import type { NextConfig } from "next";

import { securityHeaders } from "./src/lib/security-headers.mjs";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        // Todas las rutas salvo el service worker, que ya lleva su propia CSP más estricta.
        // CSP_REPORT_ONLY=1 deja la política en modo aviso (solo consola) por si hay que depurarla.
        source: "/((?!sw\\.js).*)",
        headers: securityHeaders({ dev: process.env.NODE_ENV !== "production", reportOnly: process.env.CSP_REPORT_ONLY === "1" }),
      },
      {
        // Modelo 3D (~4 MB) y pósters: cambian muy rara vez y se piden en cada visita al visor.
        // Una semana en caché y revalidación en segundo plano; sus rutas no llevan versión en el nombre.
        source: "/models/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        source: "/anatomy/:file(poster-[a-z]+\\.webp)",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        // Si el navegador cachea el service worker, las actualizaciones no llegan.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
