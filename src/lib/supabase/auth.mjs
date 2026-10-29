const cookieNames = ["gymapp-access", "gymapp-refresh", "gymapp-remember"];
const ninetyDays = 90 * 24 * 60 * 60;

function readCookies(request) {
  const cookies = new Map();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    try {
      cookies.set(part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1)));
    } catch {
      continue;
    }
  }
  return cookies;
}

function publicUser(user) {
  if (!user || typeof user.id !== "string") throw new Error("Invalid user");
  return {
    id: user.id,
    email: typeof user.email === "string" ? user.email : null,
    username: typeof user.user_metadata?.username === "string" ? user.user_metadata.username : null,
  };
}

export function createAuthHandler({ env = process.env, fetcher = fetch, onSession = null } = {}) {
  return async function handleAuth(request) {
    const secure = new URL(request.url).protocol === "https:" || env.NODE_ENV === "production";
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      Vary: "Cookie, Origin",
    });
    const reply = (body, status = 200) => Response.json(body, { status, headers });
    const setCookie = (name, value, maxAge) => {
      let cookie = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax`;
      if (secure) cookie += "; Secure";
      if (maxAge !== undefined) cookie += `; Max-Age=${maxAge}`;
      headers.append("Set-Cookie", cookie);
    };
    const clearSession = () => cookieNames.forEach((name) => setCookie(name, "", 0));
    const saveSession = (session, rememberUntil) => {
      if (
        typeof session.access_token !== "string" || !session.access_token ||
        typeof session.refresh_token !== "string" || !session.refresh_token ||
        !Number.isFinite(session.expires_in) || session.expires_in <= 0
      ) throw new Error("Invalid session");
      const remaining = rememberUntil ? Math.max(0, Math.floor((rememberUntil - Date.now()) / 1000)) : undefined;
      setCookie(cookieNames[0], session.access_token, remaining === undefined ? undefined : Math.min(Math.floor(session.expires_in), remaining));
      setCookie(cookieNames[1], session.refresh_token, remaining);
      setCookie(cookieNames[2], rememberUntil ? String(rememberUntil) : "", remaining);
    };

    if (request.method !== "POST") return reply({ error: "Método no permitido." }, 405);
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return reply({ error: "Origen no permitido." }, 403);
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      return reply({ error: "Se requiere JSON." }, 415);
    }
    let body;
    try {
      const text = await request.text();
      if (text.length > 4096) return reply({ error: "Petición demasiado grande." }, 413);
      body = JSON.parse(text);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
    } catch {
      return reply({ error: "Petición inválida." }, 400);
    }
    if (!["login", "signup", "session", "logout"].includes(body.action)) {
      return reply({ error: "Acción no válida." }, 400);
    }
    const cookies = readCookies(request);
    if (body.action === "session" && !cookies.get(cookieNames[0]) && !cookies.get(cookieNames[1])) {
      return reply({ user: null });
    }

    try {
      const base = new URL(env.SUPABASE_URL ?? "");
      const key = env.SUPABASE_PUBLISHABLE_KEY;
      if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) {
        throw new Error("Invalid Supabase URL");
      }
      let validKey = typeof key === "string" && key.startsWith("sb_publishable_");
      if (!validKey && typeof key === "string" && key.split(".").length === 3) {
        try {
          validKey = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "anon";
        } catch {
          validKey = false;
        }
      }
      if (!validKey) throw new Error("Use a publishable key");

      const call = async (path, payload, token) => {
        const response = await fetcher(new URL(`/auth/v1/${path}`, base), {
          method: payload === undefined ? "GET" : "POST",
          headers: {
            apikey: key,
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: payload === undefined ? undefined : JSON.stringify(payload),
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        if (response.status === 429) return { status: 429, ok: false, data: null };
        if (response.status >= 500) throw new Error("Supabase unavailable");
        const data = response.status === 204 ? null : await response.json();
        return { status: response.status, ok: response.ok, data };
      };

      if (body.action === "logout") {
        try {
          let access = cookies.get(cookieNames[0]);
          const revoked = access ? await call("logout?scope=local", {}, access) : null;
          if ((!access || !revoked?.ok) && cookies.get(cookieNames[1])) {
            const refreshed = await call("token?grant_type=refresh_token", { refresh_token: cookies.get(cookieNames[1]) });
            if (refreshed.ok) {
              access = refreshed.data.access_token;
              const retried = await call("logout?scope=local", {}, access);
              if (!retried.ok) throw new Error("Revocation failed");
            } else if (refreshed.status === 429) {
              throw new Error("Revocation unavailable");
            }
          }
        } finally {
          clearSession();
        }
        return reply({ user: null, message: "Sesión cerrada." });
      }

      if (body.action === "session") {
        const rememberUntil = Number(cookies.get(cookieNames[2]) || 0);
        if (!Number.isFinite(rememberUntil) || (rememberUntil && rememberUntil <= Date.now())) {
          clearSession();
          return reply({ user: null });
        }
        const access = cookies.get(cookieNames[0]);
        if (access) {
          const current = await call("user", undefined, access);
          if (current.ok) {
            const user = publicUser(current.data);
            return onSession ? await onSession({ user, accessToken: access, reply }) : reply({ user });
          }
          if (current.status === 429) return reply({ error: "Demasiados intentos. Espera un momento." }, 429);
        }
        const refresh = cookies.get(cookieNames[1]);
        if (refresh) {
          const renewed = await call("token?grant_type=refresh_token", { refresh_token: refresh });
          if (renewed.ok) {
            const user = publicUser(renewed.data.user);
            saveSession(renewed.data, rememberUntil);
            return onSession ? await onSession({ user, accessToken: renewed.data.access_token, reply }) : reply({ user });
          }
          if (renewed.status === 429) return reply({ error: "Demasiados intentos. Espera un momento." }, 429);
        }
        clearSession();
        return reply({ user: null });
      }

      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = body.password;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== "string" || password.length === 0 || password.length > 128) {
        return reply({ error: "Introduce un correo y una contraseña válidos." }, 400);
      }
      const username = body.username ?? `rat_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
      if (body.action === "signup" && (password.length < 10 || typeof username !== "string" || !/^[A-Za-z0-9_]{3,30}$/.test(username))) {
        return reply({ error: "El usuario debe tener entre 3 y 30 letras, números o guiones bajos; la contraseña, al menos 10 caracteres." }, 400);
      }
      const signup = body.action === "signup";
      const result = await call(signup ? "signup" : "token?grant_type=password", {
        email,
        password,
        ...(signup ? { data: { username } } : {}),
      });
      if (result.status === 429) return reply({ error: "Demasiados intentos. Espera un momento." }, 429);
      if (!result.ok) {
        return reply({ error: signup
          ? "No se ha podido crear la cuenta. Revisa los datos o intenta iniciar sesión."
          : "No se ha podido iniciar sesión. Revisa las credenciales y confirma tu correo." }, signup ? 400 : 401);
      }
      if (signup && !result.data.access_token) {
        return reply({ user: null, message: "Revisa tu correo para confirmar la cuenta. Después podrás iniciar sesión." });
      }
      const user = publicUser(result.data.user);
      saveSession(result.data, body.remember === true ? Date.now() + ninetyDays * 1000 : 0);
      return reply({ user });
    } catch {
      if (body.action === "logout") {
        if (!headers.has("Set-Cookie")) clearSession();
        return reply({ user: null, error: "Sesión local cerrada. No se ha podido confirmar la revocación en Supabase." }, 503);
      }
      return reply({ error: "El servicio de acceso no está disponible. Inténtalo más tarde." }, 503);
    }
  };
}