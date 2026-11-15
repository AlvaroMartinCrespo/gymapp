"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { Sheet } from "@/components/ui/sheet";
import { TimerPanel } from "./timer-panel";
import { closeTimerSheet, useTimerSheetOpen } from "./timer-sheet-state";

/** Cronómetro como hoja inferior (móvil). Se monta el panel solo al abrirla para no duplicar ids con /cronometro. */
export function TimerSheet() {
  const open = useTimerSheetOpen();
  const pathname = usePathname();

  useEffect(() => { closeTimerSheet(); }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) closeTimerSheet(); }} title="Cronómetro">
      {open && <TimerPanel embedded />}
    </Sheet>
  );
}
