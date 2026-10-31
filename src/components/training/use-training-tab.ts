"use client";

import { useSyncExternalStore } from "react";

export type TrainingTab = "strength" | "cardio";

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
  };
}

/** La pestaña activa de /entrenar vive en el hash (#cardio): sobrevive a recargas y se puede enlazar. */
export function useTrainingTab(): TrainingTab {
  return useSyncExternalStore(subscribe, () => (window.location.hash === "#cardio" ? "cardio" : "strength"), () => "strength");
}

export function setTrainingTab(tab: TrainingTab) {
  const url = `${window.location.pathname}${window.location.search}${tab === "cardio" ? "#cardio" : ""}`;
  window.history.replaceState(window.history.state, "", url);
  // replaceState no emite hashchange: se avisa a los suscriptores a mano.
  window.dispatchEvent(new Event("hashchange"));
}
