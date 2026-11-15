"use client";

import { useSyncExternalStore } from "react";

type Prefs = { favorites: string[]; recents: string[] };

const KEY = "gymapp:exercise-prefs";
const MAX_RECENTS = 6;
const EMPTY: Prefs = { favorites: [], recents: [] };

let cache: Prefs = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

function read(): Prefs {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return parsed ? { favorites: strings(parsed.favorites), recents: strings(parsed.recents) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function snapshot() {
  if (!loaded) { cache = read(); loaded = true; }
  return cache;
}

function write(next: Prefs) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin almacenamiento: solo dura la sesión */ }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

/** Favoritos y recientes de ejercicios, guardados en este navegador. */
export function useExercisePrefs(): Prefs {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function toggleFavorite(id: string) {
  const { favorites, recents } = snapshot();
  write({ favorites: favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id], recents });
}

export function pushRecent(id: string) {
  const { favorites, recents } = snapshot();
  if (recents[0] === id) return;
  write({ favorites, recents: [id, ...recents.filter((item) => item !== id)].slice(0, MAX_RECENTS) });
}
