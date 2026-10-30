"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Pause, Play, RotateCcw, Timer, X } from "lucide-react";

import { formatTimer } from "@/lib/timer";
import { useTimer } from "./timer-provider";

export function TimerPill() {
  const pathname = usePathname();
  const { timer, value, ready, dispatch } = useTimer();
  if (!ready || timer.status === "idle" || pathname === "/cronometro") return null;

  const running = timer.status === "running";
  const finished = timer.status === "finished";
  const formatted = formatTimer(value, timer.mode === "rest");
  const command = running ? "Pausar" : finished ? "Repetir" : "Reanudar";
  const label = finished ? "Tiempo completado" : timer.status === "paused" ? "En pausa" : timer.label;
  const iconClass = "flex size-11 shrink-0 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="fixed left-1/2 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 flex h-14 w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card px-2 shadow-lg md:left-[calc(50%_+_8rem)]">
        <Link href="/cronometro" aria-label={`Abrir cronómetro: ${label}, ${formatted}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-full px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {finished ? <Check className="size-5 shrink-0 text-primary" /> : <Timer className="size-5 shrink-0 text-primary" />}
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-xs text-muted-foreground">{label}</span>
            <span role="timer" aria-live="off" className="font-mono text-lg tabular-nums">{formatted}</span>
          </span>
        </Link>
        <button type="button" title={command} aria-label={command} onClick={() => dispatch({ type: running ? "pause" : "start" })} className={iconClass}>
          {running ? <Pause className="size-4" /> : finished ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
        </button>
        <button type="button" title="Restablecer y ocultar" aria-label="Restablecer y ocultar cronómetro" onClick={() => dispatch({ type: "reset" })} className={`${iconClass} text-muted-foreground`}>
          <X className="size-4" />
        </button>
    </div>
  );
}