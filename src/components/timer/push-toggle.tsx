"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

import { cancelPendingPush, getPushStatus, PushError, subscribePush, unsubscribePush, type PushStatus } from "@/lib/push/client";
import { useTimer } from "./timer-provider";

type Busy = "enabling" | "disabling" | null;

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** Activa o desactiva los avisos push del descanso en este dispositivo. */
export function PushToggle() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const { syncPush } = useTimer();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void getPushStatus().then((next) => {
        if (!cancelled) setStatus(next);
      });
    };
    refresh();
    // Al volver de los Ajustes del móvil, el permiso pudo cambiar.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function enable() {
    setError(null);
    setBusy("enabling");
    try {
      await subscribePush();
      setStatus("on");
      // Si ya hay un descanso en marcha, se programa su aviso ahora.
      syncPush();
    } catch (failure) {
      const code = failure instanceof PushError ? failure.code : "failed";
      if (code === "denied") setStatus("denied");
      else if (code === "dismissed") setStatus("off");
      else setError("No se pudieron activar los avisos. Inténtalo de nuevo en unos segundos.");
    } finally {
      setBusy(null);
    }
  }

  async function disable() {
    setError(null);
    setBusy("disabling");
    try {
      // Primero se cancela el aviso pendiente: sin suscripción no llegaría, pero así QStash no lo conserva.
      await cancelPendingPush();
      await unsubscribePush();
      setStatus(await getPushStatus());
    } finally {
      setBusy(null);
    }
  }

  // Hasta saber el estado no se muestra nada (evita parpadeos y diferencias con el servidor).
  if (status === null) return null;

  return (
    <div className="mt-8 border-t border-border pt-6">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
        {status === "on" ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4 text-muted-foreground" />}
        Avisos del descanso
      </h2>

      {status === "unsupported" && <p className="text-sm text-muted-foreground">Este navegador no admite notificaciones push. El cronómetro funciona con normalidad.</p>}

      {status === "needs-install" && (
        <p className="text-sm text-muted-foreground">En iPhone y iPad los avisos solo funcionan con la app instalada (iOS 16.4 o posterior). Toca Compartir → Añadir a pantalla de inicio y ábrela desde el icono.</p>
      )}

      {status === "unconfigured" && <p className="text-sm text-muted-foreground">Los avisos todavía no están configurados en esta instalación.</p>}

      {status === "denied" && (
        <p className="text-sm text-muted-foreground">Las notificaciones están bloqueadas. Permítelas en los Ajustes del móvil (o en los permisos del sitio del navegador) y vuelve aquí.</p>
      )}

      {status === "off" && (
        <>
          <p className="mb-3 text-sm text-muted-foreground">Recibe una notificación cuando termine el descanso, aunque la app esté cerrada o el móvil bloqueado.</p>
          <button type="button" onClick={enable} disabled={busy !== null} className={button}>
            <Bell className="size-4" />
            {busy === "enabling" ? "Pidiendo permiso…" : "Activar avisos"}
          </button>
        </>
      )}

      {status === "on" && (
        <>
          <p className="mb-3 text-sm text-muted-foreground">Avisos activados en este dispositivo.</p>
          <button type="button" onClick={disable} disabled={busy !== null} className={button}>
            <BellOff className="size-4" />
            {busy === "disabling" ? "Desactivando…" : "Desactivar avisos"}
          </button>
        </>
      )}

      {error && <p role="alert" className="mt-3 break-words text-sm text-primary">{error}</p>}
    </div>
  );
}
