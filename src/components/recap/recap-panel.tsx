"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, CalendarDays, LoaderCircle, LogIn, Minus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MuscleViewer3D } from "@/components/anatomy/muscle-viewer-3d";
import { localHistoryDate } from "@/lib/history";
import { recapChange } from "@/lib/recap.mjs";

type Period = "week" | "month" | "year";
type Summary = { days: number; sets: number; exercises: number; volume: number };
type Recap = {
  date: string;
  period: Period;
  range: { current_start: string; current_end: string; previous_start: string; previous_end: string };
  current: Summary;
  previous: Summary;
  buckets: { date: string; sets: number; volume: number }[];
  categories: { category: string; sets: number; volume: number }[];
  muscles?: { mesh: string; primary_sets: number; secondary_sets: number }[];
};
type View = { key: string; data: Recap | null; error: string; loginRequired: boolean };

const periods = [{ value: "week", label: "Semana" }, { value: "month", label: "Mes" }, { value: "year", label: "Año" }] as const;
const metrics: { field: keyof Summary; label: string }[] = [
  { field: "days", label: "Días entrenados" }, { field: "sets", label: "Series" },
  { field: "volume", label: "Volumen (kg · rep)" }, { field: "exercises", label: "Ejercicios distintos" },
];

function subscribeDate(callback: () => void) {
  const interval = window.setInterval(callback, 60000);
  window.addEventListener("focus", callback);
  return () => { window.clearInterval(interval); window.removeEventListener("focus", callback); };
}

function dateLabel(date: string, monthOnly = false) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", monthOnly ? { month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

function numberLabel(value: number, signed = false) {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2, signDisplay: signed ? "exceptZero" : "auto" });
}

function Bar({ value, maximum, label }: { value: number; maximum: number; label: string }) {
  return <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={value} className="h-2 min-w-0 bg-muted"><div className="h-full bg-primary" style={{ width: `${(value / maximum) * 100}%` }} /></div>;
}

export function RecapPanel() {
  const today = useSyncExternalStore(subscribeDate, localHistoryDate, () => "");
  const [selected, setSelected] = useState("");
  const [period, setPeriod] = useState<Period>("week");
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<View>({ key: "", data: null, error: "", loginRequired: false });
  const date = selected || today;
  const queryKey = `${date}:${period}:${reload}`;
  const loading = !date || view.key !== queryKey;
  const data = loading ? null : view.data;
  const maxVolume = Math.max(1, ...(data?.buckets.map((bucket) => bucket.volume) ?? []));
  const maxSets = Math.max(1, ...(data?.categories.map((category) => category.sets) ?? []));

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "recap", date, period }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!controller.signal.aborted) setView({ key: queryKey, data: response.ok ? result : null, error: response.ok ? "" : result.error ?? "No se ha podido cargar el recap.", loginRequired: response.status === 401 });
      } catch {
        if (!controller.signal.aborted) setView({ key: queryKey, data: null, error: "No se ha podido conectar con el recap.", loginRequired: false });
      }
    }
    void load();
    return () => controller.abort();
  }, [date, period, queryKey]);

  return (
    <section aria-labelledby="recap-heading" className="min-w-0 space-y-6">
      <header className="flex items-center gap-3">
        <h1 id="recap-heading" className="flex-1 text-2xl font-semibold">Recap</h1>
        <Link href="/historial" title="Historial" aria-label="Historial" className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"><CalendarDays className="size-4" /></Link>
        <Button type="button" size="icon" variant="outline" className="rounded-lg" disabled={loading} title="Actualizar recap" aria-label="Actualizar recap" onClick={() => setReload((current) => current + 1)}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </header>

      <fieldset className="grid grid-cols-3 gap-1 border-b border-border pb-3">
        <legend className="sr-only">Periodo del recap</legend>
        {periods.map((option) => <label key={option.value} className="min-w-0 cursor-pointer"><input type="radio" name="recap-period" value={option.value} checked={period === option.value} onChange={() => setPeriod(option.value)} className="peer sr-only" /><span className="flex h-11 items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-card peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">{option.label}</span></label>)}
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-2"><label htmlFor="recap-date" className="block text-xs text-muted-foreground">Fecha de corte</label><input id="recap-date" type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={(event) => { if (event.target.value && event.target.validity.valid) setSelected(event.target.value); }} className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
        <Button type="button" variant="outline" className="rounded-lg" disabled={!today || date === today} onClick={() => setSelected(today)}>Hoy</Button>
      </div>

      {loading ? <p role="status" className="flex min-h-40 items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Cargando recap...</p>
        : !data ? <div className="space-y-4 border-t border-border pt-5"><p role="alert" className="break-words text-sm text-primary">{view.error}</p>{view.loginRequired && <Button asChild className="rounded-lg"><Link href="/acceso"><LogIn className="size-4" />Iniciar sesión</Link></Button>}</div>
        : <>
          <div className="space-y-1 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            <p className="text-sm font-medium text-foreground">{dateLabel(data.range.current_start)} a {dateLabel(data.range.current_end)}</p>
            <p>Frente a {dateLabel(data.range.previous_start)} a {dateLabel(data.range.previous_end)}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-5 gap-y-6 border-y border-border py-5">
            {metrics.map(({ field, label }) => {
              const change = recapChange(data.current[field], data.previous[field]);
              const Icon = change.difference > 0 ? ArrowUp : change.difference < 0 ? ArrowDown : Minus;
              return <div key={field} className="min-w-0 space-y-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-all text-2xl font-semibold tabular-nums">{numberLabel(data.current[field])}</dd><dd className="text-xs leading-relaxed text-muted-foreground"><span className="flex items-start gap-1"><Icon className="mt-0.5 size-3 shrink-0" /><span className="break-words tabular-nums">{numberLabel(change.difference, true)}{change.percent === null ? " · Sin base porcentual" : ` · ${numberLabel(change.percent, true)} %`}</span></span><span className="mt-1 block break-words">Anterior: {numberLabel(data.previous[field])}</span></dd></div>;
            })}
          </dl>

          {data.current.sets === 0 && <p role="status" className="text-sm text-muted-foreground">Sin series registradas en este periodo.</p>}

          <section aria-labelledby="recap-volume-heading" className="min-w-0 space-y-4">
            <header><h2 id="recap-volume-heading" className="text-base font-semibold">Volumen {period === "year" ? "mensual" : "diario"}</h2><p className="mt-1 text-xs text-muted-foreground">kg · rep</p></header>
            <ol className="space-y-3">
              {data.buckets.map((bucket) => <li key={bucket.date} className="grid min-h-6 grid-cols-[minmax(0,5rem)_minmax(0,1fr)_minmax(0,6rem)] items-center gap-3"><time dateTime={bucket.date} title={dateLabel(bucket.date)} className="text-xs text-muted-foreground">{period === "year" ? dateLabel(bucket.date, true) : new Date(`${bucket.date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</time><Bar value={bucket.volume} maximum={maxVolume} label={`Volumen de ${dateLabel(bucket.date, period === "year")}`} /><span className="break-all text-right text-xs tabular-nums">{numberLabel(bucket.volume)}</span></li>)}
            </ol>
          </section>

          <MuscleViewer3D mode="heat" heat={data.muscles} title="Frecuencia muscular del periodo" />

          <section aria-labelledby="recap-categories-heading" className="min-w-0 space-y-4 border-t border-border pt-5">
            <h2 id="recap-categories-heading" className="text-base font-semibold">Series por grupo muscular</h2>
            <ol className="space-y-3">{data.categories.map((category) => <li key={category.category} className="grid min-h-6 grid-cols-[minmax(0,5rem)_minmax(0,1fr)_minmax(0,6rem)] items-center gap-3"><span className="break-words text-xs text-muted-foreground">{category.category}</span><Bar value={category.sets} maximum={maxSets} label={`Series de ${category.category}`} /><span className="break-all text-right text-xs tabular-nums">{numberLabel(category.sets)}</span></li>)}</ol>
          </section>
        </>}
    </section>
  );
}