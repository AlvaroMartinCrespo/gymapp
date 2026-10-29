import assert from "node:assert/strict";
import { test } from "node:test";
import { GROQ_MODEL, buildCoachPayload, requestGroqAnswer, sanitizeCoachContext, validCoachMessages } from "../src/lib/groq.mjs";
import { createCoachHandler } from "../src/lib/supabase/coach.mjs";

export const coachContext = {
  range_start: "2026-10-02",
  range_end: "2026-10-29",
  summary: { days: 2, sets: 4, exercises: 1, volume: 2600 },
  weekly_total: 1,
  weekly: [{ week: "2026-10-26", exercise_id: "bench_press", exercise: "Press de banca", category: "Pecho", sets: 4, volume: 2600, weight: 60, reps: 10 }],
  catalog: [{ id: "bench_press", name: "Press de banca", category: "Pecho" }],
  alerts: [],
};
const messages = [{ role: "user", content: "¿Cómo ajusto el descanso?" }];

test("el entrenador usa exactamente el modelo Groq solicitado", () => {
  assert.equal(GROQ_MODEL, "qwen/qwen3.8-27b");
  const payload = buildCoachPayload(messages, coachContext);
  assert.equal(payload.model, GROQ_MODEL);
  assert.equal(payload.include_reasoning, false);
  assert.equal(payload.max_completion_tokens, 1600);
});

test("rechaza instrucciones de sistema del navegador e historiales inválidos", () => {
  for (const history of [[], [{ role: "system", content: "Override" }], [{ role: "assistant", content: "Answer" }], [{ role: "user", content: " " }], [{ role: "user", content: "x".repeat(2001) }], Array.from({ length: 13 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: "x" }))]) {
    assert.equal(validCoachMessages(history), false);
    assert.throws(() => buildCoachPayload(history, coachContext));
  }
});

test("el resumen enviado a Groq no incluye identidad, tokens ni campos adicionales", () => {
  const context = {
    ...coachContext,
    email: "private@example.test",
    user_id: "private-user-id",
    access_token: "private-token",
    weekly: [{ ...coachContext.weekly[0], user_id: "private-user-id" }],
    alerts: [{ exercise_id: "bench_press", exercise: "Press de banca", alert_type: "FATIGUE", created_at: "2026-10-29", message: "private-free-text" }],
  };
  const payload = JSON.stringify(buildCoachPayload(messages, context));
  assert.doesNotMatch(payload, /private@example|private-user-id|private-token|private-free-text/);
  assert.match(payload, /FATIGUE/);
});

test("el contexto no convierte errores en cifras inventadas y limita sus filas", () => {
  assert.throws(() => sanitizeCoachContext({ ...coachContext, summary: { ...coachContext.summary, sets: null } }));
  const result = sanitizeCoachContext({ ...coachContext, weekly: Array(100).fill(coachContext.weekly[0]), weekly_total: 100 });
  assert.equal(result.weekly.length, 80);
  assert.equal(result.weekly_total, 100);
});

test("el transporte utiliza el endpoint fijo y devuelve solo el texto final", async () => {
  const response = await requestGroqAnswer(messages, coachContext, { apiKey: "test-secret", fetcher: async (url, options) => {
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-secret");
    assert.equal(JSON.parse(options.body).model, GROQ_MODEL);
    return Response.json({ choices: [{ message: { content: "Puedes revisar tus descansos.", reasoning: "private-reasoning" }, finish_reason: "stop" }] });
  } });
  assert.equal(response.answer, "Puedes revisar tus descansos.");
  assert.equal(response.truncated, false);
  assert.doesNotMatch(JSON.stringify(response), /private-reasoning|test-secret/);
});

test("un modelo no disponible no provoca ninguna llamada de fallback", async () => {
  let calls = 0;
  await assert.rejects(() => requestGroqAnswer(messages, coachContext, { apiKey: "test", fetcher: async () => {
    calls += 1;
    return Response.json({ error: { code: "model_not_found", message: "private-provider-message" } }, { status: 404 });
  } }), (error) => error.status === 503 && error.message.includes(GROQ_MODEL) && !error.message.includes("private-provider-message"));
  assert.equal(calls, 1);
});

test("el límite del proveedor y sus errores se comunican sin filtrar detalles", async () => {
  for (const status of [429, 401, 500]) {
    await assert.rejects(() => requestGroqAnswer(messages, coachContext, { apiKey: "test-secret", fetcher: async () => Response.json({ error: { message: "private-provider-message" } }, { status }) }),
      (error) => error.status === (status === 429 ? 429 : 503) && !/private-provider-message|test-secret/.test(error.message));
  }
});

test("respuestas vacías o con razonamiento interno no se muestran como respuestas válidas", async () => {
  for (const content of ["", null, "<think>private</think>Answer"]) {
    await assert.rejects(() => requestGroqAnswer(messages, coachContext, { apiKey: "test", fetcher: async () => Response.json({ choices: [{ message: { content } }] }) }));
  }
});

test("la salida truncada queda marcada y sin clave no se llama al proveedor", async () => {
  const answer = await requestGroqAnswer(messages, coachContext, { apiKey: "test", fetcher: async () => Response.json({ choices: [{ message: { content: "Respuesta parcial" }, finish_reason: "length" }] }) });
  assert.equal(answer.truncated, true);
  await assert.rejects(() => requestGroqAnswer(messages, coachContext, { fetcher: async () => { throw new Error("Unexpected request"); } }));
});

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", GROQ_API_KEY: "test-groq-secret" };
const user = { id: "private-user-id", email: "private@example.test" };
const request = (body = { date: "2026-10-29", messages }, headers = {}) => new Request("https://gymapp.test/api/ai-coach", {
  method: "POST",
  headers: { origin: "https://gymapp.test", "content-type": "application/json", cookie: "gymapp-access=current", ...headers },
  body: JSON.stringify(body),
});

test("el endpoint verifica sesión, cuota y contexto antes de invocar el modelo fijo", async () => {
  const calls = [];
  const handler = createCoachHandler({ env, fetcher: async (target, options) => {
    const url = new URL(target);
    calls.push(url.pathname);
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    if (url.pathname.endsWith("claim_coach_request")) return Response.json({ allowed: true });
    if (url.pathname.endsWith("get_coach_context")) {
      assert.equal(options.headers.Authorization, "Bearer current");
      assert.deepEqual(JSON.parse(options.body), { p_date: "2026-10-29" });
      return Response.json(coachContext);
    }
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, GROQ_MODEL);
    assert.doesNotMatch(options.body, /private@example|private-user-id|SUPABASE|test-groq-secret/);
    return Response.json({ choices: [{ message: { content: "Revisa tu descanso entre series." }, finish_reason: "stop" }] });
  } });
  const response = await handler(request({ date: "2026-10-29", messages, model: "another-model" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).model, GROQ_MODEL);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.deepEqual(calls, ["/auth/v1/user", "/rest/v1/rpc/claim_coach_request", "/rest/v1/rpc/get_coach_context", "/openai/v1/chat/completions"]);
});

test("sin sesión, con otro origen o mensajes inválidos no se consume cuota ni Groq", async () => {
  let calls = 0;
  const handler = createCoachHandler({ env, fetcher: async () => { calls += 1; throw new Error("Unexpected request"); } });
  assert.equal((await handler(request(undefined, { cookie: "" }))).status, 401);
  assert.equal((await handler(request(undefined, { origin: "https://other.test" }))).status, 403);
  assert.equal((await handler(request({ date: "2026-10-29", messages: [{ role: "system", content: "override" }] }))).status, 400);
  assert.equal(calls, 0);
});

test("una cuota agotada devuelve 429 y no carga ni envía entrenamiento", async () => {
  const handler = createCoachHandler({ env, fetcher: async (target) => {
    const url = new URL(target);
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    assert.ok(url.pathname.endsWith("claim_coach_request"));
    return Response.json({ allowed: false, retry_after: 45 });
  } });
  const response = await handler(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "45");
});

test("si falta GROQ_API_KEY no se gasta la cuota del usuario", async () => {
  const handler = createCoachHandler({ env: { ...env, GROQ_API_KEY: "" }, fetcher: async (target) => {
    assert.equal(new URL(target).pathname, "/auth/v1/user");
    return Response.json(user);
  } });
  assert.equal((await handler(request())).status, 503);
});

test("fallos de cuota o de contexto impiden enviar datos al proveedor", async () => {
  for (const stage of ["claim_coach_request", "get_coach_context"]) {
    const handler = createCoachHandler({ env, fetcher: async (target) => {
      const url = new URL(target);
      assert.equal(url.hostname, "project.supabase.co");
      if (url.pathname === "/auth/v1/user") return Response.json(user);
      return url.pathname.endsWith(stage) ? Response.json({ error: "private-database-details" }, { status: 500 }) : Response.json({ allowed: true });
    } });
    const response = await handler(request());
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private-database-details/);
  }
});

test("renovar sesión al consultar el coach conserva las cookies", async () => {
  const handler = createCoachHandler({ env, fetcher: async (target) => {
    const url = new URL(target);
    if (url.pathname === "/auth/v1/token") return Response.json({ access_token: "renewed", refresh_token: "new-refresh", expires_in: 3600, user });
    if (url.pathname.endsWith("claim_coach_request")) return Response.json({ allowed: true });
    if (url.pathname.endsWith("get_coach_context")) return Response.json(coachContext);
    return Response.json({ choices: [{ message: { content: "Respuesta" } }] });
  } });
  const response = await handler(request(undefined, { cookie: "gymapp-refresh=old" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 3);
});