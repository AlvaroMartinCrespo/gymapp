// Validación de suscripciones push y textos. Sin dependencias.

export const MAX_LABEL_LENGTH = 100;
const MAX_ENDPOINT_LENGTH = 2048;

// Solo se envía a los servicios push conocidos: evita usar el servidor para llamar a URLs arbitrarias.
const ALLOWED_HOSTS = ["web.push.apple.com", "fcm.googleapis.com"]; // Apple, Google
const ALLOWED_HOST_SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com"]; // Mozilla, Windows

/** true si es una URL https, sin credenciales ni puerto raro, de un servicio push permitido. */
export function allowedPushEndpoint(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ENDPOINT_LENGTH) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOSTS.includes(host) || ALLOWED_HOST_SUFFIXES.some((suffix) => host.length > suffix.length && host.endsWith(suffix));
}

function base64urlBytes(value, length) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const bytes = Buffer.from(value, "base64url");
  return bytes.length === length ? bytes : null;
}

/** Suscripción del navegador: endpoint permitido + claves p256dh (65 bytes) y auth (16 bytes). */
export function validSubscription(subscription) {
  if (!subscription || typeof subscription !== "object" || Array.isArray(subscription)) return false;
  if (!allowedPushEndpoint(subscription.endpoint)) return false;
  const keys = subscription.keys;
  if (!keys || typeof keys !== "object") return false;
  const p256dh = base64urlBytes(keys.p256dh, 65);
  return p256dh !== null && p256dh[0] === 0x04 && base64urlBytes(keys.auth, 16) !== null;
}

/** Copia solo los campos necesarios (descarta cualquier otro dato del navegador). */
export function cleanSubscription(subscription) {
  return { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } };
}

/** Texto corto y sin caracteres de control. Devuelve "" si no es texto. */
export function cleanLabel(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_LABEL_LENGTH).trim();
}

// Mismo límite que MAX_REST_SECONDS en src/lib/timer.ts (una prueba comprueba que coinciden).
export const MAX_REST_SECONDS = 3600;

/** Segundos de descanso: entero entre 1 y MAX_REST_SECONDS. */
export function validSeconds(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_REST_SECONDS;
}
