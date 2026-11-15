"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

import { AuthStatus } from "./auth-status";
import { HeaderActionSlot } from "./header-slot";
import { routeMeta } from "./nav-items";

// Páginas vistas dentro de la app: si es la primera, "atrás" no debe sacar al usuario de GymRat.
let visits = 0;

/** Cabecera fija: atrás o logo, título (móvil), acción principal de la pantalla y menú de cuenta. */
export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const meta = routeMeta(pathname);

  useEffect(() => { visits += 1; }, [pathname]);

  function goBack() {
    if (!meta?.backTo) return;
    if (visits > 1) router.back();
    else router.push(meta.backTo);
  }

  return (
    <header className="sticky top-0 z-30 -ml-[max(1rem,env(safe-area-inset-left))] -mr-[max(1rem,env(safe-area-inset-right))] mb-5 flex min-h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 border-b border-border bg-background/85 pb-0 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] text-sm backdrop-blur-xl md:mx-0 md:px-0">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
        {meta?.backTo && (
          <button type="button" onClick={goBack} title="Volver" aria-label="Volver" className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft className="size-5" />
          </button>
        )}
        {meta ? (
          <p className="type-section min-w-0 truncate">{meta.title}</p>
        ) : (
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold">
            <span aria-hidden="true" className="size-9 shrink-0 bg-[url('/icons/icon-192.png')] bg-cover bg-center" />
            GymRat
          </Link>
        )}
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <HeaderActionSlot />
        <AuthStatus />
      </div>
    </header>
  );
}
