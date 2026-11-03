// Envía un aviso de prueba a /api/push/deliver firmando la petición como lo haría QStash.
// Sirve para comprobar el paso 4 (envío real) sin depender todavía de QStash.
//
// 1. Obtén la suscripción de ESTE dispositivo. En Chrome de escritorio, con la app abierta y los
//    avisos activados, pega en la consola de DevTools:
//      copy(JSON.stringify((await (await navigator.serviceWorker.ready).pushManager.getSubscription()).toJSON()))
//    y guarda el portapapeles en un archivo (p. ej. suscripcion.json). No lo subas al repositorio:
//    quien lo tenga puede enviar avisos a ese dispositivo hasta que se desactive.
// 2. Con `next dev` en marcha (APP_URL=http://localhost:3000 en .env.local) o contra producción:
//      node --env-file=.env.local scripts/push-deliver-test.mjs @suscripcion.json "Press de banca"
//    También acepta el JSON directamente como primer argumento.
//
// Necesita APP_URL y QSTASH_CURRENT_SIGNING_KEY (las mismas que usa el servidor).
import { readFileSync } from "node:fs";
import { deliverUrl, signQstashJwt } from "../src/lib/push/signature.mjs";

const [, , source, label] = process.argv;
const { APP_URL, QSTASH_CURRENT_SIGNING_KEY: key } = process.env;

if (!source || !APP_URL || !key) {
  console.error('Uso: node --env-file=.env.local scripts/push-deliver-test.mjs <suscripción JSON | @archivo.json> ["etiqueta"]');
  console.error("Faltan argumentos o las variables APP_URL y QSTASH_CURRENT_SIGNING_KEY.");
  process.exit(1);
}

let subscription;
try {
  subscription = JSON.parse(source.startsWith("@") ? readFileSync(source.slice(1), "utf8") : source);
} catch {
  console.error("La suscripción no es un JSON válido.");
  process.exit(1);
}

const url = deliverUrl(APP_URL);
const body = JSON.stringify({ subscription, ...(label ? { label } : {}) });
const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Upstash-Signature": signQstashJwt({ key, url, body: Buffer.from(body) }) },
  body,
});
console.log(`${url} → ${response.status}`);
console.log(await response.text());
process.exit(response.ok ? 0 : 1);
