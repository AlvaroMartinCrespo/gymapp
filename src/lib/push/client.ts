// Utilidades de notificaciones push para el navegador (sin dependencias).
// Solo se importa desde componentes cliente: usa navigator, window y Notification.
import { buildNotificationPayload, NOTIFICATION_ICON, NOTIFICATION_TAG } from "./notification.mjs";
import { createPushSync, PUSH_STORAGE_KEY } from "./sync.mjs";

export type PushSupport = "supported" | "unsupported" | "needs-install";
export type PushStatus = PushSupport | "unconfigured" | "denied" | "off" | "on";
export type PushErrorCode = "not-supported" | "unconfigured" | "dismissed" | "denied" | "failed";

export class PushError extends Error {
  code: PushErrorCode;

  constructor(code: PushErrorCode, message: string) {
    super(message);
    this.name = "PushError";
    this.code = code;
  }
}

const SERVICE_WORKER_TIMEOUT_MS = 5000;
// Una clave pública VAPID es un punto P-256 sin comprimir: 0x04 + 32 bytes (x) + 32 bytes (y).
const VAPID_KEY_BYTES = 65;

/** Clave pública VAPID (la inyecta Next en la compilación; puede estar vacía si falta la variable). */
export function getVapidPublicKey(): string {
  return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
}

/** iPhone, iPad o iPod (los iPad recientes se identifican como Mac táctil). */
export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** true si la app se abrió desde el icono de la pantalla de inicio. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return legacy || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

/**
 * En iPhone/iPad las push solo existen con la app instalada, así que ese caso se
 * comprueba antes: en una pestaña de Safari ni siquiera aparece `PushManager`.
 */
export function getPushSupport(): PushSupport {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unsupported";
  if (isIosDevice() && !isStandalone()) return "needs-install";
  const available = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return available ? "supported" : "unsupported";
}

/** Convierte una clave base64url (formato VAPID) a los bytes que pide `pushManager.subscribe`. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function readVapidKey(): Uint8Array<ArrayBuffer> | null {
  const key = getVapidPublicKey();
  if (!key) return null;
  try {
    const bytes = urlBase64ToUint8Array(key);
    return bytes.length === VAPID_KEY_BYTES && bytes[0] === 0x04 ? bytes : null;
  } catch {
    return null;
  }
}

/** Espera al service worker registrado, sin colgarse si nunca llega a registrarse. */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), SERVICE_WORKER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Suscripción push actual de este dispositivo, o null si no hay. */
export async function getSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport() !== "supported") return null;
  try {
    const registration = await getRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** Estado que debe mostrar el botón de avisos. */
export async function getPushStatus(): Promise<PushStatus> {
  const support = getPushSupport();
  if (support !== "supported") return support;
  if (!readVapidKey()) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  return (await getSubscription()) ? "on" : "off";
}

function sameKey(subscription: PushSubscription, key: Uint8Array): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((value, index) => value === key[index]);
}

/**
 * Pide permiso y suscribe este dispositivo. Debe llamarse directamente desde el
 * manejador de un toque: el permiso no se puede pedir al cargar la página, y iOS
 * lo rechaza si antes de pedirlo hay una espera asíncrona. Por eso el permiso es
 * lo primero que se hace aquí.
 */
export async function subscribePush(): Promise<PushSubscription> {
  if (getPushSupport() !== "supported") {
    throw new PushError("not-supported", "Este dispositivo no admite notificaciones push.");
  }
  const key = readVapidKey();
  if (!key) throw new PushError("unconfigured", "Falta la clave pública VAPID.");

  const permission = await Notification.requestPermission();
  if (permission === "denied") throw new PushError("denied", "Permiso de notificaciones denegado.");
  if (permission !== "granted") throw new PushError("dismissed", "Se cerró la petición de permiso sin responder.");

  const registration = await getRegistration();
  if (!registration) throw new PushError("failed", "El service worker no está listo.");

  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      if (sameKey(existing, key)) return existing;
      // Suscrita con otra clave VAPID (p. ej. se regeneraron): hay que renovarla.
      await existing.unsubscribe();
    }
    return await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  } catch {
    throw new PushError("failed", "No se pudo crear la suscripción push.");
  }
}

/** Cancela la suscripción de este dispositivo. Devuelve true si había una. */
export async function unsubscribePush(): Promise<boolean> {
  const subscription = await getSubscription();
  if (!subscription) return false;
  try {
    return await subscription.unsubscribe();
  } catch {
    return false;
  }
}

/** Suscripción como objeto plano para enviarla al servidor; null si no hay permiso o suscripción. */
async function getSerializableSubscription() {
  if (getPushSupport() !== "supported" || Notification.permission !== "granted") return null;
  return (await getSubscription())?.toJSON() ?? null;
}

const pushSync = createPushSync({
  storage: {
    get: () => window.localStorage.getItem(PUSH_STORAGE_KEY),
    set: (value: string) => window.localStorage.setItem(PUSH_STORAGE_KEY, value),
    remove: () => window.localStorage.removeItem(PUSH_STORAGE_KEY),
  },
  fetcher: (path: string, init: RequestInit) => fetch(path, init),
  getSubscription: getSerializableSubscription,
  // Una sola pestaña sincroniza a la vez: evita avisos duplicados si dos pestañas actúan a la vez.
  lock: (task: () => Promise<void>) =>
    typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("gymapp-push-sync", task) : task(),
});

/**
 * Ajusta el aviso programado al estado del cronómetro (agenda, reagenda o cancela según haga falta).
 * Es idempotente y nunca lanza; llámala tras cada acción del usuario y al volver a primer plano.
 * La lógica está en sync.mjs para poder probarla sin navegador.
 */
export const syncTimerPush: (timer: Parameters<typeof pushSync.syncTimerPush>[0]) => Promise<void> = pushSync.syncTimerPush;

/** Cancela el aviso pendiente, si lo hay (p. ej. al desactivar los avisos). */
export const cancelPendingPush: () => Promise<void> = pushSync.cancelPendingPush;

/** true si hay un push programado para este fin: él mostrará la notificación y no hace falta la local. */
export const hasScheduledPush: (endsAt: number) => boolean = pushSync.hasPendingPush;

/**
 * Respaldo local: muestra la notificación de fin de descanso desde la propia página, para cuando no hay
 * push activo (p. ej. el navegador no admite push, no hay suscripción o no se pudo programar el aviso).
 * Solo si el permiso ya está concedido: no se puede pedir al terminar un descanso, hace falta un toque.
 * Con el permiso denegado o sin dar, no hay nada que mostrar y queda la vibración. Devuelve true si se mostró.
 */
export async function showLocalTimerNotification(label: string): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  const registration = await getRegistration();
  if (!registration) return false;
  const { title, body, url } = buildNotificationPayload(label);
  const options = {
    body,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    // Mismo tag que el push: si llegaran los dos, se sustituyen en lugar de apilarse.
    tag: NOTIFICATION_TAG,
    renotify: true,
    // Con la página visible ya vibra el propio cronómetro; la notificación solo vibra si estás en otra pestaña o app.
    ...(document.visibilityState === "visible" ? {} : { vibrate: [120, 60, 120] }),
    data: { url },
  };
  try {
    await registration.showNotification(title, options);
    return true;
  } catch {
    return false;
  }
}
