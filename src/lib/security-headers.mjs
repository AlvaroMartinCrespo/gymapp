/**
 * Cabeceras de seguridad para todas las rutas (se aplican en next.config.ts).
 *
 * La política CSP refleja lo que la app carga hoy:
 *  - Next.js inyecta scripts y estilos en línea, así que `script-src`/`style-src` llevan 'unsafe-inline'
 *    (sin nonces no hay otra opción con prerenderizado). En desarrollo hace falta además 'unsafe-eval'.
 *  - El visor 3D es `/anatomy/viewer.html` en un iframe del mismo origen: por eso `frame-src 'self'` y
 *    `frame-ancestors 'self'` (con 'none' el propio visor dejaría de verse). El decodificador meshopt usa
 *    WebAssembly ('wasm-unsafe-eval') y three.js puede crear texturas desde blobs.
 *  - Las fotos de perfil pueden estar en cualquier https, de ahí `img-src https:`.
 *  - Toda llamada a Supabase, Groq y QStash se hace desde el servidor: `connect-src 'self'`.
 */

export function contentSecurityPolicy({ dev = false } = {}) {
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "frame-src": ["'self'"],
    "frame-ancestors": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  return Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

/**
 * @param {{ dev?: boolean, reportOnly?: boolean }} options `reportOnly` publica la CSP como
 * `Content-Security-Policy-Report-Only`: el navegador solo avisa en la consola sin bloquear nada.
 */
export function securityHeaders({ dev = false, reportOnly = false } = {}) {
  return [
    { key: reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", value: contentSecurityPolicy({ dev }) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
    // Solo se envía en producción: en http://localhost el navegador lo ignora, pero evita confusiones.
    ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
  ];
}
