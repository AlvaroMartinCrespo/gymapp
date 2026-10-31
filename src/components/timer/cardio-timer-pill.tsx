"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse, Pause, Play, X } from "lucide-react";

import { setTrainingTab, useTrainingTab } from "@/components/training/use-training-tab";
import { elapsedTime, formatTimer } from "@/lib/timer";
import { useCardioTimer, useTimer } from "./timer-provider";

export function CardioTimerPill() {
  const pathname = usePathname();
  const trainingTab = useTrainingTab();
  const { timer, value, ready, dispatch } = useCardioTimer();
  const rest = useTimer();
  // Con la pestaña Cardio abierta el panel ya muestra el cronómetro.
  if (!ready || timer.status === "idle" || (pathname === "/entrenar" && trainingTab === "cardio")) return null;

  const running = timer.status === "running";
  const finished = timer.status === "finished";
  const formatted = formatTimer(value);
  const command = running ? "Pausar" : "Reanudar";
  const label = finished ? "Cardio · tiempo máximo" : timer.status === "paused" ? `${timer.label} · en pausa` : timer.label;
  const iconClass = "flex size-11 shrink-0 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring";
  const mainClass = "flex min-w-0 flex-1 items-center gap-3 rounded-full px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring";
  // La píldora de descanso ocupa la parte alta de la pantalla salvo en /cronometro: la de cardio se coloca debajo.
  const restVisible = rest.ready && rest.timer.status !== "idle" && pathname !== "/cronometro";
  const content = (
    <>
      <HeartPulse className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span role="timer" aria-live="off" className="font-mono text-lg tabular-nums">{formatted}</span>
      </span>
    </>
  );

  function discard() {
    if (window.confirm(`¿Descartar el cronómetro de cardio (${formatTimer(elapsedTime(timer, Date.now()))}) sin guardar?`)) dispatch({ type: "reset" });
  }

  return (
    <div className={`fixed left-1/2 z-40 flex h-14 w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card px-2 shadow-lg md:left-[calc(50%_+_8rem)] ${restVisible ? "top-[calc(4.5rem+env(safe-area-inset-top))]" : "top-[calc(0.75rem+env(safe-area-inset-top))]"}`}>
      {pathname === "/entrenar"
        ? <button type="button" aria-label={`Abrir cardio: ${label}, ${formatted}`} onClick={() => setTrainingTab("cardio")} className={mainClass}>{content}</button>
        : <Link href="/entrenar#cardio" aria-label={`Abrir cardio: ${label}, ${formatted}`} className={mainClass}>{content}</Link>}
      {!finished && (
        <button type="button" title={command} aria-label={`${command} cronómetro de cardio`} onClick={() => dispatch({ type: running ? "pause" : "start" })} className={iconClass}>
          {running ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
      )}
      <button type="button" title="Descartar cronómetro de cardio" aria-label="Descartar cronómetro de cardio" onClick={discard} className={`${iconClass} text-muted-foreground`}>
        <X className="size-4" />
      </button>
    </div>
  );
}
