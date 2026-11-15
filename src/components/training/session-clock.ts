"use client";

import { useSyncExternalStore } from "react";

const EVENT = "gymapp:session-start";
const key = (date: string) => `gymapp:session-start:${date}`;

/** Marca el inicio de la sesión del día (la primera serie guardada). No pisa un inicio ya registrado. */
export function markSessionStart(date: string) {
  try {
    if (localStorage.getItem(key(date))) return;
    localStorage.setItem(key(date), String(Date.now()));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* sin almacenamiento: la duración simplemente no se muestra */ }
}

function readStart(date: string) {
  try {
    const value = Number(localStorage.getItem(key(date)));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function subscribeStart(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener("storage", callback); };
}

/** Instante (ms) en que empezó la sesión de `date` en este navegador, o 0 si se desconoce. */
export function useSessionStart(date: string) {
  return useSyncExternalStore(subscribeStart, () => (date ? readStart(date) : 0), () => 0);
}

/** Reloj que avanza cada 30 s mientras `active`; se queda quieto si no. */
export function useSessionNow(active: boolean) {
  return useSyncExternalStore(
    (callback) => {
      if (!active) return () => {};
      const interval = window.setInterval(callback, 10000);
      return () => window.clearInterval(interval);
    },
    () => Math.floor(Date.now() / 30000) * 30000,
    () => 0,
  );
}
