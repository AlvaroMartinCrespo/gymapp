"use client";

import { useEffect } from "react";

/** Registra /sw.js una vez al cargar la app. No renderiza nada. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // updateViaCache: "none" hace que el navegador nunca sirva el sw.js desde la caché HTTP al buscar actualizaciones.
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      console.warn("No se pudo registrar el service worker", error);
    });
  }, []);

  return null;
}
