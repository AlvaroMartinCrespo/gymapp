import { createCancelHandler } from "@/lib/push/handlers.mjs";
import { createQstashClient } from "@/lib/push/qstash.mjs";

export const POST = createCancelHandler({ cancel: createQstashClient().cancel });
