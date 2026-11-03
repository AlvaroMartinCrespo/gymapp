import { createDeliverHandler } from "@/lib/push/handlers.mjs";
import { createPushSender } from "@/lib/push/send.mjs";
import { createQstashVerifier } from "@/lib/push/signature.mjs";

// Ruta Node (la de por defecto), no Edge: el cifrado usa node:crypto.
export const POST = createDeliverHandler({ verify: createQstashVerifier(), send: createPushSender() });
