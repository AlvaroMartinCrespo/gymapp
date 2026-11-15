import { createCancelHandler } from "@/lib/push/handlers.mjs";
import { createQstashClient } from "@/lib/push/qstash.mjs";
import { createRateLimiter } from "@/lib/rate-limit.mjs";

export const POST = createCancelHandler({
  cancel: createQstashClient().cancel,
  rateLimit: createRateLimiter({ limit: 30, windowMs: 60_000 }),
});
