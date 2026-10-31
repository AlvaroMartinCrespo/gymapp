import { createAuthHandler } from "./auth.mjs";

const validPair = (value) => value && typeof value.weight === "number" && Number.isFinite(value.weight) && value.weight >= 0 && value.weight <= 10000 && Number.isInteger(value.reps) && value.reps > 0 && value.reps <= 1000;

// La foto es opcional: si falta o no es una URL HTTPS válida se descarta (null) sin tumbar el ranking.
const safeAvatar = (value) => {
  if (typeof value !== "string" || value.length > 2048 || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};

export function validRankingInput(body) {
  return body && typeof body === "object" && !Array.isArray(body) &&
    ["load", "participation"].includes(body.action) && typeof body.exerciseId === "string" && /^[a-z][a-z0-9_]{0,79}$/.test(body.exerciseId) &&
    ["weight", "reps"].includes(body.metric) && Number.isInteger(body.page) && body.page >= 0 && body.page <= 10000 &&
    (body.action !== "participation" || typeof body.enabled === "boolean");
}

export function createRankingsHandler({ env = process.env, fetcher = fetch } = {}) {
  return async function handleRankings(request) {
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
    } catch { return error("Petición inválida.", 400); }
    if (!validRankingInput(body)) return error("Revisa los filtros de clasificación.", 400);
    let authorized = false;
    const handler = createAuthHandler({ env, fetcher, onSession: async ({ accessToken, reply }) => {
      authorized = true;
      try {
        const response = await fetcher(new URL("/rest/v1/rpc/get_rankings", env.SUPABASE_URL), {
          method: "POST",
          headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_exercise_id: body.exerciseId, p_metric: body.metric, p_page: body.page, ...(body.action === "participation" ? { p_enabled: body.enabled } : {}) }),
          cache: "no-store", signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          if ([401, 403, 429].includes(response.status)) return reply({ error: "No se puede consultar la clasificación. Revisa tu sesión o reintenta más tarde." }, response.status);
          const details = await response.json().catch(() => null);
          return reply({ error: "No se ha podido confirmar la clasificación ni los cambios de participación. Reintenta la consulta." }, details?.code === "22023" ? 400 : 503);
        }
        const result = await response.json();
        const validPosition = (position) => Number.isInteger(position) && position > 0 && position <= result.total;
        if (result?.exercise_id !== body.exerciseId || result.metric !== body.metric || result.page !== body.page || typeof result.enabled !== "boolean" ||
          !Number.isInteger(result.total) || result.total < 0 || !Array.isArray(result.entries) || result.entries.length > 50 ||
          !result.entries.every((entry) => validPair(entry) && typeof entry.username === "string" && /^[A-Za-z0-9_]{3,30}$/.test(entry.username) && validPosition(entry.position) && typeof entry.is_me === "boolean") ||
          (result.personal !== null && (!validPair(result.personal) || (result.personal.position !== null && !validPosition(result.personal.position)))) ||
          (body.action === "participation" && result.enabled !== body.enabled)) throw new Error("Invalid ranking response");
        const pair = (value) => ({ weight: value.weight, reps: value.reps, position: value.position });
        return reply({ exercise_id: result.exercise_id, metric: result.metric, page: result.page, enabled: result.enabled, total: result.total,
          entries: result.entries.map((entry) => ({ ...pair(entry), username: entry.username, avatar_url: safeAvatar(entry.avatar_url), is_me: entry.is_me })),
          personal: result.personal === null ? null : pair(result.personal) });
      } catch { return reply({ error: "No se ha podido confirmar la clasificación ni los cambios de participación. Reintenta la consulta." }, 503); }
    } });
    const response = await handler(new Request(request.url, { method: "POST", headers: { origin: request.headers.get("origin"), "content-type": "application/json", cookie: request.headers.get("cookie") ?? "" }, body: JSON.stringify({ action: "session" }) }));
    return !authorized && response.ok ? Response.json({ error: "Inicia sesión para consultar rankings." }, { status: 401, headers: response.headers }) : response;
  };
}