import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkoutHandler, validWorkoutDate, validWorkoutInput } from "../src/lib/supabase/workouts.mjs";

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };
const requestId = "00000000-0000-4000-8000-000000000001";
const setId = "10000000-0000-4000-8000-000000000001";
const user = { id: "user", user_metadata: { username: "tester" } };
const payload = { action: "save", date: "2026-10-29", exerciseId: "bench_press", weight: 62.5, reps: 10, requestId };
const request = (body, headers = {}) => new Request("https://gymapp.test/api/workouts", {
  method: "POST",
  headers: { origin: "https://gymapp.test", "content-type": "application/json", cookie: "gymapp-access=current", ...headers },
  body: JSON.stringify(body),
});

test("valida fechas de calendario reales y no convierte febrero inválido a marzo", () => {
  for (const date of ["2026-02-29", "2026-04-31", "2026-2-01", "invalid", null]) assert.equal(validWorkoutDate(date), false);
  assert.equal(validWorkoutDate("2028-02-29"), true);
});

test("finalizar exige una fecha civil válida y no acepta datos de otro usuario", async () => {
  assert.equal(validWorkoutInput({ action: "finish", date: "2026-10-29" }), true);
  assert.equal(validWorkoutInput({ action: "finish", date: "2026-02-29" }), false);
  const completed = { date: "2026-10-29", completed_at: "2026-10-29T18:00:00Z", alerts_created: 1 };
  const handler = createWorkoutHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.equal(url.pathname, "/rest/v1/rpc/finish_workout");
    assert.equal(options.headers.Authorization, "Bearer current");
    assert.deepEqual(JSON.parse(options.body), { p_date: "2026-10-29" });
    return Response.json(completed);
  } });
  const response = await handler(request({ action: "finish", date: "2026-10-29", userId: "another-user" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), completed);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("no se confirma una finalización con fecha o resultado incoherentes", async () => {
  for (const result of [{ date: "2026-10-28", completed_at: "2026-10-29T18:00:00Z", alerts_created: 0 }, { date: "2026-10-29", completed_at: null, alerts_created: 0 }, { date: "2026-10-29", completed_at: "invalid", alerts_created: 0 }, { date: "2026-10-29", completed_at: "2026-10-29T18:00:00Z", alerts_created: -1 }]) {
    const handler = createWorkoutHandler({ env, fetcher: async (url) => Response.json(url.pathname === "/auth/v1/user" ? user : result) });
    assert.equal((await handler(request({ action: "finish", date: "2026-10-29" }))).status, 503);
  }
});

test("finalizar sin sesión no consulta ni modifica entrenamientos", async () => {
  const handler = createWorkoutHandler({ env, fetcher: async () => { throw new Error("Unexpected request"); } });
  assert.equal((await handler(request({ action: "finish", date: "2026-10-29" }, { cookie: "" }))).status, 401);
});

test("finalizar conserva las cookies de una sesión renovada", async () => {
  const handler = createWorkoutHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/token") return Response.json({ access_token: "renewed", refresh_token: "next", expires_in: 3600, user });
    assert.equal(url.pathname, "/rest/v1/rpc/finish_workout");
    assert.equal(options.headers.Authorization, "Bearer renewed");
    return Response.json({ date: "2026-10-29", completed_at: "2026-10-29T18:00:00Z", alerts_created: 0 });
  } });
  const response = await handler(request({ action: "finish", date: "2026-10-29" }, { cookie: "gymapp-refresh=old" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 3);
});

test("un cierre sin series se comunica sin filtrar el error de la base de datos", async () => {
  const handler = createWorkoutHandler({ env, fetcher: async (url) => url.pathname === "/auth/v1/user" ? Response.json(user) : Response.json({ code: "22023", message: "private-database-message" }, { status: 400 }) });
  const response = await handler(request({ action: "finish", date: "2026-10-29" }));
  assert.equal(response.status, 400);
  const body = await response.text();
  assert.match(body, /al menos una serie/);
  assert.doesNotMatch(body, /private-database-message/);
});

test("valida pesos, repeticiones, catálogo por ID y UUID de reintento", () => {
  assert.equal(validWorkoutInput(payload), true);
  assert.equal(validWorkoutInput({ ...payload, weight: 0 }), true);
  for (const change of [{ weight: -1 }, { weight: 12.555 }, { weight: "60" }, { weight: Infinity }, { reps: 0 }, { reps: 2.5 }, { requestId: "bad" }, { exerciseId: "bench_press&user_id=other" }]) {
    assert.equal(validWorkoutInput({ ...payload, ...change }), false);
  }
});

test("guardar usa el JWT verificado y el RPC sin aceptar la identidad del navegador", async () => {
  const handler = createWorkoutHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.equal(url.pathname, "/rest/v1/rpc/save_workout_set");
    assert.equal(options.headers.Authorization, "Bearer current");
    assert.deepEqual(JSON.parse(options.body), { p_date: payload.date, p_exercise_id: "bench_press", p_weight: 62.5, p_reps: 10, p_request_id: requestId });
    return Response.json({ id: setId, set_number: 1, weight: 62.5, reps: 10 });
  } });
  const response = await handler(request({ ...payload, userId: "another-user" }));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).saved.id, setId);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("la carga recupera series del día y datos reales de la sesión anterior", async () => {
  const snapshot = { sets: [], previous_date: "2026-10-27", previous_sets: [{ id: setId, set_number: 1, weight: 60, reps: 10 }] };
  const handler = createWorkoutHandler({ env, fetcher: async (url) => {
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.equal(url.pathname, "/rest/v1/rpc/get_workout_session");
    return Response.json(snapshot);
  } });
  const response = await handler(request({ action: "load", date: payload.date, exerciseId: payload.exerciseId }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).previous_sets, snapshot.previous_sets);
});

test("sin sesión ni origen válido no se realizan escrituras", async () => {
  let calls = 0;
  const handler = createWorkoutHandler({ env, fetcher: async () => { calls += 1; throw new Error("Unexpected request"); } });
  assert.equal((await handler(request(payload, { cookie: "" }))).status, 401);
  assert.equal((await handler(request(payload, { origin: "https://other.test" }))).status, 403);
  assert.equal((await handler(request({ ...payload, reps: 0 }))).status, 400);
  assert.equal(calls, 0);
});

test("la renovación de sesión durante un guardado devuelve las cookies al navegador", async () => {
  const handler = createWorkoutHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/token") return Response.json({ access_token: "renewed", refresh_token: "new-refresh", expires_in: 3600, user });
    assert.equal(options.headers.Authorization, "Bearer renewed");
    return Response.json([{ id: setId, set_number: 1 }]);
  } });
  const response = await handler(request(payload, { cookie: "gymapp-refresh=old" }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.getSetCookie().length, 3);
});

test("los reintentos conservan el identificador de operación", async () => {
  const identifiers = [];
  const handler = createWorkoutHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    identifiers.push(JSON.parse(options.body).p_request_id);
    if (identifiers.length === 1) throw new Error("Lost response");
    return Response.json({ id: setId });
  } });
  assert.equal((await handler(request(payload))).status, 503);
  assert.equal((await handler(request(payload))).status, 201);
  assert.deepEqual(identifiers, [requestId, requestId]);
});

test("borrar una serie usa DELETE con RLS y no expone registros", async () => {
  const handler = createWorkoutHandler({ env, fetcher: async (url, options) => {
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.equal(options.method, "DELETE");
    assert.equal(url.searchParams.get("id"), `eq.${setId}`);
    return Response.json([{ id: setId }]);
  } });
  const response = await handler(request({ action: "delete", setId }));
  assert.deepEqual(await response.json(), { deleted: setId });
});

test("los errores del proveedor no filtran detalles y conservan la opción de reintentar", async () => {
  const handler = createWorkoutHandler({ env, fetcher: async (url) => url.pathname === "/auth/v1/user"
    ? Response.json(user)
    : Response.json({ message: "private-db-details", code: "PGRST202" }, { status: 404 }) });
  const response = await handler(request(payload));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private-db-details|PGRST202|current/);
});

test("una sesión revocada devuelve 401 y conserva la eliminación de cookies", async () => {
  const handler = createWorkoutHandler({ env, fetcher: async (url) => {
    assert.match(url.pathname, /^\/auth\/v1\//);
    return Response.json({ error: "revoked" }, { status: 401 });
  } });
  const response = await handler(request(payload, { cookie: "gymapp-access=old; gymapp-refresh=revoked" }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.getSetCookie().length, 3);
  for (const cookie of response.headers.getSetCookie()) assert.match(cookie, /Max-Age=0/);
});

test("RLS no distingue entre una serie ajena y una inexistente al eliminar", async () => {
  const handler = createWorkoutHandler({ env, fetcher: async (url) => url.pathname === "/auth/v1/user"
    ? Response.json(user)
    : Response.json([]) });
  const response = await handler(request({ action: "delete", setId }));
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "La serie ya no está disponible." });
});