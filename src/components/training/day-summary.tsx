import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { formatNumber } from "@/lib/format";
import type { summarizeWorkoutDay } from "@/lib/history";

type DaySummaryProps = {
  summary: ReturnType<typeof summarizeWorkoutDay>;
  completed: boolean;
  loading: boolean;
  locked: boolean;
  onSelectExercise: (exerciseId: string) => void;
};

/** Resumen del día: totales y ejercicios con sus series; pulsar un ejercicio lo selecciona. */
export function DaySummary({ summary, completed, loading, locked, onSelectExercise }: DaySummaryProps) {
  return (
    <Card role="region" aria-labelledby="day-summary-heading" aria-busy={loading}>
      <h2 id="day-summary-heading" className="type-section">{completed ? "Resumen del día" : "Ejercicios de hoy"}</h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Ejercicios" value={summary.exercises.length} />
        <Stat label="Series" value={summary.sets} />
        <Stat label="Repeticiones" value={summary.repetitions} />
        <Stat label="Volumen (kg × reps)" value={formatNumber(summary.volume)} />
      </dl>
      {summary.exercises.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay series registradas hoy.</p>}
      <ul className="divide-y divide-border">
        {summary.exercises.map((entry) => (
          <li key={entry.id} className="space-y-2 py-3">
            <button type="button" disabled={locked || loading} onClick={() => onSelectExercise(entry.id)} className="min-h-11 max-w-full break-words text-left text-sm font-medium underline-offset-4 hover:underline disabled:opacity-50">{entry.name}</button>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {entry.sets.map((set) => <li key={set.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1"><span>Serie {set.set_number}</span><span className="type-data">{formatNumber(set.weight)} kg × {set.reps}</span></li>)}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}
