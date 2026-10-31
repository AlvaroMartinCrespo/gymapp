"use client";

import { useSyncExternalStore } from "react";

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function subscribeDate(callback: () => void) {
  const interval = window.setInterval(callback, 60000);
  window.addEventListener("focus", callback);
  document.addEventListener("visibilitychange", callback);
  return () => {
    window.clearInterval(interval);
    window.removeEventListener("focus", callback);
    document.removeEventListener("visibilitychange", callback);
  };
}

/** Fecha local de hoy (AAAA-MM-DD); vacía en el servidor y se actualiza al cambiar de día. */
export function useLocalDate() {
  return useSyncExternalStore(subscribeDate, localDate, () => "");
}
