"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Check, CircleCheck, Copy, Dumbbell, LoaderCircle, LogIn, Plus, RefreshCw, Trash2 } from "lucide-react";

import exercises from "@/db/exercises.json";
import { MuscleViewer3D } from "@/components/anatomy/muscle-viewer-3d";
import { useTimer } from "@/components/timer/timer-provider";
import { Button } from "@/components/ui/button";
import { summarizeWorkoutDay } from "@/lib/history";

type WorkoutSet = { id: string; set_number: number; weight: number | string; reps: number; is_pr?: boolean };
type DaySet = WorkoutSet & { exercise_id: string; name: string };
type SessionData = { sets: WorkoutSet[]; previous_date: string | null; previous_sets: WorkoutSet[]; completed_at?: string | null; day_set_count?: number; day_sets: DaySet[] };
type SessionState = { key: string; data: SessionData | null; error: string; loginRequired: boolean };
type PendingSet = {
  payload: { action: "save"; date: string; exerciseId: string; weight: number; reps: number; requestId: string };
  exerciseName: string;
  restSeconds: number | null;
};

const categories = [...new Set(exercises.map((exercise) => exercise.category))];
const restOptions = [60, 90, 120, 180, 300];
const inputClass = "h-12 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function subscribeDate(callback: () => void) {
  const interval = window.setInterval(callback, 60000);
  window.addEventListener("focus", callback);
  document.addEventListener("visibilitychange", callback);
  return () => {
    window.clearInterval(interval);
    window.removeEventListener("focus", callback);
    document.removeEventListener("visibilitychange", callback);
  };
}

function formatWeight(weight: number | string) {
  return Number(weight).toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

async function workoutRequest(body: object, signal?: AbortSignal) {
  const response = await fetch("/api/workouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  return { response, result: await response.json() };
}

export function TrainingPanel() {
  const date = useSyncExternalStore(subscribeDate, localDate, () => "");
  const { startRest } = useTimer();
  const [exerciseId, setExerciseId] = useState(exercises[0].id);
  const [session, setSession] = useState<SessionState>({ key: "", data: null, error: "", loginRequired: false });
  const [reload, setReload] = useState(0);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [restEnabled, setRestEnabled] = useState(true);
  const [restSeconds, setRestSeconds] = useState(90);
  const [busy, setBusy] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const pending = useRef<PendingSet | null>(null);
  const finishing = useRef(false);
  const exercise = exercises.find((candidate) => candidate.id === exerciseId) ?? exercises[0];
  const queryKey = `${date}:${exercise.id}:${reload}`;
  const loading = !date || session.key !== queryKey;
  const data = !loading ? session.data : null;
  const sets = data?.sets ?? [];
  const nextNumber = sets.reduce((maximum, entry) => Math.max(maximum, entry.set_number), 0) + 1;
  const ghost = data?.previous_sets.find((entry) => entry.set_number === nextNumber);
  const locked = Boolean(busy) || uncertain;
  const volume = sets.reduce((total, entry) => total + Number(entry.weight) * entry.reps, 0);
  const dayData = session.key.startsWith(`${date}:`) ? session.data : null;
  const daySummary = dayData ? summarizeWorkoutDay(dayData.day_sets) : null;

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    async function load() {
      try {
        const { response, result } = await workoutRequest({ action: "load", date, exerciseId: exercise.id }, controller.signal);
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setSession({ key: queryKey, data: null, error: result.error ?? "No se han podido cargar las series.", loginRequired: response.status === 401 });
          return;
        }
        const historyResponse = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "history", date }),
          signal: controller.signal,
        });
        const history = await historyResponse.json();
        if (controller.signal.aborted) return;
        if (response.ok && (!historyResponse.ok || history.date !== date || !Array.isArray(history.sets))) {
          setSession({ key: queryKey, data: null, error: history.error ?? "No se ha podido cargar el entrenamiento del día.", loginRequired: historyResponse.status === 401 });
          return;
        }
        setSession({
          key: queryKey,
          data: response.ok ? { ...result, day_sets: history.sets } : null,
          error: response.ok ? "" : result.error ?? "No se han podido cargar las series.",
          loginRequired: response.status === 401,
        });
      } catch {
        if (!controller.signal.aborted) setSession({ key: queryKey, data: null, error: "No se ha podido conectar con tus entrenamientos.", loginRequired: false });
      }
    }
    void load();
    return () => controller.abort();
  }, [date, exercise.id, queryKey]);

  function chooseExercise(identifier: string) {
    setExerciseId(identifier);
    setWeight("");
    setReps("");
    setError("");
    setMessage("");
  }

  function updateSets(update: (current: WorkoutSet[]) => WorkoutSet[]) {
    setSession((current) => current.key === queryKey && current.data
      ? { ...current, data: { ...current.data, sets: update(current.data.sets) } }
      : current);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || finishing.current || (!pending.current && (!data || !weight.trim() || !reps.trim()))) return;
    const attempt: PendingSet = pending.current ?? {
      payload: { action: "save", date, exerciseId: exercise.id, weight: Number(weight), reps: Number(reps), requestId: crypto.randomUUID() },
      exerciseName: exercise.name,
      restSeconds: restEnabled ? restSeconds : null,
    };
    pending.current = attempt;
    setBusy("save");
    setError("");
    setMessage("");
    setLoginRequired(false);
    try {
      const { response, result } = await workoutRequest(attempt.payload);
      if (!response.ok) {
        const retryable = response.status >= 500 || [409, 429].includes(response.status);
        setUncertain(retryable);
        if (!retryable) pending.current = null;
        setLoginRequired(response.status === 401 || response.status === 403);
        setError(result.error ?? "No se ha podido guardar la serie.");
        return;
      }
      const saved = result.saved as WorkoutSet;
      if (!saved?.id) throw new Error("Missing saved set");
      updateSets((current) => [...current.filter((entry) => entry.id !== saved.id), saved].sort((first, second) => first.set_number - second.set_number));
      setReload((current) => current + 1);
      pending.current = null;
      setUncertain(false);
      setWeight("");
      setReps("");
      setMessage(`Serie ${saved.set_number} guardada el ${formatDate(attempt.payload.date)}.`);
      if (attempt.restSeconds !== null) startRest(attempt.restSeconds, attempt.exerciseName);
    } catch {
      setUncertain(true);
      setError("No se ha podido confirmar el guardado. Reintenta con los mismos datos para evitar duplicados.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(entry: WorkoutSet) {
    if (locked || finishing.current || !window.confirm(`¿Eliminar la serie ${entry.set_number}?`)) return;
    setBusy(entry.id);
    setError("");
    setMessage("");
    try {
      const { response, result } = await workoutRequest({ action: "delete", setId: entry.id });
      if (!response.ok && response.status !== 404) {
        setError(result.error ?? "No se ha podido eliminar la serie.");
        return;
      }
      updateSets((current) => current.filter((candidate) => candidate.id !== entry.id));
      setReload((current) => current + 1);
      setMessage("Serie eliminada.");
    } catch {
      setError("No se ha podido confirmar la eliminación. Actualiza las series antes de reintentarlo.");
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    if (!data || locked || pending.current || finishing.current || data.completed_at || !(data.day_set_count ?? sets.length) || weight.trim() || reps.trim()) return;
    if (!window.confirm("¿Finalizar el entrenamiento de hoy?")) return;
    finishing.current = true;
    setBusy("finish");
    setError("");
    setMessage("");
    try {
      const { response, result } = await workoutRequest({ action: "finish", date });
      if (!response.ok) {
        setError(result.error ?? "No se ha podido finalizar el entrenamiento.");
        setLoginRequired(response.status === 401 || response.status === 403);
        return;
      }
      setSession((current) => current.key === queryKey && current.data ? { ...current, data: { ...current.data, completed_at: result.completed_at } } : current);
      setMessage(`Entrenamiento del ${formatDate(date)} finalizado.`);
    } catch {
      setError("No se ha podido confirmar la finalización. Puedes reintentarlo sin duplicar avisos.");
    } finally {
      finishing.current = false;
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="training-heading" className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 id="training-heading" className="text-2xl font-semibold">Entrenar</h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">{date ? new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : "Cargando fecha..."}</p>
        </div>
        <button type="button" title="Actualizar series" aria-label="Actualizar series" disabled={locked || loading} onClick={() => setReload((value) => value + 1)} className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div className="space-y-5">
        <fieldset disabled={locked}>
          <legend className="mb-3 text-sm font-medium">Grupo muscular</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <label key={category} className="relative cursor-pointer">
                <input type="radio" name="muscle-group" checked={exercise.category === category} onChange={() => chooseExercise(exercises.find((candidate) => candidate.category === category)!.id)} className="peer sr-only" />
                <span className="flex min-h-10 items-center rounded-full border border-border px-3 text-sm peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50">{category}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <label htmlFor="exercise" className="block text-sm font-medium">Ejercicio</label>
          <select id="exercise" value={exercise.id} disabled={locked} onChange={(event) => chooseExercise(event.target.value)} className={inputClass}>
            {exercises.filter((candidate) => candidate.category === exercise.category).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </select>
        </div>
      </div>

      <MuscleViewer3D primary={exercise.primaryMeshes} secondary={exercise.secondaryMeshes} camera={exercise.defaultCamera} />

      <div aria-busy={loading} className="border-t border-border pt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 section-heading"><Dumbbell className="size-4 text-primary" />Series de hoy</h2>
          {data && <p className="text-sm text-muted-foreground">{sets.length} series · {formatWeight(volume)} kg</p>}
        </div>
        {loading ? <p role="status" className="flex min-h-16 items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Cargando series...</p> : session.error ? <p role="alert" className="break-words text-sm text-primary">{session.error}</p> : sets.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Sin series registradas.</p> : (
          <table className="w-full table-fixed text-left text-sm">
            <caption className="sr-only">Series de {exercise.name} del {date}</caption>
            <colgroup><col className="w-14" /><col /><col className="w-20" /><col className="w-12" /></colgroup>
            <thead className="text-muted-foreground"><tr className="border-b border-border"><th scope="col" className="py-3 font-medium">Serie</th><th scope="col" className="py-3 font-medium">Kg</th><th scope="col" className="py-3 font-medium">Reps</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>{sets.map((entry) => (
              <tr key={entry.id} className="border-b border-border">
                <th scope="row" className="py-3 font-normal tabular-nums">{entry.set_number}</th>
                <td className="py-3 font-mono tabular-nums">{formatWeight(entry.weight)}</td>
                <td className="py-3 font-mono tabular-nums">{entry.reps}</td>
                <td><button type="button" title={`Eliminar serie ${entry.set_number}`} aria-label={`Eliminar serie ${entry.set_number}`} disabled={locked} onClick={() => remove(entry)} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-card hover:text-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">{busy === entry.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {(!loading && session.loginRequired || loginRequired) && <Button asChild variant="outline" className="mt-4"><Link href="/acceso"><LogIn className="size-4" />Iniciar sesión</Link></Button>}
      </div>

      <form onSubmit={save} className="space-y-5 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-heading">Serie {nextNumber}</h2>
          {data?.previous_date && <p className="text-xs text-muted-foreground">Última sesión: {formatDate(data.previous_date)}</p>}
        </div>
        <fieldset disabled={!data || locked} className="grid grid-cols-2 gap-3">
          <legend className="sr-only">Datos de la nueva serie</legend>
          <div className="space-y-2"><label htmlFor="weight" className="block text-sm font-medium">Peso (kg)</label><input id="weight" type="number" inputMode="decimal" min={0} max={10000} step="0.01" required value={weight} onChange={(event) => setWeight(event.target.value)} placeholder={ghost ? String(ghost.weight) : "0"} className={`${inputClass} font-mono placeholder:text-muted-foreground/60`} /></div>
          <div className="space-y-2"><label htmlFor="reps" className="block text-sm font-medium">Repeticiones</label><input id="reps" type="number" inputMode="numeric" min={1} max={1000} step={1} required value={reps} onChange={(event) => setReps(event.target.value)} placeholder={ghost ? String(ghost.reps) : "0"} className={`${inputClass} font-mono placeholder:text-muted-foreground/60`} /></div>
        </fieldset>
        {ghost && <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>Anterior: {formatWeight(ghost.weight)} kg x {ghost.reps}</span><button type="button" title="Usar datos de la sesión anterior" aria-label="Usar peso y repeticiones de la sesión anterior" disabled={locked} onClick={() => { setWeight(String(ghost.weight)); setReps(String(ghost.reps)); }} className="flex size-11 items-center justify-center rounded-lg outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"><Copy className="size-4" /></button></div>}
        <fieldset disabled={locked} className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
          <legend className="sr-only">Descanso entre series</legend>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={restEnabled} onChange={(event) => setRestEnabled(event.target.checked)} className="size-4 accent-primary" />Descanso automático</label>
          <select value={restSeconds} aria-label="Duración del descanso" disabled={!restEnabled || locked} onChange={(event) => setRestSeconds(Number(event.target.value))} className="h-11 max-w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">{restOptions.map((seconds) => <option key={seconds} value={seconds}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</option>)}</select>
        </fieldset>
        {error && <p role="alert" className="break-words text-sm text-primary">{error}</p>}
        {message && <p role="status" className="flex items-center gap-2 text-sm"><Check className="size-4 shrink-0 text-primary" />{message}</p>}
        <Button type="submit" disabled={Boolean(busy) || (!data && !uncertain)} className="w-full sm:w-auto">{busy === "save" ? <LoaderCircle className="size-4 animate-spin" /> : uncertain ? <RefreshCw className="size-4" /> : <Plus className="size-4" />}{busy === "save" ? "Guardando..." : uncertain ? "Reintentar guardado" : "Guardar serie"}</Button>
      </form>

      <div className="space-y-3 border-t border-border pt-5">
        {data?.completed_at && <p role="status" className="flex items-center gap-2 text-sm"><CircleCheck className="size-4 shrink-0 text-primary" />Entrenamiento finalizado</p>}
        <Button type="button" variant="outline" className="w-full whitespace-normal rounded-lg sm:w-auto" disabled={!data || locked || Boolean(data.completed_at) || !(data.day_set_count ?? sets.length) || Boolean(weight.trim() || reps.trim())} onClick={() => void finish()}>{busy === "finish" ? <LoaderCircle className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}{busy === "finish" ? "Finalizando..." : "Finalizar entrenamiento"}</Button>
        <Link href="/" className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">Ver perfil y avisos</Link>
      </div>
      {daySummary && (
        <section aria-labelledby="day-summary-heading" aria-busy={loading} className="space-y-4 section-divider">
          <h2 id="day-summary-heading" className="section-heading">{dayData?.completed_at ? "Resumen del día" : "Ejercicios de hoy"}</h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Ejercicios</dt><dd className="font-mono tabular-nums">{daySummary.exercises.length}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Series</dt><dd className="font-mono tabular-nums">{daySummary.sets}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Repeticiones</dt><dd className="font-mono tabular-nums">{daySummary.repetitions}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Volumen (kg × reps)</dt><dd className="break-words font-mono tabular-nums">{formatWeight(daySummary.volume)}</dd></div>
          </dl>
          {daySummary.exercises.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay series registradas hoy.</p>}
          <ul className="divide-y divide-border">
            {daySummary.exercises.map((entry) => (
              <li key={entry.id} className="space-y-2 py-3">
                <button type="button" disabled={locked || loading} onClick={() => chooseExercise(entry.id)} className="min-h-11 max-w-full break-words text-left text-sm font-medium underline-offset-4 hover:underline disabled:opacity-50">{entry.name}</button>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {entry.sets.map((set) => <li key={set.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1"><span>Serie {set.set_number}</span><span className="font-mono tabular-nums">{formatWeight(set.weight)} kg × {set.reps}</span></li>)}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}