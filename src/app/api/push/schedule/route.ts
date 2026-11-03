import { createScheduleHandler } from "@/lib/push/handlers.mjs";
import { createQstashClient } from "@/lib/push/qstash.mjs";

// Ruta Node (la de por defecto), no Edge.
export const POST = createScheduleHandler({ publish: createQstashClient().publish });
