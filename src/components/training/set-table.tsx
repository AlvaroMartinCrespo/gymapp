import Link from "next/link";
import { Dumbbell, LogIn, RefreshCw } from "lucide-react";

import { PENDING_PREFIX, type WorkoutSet } from "@/components/training/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SetCard } from "@/components/training/set-card";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";

type SetTableProps = {
  exerciseName: string;
  date: string;
  sets: WorkoutSet[];
  /** Volumen total de las series (kg × reps); solo se muestra si hay datos. */
  volume: number;
  hasData: boolean;
  loading: boolean;
  error: string;
  loginRequired: boolean;
  locked: boolean;
  /** Operación en curso ("save", "finish" o el id de una serie). */
  busy: string | null;
  onRefresh: () => void;
  onRemove: (entry: WorkoutSet) => void;
};

/** Tarjeta "Series de hoy" con el volumen, el botón de actualizar y las series como tarjetas con borrado. */
export function SetTable({ exerciseName, date, sets, volume, hasData, loading, error, loginRequired, locked, busy, onRefresh, onRemove }: SetTableProps) {
  // `loginRequired` también llega de errores al guardar o borrar; el botón de sesión debe verse en ese caso.
  const loadFailed = !loading && Boolean(error);
  return (
    <Card aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-section flex items-center gap-2"><Dumbbell className="size-5 text-primary" />Series de hoy</h2>
        <div className="flex items-center gap-2">
          {hasData && <p className="text-sm text-muted-foreground">{sets.length} series · {formatNumber(volume)} kg</p>}
          <button type="button" title="Actualizar series" aria-label="Actualizar series" disabled={locked || loading} onClick={onRefresh} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      {loading ? <SkeletonList label="Cargando series..." rowClassName="h-11" /> : error ? <ErrorState loginRequired={loginRequired} onRetry={onRefresh}>{error}</ErrorState> : sets.length === 0 ? <EmptyState compact icon={Dumbbell} title="Sin series hoy" description={`Guarda tu primera serie de ${exerciseName} con el formulario de arriba.`} /> : (
        <>
        <ul aria-label={`Series de ${exerciseName} del ${date}`} className="space-y-2">
          {sets.map((entry) => <SetCard key={entry.id} entry={entry} locked={locked} removing={busy === entry.id} syncing={entry.id.startsWith(PENDING_PREFIX)} onRemove={onRemove} />)}
        </ul>
        <p className="text-xs text-muted-foreground md:hidden">Desliza una serie hacia la izquierda para eliminarla.</p>
        </>
      )}
      {loginRequired && !loadFailed && <Button asChild variant="outline" className="mt-4"><Link href="/acceso"><LogIn className="size-4" />Iniciar sesión</Link></Button>}
    </Card>
  );
}
