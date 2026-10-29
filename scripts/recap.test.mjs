import assert from "node:assert/strict";
import { test } from "node:test";
import { getRecapRange, recapChange } from "../src/lib/recap.mjs";
import { createProfileHandler } from "../src/lib/supabase/profile.mjs";

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };
const user = { id: "00000000-0000-4000-8000-000000000001", email: "tester@example.test" };
const result = { profile: { id: user.id }, date: "2026-10-29", period: "week", range: getRecapRange("2026-10-29", "week"), current: { days: 2, sets: 4, exercises: 1, volume: 2600 }, previous: { days: 0, sets: 0, exercises: 0, volume: 0 }, buckets: [], categories: [] };
const request = (body = { action: "recap", date: result.date, period: result.period }, headers = {}) => new Request("https://gymapp.test/api/profile", {
  method: "POST", headers: { origin: "https://gymapp.test", "content-type": "application/json", cookie: "gymapp-access=current", ...headers }, body: JSON.stringify(body),
});

test("el recap semanal empieza en lunes y compara solo los días transcurridos", () => {
  assert.deepEqual(getRecapRange("2026-10-29", "week"), { current_start: "2026-10-26", current_end: "2026-10-29", previous_start: "2026-10-19", previous_end: "2026-10-22" });
  assert.deepEqual(getRecapRange("2026-01-01", "week"), { current_start: "2025-12-29", current_end: "2026-01-01", previous_start: "2025-12-22", previous_end: "2025-12-25" });
});

test("el recap mensual recorta el periodo anterior cuando es más corto", () => {
  assert.deepEqual(getRecapRange("2026-03-31", "month"), { current_start: "2026-03-01", current_end: "2026-03-31", previous_start: "2026-02-01", previous_end: "2026-02-28" });
  assert.equal(getRecapRange("2028-03-31", "month").previous_end, "2028-02-29");
  assert.equal(getRecapRange("2026-01-01", "month").previous_end, "2025-12-01");
});

test("el recap anual usa días transcurridos y respeta los años bisiestos", () => {
  assert.equal(getRecapRange("2028-02-29", "year").previous_end, "2027-03-01");
  assert.equal(getRecapRange("2028-12-31", "year").previous_end, "2027-12-31");
  assert.equal(getRecapRange("2000-01-01", "year").previous_start, "1999-01-01");
  for (const [date, period] of [["2026-02-29", "month"], ["1999-12-31", "week"], ["2101-01-01", "year"], ["2026-10-29", "day"]]) assert.throws(() => getRecapRange(date, period), RangeError);
});

test("las diferencias conservan el signo y no inventan porcentajes con base cero", () => {
  assert.deepEqual(recapChange(120, 100), { difference: 20, percent: 20 });
  assert.deepEqual(recapChange(0, 100), { difference: -100, percent: -100 });
  assert.deepEqual(recapChange(100, 0), { difference: 100, percent: null });
  assert.deepEqual(recapChange(0, 0), { difference: 0, percent: null });
  for (const value of [-1, NaN, Infinity, "10"]) assert.throws(() => recapChange(value, 1), RangeError);
});

test("la API recap usa el JWT propio y únicamente la fecha y el periodo validados", async () => {
  const handler = createProfileHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.equal(url.pathname, "/rest/v1/rpc/get_workout_recap");
    assert.equal(options.headers.Authorization, "Bearer current");
    assert.deepEqual(JSON.parse(options.body), { p_date: result.date, p_period: result.period });
    return Response.json(result);
  } });
  const response = await handler(request({ action: "recap", date: result.date, period: result.period, userId: "another-user" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), result);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("el recap exige sesión, origen propio, fecha y periodo válidos", async () => {
  let calls = 0;
  const handler = createProfileHandler({ env, fetcher: async () => { calls += 1; throw new Error("Unexpected request"); } });
  assert.equal((await handler(request(undefined, { cookie: "" }))).status, 401);
  assert.equal((await handler(request(undefined, { origin: "https://other.test" }))).status, 403);
  assert.equal((await handler(request({ action: "recap", date: result.date, period: "day" }))).status, 400);
  assert.equal((await handler(request({ action: "recap", date: "2026-02-29", period: "month" }))).status, 400);
  assert.equal(calls, 0);
});

test("el recap rechaza propietario, rangos y totales incoherentes", async () => {
  for (const invalid of [{ ...result, profile: { id: "another-user" } }, { ...result, period: "month" }, { ...result, date: "2026-10-28" }, { ...result, range: {} }, { ...result, current: { ...result.current, volume: -1 } }, { ...result, previous: null }, { ...result, buckets: null }, { ...result, categories: null }]) {
    const handler = createProfileHandler({ env, fetcher: async (url) => Response.json(url.pathname === "/auth/v1/user" ? user : invalid) });
    const response = await handler(request());
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /another-user/);
  }
});

test("renovar sesión al consultar el recap conserva las cookies", async () => {
  const handler = createProfileHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/token") return Response.json({ access_token: "renewed", refresh_token: "next", expires_in: 3600, user });
    assert.equal(options.headers.Authorization, "Bearer renewed");
    return Response.json(result);
  } });
  const response = await handler(request(undefined, { cookie: "gymapp-refresh=old" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 3);
});

test("los fallos del proveedor no filtran detalles y conservan los estados de acceso", async () => {
  for (const [providerStatus, expectedStatus] of [[401, 401], [403, 403], [429, 429], [500, 503]]) {
    const handler = createProfileHandler({ env, fetcher: async (url) => url.pathname === "/auth/v1/user" ? Response.json(user) : Response.json({ error: "private-database-details" }, { status: providerStatus }) });
    const response = await handler(request());
    assert.equal(response.status, expectedStatus);
    assert.doesNotMatch(await response.text(), /private-database-details/);
  }
});