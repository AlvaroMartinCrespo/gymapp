import assert from "node:assert/strict";
import { test } from "node:test";
import { CARDIO_ACTIVITY_IDS, estimateCalories, formatCardioDuration, validCardioFields } from "../src/lib/cardio.mjs";
import { cardioRow, createCardioHandler, validCardioInput } from "../src/lib/supabase/cardio.mjs";

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };
const requestId = "00000000-0000-4000-8000-000000000001";
const sessionId = "20000000-0000-4000-8000-000000000001";
const user = { id: "user", user_metadata: { username: "tester" } };
const save = { action: "save", date: "2026-10-31", activityType: "running", durationSeconds: 1800, distanceKm: 5, avgHr: 150, maxHr: 175, calories: null, rpe: 7, requestId };
const request = (body, headers = {}) => new Request("https://gymapp.test/api/cardio", {
  method: "POST",
  headers: { origin: "https://gymapp.test", "content-type": "application/json", cookie: "gymapp-access=current", ...headers },
  body: JSON.stringify(body),
});
const withUser = (handle) => async (url, options) => url.pathname === "/auth/v1/user" ? Response.json(user) : handle(url, options);

test("el catálogo del selector coincide con el del esquema y la migración", async () => {
  const { readFileSync } = await import("node:fs");
  const schema = readFileSync(new URL("../src/db/schema.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/20261031000000_cardio_sessions.sql", import.meta.url), "utf8");
  assert.equal(CARDIO_ACTIVITY_IDS.length, 8);
  for (const id of CARDIO_ACTIVITY_IDS) {
    assert.ok(schema.includes(`"${id}"`), id);
    assert.ok(migration.includes(`'${id}'`), id);
  }
});

test("la estimación de calorías usa MET, peso y duración, y refina con la velocidad", () => {
  // 70 kg, 1 h, bici estática (MET 7) = 490 kcal
  assert.equal(estimateCalories({ activityType: "stationary_bike", durationSeconds: 3600 }), 490);
  assert.equal(estimateCalories({ activityType: "stationary_bike", durationSeconds: 3600, weightKg: 100 }), 700);
  // 8 km en 1 h caminando a 8 km/h no puede quedar por debajo de caminar a 4 km/h
  const slow = estimateCalories({ activityType: "walking", durationSeconds: 3600, distanceKm: 4 });
  const fast = estimateCalories({ activityType: "walking", durationSeconds: 3600, distanceKm: 6 });
  assert.ok(fast > slow);
  // correr a 8 km/h (MET 8,3) durante 30 min con 70 kg = 290,5 → 291 kcal
  assert.equal(estimateCalories({ activityType: "running", durationSeconds: 1800, distanceKm: 4 }), 291);
  // la distancia no afecta a actividades sin velocidad en tierra
  assert.equal(estimateCalories({ activityType: "rowing", durationSeconds: 3600, distanceKm: 3 }), estimateCalories({ activityType: "rowing", durationSeconds: 3600 }));
});

test("la estimación rechaza datos que no valen en vez de inventar un número", () => {
  assert.equal(estimateCalories({ activityType: "skiing", durationSeconds: 600 }), null);
  assert.equal(estimateCalories({ activityType: "running", durationSeconds: 0 }), null);
  assert.equal(estimateCalories({ activityType: "running", durationSeconds: 90000 }), null);
  assert.equal(estimateCalories({ activityType: "running", durationSeconds: 600, weightKg: -1 }), null);
});

test("valida los campos con los mismos límites que la base de datos", () => {
  const ok = { activityType: "running", durationSeconds: 600 };
  assert.equal(validCardioFields(ok), true);
  assert.equal(validCardioFields({ ...ok, distanceKm: 0.001, avgHr: 30, maxHr: 30, calories: 0, rpe: 1 }), true);
  for (const change of [
    { activityType: "skiing" }, { durationSeconds: 0 }, { durationSeconds: 86401 }, { durationSeconds: 60.5 },
    { distanceKm: 0 }, { distanceKm: 1001 }, { distanceKm: 1.2345 }, { distanceKm: "5" },
    { avgHr: 29 }, { maxHr: 251 }, { avgHr: 160, maxHr: 150 }, { calories: -1 }, { calories: 20001 }, { rpe: 0 }, { rpe: 11 }, { rpe: 5.5 },
  ]) assert.equal(validCardioFields({ ...ok, ...change }), false, JSON.stringify(change));
});

test("formatea la duración", () => {
  assert.equal(formatCardioDuration(2700), "45 min");
  assert.equal(formatCardioDuration(3900), "1 h 05 min");
  assert.equal(formatCardioDuration(30), "0 min 30 s");
});

test("las peticiones validan acción, fecha, UUIDs y campos", () => {
  assert.equal(validCardioInput({ action: "list" }), true);
  assert.equal(validCardioInput(save), true);
  assert.equal(validCardioInput({ ...save, action: "update", sessionId }), true);
  assert.equal(validCardioInput({ action: "delete", sessionId }), true);
  for (const bad of [null, [], { action: "other" }, { ...save, date: "2026-02-30" }, { ...save, requestId: "x" }, { ...save, action: "update" }, { ...save, durationSeconds: -5 }, { action: "delete", sessionId: "x&user_id=eq.other" }]) {
    assert.equal(validCardioInput(bad), false, JSON.stringify(bad));
  }
});

test("sin calorías se estiman y quedan como 'estimated'; con calorías son 'manual'", () => {
  const estimated = cardioRow(save);
  assert.equal(estimated.data_source, "estimated");
  assert.equal(estimated.calories, estimateCalories({ activityType: "running", durationSeconds: 1800, distanceKm: 5 }));
  const manual = cardioRow({ ...save, calories: 333 });
  assert.equal(manual.data_source, "manual");
  assert.equal(manual.calories, 333);
  assert.equal(cardioRow({ ...save, calories: 0 }).data_source, "manual");
});

test("guardar usa el JWT verificado y el RPC; el cliente no puede elegir data_source ni identidad", async () => {
  const expected = cardioRow(save);
  const handler = createCardioHandler({ env, fetcher: withUser(async (url, options) => {
    assert.equal(url.pathname, "/rest/v1/rpc/save_cardio_session");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer current");
    assert.deepEqual(JSON.parse(options.body), {
      p_date: "2026-10-31", p_activity_type: "running", p_duration_seconds: 1800, p_distance_km: 5, p_avg_hr: 150, p_max_hr: 175,
      p_calories: expected.calories, p_data_source: "estimated", p_rpe: 7, p_request_id: requestId,
    });
    return Response.json({ id: sessionId, activity_type: "running", duration_seconds: 1800 });
  }) });
  const response = await handler(request({ ...save, userId: "another-user", dataSource: "sensor", data_source: "sensor" }));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).saved.id, sessionId);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("editar hace PATCH solo de las columnas permitidas sobre esa sesión", async () => {
  const handler = createCardioHandler({ env, fetcher: withUser(async (url, options) => {
    assert.equal(url.pathname, "/rest/v1/cardio_sessions");
    assert.equal(url.searchParams.get("id"), `eq.${sessionId}`);
    assert.equal(options.method, "PATCH");
    const sent = JSON.parse(options.body);
    assert.deepEqual(Object.keys(sent).sort(), ["activity_type", "avg_hr", "calories", "data_source", "distance_km", "duration_seconds", "max_hr", "rpe"]);
    assert.equal(sent.data_source, "manual");
    assert.equal(sent.calories, 400);
    return Response.json([{ id: sessionId, activity_type: "running", duration_seconds: 1800 }]);
  }) });
  const response = await handler(request({ ...save, action: "update", sessionId, calories: 400, date: undefined, requestId: undefined }));
  assert.equal(response.status, 200);
});

test("editar o borrar una sesión inexistente o ajena devuelve 404", async () => {
  const handler = createCardioHandler({ env, fetcher: withUser(async () => Response.json([])) });
  assert.equal((await handler(request({ ...save, action: "update", sessionId }))).status, 404);
  assert.equal((await handler(request({ action: "delete", sessionId }))).status, 404);
});

test("borrar elimina solo la sesión indicada", async () => {
  const handler = createCardioHandler({ env, fetcher: withUser(async (url, options) => {
    assert.equal(options.method, "DELETE");
    assert.equal(url.searchParams.get("id"), `eq.${sessionId}`);
    return Response.json([{ id: sessionId }]);
  }) });
  const response = await handler(request({ action: "delete", sessionId }));
  assert.deepEqual(await response.json(), { deleted: sessionId });
});

test("el listado devuelve solo las columnas conocidas y rechaza respuestas incoherentes", async () => {
  const row = { id: sessionId, date: "2026-10-31", activity_type: "walking", duration_seconds: 900, distance_km: 1.2, avg_hr: null, max_hr: null, calories: 50, data_source: "estimated", rpe: null, secret: "x" };
  const ok = createCardioHandler({ env, fetcher: withUser(async (url, options) => {
    assert.equal(url.pathname, "/rest/v1/rpc/get_recent_cardio");
    assert.deepEqual(JSON.parse(options.body), { p_limit: 30 });
    return Response.json([row]);
  }) });
  const response = await ok(request({ action: "list" }));
  const { sessions } = await response.json();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].secret, undefined);
  for (const broken of [{ error: "x" }, [{ ...row, date: "bad" }], [{ ...row, id: 5 }]]) {
    const handler = createCardioHandler({ env, fetcher: withUser(async () => Response.json(broken)) });
    assert.equal((await handler(request({ action: "list" }))).status, 503);
  }
});

test("los errores de la base de datos no se filtran y se clasifican", async () => {
  for (const [code, status] of [["22023", 400], ["23514", 400], ["23505", 409], ["XX000", 503]]) {
    const handler = createCardioHandler({ env, fetcher: withUser(async () => Response.json({ code, message: "private-database-message" }, { status: 400 })) });
    const response = await handler(request(save));
    assert.equal(response.status, status, code);
    assert.doesNotMatch(await response.text(), /private-database-message/);
  }
});

test("sin sesión, con otro origen o con datos inválidos no se toca la base de datos", async () => {
  let calls = 0;
  const handler = createCardioHandler({ env, fetcher: async () => { calls += 1; throw new Error("Unexpected request"); } });
  assert.equal((await handler(request(save, { cookie: "" }))).status, 401);
  assert.equal((await handler(request(save, { origin: "https://other.test" }))).status, 403);
  assert.equal((await handler(request({ ...save, durationSeconds: 0 }))).status, 400);
  assert.equal((await handler(new Request("https://gymapp.test/api/cardio", { method: "GET" }))).status, 405);
  assert.equal(calls, 0);
});
