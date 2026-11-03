import assert from "node:assert/strict";
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { generateVapidKeys } from "./generate-vapid.mjs";
import { buildDeliverPayload, createCancelHandler, createDeliverHandler, createScheduleHandler, DELIVER_BODY, DELIVER_TITLE } from "../src/lib/push/handlers.mjs";
import { INITIAL_TIMER, MAX_REST_SECONDS as TIMER_MAX_REST_SECONDS, transitionTimer } from "../src/lib/timer.ts";
import { buildNotificationPayload, NOTIFICATION_ICON, NOTIFICATION_TAG } from "../src/lib/push/notification.mjs";
import { CANCEL_PATH, createPushSync, LOCAL_NOTIFICATION_WINDOW_MS, shouldNotifyLocally, MAX_SCHEDULE_SECONDS, PUSH_STORAGE_KEY, pushEndsAt, SCHEDULE_PATH } from "../src/lib/push/sync.mjs";
import { createQstashClient, QstashConfigError, QstashError, validMessageId } from "../src/lib/push/qstash.mjs";
import { PushConfigError, PushSendError, createPushSender, encryptPayload } from "../src/lib/push/send.mjs";
import { createQstashVerifier, deliverUrl, signQstashJwt, verifyQstashJwt } from "../src/lib/push/signature.mjs";
import { allowedPushEndpoint, cleanLabel, MAX_REST_SECONDS, validSeconds, validSubscription } from "../src/lib/push/validate.mjs";

const b64 = (value) => Buffer.from(value).toString("base64url");
const APP_URL = "https://gymapp.example.test";
const URL_DELIVER = `${APP_URL}/api/push/deliver`;

// Vector de pruebas del RFC 8291 (sección 5 y apéndice A).
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

// Descifrado del navegador (RFC 8291 + RFC 8188), independiente del código de envío.
function decryptAsBrowser(body, { uaPrivate, uaPublic, auth }) {
  const salt = body.subarray(0, 16);
  const idLength = body[20];
  const asPublic = body.subarray(21, 21 + idLength);
  const ciphertext = body.subarray(21 + idLength);
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(Buffer.from(uaPrivate, "base64url"));
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), Buffer.from(uaPublic, "base64url"), asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", ecdh.computeSecret(asPublic), Buffer.from(auth, "base64url"), keyInfo, 32));
  const key = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = createDecipheriv("aes-128-gcm", key, nonce);
  decipher.setAuthTag(ciphertext.subarray(-16));
  const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]);
  assert.equal(plain.at(-1), 2, "falta el delimitador del último registro");
  return plain.subarray(0, -1).toString();
}

function browserSubscription(endpoint = "https://fcm.googleapis.com/fcm/send/abc123") {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const keys = { p256dh: b64(ecdh.getPublicKey()), auth: b64(randomBytes(16)) };
  return { subscription: { endpoint, keys }, secret: { uaPrivate: b64(ecdh.getPrivateKey()), uaPublic: keys.p256dh, auth: keys.auth } };
}

test("el cifrado reproduce byte a byte el ejemplo del RFC 8291", () => {
  const body = encryptPayload({ payload: RFC.plaintext, p256dh: RFC.uaPublic, auth: RFC.auth, salt: Buffer.from(RFC.salt, "base64url"), ephemeral: { privateKey: RFC.asPrivate } });
  assert.equal(b64(body), RFC.body);
  assert.equal(decryptAsBrowser(Buffer.from(RFC.body, "base64url"), { uaPrivate: RFC.uaPrivate, uaPublic: RFC.uaPublic, auth: RFC.auth }), RFC.plaintext);
});

test("un mensaje cifrado con claves aleatorias lo descifra el navegador, y no se repite la sal", () => {
  const { subscription, secret } = browserSubscription();
  const first = encryptPayload({ payload: "hola ñ", ...subscription.keys });
  const second = encryptPayload({ payload: "hola ñ", ...subscription.keys });
  assert.equal(decryptAsBrowser(first, secret), "hola ñ");
  assert.notDeepEqual(first, second);
  assert.throws(() => encryptPayload({ payload: "x".repeat(3600), ...subscription.keys }), PushSendError);
});

test("solo se aceptan endpoints https de servicios push conocidos", () => {
  for (const ok of ["https://fcm.googleapis.com/fcm/send/abc", "https://web.push.apple.com/QJ3x", "https://updates.push.services.mozilla.com/wpush/v2/x", "https://db5p.notify.windows.com/?token=x"]) {
    assert.equal(allowedPushEndpoint(ok), true, ok);
  }
  for (const bad of [
    "http://fcm.googleapis.com/fcm/send/abc", "https://evil.example/fcm", "https://fcm.googleapis.com.evil.example/x", "https://evilfcm.googleapis.com/x",
    "https://user:pass@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "https://127.0.0.1/x", "https://localhost/x", "https://[::1]/x", "https://169.254.169.254/latest",
    "https://.notify.windows.com/x", "ftp://web.push.apple.com/x", "web.push.apple.com", "", null, undefined, 42, `https://fcm.googleapis.com/${"a".repeat(2100)}`,
  ]) {
    assert.equal(allowedPushEndpoint(bad), false, String(bad));
  }
});

test("la suscripción exige claves de la longitud correcta", () => {
  const { subscription } = browserSubscription();
  assert.equal(validSubscription(subscription), true);
  for (const bad of [null, [], {}, { ...subscription, keys: null }, { ...subscription, keys: { ...subscription.keys, auth: b64(randomBytes(15)) } },
    { ...subscription, keys: { ...subscription.keys, p256dh: b64(randomBytes(64)) } }, { ...subscription, keys: { ...subscription.keys, p256dh: b64(Buffer.concat([Buffer.from([2]), randomBytes(64)])) } },
    { ...subscription, keys: { ...subscription.keys, auth: "no válido!" } }, { ...subscription, endpoint: "https://evil.example/x" }]) {
    assert.equal(validSubscription(bad), false);
  }
});

test("la etiqueta se limpia y se recorta", () => {
  assert.equal(cleanLabel("  Press de banca\n\u0000 "), "Press de banca");
  assert.equal(cleanLabel("x".repeat(150)).length, 100);
  assert.equal(cleanLabel(42), "");
  assert.deepEqual(buildDeliverPayload("Descanso"), { title: DELIVER_TITLE, body: DELIVER_BODY, url: "/cronometro" });
  assert.match(buildDeliverPayload("Press de banca").body, /^Press de banca/);
});

test("verifica la firma de QStash: clave actual, siguiente, URL, caducidad y cuerpo", () => {
  const body = new TextEncoder().encode('{"a":1}');
  const now = Date.now();
  const jwt = signQstashJwt({ key: "current", url: URL_DELIVER, body, now });
  assert.equal(verifyQstashJwt({ jwt, key: "current", url: URL_DELIVER, body, now }), true);
  assert.equal(verifyQstashJwt({ jwt, key: "otra", url: URL_DELIVER, body, now }), false);
  assert.equal(verifyQstashJwt({ jwt, key: "current", url: `${APP_URL}/otra`, body, now }), false);
  assert.equal(verifyQstashJwt({ jwt, key: "current", url: URL_DELIVER, body: new TextEncoder().encode('{"a":2}'), now }), false);
  assert.equal(verifyQstashJwt({ jwt, key: "current", url: URL_DELIVER, body, now: now + 400_000 }), false, "caducado");
  assert.equal(verifyQstashJwt({ jwt, key: "current", url: URL_DELIVER, body, now: now - 60_000 }), false, "aún no válido");
  for (const bad of ["", "a.b", "a.b.c", null, undefined, jwt.slice(0, -2) + "xx"]) assert.equal(verifyQstashJwt({ jwt: bad, key: "current", url: URL_DELIVER, body, now }), false);
  // Un JWT sin firma (alg none) no vale.
  const [, payload] = jwt.split(".");
  assert.equal(verifyQstashJwt({ jwt: `${b64('{"alg":"none"}')}.${payload}.`, key: "current", url: URL_DELIVER, body, now }), false);
  // El hash con relleno "=" que envía QStash también se acepta.
  const [h, p, s] = jwt.split(".");
  const claims = JSON.parse(Buffer.from(p, "base64url"));
  assert.equal(claims.iss, "Upstash");
  assert.equal(claims.sub, URL_DELIVER);
  assert.ok(s.length > 0 && h.length > 0);
});

test("el verificador usa la clave siguiente y rechaza si falta configuración", async () => {
  const body = new TextEncoder().encode("{}");
  const env = { APP_URL: `${APP_URL}/`, QSTASH_CURRENT_SIGNING_KEY: "current", QSTASH_NEXT_SIGNING_KEY: "next" };
  const verifyRequest = createQstashVerifier({ env });
  assert.equal(await verifyRequest({ signature: signQstashJwt({ key: "current", url: URL_DELIVER, body }), body }), true);
  assert.equal(await verifyRequest({ signature: signQstashJwt({ key: "next", url: URL_DELIVER, body }), body }), true);
  assert.equal(await verifyRequest({ signature: signQstashJwt({ key: "x", url: URL_DELIVER, body }), body }), false);
  const quiet = console.error;
  console.error = () => {};
  try {
    for (const partial of [{}, { APP_URL }, { QSTASH_CURRENT_SIGNING_KEY: "current" }, { APP_URL: "no-es-url", QSTASH_CURRENT_SIGNING_KEY: "current" }]) {
      assert.equal(await createQstashVerifier({ env: partial })({ signature: signQstashJwt({ key: "current", url: URL_DELIVER, body }), body }), false);
    }
  } finally {
    console.error = quiet;
  }
  assert.equal(deliverUrl("https://gymapp.example.test/"), URL_DELIVER);
});

function deliverRequest({ body, signature, method = "POST", headers = {} }) {
  const init = { method, headers: { "content-type": "application/json", ...(signature ? { "upstash-signature": signature } : {}), ...headers } };
  if (method !== "GET") init.body = body;
  return new Request(URL_DELIVER, init);
}

function deliverSetup({ status = 201, sendError } = {}) {
  const calls = [];
  const send = async (subscription, payload) => {
    calls.push({ subscription, payload });
    if (sendError) throw sendError;
    return { status };
  };
  const env = { APP_URL, QSTASH_CURRENT_SIGNING_KEY: "current", QSTASH_NEXT_SIGNING_KEY: "next" };
  const handler = createDeliverHandler({ verify: createQstashVerifier({ env }), send });
  const { subscription } = browserSubscription();
  const sign = (text, key = "current") => signQstashJwt({ key, url: URL_DELIVER, body: new TextEncoder().encode(text) });
  return { calls, handler, subscription, sign };
}

test("deliver rechaza sin firma o con firma inválida y no llama al servicio push", async () => {
  const { calls, handler, subscription, sign } = deliverSetup();
  const text = JSON.stringify({ subscription, label: "Press de banca" });
  const quiet = console.error;
  console.error = () => {};
  try {
    for (const request of [
      deliverRequest({ body: text }),
      deliverRequest({ body: text, signature: "no.es.jwt" }),
      deliverRequest({ body: text, signature: sign(text, "clave-ajena") }),
      deliverRequest({ body: text, signature: sign(`${text} `) }),
    ]) {
      const response = await handler(request);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "No autorizado." });
    }
  } finally {
    console.error = quiet;
  }
  assert.equal(calls.length, 0);
  assert.equal((await handler(deliverRequest({ method: "GET" }))).status, 405);
});

test("deliver envía el aviso con título fijo cuando la firma es válida", async () => {
  const { calls, handler, subscription, sign } = deliverSetup();
  const text = JSON.stringify({ subscription: { ...subscription, expirationTime: null, extra: "descartado" }, label: "Press de banca", title: "Título del atacante", url: "https://evil.example" });
  const response = await handler(deliverRequest({ body: text, signature: sign(text) }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].subscription, subscription);
  assert.deepEqual(calls[0].payload, { title: "Descanso terminado", body: "Press de banca · ya puedes hacer la siguiente serie.", url: "/cronometro" });
});

test("deliver valida el cuerpo y el tamaño", async () => {
  const { calls, handler, subscription, sign } = deliverSetup();
  for (const body of ["no es json", "null", "[]", JSON.stringify({}), JSON.stringify({ subscription: { ...subscription, endpoint: "https://evil.example/x" } }), JSON.stringify({ subscription, label: 42 })]) {
    const response = await handler(deliverRequest({ body, signature: sign(body) }));
    assert.equal(response.status, 400, body);
  }
  const big = JSON.stringify({ subscription, label: "x".repeat(5000) });
  assert.equal((await handler(deliverRequest({ body: big, signature: sign(big) }))).status, 413);
  assert.equal(calls.length, 0);
});

test("deliver: 404 y 410 del servicio push no provocan reintento; otros fallos sí", async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    for (const status of [404, 410]) {
      const { handler, subscription, sign } = deliverSetup({ status });
      const text = JSON.stringify({ subscription });
      const response = await handler(deliverRequest({ body: text, signature: sign(text) }));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true, expired: true });
    }
    for (const status of [400, 401, 403, 413, 429, 500, 503]) {
      const { handler, subscription, sign } = deliverSetup({ status });
      const text = JSON.stringify({ subscription });
      assert.equal((await handler(deliverRequest({ body: text, signature: sign(text) }))).status, 502, String(status));
    }
    const { handler, subscription, sign } = deliverSetup({ sendError: new PushConfigError("detalle interno secreto") });
    const text = JSON.stringify({ subscription });
    const response = await handler(deliverRequest({ body: text, signature: sign(text) }));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "No se ha podido enviar el aviso." });
  } finally {
    console.error = quiet;
  }
});

test("el envío firma con VAPID, cifra, usa TTL corto y no sigue redirecciones", async () => {
  const keys = generateVapidKeys();
  const env = { NEXT_PUBLIC_VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:yo@example.test" };
  const { subscription, secret } = browserSubscription("https://web.push.apple.com/QJ3x");
  const requests = [];
  const fetcher = async (url, init) => {
    requests.push({ url, init });
    return new Response(null, { status: 201 });
  };
  const send = createPushSender({ env, fetcher, now: () => 1_800_000_000_000 });
  assert.deepEqual(await send(subscription, { title: "Hola", body: "Mundo", url: "/cronometro" }), { status: 201 });

  const { url, init } = requests[0];
  assert.equal(url, subscription.endpoint);
  assert.equal(init.method, "POST");
  assert.equal(init.redirect, "error");
  assert.equal(init.headers.TTL, "60");
  assert.equal(init.headers.Urgency, "high");
  assert.equal(init.headers["Content-Encoding"], "aes128gcm");
  assert.deepEqual(JSON.parse(decryptAsBrowser(Buffer.from(init.body), secret)), { title: "Hola", body: "Mundo", url: "/cronometro" });

  const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(init.headers.Authorization);
  assert.ok(match, "formato de la cabecera Authorization");
  assert.equal(match[4], keys.publicKey);
  assert.deepEqual(JSON.parse(Buffer.from(match[2], "base64url")), { aud: "https://web.push.apple.com", exp: 1_800_000_000 + 43200, sub: "mailto:yo@example.test" });
  const publicKey = createPublicKey({ format: "jwk", key: { kty: "EC", crv: "P-256", x: b64(Buffer.from(keys.publicKey, "base64url").subarray(1, 33)), y: b64(Buffer.from(keys.publicKey, "base64url").subarray(33)) } });
  assert.equal(verify("sha256", Buffer.from(`${match[1]}.${match[2]}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(match[3], "base64url")), true);
});

test("el envío rechaza destinos no permitidos y errores de configuración sin filtrar claves", async () => {
  const keys = generateVapidKeys();
  const env = { NEXT_PUBLIC_VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:yo@example.test" };
  const { subscription } = browserSubscription();
  let calls = 0;
  const fetcher = async () => { calls += 1; throw new Error(`fallo con ${keys.privateKey}`); };

  await assert.rejects(createPushSender({ env, fetcher })({ ...subscription, endpoint: "https://evil.example/x" }, {}), PushSendError);
  assert.equal(calls, 0);

  await assert.rejects(createPushSender({ env, fetcher })(subscription, {}), (error) => {
    assert.ok(error instanceof PushSendError);
    assert.ok(!error.message.includes(keys.privateKey) && !String(error.stack).includes(keys.privateKey));
    return true;
  });

  for (const broken of [{}, { ...env, VAPID_PRIVATE_KEY: "" }, { ...env, VAPID_SUBJECT: "mailto:" }, { ...env, VAPID_SUBJECT: "tu@correo.com" }, { ...env, NEXT_PUBLIC_VAPID_PUBLIC_KEY: "corta" }]) {
    await assert.rejects(createPushSender({ env: broken, fetcher })(subscription, {}), (error) => {
      assert.ok(error instanceof PushConfigError);
      assert.ok(!error.message.includes(keys.privateKey));
      return true;
    });
  }
});

// ---------- Paso 5: agendar y cancelar ----------

const QSTASH_ENV = { QSTASH_TOKEN: "token-secreto-qstash", APP_URL };
const ORIGIN = "https://gymapp.example.test";

function appRequest(path, body, { method = "POST", headers = {}, raw } = {}) {
  const init = { method, headers: { origin: ORIGIN, "content-type": "application/json", ...headers } };
  if (method !== "GET") init.body = raw ?? JSON.stringify(body);
  return new Request(`${ORIGIN}${path}`, init);
}

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("el límite de segundos coincide con el del cronómetro y solo admite enteros de 1 a 3600", () => {
  const timer = readFileSync(new URL("../src/lib/timer.ts", import.meta.url), "utf8");
  assert.equal(Number(/MAX_REST_SECONDS\s*=\s*(\d+)/.exec(timer)?.[1]), MAX_REST_SECONDS);
  for (const ok of [1, 10, 90, 3600]) assert.equal(validSeconds(ok), true, String(ok));
  for (const bad of [0, -1, 3601, 1.5, NaN, Infinity, "60", null, undefined, [60], {}]) assert.equal(validSeconds(bad), false, String(bad));
});

test("validMessageId solo admite identificadores seguros para ir en una URL", () => {
  assert.equal(validMessageId("msg_26hZCxZqq2BCDeFg"), true);
  for (const bad of ["", "a/b", "../x", "msg 1", "msg?x=1", "a".repeat(101), 5, null, undefined]) assert.equal(validMessageId(bad), false, String(bad));
});

test("qstash publish: URL, cabeceras de retardo y sin reintentos, cuerpo JSON", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ messageId: "msg_abc123" });
  };
  const { subscription } = browserSubscription();
  const result = await createQstashClient({ env: QSTASH_ENV, fetcher }).publish({ delaySeconds: 90, body: { subscription, label: "Remo" } });
  assert.deepEqual(result, { messageId: "msg_abc123" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://qstash.upstash.io/v2/publish/${URL_DELIVER}`);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Upstash-Delay"], "90s");
  assert.equal(calls[0].init.headers["Upstash-Retries"], "0");
  assert.equal(calls[0].init.headers.Authorization, "Bearer token-secreto-qstash");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].init.body), { subscription, label: "Remo" });
  assert.equal(calls[0].init.redirect, "error");
});

test("qstash usa QSTASH_URL (región) solo si es https de upstash.io", async () => {
  const urls = [];
  const fetcher = async (url) => {
    urls.push(String(url));
    return jsonResponse({ messageId: "msg_1" });
  };
  const eu = { ...QSTASH_ENV, QSTASH_URL: "https://qstash-eu-central-1.upstash.io/" };
  await createQstashClient({ env: eu, fetcher }).publish({ delaySeconds: 5, body: {} });
  await createQstashClient({ env: eu, fetcher }).cancel("msg_1");
  assert.deepEqual(urls, [`https://qstash-eu-central-1.upstash.io/v2/publish/${URL_DELIVER}`, "https://qstash-eu-central-1.upstash.io/v2/messages/msg_1"]);
  for (const bad of ["http://qstash.upstash.io", "https://evil.example.com", "https://upstash.io.evil.com", "https://user:pw@qstash.upstash.io"]) {
    await assert.rejects(createQstashClient({ env: { ...QSTASH_ENV, QSTASH_URL: bad }, fetcher }).publish({ delaySeconds: 5, body: {} }), QstashConfigError, bad);
  }
  assert.equal(urls.length, 2, "con una dirección no permitida no se llega a llamar");
});

test("qstash cancel: 200 cancela, 404 no es un error, otros códigos sí", async () => {
  const calls = [];
  const reply = (status) => async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status });
  };
  const cancelWith = (status) => createQstashClient({ env: QSTASH_ENV, fetcher: reply(status) }).cancel("msg_xyz");
  assert.deepEqual(await cancelWith(200), { cancelled: true });
  assert.deepEqual(await cancelWith(404), { cancelled: false });
  await assert.rejects(cancelWith(500), QstashError);
  await assert.rejects(cancelWith(401), QstashError);
  assert.equal(calls[0].url, "https://qstash.upstash.io/v2/messages/msg_xyz");
  assert.equal(calls[0].init.method, "DELETE");
  assert.equal(calls[0].init.headers.Authorization, "Bearer token-secreto-qstash");
  await assert.rejects(createQstashClient({ env: QSTASH_ENV, fetcher: reply(200) }).cancel("../../x"), QstashError);
});

test("qstash: errores sin configuración, de red o con respuestas raras, y sin filtrar el token", async () => {
  const never = async () => assert.fail("no debe llamar a QStash");
  await assert.rejects(createQstashClient({ env: {}, fetcher: never }).publish({ delaySeconds: 5, body: {} }), QstashConfigError);
  await assert.rejects(createQstashClient({ env: { QSTASH_TOKEN: "t" }, fetcher: never }).cancel("msg_1"), QstashConfigError);
  await assert.rejects(createQstashClient({ env: { ...QSTASH_ENV, APP_URL: "http://gymapp.example.test" }, fetcher: never }).publish({ delaySeconds: 5, body: {} }), QstashConfigError);
  await assert.rejects(createQstashClient({ env: QSTASH_ENV, fetcher: never }).publish({ delaySeconds: -1, body: {} }), QstashError);

  const failures = [
    async () => { throw new Error("fallo de red con token-secreto-qstash dentro"); },
    async () => jsonResponse({ error: "token-secreto-qstash" }, 401),
    async () => jsonResponse({ messageId: "../../mal" }),
    async () => jsonResponse({}),
    async () => new Response("no es json", { status: 200 }),
  ];
  for (const fetcher of failures) {
    await assert.rejects(createQstashClient({ env: QSTASH_ENV, fetcher }).publish({ delaySeconds: 5, body: {} }), (failure) => {
      assert.ok(failure instanceof QstashError);
      assert.ok(!failure.message.includes("token-secreto-qstash"), "el error filtra el token");
      return true;
    });
  }
});

function scheduleSetup({ publishError } = {}) {
  const calls = [];
  const publish = async (args) => {
    calls.push(args);
    if (publishError) throw publishError;
    return { messageId: "msg_prog1" };
  };
  return { calls, handler: createScheduleHandler({ publish }), ...browserSubscription() };
}

test("schedule programa el aviso con segundos y una etiqueta limpia", async () => {
  const { calls, handler, subscription } = scheduleSetup();
  const response = await handler(appRequest("/api/push/schedule", { subscription: { ...subscription, expirationTime: null, extra: "x" }, seconds: 90, label: "  Press\nde banca  " }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { messageId: "msg_prog1" });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].delaySeconds, 90);
  assert.deepEqual(calls[0].body, { subscription, label: "Press de banca" });
});

test("schedule acepta 1 y 3600 segundos y no necesita etiqueta", async () => {
  const { calls, handler, subscription } = scheduleSetup();
  for (const seconds of [1, 3600]) assert.equal((await handler(appRequest("/api/push/schedule", { subscription, seconds }))).status, 200);
  assert.deepEqual(calls.map((call) => [call.delaySeconds, call.body.label]), [[1, ""], [3600, ""]]);
});

test("schedule rechaza segundos fuera de rango, suscripciones ajenas y cuerpos mal formados sin llamar a QStash", async () => {
  const { calls, handler, subscription } = scheduleSetup();
  const post = (body, options) => handler(appRequest("/api/push/schedule", body, options));
  for (const seconds of [0, 3601, 1.5, "60", null, undefined, -5]) assert.equal((await post({ subscription, seconds })).status, 400, String(seconds));
  for (const endpoint of ["http://fcm.googleapis.com/fcm/send/a", "https://evil.example.com/x", "https://127.0.0.1/x", "https://localhost/x", "https://fcm.googleapis.com.evil.com/x", "https://fcm.googleapis.com:8443/x", "https://user:pw@fcm.googleapis.com/x"]) {
    assert.equal((await post({ subscription: { ...subscription, endpoint }, seconds: 60 })).status, 400, endpoint);
  }
  assert.equal((await post({ subscription: { endpoint: subscription.endpoint, keys: { p256dh: "corta", auth: subscription.keys.auth } }, seconds: 60 })).status, 400);
  assert.equal((await post({ seconds: 60 })).status, 400);
  assert.equal((await post({ subscription, seconds: 60, label: 7 })).status, 400);
  assert.equal((await post(null, { raw: "no es json" })).status, 400);
  assert.equal((await post(null, { raw: "[]" })).status, 400);
  assert.equal((await post(null, { raw: "null" })).status, 400);
  assert.equal((await post({ subscription, seconds: 60, label: "x".repeat(5000) })).status, 413);
  assert.equal(calls.length, 0);
});

test("schedule exige POST, mismo origen y JSON", async () => {
  const { calls, handler, subscription } = scheduleSetup();
  const body = { subscription, seconds: 30 };
  assert.equal((await handler(appRequest("/api/push/schedule", body, { method: "GET" }))).status, 405);
  assert.equal((await handler(appRequest("/api/push/schedule", body, { headers: { origin: "https://evil.example.com" } }))).status, 403);
  assert.equal((await handler(new Request(`${ORIGIN}/api/push/schedule`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))).status, 403, "sin cabecera Origin");
  assert.equal((await handler(appRequest("/api/push/schedule", body, { headers: { "content-type": "text/plain" } }))).status, 415);
  assert.equal(calls.length, 0);
});

test("schedule: los fallos de QStash dan errores genéricos y no filtran nada", async () => {
  const quiet = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.join(" "));
  try {
    for (const [failure, status] of [[new QstashError("QStash respondió 500 con token-secreto-qstash"), 502], [new QstashConfigError("Falta QSTASH_TOKEN"), 500], [new Error("boom"), 502]]) {
      const { handler, subscription } = scheduleSetup({ publishError: failure });
      const response = await handler(appRequest("/api/push/schedule", { subscription, seconds: 60 }));
      assert.equal(response.status, status);
      const text = JSON.stringify(await response.json());
      assert.equal(text, JSON.stringify({ error: "No se ha podido programar el aviso." }));
    }
  } finally {
    console.error = quiet;
  }
  assert.ok(logged.length === 3);
  assert.ok(logged.every((line) => !line.includes("token-secreto-qstash") && !line.includes("endpoint")), "el registro filtra datos");
});

test("cancel cancela, responde 200 si ya no existe y valida el identificador", async () => {
  const calls = [];
  let result = { cancelled: true };
  const handler = createCancelHandler({ cancel: async (id) => { calls.push(id); return result; } });
  const post = (body, options) => handler(appRequest("/api/push/cancel", body, options));

  let response = await post({ messageId: "msg_prog1" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, cancelled: true });
  result = { cancelled: false };
  response = await post({ messageId: "msg_prog1" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, cancelled: false });
  assert.equal(calls.length, 2);

  for (const messageId of ["", "../x", "a/b", 5, null, undefined, "a".repeat(101)]) assert.equal((await post({ messageId })).status, 400, String(messageId));
  assert.equal((await post(null, { raw: "{no" })).status, 400);
  assert.equal((await post({ messageId: "m".repeat(2000) })).status, 413);
  assert.equal((await post({ messageId: "msg_1" }, { method: "GET" })).status, 405);
  assert.equal((await post({ messageId: "msg_1" }, { headers: { origin: "https://evil.example.com" } })).status, 403);
  assert.equal((await post({ messageId: "msg_1" }, { headers: { "content-type": "text/plain" } })).status, 415);
  assert.equal(calls.length, 2);
});

test("cancel: los fallos de QStash dan errores genéricos", async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    for (const [failure, status] of [[new QstashError("QStash respondió 500"), 502], [new QstashConfigError("Falta QSTASH_TOKEN"), 500]]) {
      const handler = createCancelHandler({ cancel: async () => { throw failure; } });
      const response = await handler(appRequest("/api/push/cancel", { messageId: "msg_1" }));
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { error: "No se ha podido cancelar el aviso." });
    }
  } finally {
    console.error = quiet;
  }
});

// ---------- Paso 6: sincronización con el cronómetro ----------

function syncSetup({ subscription = browserSubscription().subscription, scheduleStatus = 200, cancelStatus = 200, failNetwork = false, start = 1_000_000 } = {}) {
  const requests = [];
  const store = { value: null };
  let clock = start;
  let counter = 0;
  const state = { subscription, scheduleStatus, cancelStatus, failNetwork };
  const fetcher = async (path, init) => {
    const body = JSON.parse(init.body);
    requests.push({ path, body, init });
    if (state.failNetwork) throw new TypeError("sin conexión");
    if (path === SCHEDULE_PATH) {
      return state.scheduleStatus === 200 ? jsonResponse({ messageId: `msg_${++counter}` }) : jsonResponse({ error: "x" }, state.scheduleStatus);
    }
    return jsonResponse({ ok: true }, state.cancelStatus);
  };
  const sync = createPushSync({
    storage: { get: () => store.value, set: (value) => { store.value = value; }, remove: () => { store.value = null; } },
    fetcher,
    getSubscription: async () => state.subscription,
    now: () => clock,
  });
  const record = () => (store.value ? JSON.parse(store.value) : null);
  const kinds = () => requests.map((request) => (request.path === SCHEDULE_PATH ? "schedule" : "cancel"));
  return { ...sync, requests, store, state, record, kinds, tick: (ms) => { clock += ms; }, now: () => clock };
}

// Reproduce una acción del usuario como lo hace TimerProvider: transición del cronómetro + sincronización.
function act(setup, timer, action) {
  const next = transitionTimer(timer, action, setup.now());
  return { timer: next, done: setup.syncTimerPush(next) };
}

test("el límite del aviso coincide con el del cronómetro y la clave de almacenamiento es la del plan", () => {
  assert.equal(MAX_SCHEDULE_SECONDS, TIMER_MAX_REST_SECONDS);
  assert.equal(PUSH_STORAGE_KEY, "gymapp-push-v1");
});

test("pushEndsAt: solo hay fin en descanso en marcha", () => {
  const running = transitionTimer(INITIAL_TIMER, { type: "start" }, 5000);
  assert.equal(pushEndsAt(running), 5000 + 90_000);
  const paused = transitionTimer(running, { type: "pause" }, 35_000);
  assert.equal(pushEndsAt(paused), null);
  assert.equal(pushEndsAt(transitionTimer(paused, { type: "start" }, 40_000)), 40_000 + 60_000, "al reanudar cuenta el tiempo restante");
  assert.equal(pushEndsAt(INITIAL_TIMER), null);
  assert.equal(pushEndsAt(transitionTimer(INITIAL_TIMER, { type: "startStopwatch" }, 1), { }), null);
  assert.equal(pushEndsAt(transitionTimer(INITIAL_TIMER, { type: "configure", mode: "stopwatch", seconds: 60 }, 1)), null);
  assert.equal(pushEndsAt(null), null);
});

test("start agenda una vez con el tiempo restante y guarda messageId y endsAt", async () => {
  const setup = syncSetup();
  const { timer, done } = act(setup, INITIAL_TIMER, { type: "start" });
  await done;
  assert.deepEqual(setup.kinds(), ["schedule"]);
  assert.equal(setup.requests[0].body.seconds, 90);
  assert.equal(setup.requests[0].body.label, "Descanso");
  assert.deepEqual(setup.requests[0].body.subscription, setup.state.subscription);
  assert.equal(setup.requests[0].init.keepalive, true);
  assert.deepEqual(setup.record(), { messageId: "msg_1", endsAt: pushEndsAt(timer) });
});

test("startRest agenda con la duración completa y la etiqueta del ejercicio", async () => {
  const setup = syncSetup();
  const { done } = act(setup, INITIAL_TIMER, { type: "startRest", seconds: 120, label: "Press de banca" });
  await done;
  assert.deepEqual(setup.kinds(), ["schedule"]);
  assert.equal(setup.requests[0].body.seconds, 120);
  assert.equal(setup.requests[0].body.label, "Press de banca");
});

test("si el fin coincide con lo guardado no se llama al servidor (varias pestañas o repeticiones)", async () => {
  const setup = syncSetup();
  const { timer, done } = act(setup, INITIAL_TIMER, { type: "start" });
  await done;
  setup.tick(5000);
  await setup.syncTimerPush(timer);
  await setup.syncTimerPush(timer);
  assert.deepEqual(setup.kinds(), ["schedule"]);
});

test("pause, reset y configure cancelan el aviso pendiente", async () => {
  for (const action of [{ type: "pause" }, { type: "reset" }, { type: "configure", mode: "rest", seconds: 60 }]) {
    const setup = syncSetup();
    let { timer, done } = act(setup, INITIAL_TIMER, { type: "start" });
    await done;
    setup.tick(10_000);
    ({ timer, done } = act(setup, timer, action));
    await done;
    assert.deepEqual(setup.kinds(), ["schedule", "cancel"], action.type);
    assert.equal(setup.requests[1].body.messageId, "msg_1");
    assert.equal(setup.record(), null, action.type);
  }
});

test("pausar y reanudar cancela y reagenda con el tiempo restante", async () => {
  const setup = syncSetup();
  let { timer, done } = act(setup, INITIAL_TIMER, { type: "start" });
  await done;
  setup.tick(30_000);
  ({ timer, done } = act(setup, timer, { type: "pause" }));
  await done;
  setup.tick(5_000);
  ({ timer, done } = act(setup, timer, { type: "start" }));
  await done;
  assert.deepEqual(setup.kinds(), ["schedule", "cancel", "schedule"]);
  assert.equal(setup.requests[2].body.seconds, 60);
  assert.equal(setup.record().messageId, "msg_2");
});

test("extend (+30 s) cancela el aviso anterior y agenda el nuevo fin", async () => {
  const setup = syncSetup();
  let { timer, done } = act(setup, INITIAL_TIMER, { type: "start" });
  await done;
  setup.tick(20_000);
  ({ timer, done } = act(setup, timer, { type: "extend", seconds: 30 }));
  await done;
  assert.deepEqual(setup.kinds(), ["schedule", "cancel", "schedule"]);
  assert.equal(setup.requests[1].body.messageId, "msg_1");
  assert.equal(setup.requests[2].body.seconds, 100);
  assert.deepEqual(setup.record(), { messageId: "msg_2", endsAt: pushEndsAt(timer) });
});

test("dos descansos seguidos: queda un solo aviso, el del último", async () => {
  const setup = syncSetup();
  let { timer, done } = act(setup, INITIAL_TIMER, { type: "startRest", seconds: 90, label: "Sentadilla" });
  await done;
  setup.tick(40_000);
  ({ timer, done } = act(setup, timer, { type: "startRest", seconds: 60, label: "Remo" }));
  await done;
  assert.deepEqual(setup.kinds(), ["schedule", "cancel", "schedule"]);
  assert.equal(setup.requests[2].body.label, "Remo");
  assert.equal(setup.record().messageId, "msg_2");
});

test("el cronómetro ascendente y el reposo no agendan nada ni llaman al servidor", async () => {
  const setup = syncSetup();
  await setup.syncTimerPush(INITIAL_TIMER);
  await setup.syncTimerPush(transitionTimer(INITIAL_TIMER, { type: "startStopwatch" }, setup.now()));
  assert.deepEqual(setup.requests, []);
});

test("sin suscripción no agenda nada, pero sí cancela lo pendiente", async () => {
  const setup = syncSetup({ subscription: null });
  const { done } = act(setup, INITIAL_TIMER, { type: "start" });
  await done;
  assert.deepEqual(setup.requests, []);
  assert.equal(setup.record(), null);

  // Ya había un aviso (se desactivaron los avisos después): cancelarlo no necesita suscripción.
  setup.store.value = JSON.stringify({ messageId: "msg_viejo", endsAt: setup.now() + 50_000 });
  await setup.cancelPendingPush();
  assert.deepEqual(setup.kinds(), ["cancel"]);
  assert.equal(setup.requests[0].body.messageId, "msg_viejo");
  assert.equal(setup.record(), null);
});

test("un aviso que ya tocaba se descarta sin llamar a cancel", async () => {
  const setup = syncSetup();
  setup.store.value = JSON.stringify({ messageId: "msg_pasado", endsAt: setup.now() - 1 });
  await setup.syncTimerPush(INITIAL_TIMER);
  assert.deepEqual(setup.requests, []);
  assert.equal(setup.record(), null);
  const { done } = act(setup, INITIAL_TIMER, { type: "start" });
  await done;
  assert.deepEqual(setup.kinds(), ["schedule"], "no se cancela el ya entregado");
});

test("sin conexión no rompe nada y se repara al volver", async () => {
  const setup = syncSetup({ failNetwork: true });
  const { timer, done } = act(setup, INITIAL_TIMER, { type: "start" });
  await assert.doesNotReject(done);
  assert.equal(setup.record(), null);
  setup.state.failNetwork = false;
  setup.tick(3000);
  await setup.syncTimerPush(timer);
  assert.deepEqual(setup.kinds(), ["schedule", "schedule"]);
  assert.equal(setup.requests[1].body.seconds, 87);
  assert.equal(setup.record().messageId, "msg_1");
});

test("si no se puede cancelar el aviso anterior no se agenda otro (evita un aviso falso) y se reintenta", async () => {
  const setup = syncSetup();
  let { timer, done } = act(setup, INITIAL_TIMER, { type: "start" });
  await done;
  setup.state.failNetwork = true;
  setup.tick(10_000);
  ({ timer, done } = act(setup, timer, { type: "pause" }));
  await done;
  assert.equal(setup.record().messageId, "msg_1", "se conserva para reintentar");
  setup.state.failNetwork = false;
  await setup.syncTimerPush(timer);
  assert.deepEqual(setup.kinds(), ["schedule", "cancel", "cancel"]);
  assert.equal(setup.record(), null);

  // 5xx del servidor: también reintentable. 4xx: se descarta para no quedar bloqueado.
  for (const [status, kept] of [[502, true], [429, true], [400, false], [403, false]]) {
    const other = syncSetup({ cancelStatus: status });
    other.store.value = JSON.stringify({ messageId: "msg_x", endsAt: other.now() + 60_000 });
    await other.cancelPendingPush();
    assert.equal(other.record() !== null, kept, String(status));
  }
});

test("si el servidor rechaza agendar no se guarda nada", async () => {
  for (const scheduleStatus of [400, 500, 502]) {
    const setup = syncSetup({ scheduleStatus });
    await act(setup, INITIAL_TIMER, { type: "start" }).done;
    assert.equal(setup.record(), null, String(scheduleStatus));
  }
});

test("acciones seguidas sin esperar: se llega siempre al último estado, sin avisos de más", async () => {
  const setup = syncSetup();
  let timer = INITIAL_TIMER;
  const pending = [];
  for (const action of [{ type: "start" }, { type: "pause" }, { type: "start" }, { type: "pause" }]) {
    const result = act(setup, timer, action);
    timer = result.timer;
    pending.push(result.done);
  }
  await Promise.all(pending);
  assert.equal(setup.record(), null, "al final está en pausa: no debe quedar aviso");
  const scheduled = setup.requests.filter((request) => request.path === SCHEDULE_PATH).length;
  const cancelled = setup.requests.filter((request) => request.path === CANCEL_PATH).length;
  assert.equal(scheduled, cancelled, "todo lo agendado quedó cancelado");

  // Pausa durante una petición en curso: el aviso agendado se cancela después.
  const racing = syncSetup();
  const started = act(racing, INITIAL_TIMER, { type: "start" });
  const paused = act(racing, started.timer, { type: "pause" });
  await Promise.all([started.done, paused.done]);
  assert.equal(racing.record(), null);
  assert.equal(racing.requests.filter((request) => request.path === SCHEDULE_PATH).length, racing.requests.filter((request) => request.path === CANCEL_PATH).length);
});

test("la sincronización usa el bloqueo entre pestañas y no propaga errores del almacenamiento", async () => {
  let locks = 0;
  const calls = [];
  const sync = createPushSync({
    storage: { get: () => { throw new Error("sin almacenamiento"); }, set: () => { throw new Error("sin almacenamiento"); }, remove: () => { throw new Error("sin almacenamiento"); } },
    fetcher: async (path) => { calls.push(path); return jsonResponse({ messageId: "msg_1" }); },
    getSubscription: async () => browserSubscription().subscription,
    lock: async (task) => { locks += 1; return task(); },
    now: () => 1000,
  });
  const running = transitionTimer(INITIAL_TIMER, { type: "start" }, 1000);
  await assert.doesNotReject(sync.syncTimerPush(running));
  assert.equal(locks, 1);
  assert.deepEqual(calls, [SCHEDULE_PATH]);
  await assert.doesNotReject(createPushSync({ storage: { get: () => null, set() {}, remove() {} }, fetcher: async () => { throw new Error("x"); }, getSubscription: async () => { throw new Error("y"); }, now: () => 1000 }).syncTimerPush(running));
});

test("los datos guardados corruptos se ignoran", async () => {
  for (const value of ["no es json", "{}", JSON.stringify({ messageId: "../x", endsAt: 5 }), JSON.stringify({ messageId: "msg_1", endsAt: "5" }), "null"]) {
    const setup = syncSetup();
    setup.store.value = value;
    await act(setup, INITIAL_TIMER, { type: "start" }).done;
    assert.deepEqual(setup.kinds(), ["schedule"], value);
  }
});

test("sync.mjs puede ir al navegador: no importa módulos de Node", () => {
  const source = readFileSync(new URL("../src/lib/push/sync.mjs", import.meta.url), "utf8");
  assert.ok(!/^\s*import\b/m.test(source), "sync.mjs no debe importar nada (validate/qstash/signature usan node:crypto o Buffer)");
  const client = readFileSync(new URL("../src/lib/push/client.ts", import.meta.url), "utf8");
  assert.ok(!/from\s+["'][^"']*(qstash|signature|validate|send|handlers)\.mjs["']/.test(client), "client.ts no debe importar módulos de servidor");
});

// ---------- Paso 7: app abierta, duplicados y respaldo local ----------

const SW_SOURCE = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

// Ejecuta public/sw.js con un `self` simulado y devuelve lo que registra y los eventos que escucha.
function loadServiceWorker({ windows = [] } = {}) {
  const shown = [];
  const listeners = {};
  const opened = [];
  const self = {
    location: { origin: "https://gymapp.example.test" },
    registration: { showNotification: async (title, options) => { shown.push({ title, options }); } },
    clients: {
      claim: async () => {},
      matchAll: async () => windows,
      openWindow: async (url) => { opened.push(url); },
    },
    skipWaiting: () => {},
    addEventListener: (type, handler) => { listeners[type] = handler; },
  };
  vm.runInNewContext(SW_SOURCE, { self, URL, console });
  // Dispara un evento y espera a lo que el service worker pase a waitUntil.
  async function fire(type, event) {
    const waits = [];
    listeners[type]({ ...event, waitUntil: (promise) => waits.push(promise) });
    await Promise.all(waits);
  }
  return { shown, opened, fire, listeners };
}

const pushEvent = (data) => ({ data: data === undefined ? null : { json: () => { if (data instanceof Error) throw data; return data; } } });

test("el service worker muestra SIEMPRE una notificación (iOS no admite pushes silenciosos)", async () => {
  const cases = [
    pushEvent({ title: "Descanso terminado", body: "Press de banca · ya puedes hacer la siguiente serie.", url: "/cronometro" }),
    pushEvent(undefined),
    pushEvent({}),
    pushEvent(new SyntaxError("json roto")),
    pushEvent("texto suelto"),
    pushEvent(null),
    pushEvent({ title: 42, body: ["x"], url: {} }),
    pushEvent({ title: "   ", body: "" }),
  ];
  for (const [index, event] of cases.entries()) {
    const worker = loadServiceWorker();
    await worker.fire("push", event);
    assert.equal(worker.shown.length, 1, `caso ${index}`);
    assert.ok(worker.shown[0].title.length > 0);
    assert.equal(worker.shown[0].options.tag, "timer");
  }
});

test("el service worker, sin datos válidos, usa los textos por defecto del servidor", async () => {
  const worker = loadServiceWorker();
  await worker.fire("push", pushEvent(undefined));
  const { title, body, url } = buildNotificationPayload("");
  assert.equal(worker.shown[0].title, title);
  assert.equal(worker.shown[0].options.body, body);
  assert.equal(worker.shown[0].options.data.url, url);
});

test("el service worker y la notificación local comparten tag, icono y textos", async () => {
  const worker = loadServiceWorker();
  await worker.fire("push", pushEvent(buildNotificationPayload("Remo")));
  const [{ title, options }] = worker.shown;
  assert.equal(options.tag, NOTIFICATION_TAG);
  assert.equal(options.icon, NOTIFICATION_ICON);
  assert.equal(options.badge, NOTIFICATION_ICON);
  assert.equal(options.renotify, true);
  assert.equal(title, DELIVER_TITLE);
  assert.equal(options.body, "Remo · ya puedes hacer la siguiente serie.");
  // Los valores por defecto del service worker (copia manual) no se pueden desviar del módulo compartido.
  assert.ok(SW_SOURCE.includes(`const NOTIFICATION_TAG = "${NOTIFICATION_TAG}"`));
  assert.ok(SW_SOURCE.includes(`"${NOTIFICATION_ICON}"`));
  assert.ok(SW_SOURCE.includes(`const DEFAULT_TITLE = "${DELIVER_TITLE}"`));
  assert.ok(SW_SOURCE.includes(`const DEFAULT_BODY = "${DELIVER_BODY}"`));
});

test("el payload del servidor y el de la notificación local son el mismo", () => {
  for (const label of ["Descanso", "", "Press de banca", "  Remo\n con barra  ", "x".repeat(300), undefined, 5]) {
    assert.deepEqual(buildDeliverPayload(label), buildNotificationPayload(typeof label === "string" ? cleanLabel(label) : ""));
  }
  assert.equal(buildNotificationPayload("Descanso").body, DELIVER_BODY);
  assert.equal(buildNotificationPayload("Remo\u0000x").body, "Remo x · ya puedes hacer la siguiente serie.");
});

test("al tocar la notificación se enfoca la app abierta o se abre /cronometro, y solo de este origen", async () => {
  const closed = [];
  const notification = (url) => ({ close: () => closed.push(url), data: { url } });
  let worker = loadServiceWorker({ windows: [{ url: "https://gymapp.example.test/entrenar", focus: async () => { worker.focused = true; } }] });
  await worker.fire("notificationclick", { notification: notification("/cronometro") });
  assert.equal(worker.focused, true);
  assert.deepEqual(worker.opened, []);

  for (const [url, expected] of [["/cronometro", "https://gymapp.example.test/cronometro"], ["https://evil.example.com/x", "https://gymapp.example.test/cronometro"], ["http://", "https://gymapp.example.test/cronometro"], ["javascript:alert(1)", "https://gymapp.example.test/cronometro"]]) {
    worker = loadServiceWorker();
    await worker.fire("notificationclick", { notification: notification(url) });
    assert.deepEqual(worker.opened, [expected], url);
  }
  assert.equal(closed.length, 5);
});

test("el registro de push se conserva hasta que el cronómetro termina (para saber que el push está activo)", async () => {
  const setup = syncSetup();
  let { timer, done } = act(setup, INITIAL_TIMER, { type: "start" });
  await done;
  const endsAt = pushEndsAt(timer);
  const hasPush = (value) => setup.record()?.endsAt === value;

  // Pasa el fin y llega una sincronización (p. ej. al volver a primer plano) antes de que el cronómetro marque "terminado".
  setup.tick(90_500);
  await setup.syncTimerPush(timer);
  assert.equal(hasPush(endsAt), true, "el registro sigue ahí mientras el cronómetro aún no ha terminado");
  assert.deepEqual(setup.kinds(), ["schedule"]);

  // Cuando el cronómetro termina, el siguiente ajuste descarta el aviso ya entregado sin llamar a cancel.
  timer = transitionTimer(timer, { type: "tick" }, setup.now());
  assert.equal(timer.status, "finished");
  await setup.syncTimerPush(timer);
  assert.equal(setup.record(), null);
  assert.deepEqual(setup.kinds(), ["schedule"]);
});

test("hasPendingPush: solo con un push programado para exactamente ese fin", async () => {
  const setup = syncSetup();
  const { timer, done } = act(setup, INITIAL_TIMER, { type: "start" });
  await done;
  const endsAt = pushEndsAt(timer);
  assert.equal(setup.hasPendingPush(endsAt), true);
  assert.equal(setup.hasPendingPush(endsAt + 1), false);
  await act(setup, timer, { type: "pause" }).done;
  assert.equal(setup.hasPendingPush(endsAt), false, "tras pausar ya no hay push");

  const none = syncSetup({ subscription: null });
  const started = act(none, INITIAL_TIMER, { type: "start" });
  await started.done;
  assert.equal(none.hasPendingPush(pushEndsAt(started.timer)), false, "sin suscripción no hay push: toca el respaldo local");
  const offline = syncSetup({ failNetwork: true });
  const failed = act(offline, INITIAL_TIMER, { type: "start" });
  await failed.done;
  assert.equal(offline.hasPendingPush(pushEndsAt(failed.timer)), false, "si no se pudo programar, toca el respaldo local");
});

test("respaldo local: solo si no hay push para ese fin, es reciente y es un descanso", () => {
  const run = { endsAt: 1_000_000 };
  const noPush = () => false;
  const withPush = () => true;
  assert.equal(shouldNotifyLocally({ run, mode: "rest", now: run.endsAt + 300, hasPush: noPush }), true);
  assert.equal(shouldNotifyLocally({ run, mode: "rest", now: run.endsAt + LOCAL_NOTIFICATION_WINDOW_MS, hasPush: noPush }), true);
  assert.equal(shouldNotifyLocally({ run, mode: "rest", now: run.endsAt + 300, hasPush: withPush }), false, "con push activo no se duplica");
  assert.equal(shouldNotifyLocally({ run, mode: "rest", now: run.endsAt + LOCAL_NOTIFICATION_WINDOW_MS + 1, hasPush: noPush }), false, "terminó hace rato: sería un aviso falso");
  assert.equal(shouldNotifyLocally({ run, mode: "stopwatch", now: run.endsAt, hasPush: noPush }), false);
  assert.equal(shouldNotifyLocally({ run: null, mode: "rest", now: run.endsAt, hasPush: noPush }), false);
  let asked;
  shouldNotifyLocally({ run, mode: "rest", now: run.endsAt, hasPush: (value) => { asked = value; return false; } });
  assert.equal(asked, run.endsAt, "se consulta el push de ese fin");
});

// Navegador simulado para probar la notificación local de client.ts.
async function withBrowser({ permission = "granted", visibility = "visible", serviceWorker = true, notification = true, showError, hasRegistration = true }, run) {
  const shown = [];
  const registration = { showNotification: async (title, options) => { if (showError) throw showError; shown.push({ title, options }); } };
  const saved = Object.fromEntries(["window", "navigator", "Notification", "document"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const define = (key, value) => Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  define("navigator", serviceWorker ? { serviceWorker: { ready: hasRegistration ? Promise.resolve(registration) : new Promise(() => {}) } } : {});
  define("window", notification ? { Notification: { permission } } : {});
  if (notification) define("Notification", { permission });
  else delete globalThis.Notification;
  define("document", { visibilityState: visibility });
  try {
    const client = await import("../src/lib/push/client.ts");
    return await run({ client, shown });
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test("notificación local: se muestra con el mismo contenido que el push cuando el permiso está concedido", async () => {
  await withBrowser({}, async ({ client, shown }) => {
    assert.equal(await client.showLocalTimerNotification("Press de banca"), true);
    assert.equal(shown.length, 1);
    const [{ title, options }] = shown;
    assert.deepEqual({ title, body: options.body, url: options.data.url }, buildDeliverPayload("Press de banca"));
    assert.equal(options.tag, NOTIFICATION_TAG);
    assert.equal(options.icon, NOTIFICATION_ICON);
    assert.equal(options.renotify, true);
    assert.equal("vibrate" in options, false, "con la página visible ya vibra el cronómetro");
  });
  await withBrowser({ visibility: "hidden" }, async ({ client, shown }) => {
    assert.equal(await client.showLocalTimerNotification("Remo"), true);
    assert.deepEqual(shown[0].options.vibrate, [120, 60, 120]);
  });
});

test("notificación local: sin permiso concedido, sin soporte o con fallos no muestra nada ni lanza", async () => {
  for (const permission of ["denied", "default"]) {
    await withBrowser({ permission }, async ({ client, shown }) => {
      assert.equal(await client.showLocalTimerNotification("Remo"), false, permission);
      assert.equal(shown.length, 0);
    });
  }
  await withBrowser({ serviceWorker: false }, async ({ client, shown }) => {
    assert.equal(await client.showLocalTimerNotification("Remo"), false);
    assert.equal(shown.length, 0);
  });
  await withBrowser({ notification: false }, async ({ client }) => {
    assert.equal(await client.showLocalTimerNotification("Remo"), false);
  });
  await withBrowser({ showError: new TypeError("no se puede") }, async ({ client }) => {
    assert.equal(await client.showLocalTimerNotification("Remo"), false);
  });
});
