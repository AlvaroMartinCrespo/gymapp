import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createRankingsHandler, validRankingInput } from "../src/lib/supabase/rankings.mjs";

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };
const user = { id: "user" };
const payload = { action: "load", exerciseId: "bench_press", metric: "weight", page: 0 };
const result = { exercise_id: "bench_press", metric: "weight", page: 0, enabled: false, total: 1, entries: [{ username: "athlete", weight: 60, reps: 10, position: 1, is_me: false }], personal: { weight: 50, reps: 8, position: null } };
const request = (body = payload, headers = {}) => new Request("https://gymapp.test/api/rankings", { method: "POST", headers: { origin: "https://gymapp.test", "content-type": "application/json", cookie: "gymapp-access=current", ...headers }, body: JSON.stringify(body) });

test("rankings valida métrica, página y consentimiento explícito", () => {
  assert.ok(validRankingInput(payload));
  for (const changes of [{ metric: "volume" }, { page: -1 }, { page: 0.5 }, { exerciseId: "../profiles" }, { action: "participation", enabled: "true" }]) assert.ok(!validRankingInput({ ...payload, ...changes }));
});

test("rankings usa JWT propio, no admite identidad ni consentimiento implícito y elimina datos extra", async () => {
  const handler = createRankingsHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.equal(url.pathname, "/rest/v1/rpc/get_rankings");
    assert.equal(options.headers.Authorization, "Bearer current");
    assert.deepEqual(JSON.parse(options.body), { p_exercise_id: "bench_press", p_metric: "weight", p_page: 0 });
    return Response.json({ ...result, secret: "private", entries: result.entries.map((entry) => ({ ...entry, user_id: "private" })) });
  } });
  const response = await handler(request({ ...payload, userId: "other", enabled: true }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.deepEqual(await response.json(), result);
});

test("la participación solo envía un booleano y conserva las cookies renovadas", async () => {
  const handler = createRankingsHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/token") return Response.json({ access_token: "renewed", refresh_token: "next", expires_in: 3600, user });
    assert.equal(options.headers.Authorization, "Bearer renewed");
    assert.equal(JSON.parse(options.body).p_enabled, true);
    return Response.json({ ...result, enabled: true });
  } });
  const response = await handler(request({ ...payload, action: "participation", enabled: true }, { cookie: "gymapp-refresh=old" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 3);
});

test("rankings exige origen propio y sesión antes de acceder al agregado", async () => {
  const handler = createRankingsHandler({ env, fetcher: async () => { throw new Error("Unexpected fetch"); } });
  assert.equal((await handler(request(payload, { origin: "https://other.test" }))).status, 403);
  assert.equal((await handler(request(payload, { cookie: "" }))).status, 401);
  assert.equal((await handler(request({ ...payload, page: 10001 }))).status, 400);
});

test("retirarse envía false y no confirma un consentimiento distinto del solicitado", async () => {
  for (const enabled of [false, true]) {
    const handler = createRankingsHandler({ env, fetcher: async (url, options) => {
      if (url.pathname === "/auth/v1/user") return Response.json(user);
      assert.equal(JSON.parse(options.body).p_enabled, false);
      return Response.json({ ...result, enabled });
    } });
    assert.equal((await handler(request({ ...payload, action: "participation", enabled: false }))).status, enabled ? 503 : 200);
  }
});

test("rankings rechaza respuestas incoherentes y no expone errores privados", async () => {
  for (const changes of [{ metric: "reps" }, { entries: [{ ...result.entries[0], position: 0 }] }, { entries: [{ ...result.entries[0], username: undefined }] }, { personal: { weight: -1, reps: 10, position: null } }, { enabled: null }]) {
    const handler = createRankingsHandler({ env, fetcher: async (url) => Response.json(url.pathname === "/auth/v1/user" ? user : { ...result, ...changes }) });
    assert.equal((await handler(request())).status, 503);
  }
  const handler = createRankingsHandler({ env, fetcher: async (url) => url.pathname === "/auth/v1/user" ? Response.json(user) : Response.json({ message: "private" }, { status: 500 }) });
  assert.doesNotMatch(await (await handler(request())).text(), /private/);
});

test("rankings exige participación voluntaria, sesiones completadas y agregado limitado", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261029070000_rankings.sql", import.meta.url), "utf8");
  assert.match(sql, /rankings_enabled boolean not null default false/);
  assert.match(sql, /owner_id uuid := auth.uid\(\)/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /set rankings_enabled = p_enabled where id = owner_id/);
  assert.match(sql, /logs.completed_at is not null/);
  assert.match(sql, /from best where rankings_enabled/);
  assert.match(sql, /rank\(\) over/);
  assert.match(sql, /row_index <= \(p_page \+ 1\) \* 50/);
  assert.match(sql, /revoke all on function public.get_rankings.*from public, anon/);
  assert.doesNotMatch(sql, /grant select|grant update|avatar_url|email/);
});