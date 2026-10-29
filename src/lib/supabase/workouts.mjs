import { createAuthHandler } from "./auth.mjs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validWorkoutDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) < "2000" || value.slice(0, 4) > "2100") return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validWorkoutInput(body) {
  if (!body || typeof body !== "object" || !["load", "save", "delete", "finish"].includes(body.action)) return false;
  if (body.action === "finish") return validWorkoutDate(body.date);
  if (body.action === "delete") return typeof body.setId === "string" && uuidPattern.test(body.setId);
  if (!validWorkoutDate(body.date) || typeof body.exerciseId !== "string" || !/^[a-z][a-z0-9_]{0,79}$/.test(body.exerciseId)) return false;
  if (body.action === "load") return true;
  return typeof body.requestId === "string" && uuidPattern.test(body.requestId) &&
    typeof body.weight === "number" && Number.isFinite(body.weight) && body.weight >= 0 && body.weight <= 10000 &&
    Math.abs(body.weight * 100 - Math.round(body.weight * 100)) < 0.000001 &&
    Number.isInteger(body.reps) && body.reps >= 1 && body.reps <= 1000;
}

export function createWorkoutHandler({ env = process.env, fetcher = fetch } = {}) {
  return async function handleWorkout(request) {
    const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" };
    const error = (message, status) => Response.json({ error: message }, { status, headers });
    if (request.method !== "POST") return error("Método no permitido.", 405);
    if (request.headers.get("origin") !== new URL(request.url).origin) return error("Origen no permitido.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return error("Se requiere JSON.", 415);
    let body;
    try {
      const text = await request.text();
      if (text.length > 4096) return error("Petición demasiado grande.", 413);
      body = JSON.parse(text);
    } catch {
      return error("Petición inválida.", 400);
    }
    if (!validWorkoutInput(body)) return error("Revisa el ejercicio, los kilos y las repeticiones.", 400);
    let authorized = false;
    const handler = createAuthHandler({
      env,
      fetcher,
      onSession: async ({ accessToken, reply }) => {
        authorized = true;
        const deleting = body.action === "delete";
        const finishing = body.action === "finish";
        const path = deleting
          ? `/rest/v1/workout_sets?id=eq.${body.setId}`
          : `/rest/v1/rpc/${finishing ? "finish_workout" : body.action === "save" ? "save_workout_set" : "get_workout_session"}`;
        try {
          const response = await fetcher(new URL(path, env.SUPABASE_URL), {
            method: deleting ? "DELETE" : "POST",
            headers: {
              apikey: env.SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              ...(deleting ? { Prefer: "return=representation" } : {}),
            },
            body: deleting ? undefined : JSON.stringify({
              p_date: body.date,
              ...(!finishing ? { p_exercise_id: body.exerciseId } : {}),
              ...(body.action === "save" ? { p_weight: body.weight, p_reps: body.reps, p_request_id: body.requestId } : {}),
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) {
            if (response.status === 429) return reply({ error: "Demasiados intentos. Espera un momento." }, 429);
            if ([401, 403].includes(response.status)) return reply({ error: "Tu sesión no permite esta operación. Vuelve a iniciar sesión." }, response.status);
            const details = await response.json().catch(() => null);
            if (details?.code === "22023" || details?.code === "23503") return reply({ error: finishing ? "Registra al menos una serie y comprueba la fecha antes de finalizar." : "Los datos no son válidos o el ejercicio no está disponible." }, 400);
            if (details?.code === "23505") return reply({ error: "Otra operación ha cambiado las series. Reintenta el guardado." }, 409);
            return reply({ error: "No se ha podido completar la operación. Puedes reintentarlo sin duplicar la serie." }, 503);
          }
          const data = await response.json();
          if (deleting) return Array.isArray(data) && data.length
            ? reply({ deleted: data[0].id })
            : reply({ error: "La serie ya no está disponible." }, 404);
          const result = Array.isArray(data) ? data[0] : data;
          if (finishing) {
            if (result?.date !== body.date || typeof result.completed_at !== "string" || Number.isNaN(Date.parse(result.completed_at)) || !Number.isInteger(result.alerts_created) || result.alerts_created < 0) throw new Error("Invalid workout completion");
            return reply(result);
          }
          if (body.action === "save") {
            if (!result || typeof result.id !== "string") throw new Error("Invalid saved set");
            return reply({ saved: result }, 201);
          }
          if (!result || !Array.isArray(result.sets) || !Array.isArray(result.previous_sets)) throw new Error("Invalid workout session");
          return reply({ date: body.date, exerciseId: body.exerciseId, ...result });
        } catch {
          return reply({ error: "No se ha podido confirmar la operación. Reintenta con los mismos datos para evitar duplicados." }, 503);
        }
      },
    });
    const response = await handler(new Request(request.url, {
      method: "POST",
      headers: { origin: request.headers.get("origin"), "content-type": "application/json", cookie: request.headers.get("cookie") ?? "" },
      body: JSON.stringify({ action: "session" }),
    }));
    if (!authorized && response.ok) {
      const expiredHeaders = new Headers(response.headers);
      return Response.json({ error: "Inicia sesión para registrar tu entrenamiento." }, { status: 401, headers: expiredHeaders });
    }
    return response;
  };
}