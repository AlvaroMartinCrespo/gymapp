import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GROQ_MODEL, buildRecapPayload, cleanRecapSummary, requestGroqRecap, sanitizeRecapContext } from "../src/lib/groq.mjs";
import { createRecapSummaryHandler } from "../src/lib/supabase/recap-summary.mjs";
import { getRecapRange } from "../src/lib/recap.mjs";

const quotes = JSON.parse(readFileSync(new URL("../src/data/athlete-quotes.json", import.meta.url), "utf8"));

test("hay al menos 31 frases distintas y ninguna se repite en 31 días seguidos", () => {
  assert.ok(quotes.length >= 31);
  assert.equal(new Set(quotes.map((quote) => quote.text)).size, quotes.length);
  assert.ok(quotes.every((quote) => quote.text.trim() && quote.author.trim()));
  const start = Math.floor(Date.parse("2026-10-01T00:00:00Z") / 86400000);
  for (let offset = 0; offset < 365; offset += 1) {
    const window = Array.from({ length: 31 }, (_, day) => (start + offset + day) % quotes.length);
    assert.equal(new Set(window).size, 31);
  }
});

const date = "2026-10-29";
const range = getRecapRange(date, "week");
const exercise = { exercise: "Press de banca", category: "Pecho", current_sets: 4, previous_sets: 3, current_reps: 40, previous_reps: 30, current_max_weight: 62.5, previous_max_weight: 60, current_volume: 2500, previous_volume: 1800 };
const recapContext = {
  period: "week", range,
  current: { days: 3, sets: 12, exercises: 4, volume: 7000 },
  previous: { days: 2, sets: 9, exercises: 3, volume: 5200 },
  exercises_total: 1, exercises: [exercise],
};

test("el payload del recap usa el modelo fijo y solo datos numéricos del periodo", () => {
  const payload = buildRecapPayload({ ...recapContext, email: "private@example.test", exercises: [{ ...exercise, user_id: "private-user-id", note: "private-free-text" }] });
  assert.equal(payload.model, GROQ_MODEL);
  assert.equal(payload.include_reasoning, false);
  assert.doesNotMatch(JSON.stringify(payload), /private@example|private-user-id|private-free-text/);
  assert.match(payload.messages[0].content, /semana/);
  assert.match(payload.messages[1].content, /Press de banca/);
});

test("el contexto del recap rechaza cifras inválidas y limita ejercicios", () => {
  assert.throws(() => sanitizeRecapContext({ ...recapContext, period: "decade" }));
  assert.throws(() => sanitizeRecapContext({ ...recapContext, current: { ...recapContext.current, sets: null } }));
  assert.equal(sanitizeRecapContext({ ...recapContext, exercises: Array(30).fill(exercise) }).exercises.length, 12);
});

test("el resumen se limpia de markdown y no queda a medias", () => {
  assert.equal(cleanRecapSummary({ answer: "**Buena semana.**\n\nSubiste peso.", truncated: false }), "Buena semana. Subiste peso.");
  assert.equal(cleanRecapSummary({ answer: "Buena semana. Subiste peso y ade", truncated: true }), "Buena semana.");
});

test("requestGroqRecap devuelve solo el texto final", async () => {
  const result = await requestGroqRecap(recapContext, { apiKey: "test-secret", fetcher: async (url, options) => {
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(JSON.parse(options.body).model, GROQ_MODEL);
    return Response.json({ choices: [{ message: { content: "Buena semana, subiste peso en banca. Podrías subir un poco más.", reasoning: "private-reasoning" }, finish_reason: "stop" }] });
  } });
  assert.match(result.summary, /subiste peso/);
  assert.doesNotMatch(JSON.stringify(result), /private-reasoning|test-secret/);
  await assert.rejects(() => requestGroqRecap(recapContext, { fetcher: async () => { throw new Error("Unexpected request"); } }));
});

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", GROQ_API_KEY: "test-groq-secret" };
const user = { id: "user-1", email: "private@example.test" };
const request = (body = { date, period: "week" }, headers = {}) => new Request("https://gymapp.test/api/recap-summary", {
  method: "POST",
  headers: { origin: "https://gymapp.test", "content-type": "application/json", cookie: "gymapp-access=current", ...headers },
  body: JSON.stringify(body),
});
const recapResult = (sets = 12) => ({ profile: { id: user.id }, date, period: "week", range, current: { ...recapContext.current, sets }, previous: recapContext.previous, buckets: [], categories: [] });
const statsResult = { profile: { id: user.id }, date, period: "week", range, exercises_total: 1, exercises: [exercise] };

test("el endpoint carga recap y detalle, comprueba cuota y luego llama a Groq", async () => {
  const calls = [];
  const handler = createRecapSummaryHandler({ env, fetcher: async (target, options) => {
    const url = new URL(target);
    calls.push(url.pathname);
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    if (url.pathname.endsWith("get_workout_recap")) return Response.json(recapResult());
    if (url.pathname.endsWith("get_recap_exercise_stats")) {
      assert.deepEqual(JSON.parse(options.body), { p_date: date, p_period: "week" });
      return Response.json(statsResult);
    }
    if (url.pathname.endsWith("claim_coach_request")) return Response.json({ allowed: true });
    assert.doesNotMatch(options.body, /private@example|user-1|test-groq-secret/);
    return Response.json({ choices: [{ message: { content: "Semana sólida: subiste peso en banca." }, finish_reason: "stop" }] });
  } });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).summary, "Semana sólida: subiste peso en banca.");
  assert.deepEqual(calls, ["/auth/v1/user", "/rest/v1/rpc/get_workout_recap", "/rest/v1/rpc/get_recap_exercise_stats", "/rest/v1/rpc/claim_coach_request", "/openai/v1/chat/completions"]);
});

test("sin series en el periodo no se gasta cuota ni se llama a Groq", async () => {
  const calls = [];
  const handler = createRecapSummaryHandler({ env, fetcher: async (target) => {
    const url = new URL(target);
    calls.push(url.pathname);
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.ok(url.pathname.endsWith("get_workout_recap"));
    return Response.json(recapResult(0));
  } });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).summary, null);
  assert.equal(calls.length, 2);
});

test("sin sesión, otro origen o petición inválida no tocan base de datos ni Groq", async () => {
  let calls = 0;
  const handler = createRecapSummaryHandler({ env, fetcher: async () => { calls += 1; throw new Error("Unexpected request"); } });
  assert.equal((await handler(request(undefined, { cookie: "" }))).status, 401);
  assert.equal((await handler(request(undefined, { origin: "https://other.test" }))).status, 403);
  assert.equal((await handler(request({ date, period: "decade" }))).status, 400);
  assert.equal((await handler(request({ date: "no-date", period: "week" }))).status, 400);
  assert.ok(calls <= 1);
});

test("una cuota agotada devuelve 429 sin enviar entrenamiento a Groq", async () => {
  const handler = createRecapSummaryHandler({ env, fetcher: async (target) => {
    const url = new URL(target);
    assert.equal(url.hostname, "project.supabase.co");
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    if (url.pathname.endsWith("get_workout_recap")) return Response.json(recapResult());
    if (url.pathname.endsWith("get_recap_exercise_stats")) return Response.json(statsResult);
    return Response.json({ allowed: false, retry_after: 30 });
  } });
  const response = await handler(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "30");
});

test("datos que no pertenecen al usuario o al periodo se rechazan", async () => {
  const handler = createRecapSummaryHandler({ env, fetcher: async (target) => {
    const url = new URL(target);
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    if (url.pathname.endsWith("get_workout_recap")) return Response.json({ ...recapResult(), profile: { id: "someone-else" } });
    throw new Error("Unexpected request");
  } });
  const response = await handler(request());
  assert.equal(response.status, 503);
});
