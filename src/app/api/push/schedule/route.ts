import { createScheduleHandler } from "@/lib/push/handlers.mjs";
import { createQstashClient } from "@/lib/push/qstash.mjs";
import { createRateLimiter } from "@/lib/rate-limit.mjs";

// Ruta Node (la de por defecto), no Edge.
// Cada aviso programado es una llamada de pago a QStash: máximo 30 por minuto y cliente.
export const POST = createScheduleHandler({
  publish: createQstashClient().publish,
  rateLimit: createRateLimiter({ limit: 30, windowMs: 60_000 }),
});
