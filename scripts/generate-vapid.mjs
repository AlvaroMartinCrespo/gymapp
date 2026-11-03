// Genera un par de claves VAPID (P-256) para las notificaciones push, sin dependencias.
// Uso: node scripts/generate-vapid.mjs
//
// Imprime las variables por pantalla y NO escribe ningún archivo: la clave privada
// solo debe copiarse a `.env.local` y a las variables de entorno de Vercel.
// El formato (base64url; pública = punto sin comprimir de 65 bytes; privada = 32 bytes)
// es el mismo que produce `web-push generate-vapid-keys`.
import { generateKeyPairSync } from "node:crypto";
import { pathToFileURL } from "node:url";

export function generateVapidKeys() {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  const x = Buffer.from(jwk.x, "base64url");
  const y = Buffer.from(jwk.y, "base64url");
  const d = Buffer.from(jwk.d, "base64url");
  if (x.length !== 32 || y.length !== 32 || d.length !== 32) {
    throw new Error("Las claves generadas no tienen la longitud esperada.");
  }
  return {
    publicKey: Buffer.concat([Buffer.from([0x04]), x, y]).toString("base64url"),
    privateKey: d.toString("base64url"),
  };
}

// Solo se ejecuta al lanzarlo directamente, no al importarlo desde otro archivo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { publicKey, privateKey } = generateVapidKeys();
  console.log("Claves VAPID generadas. Cópialas a .env.local y a Vercel (Production y Preview).");
  console.log("La clave privada es SECRETA: no la subas al repositorio ni la compartas.\n");
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
  console.log("VAPID_SUBJECT=mailto:tu@correo.com\n");
  console.log("(Cambia VAPID_SUBJECT por tu correo real.)");
  console.log("Si regeneras las claves, las suscripciones push existentes dejan de funcionar");
  console.log("y hay que volver a activar los avisos en cada dispositivo.");
}
