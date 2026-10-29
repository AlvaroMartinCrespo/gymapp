"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, RefreshCw, Trophy } from "lucide-react";
import exercises from "@/db/exercises.json";
import { Button } from "@/components/ui/button";

type Entry = { username: string; weight: number; reps: number; position: number; is_me: boolean };
type Rankings = { enabled: boolean; total: number; entries: Entry[]; personal: { weight: number; reps: number; position: number | null } | null };
type View = { key: string; data: Rankings | null; error: string; login: boolean };
const categories = [...new Set(exercises.map((exercise) => exercise.category))];
const format = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

export function RankingsPanel() {
  const [category, setCategory] = useState(categories[0]);
  const [exerciseId, setExerciseId] = useState(exercises[0].id);
  const [metric, setMetric] = useState("weight");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const operation = useRef<AbortController | null>(null);
  const key = `${exerciseId}:${metric}:${page}:${reload}`;
  const current = view?.key === key ? view : null;
  const data = current?.data;
  const selected = exercises.find((exercise) => exercise.id === exerciseId)!;
  const filtered = exercises.filter((exercise) => exercise.category === category);

  useEffect(() => {
    const controller = new AbortController();
    operation.current = controller;
    async function load() {
      try {
        const response = await fetch("/api/rankings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load", exerciseId, metric, page }), signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!controller.signal.aborted) setView({ key, data: response.ok ? result : null, error: response.ok ? "" : result.error ?? "No se puede cargar la clasificación.", login: response.status === 401 });
      } catch {
        if (!controller.signal.aborted) setView({ key, data: null, error: "No se puede conectar con la clasificación.", login: false });
      }
    }
    void load();
    return () => controller.abort();
  }, [exerciseId, metric, page, key]);

  useEffect(() => () => operation.current?.abort(), []);

  async function participate(enabled: boolean) {
    if (busy || !data || operation.current?.signal.aborted) return;
    const controller = new AbortController();
    operation.current?.abort();
    operation.current = controller;
    setBusy(true);
    try {
      const response = await fetch("/api/rankings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "participation", exerciseId, metric, page, enabled }), signal: controller.signal });
      const result = await response.json();
      if (!controller.signal.aborted) {
        if (response.ok) {
          setPage(0);
          setReload((value) => value + 1);
        } else setView({ key, data: null, error: result.error ?? "No se puede confirmar la participación. Reintenta la consulta.", login: response.status === 401 });
      }
    } catch {
      if (!controller.signal.aborted) setView({ key, data: null, error: "No se puede confirmar la participación. Reintenta la consulta.", login: false });
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-6">
      <header className="flex items-center gap-3">
        <Trophy className="size-6 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold">Rankings</h1>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">Categoría
          <select className="mt-1 h-11 w-full rounded-md border bg-background px-3" disabled={busy} value={category} onChange={(event) => { setCategory(event.target.value); setExerciseId(exercises.find((exercise) => exercise.category === event.target.value)!.id); setPage(0); }}>
            {categories.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">Ejercicio
          <select className="mt-1 h-11 w-full rounded-md border bg-background px-3" disabled={busy} value={exerciseId} onChange={(event) => { setExerciseId(event.target.value); setPage(0); }}>
            {filtered.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
          </select>
        </label>
      </div>
      <div className="flex gap-2" role="group" aria-label="Criterio de clasificación">
        {[{ id: "weight", label: "Peso máximo" }, { id: "reps", label: "Repeticiones" }].map((mode) => <Button key={mode.id} disabled={busy} variant={metric === mode.id ? "default" : "outline"} aria-pressed={metric === mode.id} onClick={() => { setMetric(mode.id); setPage(0); }}>{mode.label}</Button>)}
      </div>

      {!current && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="size-4 animate-spin" />Cargando clasificación...</p>}
      {current?.error && <div className="space-y-3" role="alert"><p>{current.error}</p>{current.login ? <Button asChild><Link href="/acceso">Iniciar sesión</Link></Button> : <Button variant="outline" onClick={() => setReload((value) => value + 1)}><RefreshCw className="size-4" />Reintentar</Button>}</div>}

      {data && <>
        <label className="flex items-start gap-3 border-y py-4 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-red-600" checked={data.enabled} disabled={busy} onChange={(event) => void participate(event.target.checked)} />
          <span>Publicar mi alias y mi mejor serie en los rankings de todos los ejercicios</span>
          {busy && <LoaderCircle className="size-4 shrink-0 animate-spin" aria-label="Guardando participación" />}
        </label>
        <section aria-label={`Clasificación de ${selected.name}`} className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">{selected.name}</h2><p className="text-sm text-muted-foreground">{format.format(data.total)} participantes · Sesiones finalizadas</p></div>
          {data.entries.length === 0 ? <p className="py-8 text-center text-muted-foreground">{data.total === 0 ? "Aún no hay marcas publicadas." : "No hay resultados en esta página."}</p> : <ol className="divide-y border-y">
            {data.entries.map((entry) => <li key={entry.username} className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 py-4 ${entry.is_me ? "bg-primary/5" : ""}`}>
              <span className="text-center font-semibold tabular-nums">{entry.position <= 3 ? <span className="inline-flex flex-col items-center"><Trophy aria-hidden="true" className={`size-4 ${entry.position === 1 ? "text-amber-500" : entry.position === 2 ? "text-zinc-400" : "text-rose-600"}`} />{entry.position}</span> : entry.position}</span>
              <span className="min-w-0 break-all font-medium">{entry.username}{entry.is_me && <span className="ml-2 text-xs text-muted-foreground">Tú</span>}</span>
              <span className="text-right text-sm tabular-nums"><strong>{metric === "weight" ? `${format.format(entry.weight)} kg` : `${entry.reps} reps`}</strong><br /><span className="text-muted-foreground">{metric === "weight" ? `${entry.reps} reps` : `${format.format(entry.weight)} kg`}</span></span>
            </li>)}
          </ol>}
          <nav className="flex items-center justify-between gap-3" aria-label="Páginas de clasificación">
            <Button size="icon" variant="outline" title="Página anterior" aria-label="Página anterior" disabled={busy || page === 0} onClick={() => setPage((value) => value - 1)}><ArrowLeft className="size-4" /></Button>
            <span className="text-sm tabular-nums">{page + 1} / {Math.max(1, Math.ceil(data.total / 50))}</span>
            <Button size="icon" variant="outline" title="Página siguiente" aria-label="Página siguiente" disabled={busy || (page + 1) * 50 >= data.total} onClick={() => setPage((value) => value + 1)}><ArrowRight className="size-4" /></Button>
          </nav>
        </section>
        <aside className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-2 border-y bg-background px-2 py-4 md:bottom-4" aria-label="Tu marca personal">
          <div><p className="font-semibold">Tu mejor serie</p><p className="text-sm text-muted-foreground">{data.enabled ? data.personal?.position ? `Posición ${data.personal.position}` : "Sin posición" : "Participación privada"}</p></div>
          <p className="text-sm tabular-nums">{data.personal ? `${format.format(data.personal.weight)} kg · ${data.personal.reps} reps` : "Sin sesiones finalizadas"}</p>
        </aside>
      </>}
    </div>
  );
}