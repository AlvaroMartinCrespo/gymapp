// Verificación (y firma, para pruebas) de las peticiones de QStash. Sin dependencias.
// QStash envía un JWT HS256 en la cabecera `Upstash-Signature`, firmado con tu clave de firma,
// con las claves iss ("Upstash"), sub (la URL llamada), exp, nbf y body (SHA-256 del cuerpo, base64url).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const DELIVER_PATH = "/api/push/deliver";
const CLOCK_TOLERANCE_SECONDS = 10;

const encode = (value) => Buffer.from(value).toString("base64url");

/** URL pública a la que QStash llamará (debe coincidir con el `sub` del JWT). */
export function deliverUrl(appUrl) {
  return new URL(DELIVER_PATH, appUrl).href;
}

const bodyHash = (body) => createHash("sha256").update(body).digest("base64url");

/** Firma un JWT con el mismo formato que QStash. Solo para pruebas y para scripts/push-deliver-test.mjs. */
export function signQstashJwt({ key, url, body, now = Date.now(), ttlSeconds = 300 }) {
  const seconds = Math.floor(now / 1000);
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(JSON.stringify({ iss: "Upstash", sub: url, exp: seconds + ttlSeconds, nbf: seconds, iat: seconds, jti: `jwt_${seconds}`, body: bodyHash(body) }));
  const signature = createHmac("sha256", key).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** Comprueba firma, emisor, URL, caducidad y hash del cuerpo con una clave. Nunca lanza. */
export function verifyQstashJwt({ jwt, key, url, body, now = Date.now() }) {
  try {
    if (typeof jwt !== "string" || typeof key !== "string" || !key) return false;
    const parts = jwt.split(".");
    if (parts.length !== 3) return false;
    const [header, payload, signature] = parts;
    if (JSON.parse(Buffer.from(header, "base64url").toString()).alg !== "HS256") return false;

    const expected = createHmac("sha256", key).update(`${header}.${payload}`).digest();
    const given = Buffer.from(signature, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    const seconds = Math.floor(now / 1000);
    if (claims.iss !== "Upstash" || claims.sub !== url) return false;
    if (typeof claims.exp !== "number" || claims.exp < seconds - CLOCK_TOLERANCE_SECONDS) return false;
    if (typeof claims.nbf !== "number" || claims.nbf > seconds + CLOCK_TOLERANCE_SECONDS) return false;
    // QStash puede enviar el hash con relleno "="; se ignora.
    return typeof claims.body === "string" && claims.body.replace(/=+$/, "") === bodyHash(body);
  } catch {
    return false;
  }
}

/**
 * Devuelve `verify({ signature, body })`, que acepta la petición solo si la firma es válida con la
 * clave actual o con la siguiente (rotación sin interrupción). Si falta configuración, rechaza.
 */
export function createQstashVerifier({ env = process.env, now = () => Date.now() } = {}) {
  return async function verify({ signature, body }) {
    const appUrl = typeof env.APP_URL === "string" ? env.APP_URL.trim() : "";
    const keys = [env.QSTASH_CURRENT_SIGNING_KEY, env.QSTASH_NEXT_SIGNING_KEY].filter((key) => typeof key === "string" && key.trim());
    if (!appUrl || keys.length === 0) {
      console.error("Push: faltan APP_URL o las claves de firma de QStash; se rechaza la petición.");
      return false;
    }
    let url;
    try {
      url = deliverUrl(appUrl);
    } catch {
      console.error("Push: APP_URL no es una URL válida; se rechaza la petición.");
      return false;
    }
    return keys.some((key) => verifyQstashJwt({ jwt: signature, key: key.trim(), url, body, now: now() }));
  };
}
