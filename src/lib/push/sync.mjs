// Mantiene el aviso programado en QStash coherente con el cronómetro. Sin dependencias y sin acceso directo
// al navegador (todo se inyecta), para poder probarlo con almacenamiento y fetch simulados.
// Se importa desde código cliente: no debe importar nada de Node (validate.mjs, qstash.mjs, signature.mjs...).

export const PUSH_STORAGE_KEY = "gymapp-push-v1";
export const SCHEDULE_PATH = "/api/push/schedule";
export const CANCEL_PATH = "/api/push/cancel";
// Mismo límite que MAX_REST_SECONDS en src/lib/timer.ts y en validate.mjs (una prueba comprueba que coinciden).
export const MAX_SCHEDULE_SECONDS = 3600;

// Pasado este tiempo desde el fin real del descanso ya no se muestra la notificación local de respaldo.
export const LOCAL_NOTIFICATION_WINDOW_MS = 10_000;

const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Instante (ms) en que debe sonar el aviso, o null si no hay que avisar: solo cuando el cronómetro es de
 * descanso y está en marcha. En pausa, parado, terminado o ascendente no hay aviso.
 * @param {{ mode: string, status: string, startedAt: number | null, durationMs: number, elapsedMs: number } | null | undefined} timer
 * @returns {number | null}
 */
export function pushEndsAt(timer) {
  if (!timer || timer.mode !== "rest" || timer.status !== "running" || timer.startedAt === null) return null;
  const endsAt = timer.startedAt + timer.durationMs - timer.elapsedMs;
  return Number.isSafeInteger(endsAt) ? endsAt : null;
}

/**
 * ¿Hay que mostrar la notificación local de respaldo al terminar un descanso? Solo si el fin es reciente
 * (si la app estuvo congelada en segundo plano y terminó hace rato, un aviso ahora sería un falso) y no hay
 * un push programado para ese fin (él ya muestra la notificación: así no hay avisos dobles).
 * @param {{ run: { endsAt: number } | null, mode: string, now: number, hasPush: (endsAt: number) => boolean }} input
 */
export function shouldNotifyLocally({ run, mode, now, hasPush }) {
  return Boolean(run) && mode === "rest" && Math.abs(now - run.endsAt) <= LOCAL_NOTIFICATION_WINDOW_MS && !hasPush(run.endsAt);
}

/**
 * Crea `syncTimerPush(timer)` y `cancelPendingPush()`.
 *
 * - `storage`: `{ get(): string | null, set(value: string): void, remove(): void }` (puede lanzar; se captura).
 * - `fetcher`: como `fetch`, con rutas relativas al mismo origen.
 * - `getSubscription()`: la suscripción de este dispositivo como objeto plano, o null si no hay permiso o suscripción.
 * - `lock(task)`: ejecuta `task` en exclusión entre pestañas (navigator.locks); por defecto, directamente.
 * - `now()`: reloj.
 *
 * `syncTimerPush` es idempotente: compara el fin deseado con lo guardado (`{ messageId, endsAt }`) y solo
 * habla con el servidor si hay diferencia. Nunca lanza ni rechaza: un fallo (sin conexión, servidor caído)
 * deja el aviso como estaba y se repara en la siguiente llamada (acción del usuario o vuelta a primer plano).
 * Las llamadas seguidas se agrupan: siempre se acaba sincronizando con el último estado recibido.
 */
export function createPushSync({ storage, fetcher, getSubscription, lock = (task) => task(), now = () => Date.now() }) {
  let latest = null;
  let dirty = false;
  let loop = null;

  function readRecord() {
    try {
      const parsed = JSON.parse(storage.get() ?? "null");
      if (parsed && typeof parsed.messageId === "string" && MESSAGE_ID_PATTERN.test(parsed.messageId) && Number.isSafeInteger(parsed.endsAt)) {
        return { messageId: parsed.messageId, endsAt: parsed.endsAt };
      }
    } catch {
      // Dato ausente o corrupto: se trata como "no hay aviso pendiente".
    }
    return null;
  }

  function writeRecord(record) {
    try {
      storage.set(JSON.stringify(record));
    } catch {
      // Sin almacenamiento no se puede evitar un duplicado, pero tampoco debe romper el cronómetro.
    }
  }

  function clearRecord() {
    try {
      storage.remove();
    } catch {
      // Ídem.
    }
  }

  async function post(path, body) {
    return fetcher(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // Que la petición llegue aunque la página se cierre justo después (p. ej. al pausar y bloquear).
      keepalive: true,
    });
  }

  /** true si ya no queda aviso pendiente de este registro; false si no se pudo cancelar y hay que reintentarlo. */
  async function cancelRecord(record) {
    try {
      const response = await post(CANCEL_PATH, { messageId: record.messageId });
      // Un 4xx (salvo "reintenta luego") no mejora reintentando: se descarta para no quedar bloqueado.
      const retryable = response.status >= 500 || response.status === 408 || response.status === 429;
      if (response.ok || !retryable) {
        clearRecord();
        return true;
      }
    } catch {
      // Sin conexión.
    }
    return false;
  }

  async function reconcile() {
    const timer = latest;
    const endsAt = pushEndsAt(timer);
    let record = readRecord();

    // Si coincide con el fin deseado no hay nada que hacer. Esto va antes de descartar los avisos ya vencidos:
    // mientras el cronómetro no pase a "terminado", el registro debe seguir ahí para saber que el push está activo.
    if (record && endsAt !== null && record.endsAt === endsAt) return;
    // Si el aviso pendiente ya tocaba, se entregó: no hay nada que cancelar.
    if (record && record.endsAt <= now()) {
      clearRecord();
      record = null;
    }

    if (record && !(await cancelRecord(record))) return;
    if (endsAt === null || dirty) return;

    const seconds = Math.min(MAX_SCHEDULE_SECONDS, Math.round((endsAt - now()) / 1000));
    if (seconds < 1) return;

    const subscription = await getSubscription();
    // Si mientras tanto llegó otra acción, esa se encargará (la llamada vigente es la última).
    if (!subscription || dirty) return;

    try {
      const response = await post(SCHEDULE_PATH, { subscription, seconds, label: timer.label });
      if (!response.ok) return;
      const { messageId } = await response.json();
      if (typeof messageId === "string" && MESSAGE_ID_PATTERN.test(messageId)) writeRecord({ messageId, endsAt });
    } catch {
      // Sin conexión o respuesta rara: se repara en la siguiente sincronización.
    }
  }

  /** @param {Parameters<typeof pushEndsAt>[0] & { label?: string }} timer */
  function syncTimerPush(timer) {
    latest = timer;
    dirty = true;
    loop ??= (async () => {
      try {
        while (dirty) {
          dirty = false;
          try {
            await lock(reconcile);
          } catch {
            // Nunca se propaga: el cronómetro no depende del aviso.
          }
        }
      } finally {
        loop = null;
      }
    })();
    return loop;
  }

  return {
    syncTimerPush,
    /** true si hay un aviso push programado para exactamente este fin (el push se encargará de avisar). */
    hasPendingPush: (endsAt) => readRecord()?.endsAt === endsAt,
    /** Cancela el aviso pendiente (p. ej. al desactivar los avisos). */
    cancelPendingPush: () => syncTimerPush(null),
  };
}
