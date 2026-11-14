"use client";

import { useEffect } from "react";

import "./globals.css";

/** Último recurso: sustituye al layout raíz, así que define su propio <html> y <body>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es" className="dark min-h-dvh antialiased">
      <body className="flex min-h-dvh items-center justify-center p-6">
        <main role="alert" className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="type-page">GymRat no ha podido cargar</h1>
          <p className="text-sm text-muted-foreground">
            Ha ocurrido un error inesperado{error.digest ? ` (código ${error.digest})` : ""}. Inténtalo de nuevo.
          </p>
          <button type="button" onClick={() => reset()} className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
