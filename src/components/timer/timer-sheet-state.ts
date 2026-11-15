"use client";

import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function set(value: boolean) {
  if (open === value) return;
  open = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function openTimerSheet() { set(true); }
export function closeTimerSheet() { set(false); }
export function useTimerSheetOpen() {
  return useSyncExternalStore(subscribe, () => open, () => false);
}

/** En móvil el cronómetro se abre como hoja inferior; en escritorio sigue siendo la página /cronometro. */
export function isMobileViewport() {
  return window.matchMedia("(max-width: 767px)").matches;
}
