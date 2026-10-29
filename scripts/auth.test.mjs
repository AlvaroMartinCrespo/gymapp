import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthHandler } from "../src/lib/supabase/auth.mjs";

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };
const user = { id: "user-id", email: "test@example.com", user_metadata: { username: "tester" } };
const session = { access_token: "secret-access", refresh_token: "secret-refresh", expires_in: 3600, user };
const request = (body, headers = {}) => new Request("https://gymapp.test/api/auth", {
  method: "POST",
  headers: { origin: "https://gymapp.test", "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

test("las operaciones internas reciben la sesión verificada sin exponer tokens al cliente", async () => {
  const handler = createAuthHandler({
    env,
    fetcher: async () => Response.json(user),
    onSession: async ({ user: account, accessToken, reply }) => {
      assert.equal(accessToken, "current");
      assert.equal(account.id, user.id);
      return reply({ saved: true });
    },
  });
  const response = await handler(request({ action: "session" }, { cookie: "gymapp-access=current" }));
  assert.deepEqual(await response.json(), { saved: true });
});

test("una operación interna conserva las cookies renovadas al construir su respuesta", async () => {
  const handler = createAuthHandler({
    env,
    fetcher: async () => Response.json(session),
    onSession: async ({ accessToken, reply }) => {
      assert.equal(accessToken, session.access_token);
      return reply({ saved: true }, 201);
    },
  });
  const response = await handler(request({ action: "session" }, { cookie: "gymapp-refresh=old" }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.getSetCookie().length, 3);
  assert.deepEqual(await response.json(), { saved: true });
});

test("login envía credenciales a Supabase y solo devuelve el usuario, con cookies protegidas", async () => {
  const handler = createAuthHandler({ env, fetcher: async (url, options) => {
    assert.equal(url.href, "https://project.supabase.co/auth/v1/token?grant_type=password");
    assert.equal(options.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
    assert.deepEqual(JSON.parse(options.body), { email: "test@example.com", password: "password123" });
    return Response.json(session);
  } });
  const response = await handler(request({ action: "login", email: "TEST@example.com", password: "password123", remember: true }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user: { id: user.id, email: user.email, username: "tester" } });
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 3);
  for (const cookie of cookies) assert.match(cookie, /Path=\/; HttpOnly; SameSite=Lax; Secure/);
  assert.match(cookies[0], /Max-Age=3600/);
  assert.match(cookies[1], /Max-Age=777[56]\d{3}/);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("sin mantener sesión, las cookies no sobreviven al cierre del navegador", async () => {
  const handler = createAuthHandler({ env, fetcher: async () => Response.json(session) });
  const response = await handler(request({ action: "login", email: user.email, password: "password123" }));
  for (const cookie of response.headers.getSetCookie()) assert.doesNotMatch(cookie, /Max-Age/);
});

test("el registro solicita el perfil y espera la confirmación de correo sin inventar sesión", async () => {
  const handler = createAuthHandler({ env, fetcher: async (url, options) => {
    assert.equal(url.pathname, "/auth/v1/signup");
    assert.deepEqual(JSON.parse(options.body).data, { username: "tester" });
    return Response.json(user);
  } });
  const response = await handler(request({ action: "signup", email: user.email, password: "password123", username: "tester" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user, null);
  assert.equal(response.headers.getSetCookie().length, 0);
});

test("el registro sin alias genera uno único y abre sesión sin confirmación", async () => {
  const usernames = new Set();
  const handler = createAuthHandler({ env, fetcher: async (url, options) => {
    assert.equal(url.pathname, "/auth/v1/signup");
    const body = JSON.parse(options.body);
    assert.equal(body.email, user.email);
    assert.equal(body.password, "password123");
    assert.match(body.data.username, /^rat_[a-f0-9]{24}$/);
    usernames.add(body.data.username);
    return Response.json({ ...session, user: { ...user, user_metadata: body.data } });
  } });
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await handler(request({ action: "signup", email: user.email, password: "password123" }));
    assert.equal(response.status, 200);
    assert.match((await response.json()).user.username, /^rat_[a-f0-9]{24}$/);
    assert.equal(response.headers.getSetCookie().length, 3);
  }
  assert.equal(usernames.size, 2);
});

test("bloquea CSRF, datos inválidos y contraseñas de registro cortas antes de llamar a Supabase", async () => {
  const handler = createAuthHandler({ env, fetcher: () => { throw new Error("Unexpected request"); } });
  assert.equal((await handler(request({ action: "login" }, { origin: "https://other.test" }))).status, 403);
  assert.equal((await handler(request({ action: "signup", email: user.email, username: "tester", password: "short" }))).status, 400);
  assert.equal((await handler(request({ action: "unknown" }))).status, 400);
  assert.equal((await handler(request({ action: "login", email: "invalid", password: "password123" }))).status, 400);
});

test("la sesión renueva tokens expirados y conserva la fecha límite original", async () => {
  const until = Date.now() + 86400000;
  const handler = createAuthHandler({ env, fetcher: async (url, options) => {
    if (url.pathname.endsWith("/user")) return Response.json({ error: "expired" }, { status: 401 });
    assert.equal(url.searchParams.get("grant_type"), "refresh_token");
    assert.deepEqual(JSON.parse(options.body), { refresh_token: "old-refresh" });
    return Response.json(session);
  } });
  const response = await handler(request({ action: "session" }, { cookie: `gymapp-access=old; gymapp-refresh=old-refresh; gymapp-remember=${until}` }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.id, user.id);
  assert.match(response.headers.getSetCookie()[2], new RegExp(String(until)));
  assert.match(response.headers.getSetCookie()[1], /Max-Age=86[34]\d{2}/);
});

test("una sesión recordada expirada se elimina y no llama al proveedor", async () => {
  const handler = createAuthHandler({ env, fetcher: () => { throw new Error("Unexpected request"); } });
  const response = await handler(request({ action: "session" }, { cookie: "gymapp-refresh=old; gymapp-remember=1" }));
  assert.deepEqual(await response.json(), { user: null });
  assert.equal(response.headers.getSetCookie().length, 3);
  for (const cookie of response.headers.getSetCookie()) assert.match(cookie, /Max-Age=0/);
});

test("la caída del proveedor no borra una sesión que podría seguir siendo válida", async () => {
  const handler = createAuthHandler({ env, fetcher: async () => new Response("Unavailable", { status: 503 }) });
  const response = await handler(request({ action: "session" }, { cookie: "gymapp-access=current; gymapp-refresh=refresh" }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.getSetCookie().length, 0);
});

test("logout revoca la sesión local en Supabase y borra todas las cookies", async () => {
  const handler = createAuthHandler({ env, fetcher: async (url, options) => {
    assert.equal(url.pathname, "/auth/v1/logout");
    assert.equal(url.searchParams.get("scope"), "local");
    assert.equal(options.headers.Authorization, "Bearer current");
    return new Response(null, { status: 204 });
  } });
  const response = await handler(request({ action: "logout" }, { cookie: "gymapp-access=current" }));
  assert.equal(response.status, 200);
  for (const cookie of response.headers.getSetCookie()) assert.match(cookie, /Max-Age=0/);
});

test("sin configuración falla de forma controlada y las claves administrativas se rechazan", async () => {
  for (const config of [{}, { ...env, SUPABASE_PUBLISHABLE_KEY: "sb_secret_do-not-use" }]) {
    const handler = createAuthHandler({ env: config });
    const response = await handler(request({ action: "login", email: user.email, password: "password123" }));
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /sb_secret|SUPABASE_URL|password123/);
  }
});

test("logout renueva un acceso caducado para revocar también la sesión de Supabase", async () => {
  const calls = [];
  const handler = createAuthHandler({ env, fetcher: async (url, options) => {
    calls.push(url.pathname);
    if (url.pathname.endsWith("/token")) return Response.json(session);
    if (options.headers.Authorization === "Bearer expired") return Response.json({}, { status: 401 });
    assert.equal(options.headers.Authorization, "Bearer secret-access");
    return new Response(null, { status: 204 });
  } });
  const response = await handler(request({ action: "logout" }, { cookie: "gymapp-access=expired; gymapp-refresh=refresh" }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/auth/v1/logout", "/auth/v1/token", "/auth/v1/logout"]);
  assert.equal(response.headers.getSetCookie().length, 3);
});

test("logout borra cookies una sola vez aunque el proveedor no responda", async () => {
  const handler = createAuthHandler({ env, fetcher: async () => { throw new Error("Network down"); } });
  const response = await handler(request({ action: "logout" }, { cookie: "gymapp-access=current" }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.getSetCookie().length, 3);
  assert.equal((await response.json()).user, null);
});

test("tokens revocados se eliminan, pero un límite de intentos conserva las cookies", async () => {
  for (const status of [400, 429]) {
    const handler = createAuthHandler({ env, fetcher: async () => Response.json({}, { status }) });
    const response = await handler(request({ action: "session" }, { cookie: "gymapp-refresh=invalid" }));
    assert.equal(response.status, status === 429 ? 429 : 200);
    assert.equal(response.headers.getSetCookie().length, status === 429 ? 0 : 3);
  }
});