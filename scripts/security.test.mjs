import assert from "node:assert/strict";
import { test } from "node:test";
import { createCancelHandler, createScheduleHandler } from "../src/lib/push/handlers.mjs";
import { clientKey, createRateLimiter } from "../src/lib/rate-limit.mjs";
import { contentSecurityPolicy, securityHeaders } from "../src/lib/security-headers.mjs";

const ORIGIN = "https://gymapp.example.test";

function post(path, body, headers = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("el limitador permite hasta el máximo y bloquea el resto de la ventana", () => {
  let time = 1_000;
  const check = createRateLimiter({ limit: 3, windowMs: 10_000, now: () => time });
  for (let i = 0; i < 3; i += 1) assert.equal(check("a").allowed, true);
  const blocked = check("a");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 10);
  time += 4_000;
  assert.equal(check("a").retryAfterSeconds, 6);
});

test("el limitador cuenta cada clave por separado y se reinicia al acabar la ventana", () => {
  let time = 0;
  const check = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => time });
  assert.equal(check("a").allowed, true);
  assert.equal(check("a").allowed, false);
  assert.equal(check("b").allowed, true);
  time += 1_000;
  assert.equal(check("a").allowed, true);
});

test("el limitador rechaza configuraciones inválidas", () => {
  assert.throws(() => createRateLimiter({ limit: 0, windowMs: 1000 }), RangeError);
  assert.throws(() => createRateLimiter({ limit: 1, windowMs: 0 }), RangeError);
});

test("clientKey usa la primera IP de x-forwarded-for y cae en otras cabeceras", () => {
  const request = (headers) => new Request(ORIGIN, { headers });
  assert.equal(clientKey(request({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "1.1.1.1");
  assert.equal(clientKey(request({ "cf-connecting-ip": "3.3.3.3" })), "3.3.3.3");
  assert.equal(clientKey(request({ "x-real-ip": "4.4.4.4" })), "4.4.4.4");
  assert.equal(clientKey(request({})), "desconocido");
});

test("schedule devuelve 429 con Retry-After al pasar el límite y no llama a QStash", async () => {
  let published = 0;
  const handler = createScheduleHandler({
    publish: async () => {
      published += 1;
      return { messageId: "msg_1" };
    },
    rateLimit: createRateLimiter({ limit: 1, windowMs: 60_000 }),
  });
  const body = { subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "x", auth: "y" } }, seconds: 60 };
  await handler(post("/api/push/schedule", body, { "x-forwarded-for": "9.9.9.9" }));
  const second = await handler(post("/api/push/schedule", body, { "x-forwarded-for": "9.9.9.9" }));
  assert.equal(second.status, 429);
  assert.ok(Number(second.headers.get("retry-after")) >= 1);
  assert.ok(published <= 1);
});

test("cancel limita por IP y otra IP conserva su cupo", async () => {
  const handler = createCancelHandler({
    cancel: async () => ({ cancelled: true }),
    rateLimit: createRateLimiter({ limit: 1, windowMs: 60_000 }),
  });
  const send = (ip) => handler(post("/api/push/cancel", { messageId: "msg_1" }, { "x-forwarded-for": ip }));
  await send("1.1.1.1");
  assert.equal((await send("1.1.1.1")).status, 429);
  assert.notEqual((await send("2.2.2.2")).status, 429);
});

test("las peticiones de otro origen no gastan el cupo del límite", async () => {
  const handler = createCancelHandler({
    cancel: async () => ({ cancelled: true }),
    rateLimit: createRateLimiter({ limit: 1, windowMs: 60_000 }),
  });
  const foreign = new Request(`${ORIGIN}/api/push/cancel`, {
    method: "POST",
    headers: { origin: "https://otra-web.test", "content-type": "application/json", "x-forwarded-for": "1.1.1.1" },
    body: JSON.stringify({ messageId: "msg_1" }),
  });
  assert.equal((await handler(foreign)).status, 403);
  assert.notEqual((await handler(post("/api/push/cancel", { messageId: "msg_1" }, { "x-forwarded-for": "1.1.1.1" }))).status, 429);
});

test("la CSP permite el visor 3D del mismo origen y bloquea lo demás", () => {
  const csp = contentSecurityPolicy();
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /frame-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /connect-src 'self'(;|$)/);
  assert.match(csp, /'wasm-unsafe-eval'/);
  assert.doesNotMatch(csp, /'unsafe-eval'/);
  assert.match(contentSecurityPolicy({ dev: true }), /'unsafe-eval'/);
});

test("las cabeceras de seguridad incluyen lo esencial y respetan el modo aviso", () => {
  const names = (options) => securityHeaders(options).map((header) => header.key);
  for (const key of ["Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) {
    assert.ok(names({}).includes(key), `falta ${key}`);
  }
  assert.ok(!names({ dev: true }).includes("Strict-Transport-Security"));
  assert.ok(names({ reportOnly: true }).includes("Content-Security-Policy-Report-Only"));
  assert.ok(!names({ reportOnly: true }).includes("Content-Security-Policy"));
});
