import { createAuthHandler } from "./auth.mjs";
import { validWorkoutDate } from "./workouts.mjs";
import { getRecapRange } from "../recap.mjs";
import { validHeat } from "../../../public/anatomy/muscles.mjs";

export function normalizeAvatarUrl(value) {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Invalid avatar URL");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2048 || /\s/.test(trimmed)) throw new Error("Invalid avatar URL");
  const url = new URL(trimmed);
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error("Invalid avatar URL");
  return url.href;
}

function validInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  if (body.action === "alerts") return true;
  if (body.action === "readAlert") return typeof body.alertId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.alertId);
  if (["load", "history"].includes(body.action)) return validWorkoutDate(body.date);
  if (body.action === "recap") return validWorkoutDate(body.date) && ["week", "month", "year"].includes(body.period);
  if (body.action !== "avatar") return false;
  try {
    normalizeAvatarUrl(body.avatarUrl);
    return true;
  } catch {
    return false;
  }
}

export function createProfileHandler({ env = process.env, fetcher = fetch } = {}) {
  return async function handleProfile(request) {
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
    if (!validInput(body)) return error("Revisa la fecha o introduce una URL HTTPS válida y sin credenciales.", 400);
    let authorized = false;
    const handler = createAuthHandler({
      env,
      fetcher,
      onSession: async ({ user, accessToken, reply }) => {
        authorized = true;
        const updating = body.action === "avatar";
        const history = body.action === "history";
        const recap = body.action === "recap";
        const alerts = body.action === "alerts";
        const readingAlert = body.action === "readAlert";
        const rpc = { load: "get_profile_overview", history: "get_workout_history", recap: "get_workout_recap", alerts: "get_training_alerts" };
        const url = new URL(updating ? "/rest/v1/profiles" : readingAlert ? "/rest/v1/ai_alerts" : `/rest/v1/rpc/${rpc[body.action]}`, env.SUPABASE_URL);
        if (updating) {
          url.searchParams.set("id", `eq.${user.id}`);
          url.searchParams.set("select", "id,username,avatar_url,created_at");
        }
        if (readingAlert) {
          url.searchParams.set("id", `eq.${body.alertId}`);
          url.searchParams.set("user_id", `eq.${user.id}`);
          url.searchParams.set("select", "id,is_read");
        }
        try {
          const response = await fetcher(url, {
            method: updating || readingAlert ? "PATCH" : "POST",
            headers: {
              apikey: env.SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              ...(updating || readingAlert ? { Prefer: "return=representation" } : {}),
            },
            body: JSON.stringify(updating ? { avatar_url: normalizeAvatarUrl(body.avatarUrl) } : readingAlert ? { is_read: true } : alerts ? {} : { p_date: body.date, ...(recap ? { p_period: body.period } : {}) }),
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) {
            if (response.status === 429) return reply({ error: "Demasiados intentos. Espera un momento." }, 429);
            if ([401, 403].includes(response.status)) return reply({ error: "Vuelve a iniciar sesión para acceder a tu perfil." }, response.status);
            return reply({ error: "No se ha podido completar la operación del perfil. Inténtalo más tarde." }, 503);
          }
          const result = await response.json();
          if (readingAlert) {
            const alert = Array.isArray(result) ? result[0] : null;
            if (!alert) return reply({ error: "El aviso ya no está disponible." }, 404);
            if (alert.id !== body.alertId || alert.is_read !== true) throw new Error("Invalid alert update");
            return reply({ read: alert.id });
          }
          if (alerts) {
            if (result?.profile_id !== user.id || !Array.isArray(result.alerts)) throw new Error("Invalid training alerts");
            return reply({ alerts: result.alerts });
          }
          if (updating) {
            const profile = Array.isArray(result) ? result[0] : null;
            if (!profile) return reply({ error: "Tu perfil no está disponible." }, 404);
            if (profile.id !== user.id) throw new Error("Unexpected profile");
            return reply({ profile });
          }
          if (!result?.profile) return reply({ error: "Tu perfil no está disponible." }, 404);
          if (recap) {
            const range = getRecapRange(body.date, body.period);
            const validSummary = (summary) => ["days", "sets", "exercises", "volume"].every((field) => typeof summary?.[field] === "number" && Number.isFinite(summary[field]) && summary[field] >= 0);
            if (result.profile.id !== user.id || result.date !== body.date || result.period !== body.period ||
                !Object.entries(range).every(([field, value]) => result.range?.[field] === value) ||
                !validSummary(result.current) || !validSummary(result.previous) || !Array.isArray(result.buckets) || !Array.isArray(result.categories) ||
                (result.muscles !== undefined && (!Array.isArray(result.muscles) || validHeat(result.muscles).length !== result.muscles.length ||
                  new Set(result.muscles.map((row) => row.mesh)).size !== result.muscles.length))) {
              throw new Error("Invalid workout recap");
            }
            return reply(result);
          }
          if (history) {
            if (result.profile.id !== user.id || result.date !== body.date || result.month !== `${body.date.slice(0, 7)}-01` ||
                !["days", "sets", "exercises", "volume"].every((field) => typeof result.summary?.[field] === "number" && Number.isFinite(result.summary[field]) && result.summary[field] >= 0) ||
                !Array.isArray(result.days) || !Array.isArray(result.sets)) {
              throw new Error("Invalid workout history");
            }
            return reply(result);
          }
          if (result.profile.id !== user.id || typeof result.summary?.days !== "number" || !Array.isArray(result.activity) || !Array.isArray(result.recent_days) || !Array.isArray(result.best_marks)) {
            throw new Error("Invalid profile overview");
          }
          return reply({ ...result, email: user.email });
        } catch {
          return reply({ error: "No se ha podido confirmar la operación del perfil. Comprueba tu conexión e inténtalo de nuevo." }, 503);
        }
      },
    });
    const response = await handler(new Request(request.url, {
      method: "POST",
      headers: { origin: request.headers.get("origin"), "content-type": "application/json", cookie: request.headers.get("cookie") ?? "" },
      body: JSON.stringify({ action: "session" }),
    }));
    return !authorized && response.ok
      ? Response.json({ error: "Inicia sesión para ver tu perfil." }, { status: 401, headers: response.headers })
      : response;
  };
}