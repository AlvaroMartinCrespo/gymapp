import { cleanLabel, cleanSubscription, validSeconds, validSubscription } from "./validate.mjs";
import { validMessageId } from "./qstash.mjs";

import { buildNotificationPayload, DELIVER_BODY, DELIVER_TITLE, DELIVER_URL } from "./notification.mjs";

export { DELIVER_BODY, DELIVER_TITLE, DELIVER_URL };
const MAX_BODY_BYTES = 4096;

/** El título y la URL los fija el servidor; del navegador solo se usa el nombre (recortado) en el texto secundario. */
export function buildDeliverPayload(label) {
  return buildNotificationPayload(cleanLabel(label));
}

/**
 * Ruta que QStash llama a la hora exacta. `verify({ signature, body })` y `send(subscription, payload)`
 * se inyectan (como en los handlers de Supabase) para probarlos sin red.
 */
export function createDeliverHandler({ verify, send }) {
  return async function handleDeliver(request) {
    const headers = { "Cache-Control": "private, no-store" };
    const error = (message, status) => Response.json({ error: message }, { status, headers });
    if (request.method !== "POST") return error("Método no permitido.", 405);

    const signature = request.headers.get("upstash-signature");
    if (!signature) return error("No autorizado.", 401);
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) return error("Petición demasiado grande.", 413);

    let raw;
    try {
      raw = new Uint8Array(await request.arrayBuffer());
    } catch {
      return error("Petición inválida.", 400);
    }
    if (raw.byteLength > MAX_BODY_BYTES) return error("Petición demasiado grande.", 413);

    // Sin firma válida no se mira el contenido ni se llama al servicio push.
    let authorized = false;
    try {
      authorized = (await verify({ signature, body: raw })) === true;
    } catch {
      authorized = false;
    }
    if (!authorized) return error("No autorizado.", 401);

    let body;
    try {
      body = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      return error("Petición inválida.", 400);
    }
    if (!body || typeof body !== "object" || !validSubscription(body.subscription)) return error("Petición inválida.", 400);
    if (body.label !== undefined && typeof body.label !== "string") return error("Petición inválida.", 400);

    try {
      const { status } = await send(cleanSubscription(body.subscription), buildDeliverPayload(body.label));
      if (status >= 200 && status < 300) return Response.json({ ok: true }, { headers });
      // 404/410: suscripción caducada. Se responde 200 para que QStash no reintente.
      if (status === 404 || status === 410) return Response.json({ ok: true, expired: true }, { headers });
      console.error(`Push: el servicio push respondió ${status}.`);
      return error("No se ha podido enviar el aviso.", 502);
    } catch (failure) {
      // Solo el tipo de error: nunca el mensaje completo ni claves.
      console.error(`Push: fallo al enviar (${failure instanceof Error ? failure.name : "desconocido"}).`);
      return error("No se ha podido enviar el aviso.", failure instanceof Error && failure.name === "PushConfigError" ? 500 : 502);
    }
  };
}

const MAX_SCHEDULE_BODY_BYTES = 4096;
const MAX_CANCEL_BODY_BYTES = 1024;

/**
 * Comprobaciones comunes de las rutas públicas que llama la app (schedule y cancel): método, mismo origen,
 * JSON y tamaño. Devuelve `{ body }` con el JSON leído o `{ response }` con el error que hay que devolver.
 * No hay login, así que el origen solo frena a otras webs en navegadores; los límites del cuerpo y las
 * validaciones de cada ruta son las que acotan el abuso.
 */
async function readAppRequest(request, maxBytes, error) {
  if (request.method !== "POST") return { response: error("Método no permitido.", 405) };
  if (request.headers.get("origin") !== new URL(request.url).origin) return { response: error("Origen no permitido.", 403) };
  if (!request.headers.get("content-type")?.startsWith("application/json")) return { response: error("Se requiere JSON.", 415) };
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { response: error("Petición demasiado grande.", 413) };
  let text;
  try {
    text = await request.text();
  } catch {
    return { response: error("Petición inválida.", 400) };
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes) return { response: error("Petición demasiado grande.", 413) };
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) return { response: error("Petición inválida.", 400) };
    return { body };
  } catch {
    return { response: error("Petición inválida.", 400) };
  }
}

const isConfigError = (failure) => failure instanceof Error && failure.name === "QstashConfigError";

/**
 * POST /api/push/schedule: `{ subscription, seconds, label? }` → `{ messageId }`.
 * `publish({ delaySeconds, body })` se inyecta (ver qstash.mjs). El cuerpo que viaja a QStash se reconstruye
 * solo con los campos validados, y /api/push/deliver lo vuelve a validar al recibirlo.
 */
export function createScheduleHandler({ publish }) {
  return async function handleSchedule(request) {
    const headers = { "Cache-Control": "private, no-store" };
    const error = (message, status) => Response.json({ error: message }, { status, headers });
    const { body, response } = await readAppRequest(request, MAX_SCHEDULE_BODY_BYTES, error);
    if (response) return response;

    if (!validSubscription(body.subscription)) return error("Suscripción de avisos inválida.", 400);
    if (!validSeconds(body.seconds)) return error("La duración del descanso no es válida.", 400);
    if (body.label !== undefined && typeof body.label !== "string") return error("Petición inválida.", 400);

    try {
      const { messageId } = await publish({
        delaySeconds: body.seconds,
        body: { subscription: cleanSubscription(body.subscription), label: cleanLabel(body.label) },
      });
      return Response.json({ messageId }, { headers });
    } catch (failure) {
      // Solo el tipo de error: nunca el mensaje completo, el token ni la suscripción.
      console.error(`Push: fallo al programar el aviso (${failure instanceof Error ? failure.name : "desconocido"}).`);
      return error("No se ha podido programar el aviso.", isConfigError(failure) ? 500 : 502);
    }
  };
}

/**
 * POST /api/push/cancel: `{ messageId }` → `{ ok: true }`. Si QStash ya no tiene el mensaje (ya se
 * entregó o ya estaba cancelado) también responde 200: para quien llama el resultado es el mismo.
 */
export function createCancelHandler({ cancel }) {
  return async function handleCancel(request) {
    const headers = { "Cache-Control": "private, no-store" };
    const error = (message, status) => Response.json({ error: message }, { status, headers });
    const { body, response } = await readAppRequest(request, MAX_CANCEL_BODY_BYTES, error);
    if (response) return response;

    if (!validMessageId(body.messageId)) return error("Petición inválida.", 400);

    try {
      const { cancelled } = await cancel(body.messageId);
      return Response.json({ ok: true, cancelled }, { headers });
    } catch (failure) {
      console.error(`Push: fallo al cancelar el aviso (${failure instanceof Error ? failure.name : "desconocido"}).`);
      return error("No se ha podido cancelar el aviso.", isConfigError(failure) ? 500 : 502);
    }
  };
}
