"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";

import exercises from "@/db/exercises.json";
import { MuscleViewer3D } from "@/components/anatomy/muscle-viewer-3d";
import { useTimer } from "@/components/timer/timer-provider";
import { DaySummary } from "@/components/training/day-summary";
import { ExercisePicker } from "@/components/training/exercise-picker";
import { LbConverter } from "@/components/training/lb-converter";
import { SetForm } from "@/components/training/set-form";
import { SetTable } from "@/components/training/set-table";
import { SessionHeader } from "@/components/training/session-header";
import { markSessionStart } from "@/components/training/session-clock";
import { PENDING_PREFIX, type DaySet, type WorkoutSet } from "@/components/training/types";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { postJson, requestJson } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { summarizeWorkoutDay } from "@/lib/history";
import { useLocalDate } from "@/lib/use-local-date";

type SessionData = { sets: WorkoutSet[]; previous_date: string | null; previous_sets: WorkoutSet[]; completed_at?: string | null; day_set_count?: number; day_sets: DaySet[] };
type SessionState = { key: string; data: SessionData | null; error: string; loginRequired: boolean };
type PendingSet = {
  payload: { action: "save"; date: string; exerciseId: string; weight: number; reps: number; requestId: string };
  exerciseName: string;
  restSeconds: number | null;
};

const workoutRequest = (body: object, signal?: AbortSignal) => requestJson("/api/workouts", body, { signal });

export function TrainingPanel() {
  const date = useLocalDate();
  const { startRest } = useTimer();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [exerciseId, setExerciseId] = useState(exercises[0].id);
  const [session, setSession] = useState<SessionState>({ key: "", data: null, error: "", loginRequired: false });
  const [reload, setReload] = useState(0);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [restEnabled, setRestEnabled] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [restSeconds, setRestSeconds] = useState(120);
  const [busy, setBusy] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
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
  const lastSet = sets.length > 0 ? sets[sets.length - 1] : undefined;
  const locked = Boolean(busy) || uncertain;
  const volume = sets.reduce((total, entry) => total + Number(entry.weight) * entry.reps, 0);
  const finishDisabled = !data || locked || Boolean(data.completed_at) || !(data.day_set_count ?? sets.length) || Boolean(weight.trim() || reps.trim());
  const dayData = session.key.startsWith(`${date}:`) ? session.data : null;
  const daySummary = dayData ? summarizeWorkoutDay(dayData.day_sets) : null;

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    async function load() {
      const network = "No se ha podido conectar con tus entrenamientos.";
      const dayFallback = "No se ha podido cargar el entrenamiento del día.";
      const exerciseDay = await postJson<Omit<SessionData, "day_sets">>("/api/workouts", { action: "load", date, exerciseId: exercise.id }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!exerciseDay.ok) {
        setSession({ key: queryKey, data: null, error: exerciseDay.unreachable ? network : exerciseDay.error ?? "No se han podido cargar las series.", loginRequired: exerciseDay.status === 401 });
        return;
      }
      const history = await postJson<{ date: string; sets: DaySet[] }>("/api/profile", { action: "history", date }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!history.ok || history.data.date !== date || !Array.isArray(history.data.sets)) {
        setSession({ key: queryKey, data: null, error: !history.ok ? (history.unreachable ? network : history.error ?? dayFallback) : dayFallback, loginRequired: !history.ok && history.status === 401 });
        return;
      }
      setSession({ key: queryKey, data: { ...exerciseDay.data, day_sets: history.data.sets }, error: "", loginRequired: false });
    }
    void load();
    return () => controller.abort();
  }, [date, exercise.id, queryKey]);

  function chooseExercise(identifier: string) {
    setExerciseId(identifier);
    setWeight("");
    setReps("");
    setError("");
  }

  /** Aplica un cambio local a los datos cargados (sin volver a pedirlos, para que la interfaz responda al instante). */
  function mutate(update: (current: SessionData) => SessionData) {
    setSession((current) => current.key === queryKey && current.data ? { ...current, data: update(current.data) } : current);
  }

  const bySetNumber = (first: WorkoutSet, second: WorkoutSet) => first.set_number - second.set_number;

  function insertSet(entry: WorkoutSet, replacing?: string) {
    mutate((current) => ({
      ...current,
      sets: [...current.sets.filter((candidate) => candidate.id !== entry.id && candidate.id !== replacing), entry].sort(bySetNumber),
      day_sets: [...current.day_sets.filter((candidate) => candidate.id !== entry.id && candidate.id !== replacing), { ...entry, exercise_id: exercise.id, name: exercise.name }],
      day_set_count: current.day_set_count === undefined || replacing ? current.day_set_count : current.day_set_count + 1,
    }));
  }

  function dropSet(id: string, countable: boolean) {
    mutate((current) => ({
      ...current,
      sets: current.sets.filter((candidate) => candidate.id !== id),
      day_sets: current.day_sets.filter((candidate) => candidate.id !== id),
      day_set_count: current.day_set_count === undefined || !countable ? current.day_set_count : Math.max(0, current.day_set_count - 1),
    }));
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
    // Optimista: la serie aparece y el formulario se vacía ya; si el guardado falla se deshace.
    const tempId = `${PENDING_PREFIX}${attempt.payload.requestId}`;
    insertSet({ id: tempId, set_number: nextNumber, weight: attempt.payload.weight, reps: attempt.payload.reps });
    setWeight("");
    setReps("");
    const rollback = () => {
      dropSet(tempId, true);
      setWeight(String(attempt.payload.weight));
      setReps(String(attempt.payload.reps));
    };
    setBusy("save");
    setError("");
    setLoginRequired(false);
    try {
      const { response, result } = await workoutRequest(attempt.payload);
      if (!response.ok) {
        rollback();
        const retryable = response.status >= 500 || [409, 429].includes(response.status);
        setUncertain(retryable);
        if (!retryable) pending.current = null;
        setLoginRequired(response.status === 401 || response.status === 403);
        setError(result.error ?? "No se ha podido guardar la serie.");
        return;
      }
      const saved = result.saved as WorkoutSet;
      if (!saved?.id) throw new Error("Missing saved set");
      insertSet(saved, tempId);
      markSessionStart(attempt.payload.date);
      pending.current = null;
      setUncertain(false);
      toast(`Serie ${saved.set_number} guardada el ${formatDate(attempt.payload.date, "day")}.`, { variant: "success" });
      if (attempt.restSeconds !== null) startRest(attempt.restSeconds, attempt.exerciseName);
    } catch {
      rollback();
      setUncertain(true);
      setError("No se ha podido confirmar el guardado. Reintenta con los mismos datos para evitar duplicados.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(entry: WorkoutSet) {
    if (locked || finishing.current) return;
    if (!(await confirm({ title: `¿Eliminar la serie ${entry.set_number}?`, description: "Esta acción no se puede deshacer.", confirmLabel: "Eliminar", destructive: true }))) return;
    // Optimista: la serie desaparece ya; si el servidor falla se vuelve a insertar.
    dropSet(entry.id, true);
    setBusy(entry.id);
    setError("");
    try {
      const { response, result } = await workoutRequest({ action: "delete", setId: entry.id });
      if (!response.ok && response.status !== 404) {
        insertSet(entry);
        setError(result.error ?? "No se ha podido eliminar la serie.");
        return;
      }
      toast("Serie eliminada.", { variant: "success" });
    } catch {
      insertSet(entry);
      setError("No se ha podido confirmar la eliminación. Actualiza las series antes de reintentarlo.");
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    if (!data || locked || pending.current || finishing.current || data.completed_at || !(data.day_set_count ?? sets.length) || weight.trim() || reps.trim()) return;
    if (!(await confirm({ title: "¿Finalizar el entrenamiento de hoy?", confirmLabel: "Finalizar" }))) return;
    finishing.current = true;
    setBusy("finish");
    setError("");
    try {
      const { response, result } = await workoutRequest({ action: "finish", date });
      if (!response.ok) {
        setError(result.error ?? "No se ha podido finalizar el entrenamiento.");
        setLoginRequired(response.status === 401 || response.status === 403);
        return;
      }
      setSession((current) => current.key === queryKey && current.data ? { ...current, data: { ...current.data, completed_at: result.completed_at } } : current);
      toast(`Entrenamiento del ${formatDate(date, "day")} finalizado.`, { variant: "success" });
    } catch {
      setError("No se ha podido confirmar la finalización. Puedes reintentarlo sin duplicar avisos.");
    } finally {
      finishing.current = false;
      setBusy(null);
    }
  }

  return (
    <div className="space-y-7 max-md:pb-20">
      {daySummary && <SessionHeader date={date} sets={daySummary.sets} volume={daySummary.volume} completedAt={dayData?.completed_at} finishing={busy === "finish"} finishDisabled={finishDisabled} onFinish={() => void finish()} />}

      <ExercisePicker exerciseId={exercise.id} disabled={locked} onChange={chooseExercise} />

      <SetForm
        nextNumber={nextNumber}
        previousDate={data?.previous_date}
        weight={weight}
        reps={reps}
        onWeightChange={setWeight}
        onRepsChange={setReps}
        ghost={ghost}
        lastSet={lastSet}
        restEnabled={restEnabled}
        onRestEnabledChange={setRestEnabled}
        restSeconds={restSeconds}
        onRestSecondsChange={setRestSeconds}
        ready={Boolean(data)}
        busy={busy}
        uncertain={uncertain}
        locked={locked}
        error={error}
        onSubmit={save}
      />

      <SetTable
        exerciseName={exercise.name}
        date={date}
        sets={sets}
        volume={volume}
        hasData={Boolean(data)}
        loading={loading}
        error={session.error}
        loginRequired={(!loading && session.loginRequired) || loginRequired}
        locked={locked}
        busy={busy}
        onRefresh={() => setReload((value) => value + 1)}
        onRemove={remove}
      />

      <Link href="/" className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">Ver perfil y avisos</Link>
      <details className="surface-1 group rounded-2xl" onToggle={(event) => setViewerOpen(event.currentTarget.open)}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          Músculos trabajados en este ejercicio
          <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="px-4 pb-4">
          {viewerOpen && <MuscleViewer3D primary={exercise.primaryMeshes} secondary={exercise.secondaryMeshes} camera={exercise.defaultCamera} />}
        </div>
      </details>

      <LbConverter />

      {daySummary && <DaySummary summary={daySummary} completed={Boolean(dayData?.completed_at)} loading={loading} locked={locked} onSelectExercise={chooseExercise} />}
    </div>
  );
}
