"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Dumbbell, RefreshCw } from "lucide-react";

import { HeaderAction } from "@/components/layout/header-slot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { formatDate, formatNumber } from "@/lib/format";
import { calendarCells, shiftHistoryMonth } from "@/lib/history";
import { useApi } from "@/lib/use-api";
import { useLocalDate } from "@/lib/use-local-date";

type HistorySet = { id: string; exercise_id: string; name: string; category: string; set_number: number; weight: number; reps: number };
type History = {
  month: string;
  date: string;
  summary: { days: number; sets: number; exercises: number; volume: number };
  days: { date: string; sets: number; volume: number }[];
  sets: HistorySet[];
};

const weekDays = ["L", "M", "X", "J", "V", "S", "D"];
const weekDayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function HistoryPanel() {
  const today = useLocalDate();
  const [selected, setSelected] = useState("");
  const [reload, setReload] = useState(0);
  const date = selected || today;
  const { data, latest, loading, error, loginRequired } = useApi<History>({
    url: "/api/profile",
    body: date ? { action: "history", date } : null,
    queryKey: `${date}:${reload}`,
    errors: { http: "No se ha podido cargar el historial.", network: "No se ha podido conectar con tu historial." },
  });
  // Los datos del mes anterior se mantienen mientras carga otro día del mismo mes.
  const monthData = date && latest?.month === `${date.slice(0, 7)}-01` ? latest : null;
  const previous = date ? shiftHistoryMonth(date, -1) : null;
  const next = date ? shiftHistoryMonth(date, 1) : null;
  const days = new Map(monthData?.days.map((day) => [day.date, day]) ?? []);
  const exercises = new Map<string, { name: string; category: string; sets: HistorySet[] }>();
  for (const set of data?.sets ?? []) {
    const exercise = exercises.get(set.exercise_id) ?? { name: set.name, category: set.category, sets: [] };
    exercise.sets.push(set);
    exercises.set(set.exercise_id, exercise);
  }

  return (
    <section aria-labelledby="history-heading" className="min-w-0 space-y-6">
      <header className="max-md:sr-only">
        <h1 id="history-heading" className="type-page">Historial</h1>
      </header>
      <HeaderAction>
        <Button type="button" size="icon" variant="outline" title="Actualizar historial" aria-label="Actualizar historial" disabled={loading} onClick={() => setReload((current) => current + 1)}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </HeaderAction>

      <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card className="min-w-0 gap-4 p-4">
          <div className="flex items-center gap-2">
            <Button type="button" size="icon" variant="ghost" title="Mes anterior" aria-label="Mes anterior" disabled={!previous} onClick={() => previous && setSelected(previous)}><ChevronLeft className="size-5" /></Button>
            <h2 className="min-w-0 flex-1 text-center capitalize type-section" aria-live="polite">{date ? formatDate(date, "monthYear") : "Calendario"}</h2>
            <Button type="button" size="icon" variant="ghost" title="Mes siguiente" aria-label="Mes siguiente" disabled={!next} onClick={() => next && setSelected(next)}><ChevronRight className="size-5" /></Button>
          </div>

          <div role="group" aria-label="Calendario mensual" className="grid grid-cols-7 gap-1">
            {weekDays.map((day, index) => <span key={index} aria-label={weekDayNames[index]} className="flex h-8 items-center justify-center text-xs text-muted-foreground">{day}</span>)}
            {(date ? calendarCells(date) : Array.from({ length: 42 }, () => null)).map((day, index) => day ? (
              <button key={day} type="button" aria-pressed={day === date} aria-current={day === today ? "date" : undefined} aria-label={`${formatDate(day, "full")}${days.has(day) ? `, ${days.get(day)?.sets} series registradas` : monthData ? ", sin series" : ""}`} onClick={() => setSelected(day)} className={`relative flex h-11 min-w-0 items-center justify-center rounded-xl border text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring ${day === date ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : day === today ? "border-primary text-foreground hover:bg-card" : "border-transparent hover:bg-card"}`}>
                {Number(day.slice(8))}
                {days.has(day) && <span aria-hidden="true" className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${day === date ? "bg-primary-foreground" : "bg-primary"}`} />}
              </button>
            ) : <span key={`empty-${index}`} aria-hidden="true" className="h-11" />)}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Field label="Ir a fecha" className="flex-1" labelClassName="text-xs font-normal text-muted-foreground">
              <Input id="history-date" type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={(event) => { if (event.target.value && event.target.validity.valid) setSelected(event.target.value); }} className="h-11" />
            </Field>
            <Button type="button" variant="outline" disabled={!today || date === today} onClick={() => setSelected(today)}>Hoy</Button>
          </div>

          {!monthData && loading && <div aria-hidden="true" className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12" />)}</div>}
          {monthData && <dl className="grid grid-cols-2 gap-4">
            {[ ["Días entrenados", monthData.summary.days], ["Series", monthData.summary.sets], ["Ejercicios", monthData.summary.exercises], ["Volumen (kg · rep)", monthData.summary.volume] ].map(([label, value]) => <Stat key={label} label={label} value={formatNumber(Number(value))} />)}
          </dl>}
        </Card>

        <Card aria-busy={loading} className="min-w-0 gap-5">
          <h2 className="type-section">{date ? formatDate(date, "full") : "Entrenamiento"}</h2>
          {loading ? <SkeletonGroup label="Cargando historial..." className="space-y-4"><Skeleton className="h-4 w-48" /><Skeleton className="h-40 w-full rounded-xl" /></SkeletonGroup>
            : !data ? <ErrorState loginRequired={loginRequired} onRetry={() => setReload((current) => current + 1)}>{error}</ErrorState>
            : data.sets.length === 0 ? <EmptyState icon={Dumbbell} compact title="Sin series este día" description={date === today ? "Aún no has guardado series hoy." : "No hay series guardadas en esta fecha."} action={<Button asChild variant="outline"><Link href="/entrenar"><Dumbbell />{date === today ? "Entrenar hoy" : "Ir a Entrenar"}</Link></Button>} />
            : <>
              <p className="text-sm text-muted-foreground">{data.sets.length} series · {formatNumber(data.sets.reduce((total, set) => total + set.weight * set.reps, 0))} kg · rep</p>
              {Array.from(exercises, ([exerciseId, exercise]) => <section key={exerciseId} aria-labelledby={`exercise-${exerciseId}`} className="min-w-0 space-y-3 rounded-xl border border-border p-4">
                <header><h3 id={`exercise-${exerciseId}`} className="break-words text-sm font-medium">{exercise.name}</h3><p className="mt-1 text-xs text-muted-foreground">{exercise.category}</p></header>
                <table className="w-full table-fixed text-sm tabular-nums"><caption className="sr-only">Series de {exercise.name}</caption><thead><tr className="text-xs text-muted-foreground"><th scope="col" className="py-2 text-left font-normal">Serie</th><th scope="col" className="py-2 text-right font-normal">Peso (kg)</th><th scope="col" className="py-2 text-right font-normal">Reps</th></tr></thead><tbody>{exercise.sets.map((set) => <tr key={set.id} className="border-t border-border"><th scope="row" className="py-3 text-left font-normal">{set.set_number}</th><td className="py-3 text-right font-mono">{formatNumber(set.weight)}</td><td className="py-3 text-right font-mono">{set.reps}</td></tr>)}</tbody></table>
              </section>)}
            </>}
        </Card>
      </div>
    </section>
  );
}