"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Dumbbell, RefreshCw, Sparkles } from "lucide-react";

import { HeaderAction } from "@/components/layout/header-slot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ColumnChart } from "@/components/ui/column-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { MuscleViewer3D } from "@/components/anatomy/muscle-viewer-3d";
import { postJson } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { useLocalDate } from "@/lib/use-local-date";

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
type AiSummary = { key: string; text: string | null; error: string };

const periods = [{ value: "week", label: "Semana" }, { value: "month", label: "Mes" }, { value: "year", label: "Año" }] as const;
const metrics: { field: keyof Summary; label: string }[] = [
  { field: "days", label: "Días entrenados" }, { field: "sets", label: "Series" },
  { field: "volume", label: "Volumen (kg · rep)" }, { field: "exercises", label: "Ejercicios distintos" },
];

function bucketLabels(date: string, period: Period) {
  if (period === "year") return { label: formatDate(date, "month"), title: formatDate(date, "monthYear") };
  return {
    label: period === "week" ? formatDate(date, "weekday") : String(Number(date.slice(8))),
    title: formatDate(date, "weekdayDay"),
  };
}

function Bar({ value, maximum, label }: { value: number; maximum: number; label: string }) {
  return <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={value} className="h-2 min-w-0 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(value / maximum) * 100}%` }} /></div>;
}

export function RecapPanel() {
  const today = useLocalDate();
  const [selected, setSelected] = useState("");
  const [period, setPeriod] = useState<Period>("week");
  const [reload, setReload] = useState(0);
  // Reintento del resumen del entrenador sin recargar el resto del recap.
  const [aiAttempt, setAiAttempt] = useState(0);
  const [ai, setAi] = useState<AiSummary>({ key: "", text: null, error: "" });
  const aiCache = useRef(new Map<string, string | null>());
  const date = selected || today;
  const queryKey = `${date}:${period}:${reload}`;
  const { data, loading, error, loginRequired } = useApi<Recap>({
    url: "/api/profile",
    body: date ? { action: "recap", date, period } : null,
    queryKey,
    errors: { http: "No se ha podido cargar el recap.", network: "No se ha podido conectar con el recap." },
  });
  const maxSets = Math.max(1, ...(data?.categories.map((category) => category.sets) ?? []));
  const aiKey = `${queryKey}:${aiAttempt}`;
  const aiLoading = !date || ai.key !== aiKey;

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    async function loadSummary() {
      const cached = aiCache.current.get(queryKey);
      if (cached !== undefined) {
        setAi({ key: aiKey, text: cached, error: "" });
        return;
      }
      const result = await postJson<{ summary?: unknown }>("/api/recap-summary", { date, period }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result.ok) {
        const text = typeof result.data.summary === "string" ? result.data.summary : null;
        aiCache.current.set(queryKey, text);
        setAi({ key: aiKey, text, error: "" });
      } else {
        setAi({ key: aiKey, text: null, error: (!result.unreachable && result.error) || "No se ha podido generar el resumen." });
      }
    }
    void loadSummary();
    return () => controller.abort();
  }, [date, period, queryKey, aiKey]);

  return (
    <section aria-labelledby="recap-heading" className="min-w-0 space-y-6">
      <header className="max-md:sr-only">
        <h1 id="recap-heading" className="type-page">Recap</h1>
      </header>
      <HeaderAction>
        <Link href="/historial" title="Historial" aria-label="Historial" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"><CalendarDays className="size-4" /></Link>
        <Button type="button" size="icon" variant="outline" disabled={loading} title="Actualizar recap" aria-label="Actualizar recap" onClick={() => setReload((current) => current + 1)}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </HeaderAction>

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

      {loading ? <SkeletonGroup label="Cargando recap..." className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-56 w-full rounded-2xl" /></SkeletonGroup>
        : !data ? <ErrorState loginRequired={loginRequired} onRetry={() => setReload((current) => current + 1)}>{error}</ErrorState>
        : <>
          <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
            <p className="text-sm font-medium text-foreground">{formatDate(data.range.current_start)} a {formatDate(data.range.current_end)}</p>
            <p>Frente a {formatDate(data.range.previous_start)} a {formatDate(data.range.previous_end)}</p>
          </div>

          {data.current.sets > 0 && (aiLoading || ai.text || ai.error) && (
            <section aria-labelledby="recap-ai-heading" aria-live="polite" className="surface-1 space-y-2 rounded-2xl p-5">
              <h2 id="recap-ai-heading" className="type-section flex items-center gap-2"><Sparkles className="size-5 text-primary" />Resumen del entrenador</h2>
              {aiLoading ? <SkeletonGroup label={`Analizando tu ${period === "week" ? "semana" : period === "month" ? "mes" : "año"}...`} className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-2/3" /></SkeletonGroup>
                : ai.text ? <p className="text-sm leading-relaxed">{ai.text}</p>
                : <ErrorState onRetry={() => setAiAttempt((current) => current + 1)}>{ai.error}</ErrorState>}
            </section>
          )}

          <Card>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-6">
              {metrics.map(({ field, label }) => (
                <Stat
                  key={field}
                  label={label}
                  value={formatNumber(data.current[field])}
                  trend={{ current: data.current[field], previous: data.previous[field], against: "el periodo anterior" }}
                  hint={`Anterior: ${formatNumber(data.previous[field])}`}
                />
              ))}
            </dl>
          </Card>

          {data.current.sets === 0 && <EmptyState icon={Dumbbell} title="Sin series en este periodo" description="Cambia el periodo o la fecha de corte, o registra un entrenamiento." action={<Button asChild variant="outline"><Link href="/entrenar"><Dumbbell />Ir a Entrenar</Link></Button>} />}

          <Card role="region" aria-labelledby="recap-volume-heading" className="min-w-0">
            <header><h2 id="recap-volume-heading" className="type-section">Volumen {period === "year" ? "mensual" : "diario"}</h2><p className="mt-1 text-xs text-muted-foreground">kg · rep</p></header>
            <ColumnChart
              label={`Volumen ${period === "year" ? "mensual" : "diario"}`}
              unit="kg · rep"
              formatValue={formatNumber}
              data={data.buckets.map((bucket) => ({ key: bucket.date, value: bucket.volume, ...bucketLabels(bucket.date, period) }))}
            />
          </Card>

          <MuscleViewer3D mode="heat" heat={data.muscles} title="Frecuencia muscular del periodo" />

          <Card role="region" aria-labelledby="recap-categories-heading" className="min-w-0">
            <h2 id="recap-categories-heading" className="type-section">Series por grupo muscular</h2>
            <ol className="space-y-3">{data.categories.map((category) => <li key={category.category} className="grid min-h-6 grid-cols-[minmax(0,5rem)_minmax(0,1fr)_minmax(0,6rem)] items-center gap-3"><span className="break-words text-xs text-muted-foreground">{category.category}</span><Bar value={category.sets} maximum={maxSets} label={`Series de ${category.category}`} /><span className="type-data break-all text-right text-xs">{formatNumber(category.sets)}</span></li>)}</ol>
          </Card>
        </>}
    </section>
  );
}