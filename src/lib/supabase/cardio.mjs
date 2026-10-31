import { createAuthHandler } from "./auth.mjs";
import { validWorkoutDate } from "./workouts.mjs";
import { estimateCalories, validCardioFields } from "../cardio.mjs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sessionColumns = ["id", "date", "activity_type", "duration_seconds", "distance_km", "avg_hr", "max_hr", "calories", "data_source", "rpe"];

export function validCardioInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || !["list", "save", "update", "delete"].includes(body.action)) return false;
  if (body.action === "list") return true;
  if (body.action === "delete") return typeof body.sessionId === "string" && uuidPattern.test(body.sessionId);
  if (body.action === "update" && !(typeof body.sessionId === "string" && uuidPattern.test(body.sessionId))) return false;
  if (body.action === "save" && !(validWorkoutDate(body.date) && typeof body.requestId === "string" && uuidPattern.test(body.requestId))) return false;
  return validCardioFields(body);
}

/**
 * Si el usuario no da calorías se estiman en el servidor y la sesión queda como "estimated".
 * El cliente nunca elige data_source: así 'sensor' sigue reservado al servidor y no se puede
 * hacer pasar una estimación por un dato manual.
 */
export function cardioRow(body) {
  const provided = body.calories ?? null;
  const calories = provided ?? estimateCalories({ activityType: body.activityType, durationSeconds: body.durationSeconds, distanceKm: body.distanceKm ?? null });
  return {
    activity_type: body.activityType,
    duration_seconds: body.durationSeconds,
    distance_km: body.distanceKm ?? null,
    avg_hr: body.avgHr ?? null,
    max_hr: body.maxHr ?? null,
    calories,
    data_source: provided === null && calories !== null ? "estimated" : "manual",
    rpe: body.rpe ?? null,
  };
}

function validStoredSession(session) {
  return Boolean(session) && typeof session === "object" && typeof session.id === "string" &&
    typeof session.activity_type === "string" && Number.isInteger(session.duration_seconds);
}

export function createCardioHandler({ env = process.env, fetcher = fetch } = {}) {
  return async function handleCardio(request) {
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
    if (!validCardioInput(body)) return error("Revisa la actividad, la duración y los demás datos del cardio.", 400);
    let authorized = false;
    const handler = createAuthHandler({
      env,
      fetcher,
      onSession: async ({ accessToken, reply }) => {
        authorized = true;
        const { action } = body;
        const row = action === "save" || action === "update" ? cardioRow(body) : null;
        const target = action === "update" || action === "delete" ? `/rest/v1/cardio_sessions?id=eq.${body.sessionId}` : null;
        const path = target ?? `/rest/v1/rpc/${action === "save" ? "save_cardio_session" : "get_recent_cardio"}`;
        const rest = Boolean(target);
        try {
          const response = await fetcher(new URL(path, env.SUPABASE_URL), {
            method: action === "delete" ? "DELETE" : action === "update" ? "PATCH" : "POST",
            headers: {
              apikey: env.SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              ...(rest ? { Prefer: "return=representation" } : {}),
            },
            body: action === "delete" ? undefined : JSON.stringify(
              action === "update" ? row
                : action === "save" ? {
                  p_date: body.date,
                  p_activity_type: row.activity_type,
                  p_duration_seconds: row.duration_seconds,
                  p_distance_km: row.distance_km,
                  p_avg_hr: row.avg_hr,
                  p_max_hr: row.max_hr,
                  p_calories: row.calories,
                  p_data_source: row.data_source,
                  p_rpe: row.rpe,
                  p_request_id: body.requestId,
                }
                : { p_limit: 30 },
            ),
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) {
            if (response.status === 429) return reply({ error: "Demasiados intentos. Espera un momento." }, 429);
            if ([401, 403].includes(response.status)) return reply({ error: "Tu sesión no permite esta operación. Vuelve a iniciar sesión." }, response.status);
            const details = await response.json().catch(() => null);
            if (["22023", "23514", "23503"].includes(details?.code)) return reply({ error: "Los datos del cardio no son válidos." }, 400);
            if (details?.code === "23505") return reply({ error: "Otra operación ha cambiado el cardio. Reintenta el guardado." }, 409);
            return reply({ error: "No se ha podido completar la operación. Puedes reintentarlo sin duplicar la sesión." }, 503);
          }
          const data = await response.json();
          if (action === "list") {
            if (!Array.isArray(data) || !data.every((session) => validStoredSession(session) && validWorkoutDate(session.date))) throw new Error("Invalid cardio list");
            return reply({ sessions: data.map((session) => Object.fromEntries(sessionColumns.map((column) => [column, session[column] ?? null]))) });
          }
          if (action === "delete") return Array.isArray(data) && data.length
            ? reply({ deleted: data[0].id })
            : reply({ error: "La sesión ya no está disponible." }, 404);
          const result = Array.isArray(data) ? data[0] : data;
          if (action === "update" && !result) return reply({ error: "La sesión ya no está disponible." }, 404);
          if (!validStoredSession(result)) throw new Error("Invalid saved cardio session");
          return reply({ saved: result }, action === "save" ? 201 : 200);
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
      return Response.json({ error: "Inicia sesión para registrar tu cardio." }, { status: 401, headers: expiredHeaders });
    }
    return response;
  };
}
