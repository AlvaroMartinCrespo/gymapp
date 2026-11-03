import { createAuthHandler } from "./auth.mjs";
import { validWorkoutDate } from "./workouts.mjs";
import { GroqError, requestGroqRecap } from "../groq.mjs";
import { getRecapRange } from "../recap.mjs";

const PERIODS = ["week", "month", "year"];
const FIELDS = ["days", "sets", "exercises", "volume"];

function validSummary(summary) {
  return FIELDS.every((field) => typeof summary?.[field] === "number" && Number.isFinite(summary[field]) && summary[field] >= 0);
}

export function createRecapSummaryHandler({ env = process.env, fetcher = fetch } = {}) {
  return async function handleRecapSummary(request) {
    const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" };
    const error = (message, status) => Response.json({ error: message }, { status, headers });
    if (request.method !== "POST") return error("Método no permitido.", 405);
    if (request.headers.get("origin") !== new URL(request.url).origin) return error("Origen no permitido.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return error("Se requiere JSON.", 415);
    let body;
    try {
      const text = await request.text();
      if (text.length > 1024) return error("Petición demasiado grande.", 413);
      body = JSON.parse(text);
    } catch {
      return error("Petición inválida.", 400);
    }
    if (!validWorkoutDate(body?.date) || !PERIODS.includes(body?.period)) return error("Revisa la fecha o el periodo.", 400);
    let authorized = false;
    const handler = createAuthHandler({
      env,
      fetcher,
      onSession: async ({ user, accessToken, reply }) => {
        authorized = true;
        if (typeof env.GROQ_API_KEY !== "string" || !env.GROQ_API_KEY.trim()) return reply({ error: "El entrenador IA no está configurado." }, 503);
        const rpc = (name, payload) => fetcher(new URL(`/rest/v1/rpc/${name}`, env.SUPABASE_URL), {
          method: "POST",
          headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
        });
        const statusFor = (response) => [401, 403, 429].includes(response.status) ? response.status : 503;
        try {
          const range = getRecapRange(body.date, body.period);
          const recapResponse = await rpc("get_workout_recap", { p_date: body.date, p_period: body.period });
          if (!recapResponse.ok) return reply({ error: "No se ha podido cargar tu recap." }, statusFor(recapResponse));
          const recap = await recapResponse.json();
          if (recap?.profile?.id !== user.id || recap.date !== body.date || recap.period !== body.period ||
              !Object.entries(range).every(([field, value]) => recap.range?.[field] === value) ||
              !validSummary(recap.current) || !validSummary(recap.previous)) {
            throw new Error("Invalid workout recap");
          }
          // Sin series no hay nada que resumir: no se gasta cuota ni se llama a Groq.
          if (recap.current.sets === 0) return reply({ summary: null, period: body.period, date: body.date });

          const statsResponse = await rpc("get_recap_exercise_stats", { p_date: body.date, p_period: body.period });
          if (!statsResponse.ok) return reply({ error: "No se ha podido cargar el detalle de tus ejercicios." }, statusFor(statsResponse));
          const stats = await statsResponse.json();
          if (stats?.profile?.id !== user.id || stats.date !== body.date || stats.period !== body.period ||
              !Object.entries(range).every(([field, value]) => stats.range?.[field] === value) || !Array.isArray(stats.exercises)) {
            throw new Error("Invalid recap exercise stats");
          }

          const quotaResponse = await rpc("claim_coach_request", {});
          if (!quotaResponse.ok) return reply({ error: "No se ha podido comprobar el límite de uso del entrenador." }, statusFor(quotaResponse));
          const quota = await quotaResponse.json();
          if (quota?.allowed === false) {
            const retryAfter = typeof quota.retry_after === "number" && Number.isFinite(quota.retry_after)
              ? Math.max(1, Math.min(86400, Math.ceil(quota.retry_after))) : 60;
            const response = reply({ error: "Has alcanzado el límite de consultas. Reintenta más tarde.", retryAfter }, 429);
            response.headers.set("Retry-After", String(retryAfter));
            return response;
          }
          if (quota?.allowed !== true) throw new Error("Invalid quota response");

          const result = await requestGroqRecap({
            period: body.period,
            range,
            current: recap.current,
            previous: recap.previous,
            exercises_total: stats.exercises_total,
            exercises: stats.exercises,
          }, { apiKey: env.GROQ_API_KEY, fetcher, signal: request.signal });
          return reply({ summary: result.summary, model: result.model, period: body.period, date: body.date });
        } catch (failure) {
          return failure instanceof GroqError
            ? reply({ error: failure.message }, failure.status)
            : reply({ error: "No se ha podido generar el resumen. Inténtalo más tarde." }, 503);
        }
      },
    });
    const response = await handler(new Request(request.url, {
      method: "POST",
      headers: { origin: request.headers.get("origin"), "content-type": "application/json", cookie: request.headers.get("cookie") ?? "" },
      body: JSON.stringify({ action: "session" }),
    }));
    return !authorized && response.ok
      ? Response.json({ error: "Inicia sesión para ver el resumen." }, { status: 401, headers: response.headers })
      : response;
  };
}
