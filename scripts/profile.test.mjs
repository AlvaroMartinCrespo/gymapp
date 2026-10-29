import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createProfileHandler, normalizeAvatarUrl } from "../src/lib/supabase/profile.mjs";
import { calendarCells, localHistoryDate, shiftHistoryMonth } from "../src/lib/history.ts";

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };
const user = { id: "00000000-0000-4000-8000-000000000001", email: "tester@example.test", user_metadata: { username: "tester" } };
const profile = { id: user.id, username: "tester", avatar_url: null, created_at: "2026-10-29T12:00:00Z" };
const overview = { profile, summary: { days: 0, sets: 0, exercises: 0, volume: 0 }, activity: [], recent_days: [], best_marks: [] };
const alertId = "40000000-0000-4000-8000-000000000001";
const history = { profile: { id: user.id }, month: "2026-10-01", date: "2026-10-29", summary: { days: 1, sets: 2, exercises: 1, volume: 1200 }, days: [{ date: "2026-10-29", sets: 2, volume: 1200 }], sets: [
  { id: "first-set", exercise_id: "bench_press", name: "Press de banca", category: "Pecho", set_number: 1, weight: 60, reps: 10 },
  { id: "second-set", exercise_id: "bench_press", name: "Press de banca", category: "Pecho", set_number: 2, weight: 60, reps: 10 },
] };
const request = (body, headers = {}) => new Request("https://gymapp.test/api/profile", {
  method: "POST",
  headers: { origin: "https://gymapp.test", "content-type": "application/json", cookie: "gymapp-access=current", ...headers },
  body: JSON.stringify(body),
});

test("el calendario mantiene 42 casillas y semanas de lunes a domingo", () => {
  const october = calendarCells("2026-10-29");
  assert.equal(october.length, 42);
  assert.deepEqual(october.slice(0, 4), [null, null, null, "2026-10-01"]);
  assert.equal(october.filter(Boolean).length, 31);
  assert.equal(calendarCells("2026-06-15")[0], "2026-06-01");
  assert.equal(calendarCells("2026-11-15")[6], "2026-11-01");
});

test("el calendario respeta años bisiestos y no normaliza fechas inválidas", () => {
  assert.equal(calendarCells("2028-02-29").filter(Boolean).length, 29);
  assert.equal(calendarCells("2100-02-28").filter(Boolean).length, 28);
  for (const date of ["2026-02-29", "2100-02-29", "2026-04-31", "1999-12-31", "2101-01-01", "not-a-date"]) assert.throws(() => calendarCells(date), RangeError);
});

test("la navegación mensual cruza años y conserva los límites de fechas", () => {
  assert.equal(shiftHistoryMonth("2026-01-31", 1), "2026-02-01");
  assert.equal(shiftHistoryMonth("2026-12-15", 1), "2027-01-01");
  assert.equal(shiftHistoryMonth("2026-01-15", -1), "2025-12-01");
  assert.equal(shiftHistoryMonth("2000-01-01", -1), null);
  assert.equal(shiftHistoryMonth("2100-12-31", 1), null);
});

test("la fecha de historial usa el día local y no una conversión UTC", () => {
  assert.equal(localHistoryDate(new Date(2026, 9, 29, 0, 5)), "2026-10-29");
});

test("las frases son breves, están atribuidas y se almacenan en JSON válido", () => {
  const quotes = JSON.parse(readFileSync(new URL("../src/data/athlete-quotes.json", import.meta.url), "utf8"));
  assert.ok(quotes.length >= 2);
  for (const quote of quotes) {
    assert.ok(typeof quote.text === "string" && quote.text.length > 0 && quote.text.length <= 90);
    assert.ok(typeof quote.author === "string" && quote.author.length > 0);
  }
});

test("las alertas se consultan con JWT propio y sin aceptar identidad del navegador", async () => {
  const alerts = [{ id: alertId, exercise: "Press de banca", alert_type: "STAGNATION", message: "Posible estancamiento" }];
  const handler = createProfileHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.equal(url.pathname, "/rest/v1/rpc/get_training_alerts");
    assert.equal(options.headers.Authorization, "Bearer current");
    assert.deepEqual(JSON.parse(options.body), {});
    return Response.json({ profile_id: user.id, alerts });
  } });
  const response = await handler(request({ action: "alerts", userId: "another-user" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { alerts });
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("marcar un aviso como leído solo permite cambiar is_read del propietario", async () => {
  const handler = createProfileHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.equal(url.pathname, "/rest/v1/ai_alerts");
    assert.equal(options.method, "PATCH");
    assert.equal(url.searchParams.get("id"), `eq.${alertId}`);
    assert.equal(url.searchParams.get("user_id"), `eq.${user.id}`);
    assert.deepEqual(JSON.parse(options.body), { is_read: true });
    return Response.json([{ id: alertId, is_read: true }]);
  } });
  const response = await handler(request({ action: "readAlert", alertId, userId: "another-user", message: "override" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { read: alertId });
});

test("no se exponen avisos ajenos ni se distingue un aviso ajeno de uno inexistente", async () => {
  const handler = createProfileHandler({ env, fetcher: async (url) => Response.json(url.pathname === "/auth/v1/user" ? user : { profile_id: "another-user", alerts: [{ message: "private-alert" }] }) });
  const response = await handler(request({ action: "alerts" }));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private-alert|another-user/);
  const empty = createProfileHandler({ env, fetcher: async (url) => Response.json(url.pathname === "/auth/v1/user" ? user : []) });
  assert.equal((await empty(request({ action: "readAlert", alertId }))).status, 404);
});

test("las alertas exigen sesión, UUID válido y el origen propio", async () => {
  let calls = 0;
  const handler = createProfileHandler({ env, fetcher: async () => { calls += 1; throw new Error("Unexpected request"); } });
  assert.equal((await handler(request({ action: "alerts" }, { cookie: "" }))).status, 401);
  assert.equal((await handler(request({ action: "alerts" }, { origin: "https://other.test" }))).status, 403);
  assert.equal((await handler(request({ action: "readAlert", alertId: "bad" }))).status, 400);
  assert.equal(calls, 0);
});

test("la foto admite HTTPS sin credenciales y puede eliminarse", () => {
  assert.equal(normalizeAvatarUrl("  https://images.example.test/photo.png  "), "https://images.example.test/photo.png");
  assert.equal(normalizeAvatarUrl(""), null);
  assert.equal(normalizeAvatarUrl(null), null);
  for (const value of ["http://example.test/photo", "javascript:alert(1)", "data:image/png;base64,test", "https://user:pass@example.test/photo", "https://example.test/\nphoto", "not-a-url", 12, undefined, "https://example.test/" + "x".repeat(2048)]) {
    assert.throws(() => normalizeAvatarUrl(value));
  }
});

test("el resumen se consulta con el JWT del usuario y no se cachea", async () => {
  const handler = createProfileHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.equal(url.pathname, "/rest/v1/rpc/get_profile_overview");
    assert.equal(options.headers.Authorization, "Bearer current");
    assert.deepEqual(JSON.parse(options.body), { p_date: "2026-10-29" });
    return Response.json(overview);
  } });
  const response = await handler(request({ action: "load", date: "2026-10-29" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).email, user.email);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("el historial mensual y las series del dia se consultan con el JWT propio", async () => {
  const handler = createProfileHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.equal(url.pathname, "/rest/v1/rpc/get_workout_history");
    assert.equal(options.headers.Authorization, "Bearer current");
    assert.deepEqual(JSON.parse(options.body), { p_date: "2026-10-29" });
    return Response.json(history);
  } });
  const response = await handler(request({ action: "history", date: "2026-10-29", userId: "another-user" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), history);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("el historial no inventa series en meses vacios", async () => {
  const empty = { ...history, summary: overview.summary, days: [], sets: [] };
  const handler = createProfileHandler({ env, fetcher: async (url) => Response.json(url.pathname === "/auth/v1/user" ? user : empty) });
  const response = await handler(request({ action: "history", date: history.date }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).sets, []);
});

test("el historial rechaza datos de otro usuario, fecha, mes o estructura", async () => {
  for (const invalid of [{ ...history, profile: { id: "another-user" } }, { ...history, date: "2026-10-28" }, { ...history, month: "2026-09-01" }, { ...history, days: null }, { ...history, sets: null }, { ...history, summary: { ...history.summary, volume: -1 } }]) {
    const handler = createProfileHandler({ env, fetcher: async (url) => Response.json(url.pathname === "/auth/v1/user" ? user : invalid) });
    const response = await handler(request({ action: "history", date: history.date }));
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /another-user/);
  }
});

test("el historial exige sesion, origen propio y fecha civil valida", async () => {
  let calls = 0;
  const handler = createProfileHandler({ env, fetcher: async () => { calls += 1; throw new Error("Unexpected request"); } });
  assert.equal((await handler(request({ action: "history", date: history.date }, { cookie: "" }))).status, 401);
  assert.equal((await handler(request({ action: "history", date: history.date }, { origin: "https://other.test" }))).status, 403);
  assert.equal((await handler(request({ action: "history", date: "2026-02-29" }))).status, 400);
  assert.equal(calls, 0);
});

test("el historial conserva las cookies al renovar una sesion", async () => {
  const handler = createProfileHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/token") return Response.json({ access_token: "renewed", refresh_token: "next", expires_in: 3600, user });
    assert.equal(options.headers.Authorization, "Bearer renewed");
    return Response.json(history);
  } });
  const response = await handler(request({ action: "history", date: history.date }, { cookie: "gymapp-refresh=old" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 3);
});

test("editar el avatar solo modifica el perfil verificado y no descarga la imagen", async () => {
  let calls = 0;
  const handler = createProfileHandler({ env, fetcher: async (url, options) => {
    calls += 1;
    assert.equal(url.hostname, "project.supabase.co");
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.equal(options.method, "PATCH");
    assert.equal(url.searchParams.get("id"), `eq.${user.id}`);
    assert.deepEqual(JSON.parse(options.body), { avatar_url: "https://images.example.test/photo.png" });
    return Response.json([{ ...profile, avatar_url: "https://images.example.test/photo.png" }]);
  } });
  const response = await handler(request({ action: "avatar", avatarUrl: "https://images.example.test/photo.png", userId: "another-user" }));
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("eliminar el avatar guarda null sin afectar otros campos", async () => {
  const handler = createProfileHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.deepEqual(JSON.parse(options.body), { avatar_url: null });
    return Response.json([profile]);
  } });
  assert.equal((await handler(request({ action: "avatar", avatarUrl: "" }))).status, 200);
});

test("sin sesión, con fecha inválida o desde otro origen no se consulta el perfil", async () => {
  let calls = 0;
  const handler = createProfileHandler({ env, fetcher: async () => { calls += 1; throw new Error("Unexpected request"); } });
  assert.equal((await handler(request({ action: "load", date: "2026-10-29" }, { cookie: "" }))).status, 401);
  assert.equal((await handler(request({ action: "load", date: "2026-02-29" }))).status, 400);
  assert.equal((await handler(request({ action: "avatar", avatarUrl: "https://image.test" }, { origin: "https://other.test" }))).status, 403);
  assert.equal((await handler(request({ action: "avatar" }))).status, 400);
  assert.equal(calls, 0);
});

test("la renovación de sesión conserva las cookies al devolver el perfil", async () => {
  const handler = createProfileHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/token") return Response.json({ access_token: "renewed", refresh_token: "refresh", expires_in: 3600, user });
    assert.equal(options.headers.Authorization, "Bearer renewed");
    return Response.json(overview);
  } });
  const response = await handler(request({ action: "load", date: "2026-10-29" }, { cookie: "gymapp-refresh=old" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 3);
});

test("no se acepta una respuesta que contenga el perfil de otra persona", async () => {
  const handler = createProfileHandler({ env, fetcher: async (url) => url.pathname === "/auth/v1/user"
    ? Response.json(user)
    : Response.json({ ...overview, profile: { ...profile, id: "other-user" } }) });
  const response = await handler(request({ action: "load", date: "2026-10-29" }));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /other-user|tester@example/);
});

test("los fallos del proveedor no filtran detalles y mantienen los errores transitorios", async () => {
  for (const status of [429, 500]) {
    const handler = createProfileHandler({ env, fetcher: async (url) => url.pathname === "/auth/v1/user"
      ? Response.json(user)
      : Response.json({ message: "private-db-information" }, { status }) });
    const response = await handler(request({ action: "load", date: "2026-10-29" }));
    assert.equal(response.status, status === 429 ? 429 : 503);
    assert.doesNotMatch(await response.text(), /private-db-information/);
  }
});