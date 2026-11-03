// Cliente mínimo de la API REST de QStash (Upstash). Sin dependencias.
// Docs: POST /v2/publish/{destino} (cabeceras Upstash-Delay y Upstash-Retries) y DELETE /v2/messages/{id}.
import { deliverUrl } from "./signature.mjs";

const DEFAULT_QSTASH_URL = "https://qstash.upstash.io";
const REQUEST_TIMEOUT_MS = 8000;
// Los identificadores de QStash son del tipo "msg_26hZCxZ...". Se valida porque el id acaba dentro de una URL.
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export class QstashConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "QstashConfigError";
  }
}

export class QstashError extends Error {
  constructor(message) {
    super(message);
    this.name = "QstashError";
  }
}

export const validMessageId = (value) => typeof value === "string" && MESSAGE_ID_PATTERN.test(value);

function readConfig(env) {
  const token = typeof env.QSTASH_TOKEN === "string" ? env.QSTASH_TOKEN.trim() : "";
  const appUrl = typeof env.APP_URL === "string" ? env.APP_URL.trim() : "";
  if (!token || !appUrl) throw new QstashConfigError("Falta QSTASH_TOKEN o APP_URL.");

  // Las cuentas de Upstash en Europa usan otra dirección (p. ej. https://qstash-eu-central-1.upstash.io):
  // se indica en QSTASH_URL tal como la muestra la consola. El token solo viaja a dominios de Upstash.
  const rawBase = typeof env.QSTASH_URL === "string" && env.QSTASH_URL.trim() ? env.QSTASH_URL.trim() : DEFAULT_QSTASH_URL;
  let base;
  let destination;
  try {
    base = new URL(rawBase);
    destination = deliverUrl(appUrl);
  } catch {
    throw new QstashConfigError("QSTASH_URL o APP_URL no son URLs válidas.");
  }
  const host = base.hostname.toLowerCase();
  if (base.protocol !== "https:" || base.username || base.password || !(host === "upstash.io" || host.endsWith(".upstash.io"))) {
    throw new QstashConfigError("QSTASH_URL debe ser una dirección https de upstash.io.");
  }
  if (new URL(destination).protocol !== "https:") throw new QstashConfigError("APP_URL debe ser https.");
  return { token, destination, origin: base.origin };
}

/**
 * Devuelve `{ publish, cancel }`. La configuración se lee al llamar (no al cargar el módulo),
 * así un entorno sin configurar no rompe el arranque. Los errores nunca incluyen el token.
 */
export function createQstashClient({ env = process.env, fetcher = fetch } = {}) {
  async function call(url, init) {
    try {
      return await fetcher(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
      throw new QstashError("No se pudo contactar con QStash.");
    }
  }

  return {
    /**
     * Programa `body` (un objeto, se envía como JSON) para que QStash llame a /api/push/deliver dentro de
     * `delaySeconds`. Sin reintentos: un reintento tardío de un descanso sería un aviso falso.
     * Devuelve `{ messageId }`.
     */
    async publish({ delaySeconds, body }) {
      if (!Number.isInteger(delaySeconds) || delaySeconds < 0) throw new QstashError("Retardo inválido.");
      const { token, destination, origin } = readConfig(env);
      const response = await call(`${origin}/v2/publish/${destination}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Upstash-Delay": `${delaySeconds}s`,
          "Upstash-Retries": "0",
        },
        body: JSON.stringify(body),
      });
      let payload = null;
      if (response.ok) payload = await response.json().catch(() => null);
      else await response.body?.cancel().catch(() => {});
      if (!response.ok) throw new QstashError(`QStash respondió ${response.status} al programar el aviso.`);
      if (!validMessageId(payload?.messageId)) throw new QstashError("QStash no devolvió un identificador válido.");
      return { messageId: payload.messageId };
    },

    /**
     * Cancela un mensaje pendiente. Resuelve `{ cancelled: true }` o, si QStash ya no lo tiene
     * (se entregó o ya estaba cancelado), `{ cancelled: false }`: en ambos casos no hay nada más que hacer.
     */
    async cancel(messageId) {
      if (!validMessageId(messageId)) throw new QstashError("Identificador inválido.");
      const { token, origin } = readConfig(env);
      const response = await call(`${origin}/v2/messages/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await response.body?.cancel().catch(() => {});
      if (response.ok) return { cancelled: true };
      if (response.status === 404) return { cancelled: false };
      throw new QstashError(`QStash respondió ${response.status} al cancelar el aviso.`);
    },
  };
}
