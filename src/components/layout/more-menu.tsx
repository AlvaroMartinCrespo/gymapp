"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Ellipsis } from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { openTimerSheet } from "@/components/timer/timer-sheet-state";
import { cn } from "@/lib/utils";
import { isActive, MORE_ITEMS } from "./nav-items";

const rowClass = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";

/** Botón "Más" de la barra inferior con las secciones que no caben: Cronómetro, Coach IA e Historial. */
export function MoreMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const active = MORE_ITEMS.some(({ href }) => isActive(pathname, href));

  // Al navegar se cierra el menú (ajuste de estado durante el render, sin efecto).
  if (openedAt !== pathname) { setOpenedAt(pathname); setOpen(false); }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn("flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", active ? "text-primary" : "text-muted-foreground")}
      >
        <Ellipsis className={cn("size-5", active && "drop-shadow-[0_0_8px_var(--primary)]")} />
        Más
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Más secciones">
        <ul className="-mx-2 flex flex-col gap-1">
          {MORE_ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              {href === "/cronometro" ? (
                <button
                  type="button"
                  className={rowClass}
                  onClick={() => {
                    setOpen(false);
                    // En la propia página del cronómetro no hace falta la hoja.
                    if (pathname !== "/cronometro") openTimerSheet();
                  }}
                >
                  <Icon className="size-5 text-primary" />{label}
                </button>
              ) : (
                <Link href={href} aria-current={isActive(pathname, href) ? "page" : undefined} onClick={() => setOpen(false)} className={rowClass}>
                  <Icon className="size-5 text-primary" />{label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
