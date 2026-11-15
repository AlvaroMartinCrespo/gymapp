"use client";

import { useRef, useState, type PointerEvent } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

import type { WorkoutSet } from "@/components/training/types";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

/** Desplazamiento (px) a partir del cual soltar la tarjeta pide eliminar la serie. */
const SWIPE_DELETE = 80;
const MAX_SWIPE = 120;

type SetCardProps = {
  entry: WorkoutSet;
  locked: boolean;
  /** Se está eliminando esta serie. */
  removing: boolean;
  /** Serie aún no confirmada por el servidor (actualización optimista). */
  syncing?: boolean;
  onRemove: (entry: WorkoutSet) => void;
};

/** Serie como tarjeta: se elimina con el botón o deslizándola a la izquierda. */
export function SetCard({ entry, locked, removing, syncing = false, onRemove }: SetCardProps) {
  const drag = useRef<{ pointer: number; startX: number; startY: number; horizontal: boolean | null } | null>(null);
  const [offset, setOffset] = useState(0);
  const canSwipe = !locked && !syncing;

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!canSwipe || (event.target as HTMLElement).closest("button")) return;
    drag.current = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, horizontal: null };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointer !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (state.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      state.horizontal = Math.abs(dx) > Math.abs(dy);
      if (state.horizontal) event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (state.horizontal) setOffset(Math.max(-MAX_SWIPE, Math.min(0, dx)));
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointer !== event.pointerId) return;
    drag.current = null;
    const triggered = state.horizontal && offset <= -SWIPE_DELETE;
    setOffset(0);
    if (triggered) onRemove(entry);
  }

  return (
    <li className="relative overflow-hidden rounded-xl bg-error/15">
      <div aria-hidden="true" className="absolute inset-y-0 right-0 flex w-24 items-center justify-center text-error"><Trash2 className="size-5" /></div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? undefined : "none" }}
        className={`relative flex min-h-14 touch-pan-y items-center gap-3 rounded-xl border border-border bg-card px-3 transition-transform ${syncing ? "opacity-70" : ""}`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm tabular-nums" aria-label={`Serie ${entry.set_number}`}>{entry.set_number}</span>
        <p className="type-data min-w-0 flex-1">{formatNumber(entry.weight)} kg <span className="text-muted-foreground">×</span> {entry.reps}</p>
        {entry.is_pr && <Badge variant="warning">PR</Badge>}
        {syncing
          ? <span role="status" className="flex size-11 items-center justify-center text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /><span className="sr-only">Guardando serie {entry.set_number}</span></span>
          : <button type="button" title={`Eliminar serie ${entry.set_number}`} aria-label={`Eliminar serie ${entry.set_number}`} disabled={locked} onClick={() => onRemove(entry)} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-accent hover:text-error focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">{removing ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</button>}
      </div>
    </li>
  );
}
