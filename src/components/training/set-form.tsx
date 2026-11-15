import type { FormEvent } from "react";
import { LoaderCircle, Plus, RefreshCw } from "lucide-react";

import { NumberStepper } from "@/components/training/number-stepper";
import type { SetValues } from "@/components/training/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatDate, formatNumber } from "@/lib/format";

const restOptions = [60, 90, 120, 180, 300];
const chipClass = "inline-flex min-h-10 items-center rounded-full border border-border px-3.5 text-sm outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";

type SetFormProps = {
  nextNumber: number;
  previousDate?: string | null;
  weight: string;
  reps: string;
  onWeightChange: (value: string) => void;
  onRepsChange: (value: string) => void;
  /** Serie con el mismo número de la sesión anterior. */
  ghost?: SetValues;
  /** Última serie guardada hoy. */
  lastSet?: SetValues;
  restEnabled: boolean;
  onRestEnabledChange: (enabled: boolean) => void;
  restSeconds: number;
  onRestSecondsChange: (seconds: number) => void;
  /** Hay datos cargados del ejercicio. */
  ready: boolean;
  /** Operación en curso ("save", "finish" o el id de una serie). */
  busy: string | null;
  /** Hay que reintentar el último guardado con los mismos datos. */
  uncertain: boolean;
  locked: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

/** Tarjeta de nueva serie: peso, repeticiones, atajos y descanso. */
export function SetForm({ nextNumber, previousDate, weight, reps, onWeightChange, onRepsChange, ghost, lastSet, restEnabled, onRestEnabledChange, restSeconds, onRestSecondsChange, ready, busy, uncertain, locked, error, onSubmit }: SetFormProps) {
  const reference = lastSet ?? ghost;

  function applySet(source: SetValues) {
    onWeightChange(String(Number(source.weight)));
    onRepsChange(String(source.reps));
  }

  function addWeight() {
    const base = weight.trim() !== "" && Number.isFinite(Number(weight)) ? Number(weight) : Number(reference?.weight ?? 0);
    onWeightChange(String(Math.round((base + 2.5) * 100) / 100));
    if (!reps.trim() && reference) onRepsChange(String(reference.reps));
  }

  const saveButton = (className: string) => (
    <Button type="submit" disabled={Boolean(busy) || (!ready && !uncertain)} className={className}>{busy === "save" ? <LoaderCircle className="size-4 animate-spin" /> : uncertain ? <RefreshCw className="size-4" /> : <Plus className="size-4" />}{busy === "save" ? "Guardando..." : uncertain ? "Reintentar guardado" : "Guardar serie"}</Button>
  );

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-section">Serie {nextNumber}</h2>
          {previousDate && <p className="text-xs text-muted-foreground">Última sesión: {formatDate(previousDate, "day")}</p>}
        </div>
        <fieldset disabled={!ready || locked} className="space-y-4">
          <legend className="sr-only">Datos de la nueva serie</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberStepper id="weight" label="Peso (kg)" value={weight} onChange={onWeightChange} step={2.5} max={10000} inputStep="0.01" placeholder={ghost ? String(ghost.weight) : "0"} />
            <NumberStepper id="reps" label="Repeticiones" value={reps} onChange={onRepsChange} step={1} min={1} max={1000} inputMode="numeric" inputStep="1" placeholder={ghost ? String(ghost.reps) : "0"} />
          </div>
          {reference && (
            <div role="group" aria-label="Atajos de serie" className="flex flex-wrap gap-2">
              {ghost && <button type="button" className={chipClass} onClick={() => applySet(ghost)}>Repetir anterior · {formatNumber(ghost.weight)} kg × {ghost.reps}</button>}
              {lastSet && <button type="button" className={chipClass} onClick={() => applySet(lastSet)}>Misma serie</button>}
              <button type="button" className={chipClass} onClick={addWeight}>+2,5 kg</button>
            </div>
          )}
        </fieldset>
        <fieldset disabled={locked} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-1">
          <legend className="sr-only">Descanso entre series</legend>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={restEnabled} onChange={(event) => onRestEnabledChange(event.target.checked)} className="size-4 accent-primary" />Descanso automático</label>
          <Select wrapperClassName="w-auto max-w-full" className="h-11 w-auto" value={restSeconds} aria-label="Duración del descanso" disabled={!restEnabled || locked} onChange={(event) => onRestSecondsChange(Number(event.target.value))}>{restOptions.map((seconds) => <option key={seconds} value={seconds}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</option>)}</Select>
        </fieldset>
        {error && <Alert variant="error">{error}</Alert>}
        {saveButton("w-full sm:w-auto max-md:hidden")}
        {/* Modo gimnasio: en móvil el guardado queda fijo sobre la barra inferior, al alcance del pulgar. */}
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-3 md:hidden">
          <div className="surface-2 mx-auto flex max-w-md items-center gap-3 rounded-2xl p-2 pl-4">
            <div className="min-w-0 flex-1" aria-hidden="true">
              <p className="text-xs text-muted-foreground">Serie {nextNumber}</p>
              <p className="type-data truncate">{weight.trim() || "—"} kg × {reps.trim() || "—"}</p>
            </div>
            {saveButton("shrink-0")}
          </div>
        </div>
      </form>
    </Card>
  );
}
