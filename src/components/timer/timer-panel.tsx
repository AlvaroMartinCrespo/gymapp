"use client";

import { Check, CheckCheck, Hourglass, Pause, Play, Plus, RotateCcw, Timer } from "lucide-react";
import type { FormEvent } from "react";

import { formatTimer, MAX_REST_SECONDS, type TimerMode } from "@/lib/timer";
import { useTimer } from "./timer-provider";

const presets = [60, 90, 120, 180, 300];

export function TimerPanel() {
  const { timer, value, elapsed, ready, persistent, dispatch } = useTimer();
  const running = timer.status === "running";
  const active = running || timer.status === "paused";
  const finished = timer.status === "finished";
  const rest = timer.mode === "rest";
  const formatted = ready ? formatTimer(value, rest) : "--:--";
  const progress = finished ? 1 : rest ? Math.max(0, 1 - elapsed / timer.durationMs) : (elapsed % 60000) / 60000;
  const status = !ready ? "Cargando" : running ? "En marcha" : timer.status === "paused" ? "En pausa" : finished ? "Tiempo completado" : "Listo";
  const command = running ? "Pausar" : finished ? "Repetir" : timer.status === "paused" ? "Reanudar" : "Iniciar";
  const iconButton = "flex size-14 items-center justify-center rounded-full border border-border bg-card text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";

  function configureDuration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    dispatch({ type: "configure", mode: "rest", seconds: Number(data.get("seconds")) });
  }

  function configureMode(mode: TimerMode) {
    dispatch({ type: "configure", mode, seconds: timer.durationMs / 1000 });
  }

  return (
    <section className="mx-auto w-full max-w-lg" aria-labelledby="timer-heading">
      <header className="mb-6">
        <h1 id="timer-heading" className="text-2xl font-semibold">Cronómetro</h1>
      </header>
      <div role="group" aria-label="Modo de tiempo" className="grid grid-cols-2 border-b border-border">
        <button type="button" aria-pressed={rest} disabled={!ready || active} onClick={() => configureMode("rest")} className={`flex min-h-12 items-center justify-center gap-2 border-b-2 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed ${rest ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
          <Hourglass className="size-4" />Descanso
        </button>
        <button type="button" aria-pressed={!rest} disabled={!ready || active} onClick={() => configureMode("stopwatch")} className={`flex min-h-12 items-center justify-center gap-2 border-b-2 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed ${!rest ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
          <Timer className="size-4" />Cronómetro
        </button>
      </div>

      <div className="mx-auto my-8 grid aspect-square w-full max-w-72 place-items-center rounded-full p-1.5" style={{ background: `conic-gradient(var(--primary) ${progress * 360}deg, var(--muted) ${progress * 360}deg)` }}>
        <div className="flex size-full min-w-0 flex-col items-center justify-center gap-3 rounded-full bg-background px-3">
          <p className="w-full truncate px-2 text-center text-sm text-muted-foreground">{timer.label}</p>
          <div role="timer" aria-live="off" aria-label={`${rest ? "Tiempo restante" : "Tiempo transcurrido"}: ${formatted}`} className={`whitespace-nowrap font-mono text-5xl font-medium tabular-nums ${finished ? "text-primary" : "text-foreground"}`}>
            {formatted}
          </div>
          <p role="status" aria-live="polite" className="flex min-h-6 items-center gap-2 text-sm text-muted-foreground">
            {finished && <CheckCheck className="size-4 text-primary" />}{status}
          </p>
        </div>
      </div>

      <div className="flex min-h-20 items-center justify-center gap-6">
        <button type="button" title="Restablecer" aria-label="Restablecer cronómetro" disabled={!ready || timer.status === "idle"} onClick={() => dispatch({ type: "reset" })} className={iconButton}>
          <RotateCcw className="size-5" />
        </button>
        <button type="button" title={command} aria-label={command} disabled={!ready} onClick={() => dispatch({ type: running ? "pause" : "start" })} className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background disabled:opacity-40">
          {running ? <Pause className="size-7" /> : finished ? <RotateCcw className="size-7" /> : <Play className="size-7" />}
        </button>
        <button type="button" title="Añadir 30 segundos" aria-label="Añadir 30 segundos al descanso" disabled={!ready || !rest || !active || timer.durationMs >= MAX_REST_SECONDS * 1000} onClick={() => dispatch({ type: "extend", seconds: 30 })} className={iconButton}>
          <Plus className="size-5" />
        </button>
      </div>

      {rest && (
        <div className="mt-8 border-t border-border pt-6">
          <fieldset disabled={!ready || active}>
            <legend className="mb-3 text-sm font-medium">Duración del descanso</legend>
            <div className="grid grid-cols-5 gap-2">
              {presets.map((seconds) => (
                <label key={seconds} className="relative cursor-pointer">
                  <input type="radio" name="rest-preset" value={seconds} checked={timer.durationMs === seconds * 1000} onChange={() => dispatch({ type: "configure", mode: "rest", seconds })} className="peer sr-only" />
                  <span className="flex h-11 items-center justify-center rounded-lg border border-border font-mono text-sm tabular-nums peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50">{formatTimer(seconds * 1000)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <form onSubmit={configureDuration} className="mt-5 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <label htmlFor="rest-seconds" className="block text-sm text-muted-foreground">Duración en segundos</label>
              <input key={timer.durationMs} id="rest-seconds" name="seconds" type="number" inputMode="numeric" min={1} max={MAX_REST_SECONDS} step={1} required defaultValue={timer.durationMs / 1000} disabled={!ready || active} className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 font-mono text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
            </div>
            <button type="submit" title="Aplicar duración" aria-label="Aplicar duración del descanso" disabled={!ready || active} className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
              <Check className="size-5" />
            </button>
          </form>
        </div>
      )}
      {ready && !persistent && <p role="alert" className="mt-6 break-words text-sm text-primary">El navegador no permite guardar el cronómetro. Seguirá funcionando aquí, pero se perderá al cerrar o recargar.</p>}
    </section>
  );
}