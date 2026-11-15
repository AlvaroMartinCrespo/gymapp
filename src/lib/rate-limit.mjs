/**
 * Límite de peticiones por ventana fija, en memoria.
 *
 * Es una defensa "de mejor esfuerzo": en serverless cada instancia tiene su propio contador, así que el
 * límite real es por instancia y se reinicia en un arranque en frío. Basta para frenar ráfagas desde un
 * mismo cliente (cada aviso programado cuesta una llamada a QStash); si hiciera falta un tope global,
 * habría que moverlo a un almacén compartido (por ejemplo Upstash Redis) manteniendo esta interfaz.
 */

const MAX_TRACKED_KEYS = 5_000;

/**
 * @param {{ limit: number, windowMs: number, now?: () => number }} options
 * @returns {(key: string) => { allowed: boolean, retryAfterSeconds: number }}
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("limit debe ser un entero positivo");
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new RangeError("windowMs debe ser positivo");

  /** @type {Map<string, { count: number, resetAt: number }>} */
  const buckets = new Map();

  function prune(time) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= time) buckets.delete(key);
    // Si aun así hay demasiadas claves (ataque con muchas IP), se descartan las más antiguas.
    while (buckets.size >= MAX_TRACKED_KEYS) buckets.delete(buckets.keys().next().value);
  }

  return function check(key) {
    const time = now();
    let bucket = buckets.get(key);
    if (bucket && bucket.resetAt <= time) {
      buckets.delete(key);
      bucket = undefined;
    }
    if (!bucket) {
      if (buckets.size >= MAX_TRACKED_KEYS) prune(time);
      bucket = { count: 0, resetAt: time + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - time) / 1000)) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  };
}

/**
 * Identifica al cliente por la IP que añade la plataforma (Vercel y Cloudflare sobrescriben estas cabeceras,
 * por lo que el cliente no puede falsearlas). Se usa la primera de `x-forwarded-for`. Sin ninguna, todos
 * comparten la clave "desconocido": mejor limitar de más que dejar la ruta sin límite.
 */
export function clientKey(request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("cf-connecting-ip")?.trim() || request.headers.get("x-real-ip")?.trim() || "desconocido";
}
