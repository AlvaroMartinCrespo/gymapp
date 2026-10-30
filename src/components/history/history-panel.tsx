"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Dumbbell, LoaderCircle, LogIn, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { calendarCells, localHistoryDate, shiftHistoryMonth } from "@/lib/history";

type HistorySet = { id: string; exercise_id: string; name: string; category: string; set_number: number; weight: number; reps: number };
type History = {
  month: string;
  date: string;
  summary: { days: number; sets: number; exercises: number; volume: number };
  days: { date: string; sets: number; volume: number }[];
  sets: HistorySet[];
};
type View = { key: string; data: History | null; error: string; loginRequired: boolean };

const weekDays = ["L", "M", "X", "J", "V", "S", "D"];
const weekDayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function subscribeDate(callback: () => void) {
  const interval = window.setInterval(callback, 60000);
  window.addEventListener("focus", callback);
  return () => { window.clearInterval(interval); window.removeEventListener("focus", callback); };
}

function dateLabel(date: string, monthOnly = false) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", monthOnly ? { month: "long", year: "numeric" } : { day: "numeric", month: "long", year: "numeric" });
}

function numberLabel(value: number) {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

export function HistoryPanel() {
  const today = useSyncExternalStore(subscribeDate, localHistoryDate, () => "");
  const [selected, setSelected] = useState("");
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<View>({ key: "", data: null, error: "", loginRequired: false });
  const date = selected || today;
  const queryKey = `${date}:${reload}`;
  const loading = !date || view.key !== queryKey;
  const data = loading ? null : view.data;
  const monthData = date && view.data?.month === `${date.slice(0, 7)}-01` ? view.data : null;
  const previous = date ? shiftHistoryMonth(date, -1) : null;
  const next = date ? shiftHistoryMonth(date, 1) : null;
  const days = new Map(monthData?.days.map((day) => [day.date, day]) ?? []);
  const exercises = new Map<string, { name: string; category: string; sets: HistorySet[] }>();
  for (const set of data?.sets ?? []) {
    const exercise = exercises.get(set.exercise_id) ?? { name: set.name, category: set.category, sets: [] };
    exercise.sets.push(set);
    exercises.set(set.exercise_id, exercise);
  }

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "history", date }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!controller.signal.aborted) setView({ key: queryKey, data: response.ok ? result : null, error: response.ok ? "" : result.error ?? "No se ha podido cargar el historial.", loginRequired: response.status === 401 });
      } catch {
        if (!controller.signal.aborted) setView({ key: queryKey, data: null, error: "No se ha podido conectar con tu historial.", loginRequired: false });
      }
    }
    void load();
    return () => controller.abort();
  }, [date, queryKey]);

  return (
    <section aria-labelledby="history-heading" className="min-w-0 space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/" title="Volver al perfil" aria-label="Volver al perfil" className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" /></Link>
        <h1 id="history-heading" className="min-w-0 flex-1 text-2xl font-semibold">Historial</h1>
        <Button type="button" size="icon" variant="outline" className="rounded-lg" title="Actualizar historial" aria-label="Actualizar historial" disabled={loading} onClick={() => setReload((current) => current + 1)}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </header>

      <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-2">
            <Button type="button" size="icon" variant="ghost" className="rounded-lg" title="Mes anterior" aria-label="Mes anterior" disabled={!previous} onClick={() => previous && setSelected(previous)}><ChevronLeft className="size-5" /></Button>
            <h2 className="min-w-0 flex-1 text-center capitalize section-heading" aria-live="polite">{date ? dateLabel(date, true) : "Calendario"}</h2>
            <Button type="button" size="icon" variant="ghost" className="rounded-lg" title="Mes siguiente" aria-label="Mes siguiente" disabled={!next} onClick={() => next && setSelected(next)}><ChevronRight className="size-5" /></Button>
          </div>

          <div role="group" aria-label="Calendario mensual" className="grid grid-cols-7 gap-1">
            {weekDays.map((day, index) => <span key={index} aria-label={weekDayNames[index]} className="flex h-8 items-center justify-center text-xs text-muted-foreground">{day}</span>)}
            {(date ? calendarCells(date) : Array.from({ length: 42 }, () => null)).map((day, index) => day ? (
              <button key={day} type="button" aria-pressed={day === date} aria-current={day === today ? "date" : undefined} aria-label={`${dateLabel(day)}${days.has(day) ? `, ${days.get(day)?.sets} series registradas` : monthData ? ", sin series" : ""}`} onClick={() => setSelected(day)} className={`relative flex h-11 min-w-0 items-center justify-center rounded-lg border text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring ${day === date ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : day === today ? "border-primary text-foreground hover:bg-card" : "border-transparent hover:bg-card"}`}>
                {Number(day.slice(8))}
                {days.has(day) && <span aria-hidden="true" className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${day === date ? "bg-primary-foreground" : "bg-primary"}`} />}
              </button>
            ) : <span key={`empty-${index}`} aria-hidden="true" className="h-11" />)}
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <div className="min-w-0 flex-1 space-y-2">
              <label htmlFor="history-date" className="block text-xs text-muted-foreground">Ir a fecha</label>
              <input id="history-date" type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={(event) => { if (event.target.value && event.target.validity.valid) setSelected(event.target.value); }} className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <Button type="button" variant="outline" className="rounded-lg" disabled={!today || date === today} onClick={() => setSelected(today)}>Hoy</Button>
          </div>

          {monthData && <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            {[ ["Días entrenados", monthData.summary.days], ["Series", monthData.summary.sets], ["Ejercicios", monthData.summary.exercises], ["Volumen (kg · rep)", monthData.summary.volume] ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums">{numberLabel(Number(value))}</dd></div>)}
          </dl>}
        </div>

        <div aria-busy={loading} className="min-w-0 space-y-5 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <h2 className="section-heading">{date ? dateLabel(date) : "Entrenamiento"}</h2>
          {loading ? <p role="status" className="flex min-h-32 items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Cargando historial...</p>
            : !data ? <div className="space-y-4"><p role="alert" className="break-words text-sm text-primary">{view.error}</p>{view.loginRequired && <Button asChild className="rounded-lg"><Link href="/acceso"><LogIn className="size-4" />Iniciar sesión</Link></Button>}</div>
            : data.sets.length === 0 ? <div className="space-y-4"><p className="text-sm text-muted-foreground">Sin series registradas este día.</p><Button asChild variant="outline" className="rounded-lg"><Link href="/entrenar"><Dumbbell className="size-4" />Entrenar hoy</Link></Button></div>
            : <>
              <p className="text-sm text-muted-foreground">{data.sets.length} series · {numberLabel(data.sets.reduce((total, set) => total + set.weight * set.reps, 0))} kg · rep</p>
              {Array.from(exercises, ([exerciseId, exercise]) => <section key={exerciseId} aria-labelledby={`exercise-${exerciseId}`} className="min-w-0 space-y-3 border-t border-border pt-4">
                <header><h3 id={`exercise-${exerciseId}`} className="break-words text-sm font-medium">{exercise.name}</h3><p className="mt-1 text-xs text-muted-foreground">{exercise.category}</p></header>
                <table className="w-full table-fixed text-sm tabular-nums"><caption className="sr-only">Series de {exercise.name}</caption><thead><tr className="text-xs text-muted-foreground"><th scope="col" className="py-2 text-left font-normal">Serie</th><th scope="col" className="py-2 text-right font-normal">Peso (kg)</th><th scope="col" className="py-2 text-right font-normal">Reps</th></tr></thead><tbody>{exercise.sets.map((set) => <tr key={set.id} className="border-t border-border"><th scope="row" className="py-3 text-left font-normal">{set.set_number}</th><td className="py-3 text-right">{numberLabel(set.weight)}</td><td className="py-3 text-right">{set.reps}</td></tr>)}</tbody></table>
              </section>)}
            </>}
        </div>
      </div>
    </section>
  );
}