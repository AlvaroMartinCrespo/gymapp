// Contenido de la notificación de fin de descanso. Lo comparten el servidor (payload del push) y el
// navegador (notificación local de respaldo), para que ambas digan lo mismo. Sin dependencias y sin
// nada de Node: se importa desde código cliente.
// public/sw.js no puede importar módulos y repite NOTIFICATION_TAG, NOTIFICATION_ICON y los textos por
// defecto; una prueba comprueba que coinciden.

/** Mismo tag en el push y en la notificación local: si coinciden dos, una sustituye a la otra en vez de apilarse. */
export const NOTIFICATION_TAG = "timer";
export const NOTIFICATION_ICON = "/icons/icon-192.png";
export const DELIVER_TITLE = "Descanso terminado";
export const DELIVER_BODY = "Ya puedes hacer la siguiente serie.";
export const DELIVER_URL = "/cronometro";
const GENERIC_LABEL = "Descanso";
const MAX_LABEL_LENGTH = 100;

function tidy(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_LABEL_LENGTH).trim();
}

/** Título y URL fijos; del nombre del descanso solo se usa el texto secundario (limpio y recortado). */
export function buildNotificationPayload(label) {
  const clean = tidy(label);
  return {
    title: DELIVER_TITLE,
    body: clean && clean !== GENERIC_LABEL ? `${clean} · ya puedes hacer la siguiente serie.` : DELIVER_BODY,
    url: DELIVER_URL,
  };
}
