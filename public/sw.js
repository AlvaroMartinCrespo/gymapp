// Service worker de GymRat (notificaciones del cronómetro).
// No cachea nada ni ofrece modo sin conexión: solo recibe pushes y muestra la notificación.

const NOTIFICATION_TAG = "timer";
const DEFAULT_URL = "/cronometro";
const DEFAULT_TITLE = "Descanso terminado";
const DEFAULT_BODY = "Ya puedes hacer la siguiente serie.";

// Activación rápida: la versión nueva toma el control sin esperar a cerrar todas las pestañas.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function readPayload(event) {
  if (!event.data) return {};
  try {
    const data = event.data.json();
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function text(value, fallback, max) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

self.addEventListener("push", (event) => {
  const data = readPayload(event);
  // Siempre se muestra una notificación, aunque el payload venga vacío o roto:
  // iOS no admite pushes silenciosos y puede revocar la suscripción si no se muestra nada.
  event.waitUntil(
    self.registration.showNotification(text(data.title, DEFAULT_TITLE, 100), {
      body: text(data.body, DEFAULT_BODY, 200),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Mismo tag: si coinciden dos avisos, el nuevo sustituye al anterior en lugar de apilarse.
      // renotify hace que el sustituto vuelva a sonar/vibrar.
      tag: NOTIFICATION_TAG,
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url: text(data.url, DEFAULT_URL, 200) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Solo se abren URLs de esta misma app.
  let target = new URL(DEFAULT_URL, self.location.origin);
  try {
    const requested = new URL(event.notification.data?.url ?? DEFAULT_URL, self.location.origin);
    if (requested.origin === self.location.origin) target = requested;
  } catch {
    // URL inválida: se queda /cronometro.
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
