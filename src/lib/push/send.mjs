// Envío de notificaciones Web Push (RFC 8030, cifrado RFC 8291 aes128gcm, VAPID RFC 8292).
// Implementado con node:crypto y fetch, sin dependencias: el proyecto no instala paquetes sin avisar.
import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from "node:crypto";
import { allowedPushEndpoint } from "./validate.mjs";

// Un aviso de descanso que llega tarde no sirve: el servicio push lo descarta pasado este tiempo.
export const PUSH_TTL_SECONDS = 60;
const RECORD_SIZE = 4096;
const MAX_PAYLOAD_BYTES = 3500;
const VAPID_TOKEN_SECONDS = 12 * 60 * 60;
const REQUEST_TIMEOUT_MS = 8000;

export class PushConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "PushConfigError";
  }
}

export class PushSendError extends Error {
  constructor(message) {
    super(message);
    this.name = "PushSendError";
  }
}

const encode = (value) => Buffer.from(value).toString("base64url");
const decode = (value) => Buffer.from(value, "base64url");

/**
 * Cifra el mensaje para el navegador (RFC 8291). Devuelve el cuerpo completo de la petición:
 * cabecera (sal, tamaño de registro, clave efímera) + mensaje cifrado en un único registro.
 * `salt` y `ephemeral` solo se indican en las pruebas.
 */
export function encryptPayload({ payload, p256dh, auth, salt = randomBytes(16), ephemeral }) {
  const message = Buffer.from(payload);
  if (message.length > MAX_PAYLOAD_BYTES) throw new PushSendError("El mensaje es demasiado grande.");
  const uaPublic = decode(p256dh);
  const authSecret = decode(auth);

  const ecdh = createECDH("prime256v1");
  if (ephemeral) ecdh.setPrivateKey(decode(ephemeral.privateKey));
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(uaPublic);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32));
  const contentKey = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  // 0x02 marca el último (y único) registro.
  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce);
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([message, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header[20] = asPublic.length;
  return Buffer.concat([header, asPublic, encrypted]);
}

/** Cabecera Authorization de VAPID: JWT ES256 limitado al origen del servicio push. */
export function vapidAuthorization({ endpoint, publicKey, privateKey, subject, now = Date.now() }) {
  const publicBytes = decode(publicKey);
  const key = createPrivateKey({
    format: "jwk",
    key: { kty: "EC", crv: "P-256", x: encode(publicBytes.subarray(1, 33)), y: encode(publicBytes.subarray(33, 65)), d: privateKey },
  });
  const header = encode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + VAPID_TOKEN_SECONDS, sub: subject }));
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${encode(signature)}, k=${publicKey}`;
}

function readVapidConfig(env) {
  const publicKey = typeof env.NEXT_PUBLIC_VAPID_PUBLIC_KEY === "string" ? env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.trim() : "";
  const privateKey = typeof env.VAPID_PRIVATE_KEY === "string" ? env.VAPID_PRIVATE_KEY.trim() : "";
  const subject = typeof env.VAPID_SUBJECT === "string" ? env.VAPID_SUBJECT.trim() : "";
  const validSubject = /^mailto:[^\s@]+@[^\s@]+$/.test(subject) || /^https:\/\/[^\s/]+/.test(subject);
  if (decode(publicKey).length !== 65 || decode(privateKey).length !== 32 || !validSubject) {
    throw new PushConfigError("Las claves VAPID no están configuradas correctamente.");
  }
  return { publicKey, privateKey, subject };
}

/**
 * Devuelve `send(subscription, payload)`, que cifra y envía el aviso y resuelve con `{ status }`
 * (el código HTTP del servicio push; quien llama decide qué significa). Lanza PushConfigError si
 * faltan claves VAPID y PushSendError si no hay respuesta. Los mensajes nunca incluyen claves.
 */
export function createPushSender({ env = process.env, fetcher = fetch, now = () => Date.now() } = {}) {
  return async function send(subscription, payload) {
    const config = readVapidConfig(env);
    if (!allowedPushEndpoint(subscription?.endpoint)) throw new PushSendError("Servicio push no permitido.");
    const body = encryptPayload({ payload: JSON.stringify(payload), p256dh: subscription.keys.p256dh, auth: subscription.keys.auth });
    let response;
    try {
      response = await fetcher(subscription.endpoint, {
        method: "POST",
        headers: {
          Authorization: vapidAuthorization({ endpoint: subscription.endpoint, ...config, now: now() }),
          "Content-Encoding": "aes128gcm",
          "Content-Type": "application/octet-stream",
          TTL: String(PUSH_TTL_SECONDS),
          Urgency: "high",
        },
        body,
        cache: "no-store",
        // Una redirección podría llevar la petición a un destino no permitido.
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new PushSendError("No se pudo contactar con el servicio push.");
    }
    await response.body?.cancel().catch(() => {});
    return { status: response.status };
  };
}
