"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CalendarDays, LoaderCircle, LogIn, RefreshCw, Sparkles } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ColumnChart } from "@/components/ui/column-chart";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Stat } from "@/components/ui/stat";
import { MuscleViewer3D } from "@/components/anatomy/muscle-viewer-3d";
import { localHistoryDate } from "@/lib/history";

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
type AiSummary = { key: string; text: string | null; error: string };

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

function bucketLabels(date: string, period: Period) {
  const day = new Date(`${date}T12:00:00`);
  if (period === "year") return { label: day.toLocaleDateString("es-ES", { month: "short" }), title: day.toLocaleDateString("es-ES", { month: "long", year: "numeric" }) };
  return {
    label: period === "week" ? day.toLocaleDateString("es-ES", { weekday: "short" }) : String(day.getDate()),
    title: day.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }),
  };
}

function numberLabel(value: number, signed = false) {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2, signDisplay: signed ? "exceptZero" : "auto" });
}

function Bar({ value, maximum, label }: { value: number; maximum: number; label: string }) {
  return <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={value} className="h-2 min-w-0 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(value / maximum) * 100}%` }} /></div>;
}

export function RecapPanel() {
  const today = useSyncExternalStore(subscribeDate, localHistoryDate, () => "");
  const [selected, setSelected] = useState("");
  const [period, setPeriod] = useState<Period>("week");
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<View>({ key: "", data: null, error: "", loginRequired: false });
  const [ai, setAi] = useState<AiSummary>({ key: "", text: null, error: "" });
  const aiCache = useRef(new Map<string, string | null>());
  const date = selected || today;
  const queryKey = `${date}:${period}:${reload}`;
  const loading = !date || view.key !== queryKey;
  const data = loading ? null : view.data;
  const maxSets = Math.max(1, ...(data?.categories.map((category) => category.sets) ?? []));
  const aiLoading = !date || ai.key !== queryKey;

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

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    async function loadSummary() {
      const cached = aiCache.current.get(queryKey);
      if (cached !== undefined) {
        setAi({ key: queryKey, text: cached, error: "" });
        return;
      }
      try {
        const response = await fetch("/api/recap-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, period }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (response.ok) {
          const text = typeof result.summary === "string" ? result.summary : null;
          aiCache.current.set(queryKey, text);
          setAi({ key: queryKey, text, error: "" });
        } else {
          setAi({ key: queryKey, text: null, error: result.error ?? "No se ha podido generar el resumen." });
        }
      } catch {
        if (!controller.signal.aborted) setAi({ key: queryKey, text: null, error: "No se ha podido generar el resumen." });
      }
    }
    void loadSummary();
    return () => controller.abort();
  }, [date, period, queryKey]);

  return (
    <section aria-labelledby="recap-heading" className="min-w-0 space-y-6">
      <header className="flex items-center gap-3">
        <h1 id="recap-heading" className="type-page flex-1">Recap</h1>
        <Link href="/historial" title="Historial" aria-label="Historial" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"><CalendarDays className="size-4" /></Link>
        <Button type="button" size="icon" variant="outline" disabled={loading} title="Actualizar recap" aria-label="Actualizar recap" onClick={() => setReload((current) => current + 1)}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </header>

      <Card className="gap-4 p-4">
      <fieldset className="grid grid-cols-3 gap-1">
        <legend className="sr-only">Periodo del recap</legend>
        {periods.map((option) => <label key={option.value} className="min-w-0 cursor-pointer"><input type="radio" name="recap-period" value={option.value} checked={period === option.value} onChange={() => setPeriod(option.value)} className="peer sr-only" /><span className="flex h-11 items-center justify-center rounded-xl text-sm text-muted-foreground hover:bg-card peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">{option.label}</span></label>)}
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Fecha de corte" className="flex-1" labelClassName="text-xs font-normal text-muted-foreground"><Input id="recap-date" type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={(event) => { if (event.target.value && event.target.validity.valid) setSelected(event.target.value); }} className="h-11" /></Field>
        <Button type="button" variant="outline" disabled={!today || date === today} onClick={() => setSelected(today)}>Hoy</Button>
      </div>
      </Card>

      {loading ? <p role="status" className="flex min-h-40 items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Cargando recap...</p>
        : !data ? <div className="space-y-4"><Alert variant="error">{view.error}</Alert>{view.loginRequired && <Button asChild><Link href="/acceso"><LogIn className="size-4" />Iniciar sesión</Link></Button>}</div>
        : <>
          <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
            <p className="text-sm font-medium text-foreground">{dateLabel(data.range.current_start)} a {dateLabel(data.range.current_end)}</p>
            <p>Frente a {dateLabel(data.range.previous_start)} a {dateLabel(data.range.previous_end)}</p>
          </div>

          {data.current.sets > 0 && (aiLoading || ai.text || ai.error) && (
            <section aria-labelledby="recap-ai-heading" aria-live="polite" className="surface-1 space-y-2 rounded-2xl p-5">
              <h2 id="recap-ai-heading" className="type-section flex items-center gap-2"><Sparkles className="size-5 text-primary" />Resumen del entrenador</h2>
              {aiLoading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Analizando tu {period === "week" ? "semana" : period === "month" ? "mes" : "año"}...</p>
                : ai.text ? <p className="text-sm leading-relaxed">{ai.text}</p>
                : <p className="text-sm text-muted-foreground">{ai.error}</p>}
            </section>
          )}

          <Card>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-6">
              {metrics.map(({ field, label }) => (
                <Stat
                  key={field}
                  label={label}
                  value={numberLabel(data.current[field])}
                  trend={{ current: data.current[field], previous: data.previous[field], against: "el periodo anterior" }}
                  hint={`Anterior: ${numberLabel(data.previous[field])}`}
                />
              ))}
            </dl>
          </Card>

          {data.current.sets === 0 && <p role="status" className="text-sm text-muted-foreground">Sin series registradas en este periodo.</p>}

          <Card role="region" aria-labelledby="recap-volume-heading" className="min-w-0">
            <header><h2 id="recap-volume-heading" className="type-section">Volumen {period === "year" ? "mensual" : "diario"}</h2><p className="mt-1 text-xs text-muted-foreground">kg · rep</p></header>
            <ColumnChart
              label={`Volumen ${period === "year" ? "mensual" : "diario"}`}
              unit="kg · rep"
              formatValue={numberLabel}
              data={data.buckets.map((bucket) => ({ key: bucket.date, value: bucket.volume, ...bucketLabels(bucket.date, period) }))}
            />
          </Card>

          <MuscleViewer3D mode="heat" heat={data.muscles} title="Frecuencia muscular del periodo" />

          <Card role="region" aria-labelledby="recap-categories-heading" className="min-w-0">
            <h2 id="recap-categories-heading" className="type-section">Series por grupo muscular</h2>
            <ol className="space-y-3">{data.categories.map((category) => <li key={category.category} className="grid min-h-6 grid-cols-[minmax(0,5rem)_minmax(0,1fr)_minmax(0,6rem)] items-center gap-3"><span className="break-words text-xs text-muted-foreground">{category.category}</span><Bar value={category.sets} maximum={maxSets} label={`Series de ${category.category}`} /><span className="type-data break-all text-right text-xs">{numberLabel(category.sets)}</span></li>)}</ol>
          </Card>
        </>}
    </section>
  );
}