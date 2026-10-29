import { createAuthHandler } from "./auth.mjs";
import { validWorkoutDate } from "./workouts.mjs";
import { GroqError, requestGroqAnswer, validCoachMessages } from "../groq.mjs";

export function createCoachHandler({ env = process.env, fetcher = fetch } = {}) {
  return async function handleCoach(request) {
    const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" };
    const error = (message, status) => Response.json({ error: message }, { status, headers });
    if (request.method !== "POST") return error("Método no permitido.", 405);
    if (request.headers.get("origin") !== new URL(request.url).origin) return error("Origen no permitido.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return error("Se requiere JSON.", 415);
    let body;
    try {
      const text = await request.text();
      if (text.length > 65000) return error("Petición demasiado grande.", 413);
      body = JSON.parse(text);
    } catch {
      return error("Petición inválida.", 400);
    }
    if (!validWorkoutDate(body?.date) || !validCoachMessages(body?.messages)) return error("Revisa el mensaje o inicia una conversación nueva.", 400);
    let authorized = false;
    const handler = createAuthHandler({
      env,
      fetcher,
      onSession: async ({ accessToken, reply }) => {
        authorized = true;
        if (typeof env.GROQ_API_KEY !== "string" || !env.GROQ_API_KEY.trim()) return reply({ error: "El entrenador IA no está configurado." }, 503);
        const rpc = (name, payload) => fetcher(new URL(`/rest/v1/rpc/${name}`, env.SUPABASE_URL), {
          method: "POST",
          headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
        });
        try {
          const quotaResponse = await rpc("claim_coach_request", {});
          if (!quotaResponse.ok) return reply({ error: "No se ha podido comprobar el límite de uso del entrenador." }, [401, 403, 429].includes(quotaResponse.status) ? quotaResponse.status : 503);
          const quota = await quotaResponse.json();
          if (quota?.allowed === false) {
            const retryAfter = typeof quota.retry_after === "number" && Number.isFinite(quota.retry_after)
              ? Math.max(1, Math.min(86400, Math.ceil(quota.retry_after))) : 60;
            const response = reply({ error: "Has alcanzado el límite de consultas. Reintenta más tarde.", retryAfter }, 429);
            response.headers.set("Retry-After", String(retryAfter));
            return response;
          }
          if (quota?.allowed !== true) throw new Error("Invalid quota response");
          const contextResponse = await rpc("get_coach_context", { p_date: body.date });
          if (!contextResponse.ok) return reply({ error: "No se ha podido cargar tu resumen de entrenamiento." }, [401, 403, 429].includes(contextResponse.status) ? contextResponse.status : 503);
          const context = await contextResponse.json();
          const answer = await requestGroqAnswer(body.messages, context, { apiKey: env.GROQ_API_KEY, fetcher, signal: request.signal });
          return reply({ ...answer, contextFrom: context.range_start, contextTo: context.range_end });
        } catch (failure) {
          return failure instanceof GroqError
            ? reply({ error: failure.message }, failure.status)
            : reply({ error: "No se ha podido completar la consulta. Inténtalo más tarde." }, 503);
        }
      },
    });
    const response = await handler(new Request(request.url, {
      method: "POST",
      headers: { origin: request.headers.get("origin"), "content-type": "application/json", cookie: request.headers.get("cookie") ?? "" },
      body: JSON.stringify({ action: "session" }),
    }));
    return !authorized && response.ok
      ? Response.json({ error: "Inicia sesión para consultar al entrenador." }, { status: 401, headers: response.headers })
      : response;
  };
}