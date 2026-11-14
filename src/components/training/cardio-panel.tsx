"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, HeartPulse, LoaderCircle, LogIn, Pause, Pencil, Play, Plus, RefreshCw, Square, Timer, Trash2, X } from "lucide-react";

import { useCardioTimer } from "@/components/timer/timer-provider";
import { useLocalDate } from "@/components/training/use-local-date";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { elapsedTime, formatTimer } from "@/lib/timer";
import { CARDIO_ACTIVITY_OPTIONS, DEFAULT_BODY_WEIGHT_KG, cardioActivityLabel, estimateCalories, formatCardioDuration, validCardioFields } from "@/lib/cardio.mjs";

type CardioSession = {
  id: string;
  date: string;
  activity_type: string;
  duration_seconds: number;
  distance_km: number | string | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  data_source: "manual" | "estimated" | "sensor";
  rpe: number | null;
};
type ListState = { key: number; sessions: CardioSession[]; error: string; loginRequired: boolean } | null;
type Form = { activity: string; minutes: string; seconds: string; distance: string; avgHr: string; maxHr: string; calories: string; rpe: string };
type Fields = { activityType: string; durationSeconds: number; distanceKm: number | null; avgHr: number | null; maxHr: number | null; calories: number | null; rpe: number | null };
type Attempt =
  | ({ action: "save"; date: string; requestId: string } & Fields)
  | ({ action: "update"; sessionId: string } & Fields);

const iconButtonClass = "flex size-11 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-card hover:text-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
const emptyForm: Form = { activity: CARDIO_ACTIVITY_OPTIONS[0].id, minutes: "", seconds: "", distance: "", avgHr: "", maxHr: "", calories: "", rpe: "" };

// Campo vacío = null; texto no numérico = NaN (lo rechaza la validación).
function optionalNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function parseForm(form: Form): { fields: Fields | null; message: string } {
  const minutes = form.minutes.trim() === "" ? 0 : Number(form.minutes);
  const seconds = form.seconds.trim() === "" ? 0 : Number(form.seconds);
  if (!Number.isInteger(minutes) || !Number.isInteger(seconds) || minutes < 0 || seconds < 0 || seconds > 59) return { fields: null, message: "Indica la duración con minutos enteros y segundos entre 0 y 59." };
  const durationSeconds = minutes * 60 + seconds;
  if (durationSeconds < 1 || durationSeconds > 86400) return { fields: null, message: "La duración debe estar entre 1 segundo y 24 horas." };
  const distanceKm = optionalNumber(form.distance);
  if (distanceKm !== null && !(distanceKm > 0 && distanceKm <= 1000 && Math.abs(distanceKm * 1000 - Math.round(distanceKm * 1000)) < 0.000001)) return { fields: null, message: "La distancia debe ser mayor que 0, de hasta 1000 km y con 3 decimales como máximo." };
  const avgHr = optionalNumber(form.avgHr);
  const maxHr = optionalNumber(form.maxHr);
  if ([avgHr, maxHr].some((value) => value !== null && !(Number.isInteger(value) && value >= 30 && value <= 250))) return { fields: null, message: "La frecuencia cardíaca debe ser un número entero entre 30 y 250." };
  if (avgHr !== null && maxHr !== null && maxHr < avgHr) return { fields: null, message: "La frecuencia máxima no puede ser menor que la media." };
  const calories = optionalNumber(form.calories);
  if (calories !== null && !(Number.isInteger(calories) && calories >= 0 && calories <= 20000)) return { fields: null, message: "Las calorías deben ser un número entero entre 0 y 20000." };
  const rpe = optionalNumber(form.rpe);
  const fields: Fields = { activityType: form.activity, durationSeconds, distanceKm, avgHr, maxHr, calories, rpe };
  return validCardioFields(fields) ? { fields, message: "" } : { fields: null, message: "Revisa los datos del cardio." };
}

function formatDate(date: string, today: string) {
  if (date === today) return "Hoy";
  const showYear = today && date.slice(0, 4) !== today.slice(0, 4);
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", ...(showYear ? { year: "numeric" } : {}) });
}

function sessionDetails(session: CardioSession) {
  const details: string[] = [];
  if (session.distance_km !== null) details.push(`${Number(session.distance_km).toLocaleString("es-ES", { maximumFractionDigits: 3 })} km`);
  if (session.calories !== null) details.push(`${session.data_source === "estimated" ? "≈ " : ""}${session.calories.toLocaleString("es-ES")} kcal`);
  if (session.avg_hr !== null || session.max_hr !== null) details.push(`FC ${[session.avg_hr, session.max_hr].filter((value) => value !== null).join(" / ")}`);
  if (session.rpe !== null) details.push(`RPE ${session.rpe}`);
  return details;
}

async function cardioRequest(body: object, signal?: AbortSignal) {
  const response = await fetch("/api/cardio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  return { response, result: await response.json() };
}

export function CardioPanel() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const date = useLocalDate();
  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [list, setList] = useState<ListState>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [timerFilled, setTimerFilled] = useState(false);
  const { timer, value: timerValue, ready: timerReady, persistent: timerPersistent, dispatch: timerDispatch } = useCardioTimer();
  const pending = useRef<Attempt | null>(null);
  const activityField = useRef<HTMLSelectElement>(null);
  const loading = list === null || list.key !== reload;
  const locked = Boolean(busy) || uncertain;
  const timerRunning = timer.status === "running";
  const timerActive = timer.status !== "idle";
  // La actividad cronometrada se recupera de la etiqueta del cronómetro (sobrevive a recargas).
  const timerActivity = CARDIO_ACTIVITY_OPTIONS.find((option) => option.label === timer.label)?.id ?? null;
  const activity = timerActive && timerActivity ? timerActivity : form.activity;
  const sessions = !loading ? list.sessions : [];

  const estimateSeconds = (Number(form.minutes) || 0) * 60 + (Number(form.seconds) || 0);
  const distanceValue = Number(form.distance);
  const estimate = form.calories.trim() === "" ? estimateCalories({
    activityType: activity,
    durationSeconds: estimateSeconds,
    distanceKm: distanceValue > 0 ? distanceValue : null,
  }) : null;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const { response, result } = await cardioRequest({ action: "list" }, controller.signal);
        if (controller.signal.aborted) return;
        setList(response.ok && Array.isArray(result.sessions)
          ? { key: reload, sessions: result.sessions, error: "", loginRequired: false }
          : { key: reload, sessions: [], error: result.error ?? "No se ha podido cargar el cardio.", loginRequired: response.status === 401 });
      } catch {
        if (!controller.signal.aborted) setList({ key: reload, sessions: [], error: "No se ha podido conectar con tu cardio.", loginRequired: false });
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  function change(field: keyof Form, value: string) {
    // Si se retoca la duración a mano, ya no coincide con la del cronómetro.
    if (field === "minutes" || field === "seconds") setTimerFilled(false);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditing(null);
  }

  function startTimer() {
    if (locked || editing || timerActive) return;
    timerDispatch({ type: "startStopwatch", label: cardioActivityLabel(form.activity) });
    setTimerFilled(false);
    setError("");
  }

  function resumeTimer() {
    timerDispatch({ type: "start" });
    setTimerFilled(false);
  }

  // Terminar congela el tiempo y lo vuelca al formulario; el cronómetro se reinicia al guardar.
  // Hasta entonces sigue guardado, así que cerrar la app no pierde la duración.
  function finishTimer() {
    const seconds = Math.floor(elapsedTime(timer, Date.now()) / 1000);
    if (seconds < 1) {
      setError("El cronómetro aún no ha registrado ni un segundo.");
      return;
    }
    const clamped = Math.min(seconds, 86400);
    timerDispatch({ type: "pause" });
    setForm((current) => ({ ...current, activity: timerActivity ?? current.activity, minutes: String(Math.floor(clamped / 60)), seconds: String(clamped % 60) }));
    setTimerFilled(true);
    setError("");
    if (clamped < seconds) toast("El cronómetro superaba las 24 h; la duración se ha limitado a 24 h.", { variant: "warning" });
  }

  async function discardTimer() {
    if (locked) return;
    if (!(await confirm({ title: `¿Descartar el cronómetro (${formatTimer(elapsedTime(timer, Date.now()))})?`, description: "Se perderá el tiempo registrado.", confirmLabel: "Descartar", destructive: true }))) return;
    timerDispatch({ type: "reset" });
    setTimerFilled(false);
  }

  function startEdit(session: CardioSession) {
    if (locked || timerActive) return;
    setEditing(session.id);
    setForm({
      activity: session.activity_type,
      minutes: String(Math.floor(session.duration_seconds / 60)),
      seconds: session.duration_seconds % 60 ? String(session.duration_seconds % 60) : "",
      distance: session.distance_km === null ? "" : String(Number(session.distance_km)),
      avgHr: session.avg_hr === null ? "" : String(session.avg_hr),
      maxHr: session.max_hr === null ? "" : String(session.max_hr),
      // Una estimación se deja en blanco para que se recalcule si cambian duración o distancia.
      calories: session.data_source === "estimated" || session.calories === null ? "" : String(session.calories),
      rpe: session.rpe === null ? "" : String(session.rpe),
    });
    setError("");
    activityField.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    activityField.current?.focus({ preventScroll: true });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    let attempt = pending.current;
    if (!attempt) {
      if (!date) return;
      const parsed = parseForm(form);
      if (!parsed.fields) {
        setError(parsed.message);
        return;
      }
      attempt = editing
        ? { action: "update", sessionId: editing, ...parsed.fields }
        : { action: "save", date, requestId: crypto.randomUUID(), ...parsed.fields };
    }
    const saving = attempt.action === "save";
    // Solo los guardados se reintentan con el mismo requestId; editar es idempotente por naturaleza.
    pending.current = saving ? attempt : null;
    setBusy("submit");
    setError("");
    setLoginRequired(false);
    try {
      const { response, result } = await cardioRequest(attempt);
      if (!response.ok) {
        const retryable = response.status >= 500 || [409, 429].includes(response.status);
        setUncertain(saving && retryable);
        if (!saving || !retryable) pending.current = null;
        setLoginRequired(response.status === 401 || response.status === 403);
        setError(result.error ?? "No se ha podido guardar el cardio.");
        return;
      }
      const saved = result.saved as CardioSession | undefined;
      if (!saved?.id) throw new Error("Missing saved session");
      pending.current = null;
      setUncertain(false);
      if (saving && timerFilled) timerDispatch({ type: "reset" });
      setTimerFilled(false);
      resetForm();
      setReload((current) => current + 1);
      const estimated = saved.data_source === "estimated" && saved.calories !== null ? ` Calorías estimadas: ≈ ${saved.calories} kcal.` : "";
      toast(`${saving ? "Cardio guardado" : "Cardio actualizado"}: ${cardioActivityLabel(saved.activity_type)}, ${formatCardioDuration(saved.duration_seconds)}.${estimated}`);
    } catch {
      if (saving) {
        setUncertain(true);
        setError("No se ha podido confirmar el guardado. Reintenta con los mismos datos para evitar duplicados.");
      } else {
        setError("No se ha podido confirmar la edición. Actualiza el listado antes de reintentarlo.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(session: CardioSession) {
    if (locked) return;
    if (!(await confirm({ title: `¿Eliminar ${cardioActivityLabel(session.activity_type)} de ${formatCardioDuration(session.duration_seconds)}?`, description: "Esta acción no se puede deshacer.", confirmLabel: "Eliminar", destructive: true }))) return;
    setBusy(session.id);
    setError("");
    try {
      const { response, result } = await cardioRequest({ action: "delete", sessionId: session.id });
      if (!response.ok && response.status !== 404) {
        setError(result.error ?? "No se ha podido eliminar la sesión.");
        setLoginRequired(response.status === 401 || response.status === 403);
        return;
      }
      if (editing === session.id) resetForm();
      setReload((current) => current + 1);
      toast("Sesión eliminada.", { variant: "success" });
    } catch {
      setError("No se ha podido confirmar la eliminación. Actualiza el listado antes de reintentarlo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-7">
      <Card>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-section flex items-center gap-2"><HeartPulse className="size-5 text-primary" />{editing ? "Editar sesión" : "Nueva sesión de cardio"}</h2>
          {editing && <Button type="button" variant="ghost" disabled={locked} onClick={resetForm}><X className="size-4" />Cancelar edición</Button>}
        </div>
        <fieldset disabled={locked} className="space-y-4">
          <legend className="sr-only">Datos de la sesión de cardio</legend>
          <Field label="Actividad">
            <Select id="cardio-activity" ref={activityField} value={activity} disabled={timerActive && timerActivity !== null} onChange={(event) => change("activity", event.target.value)}>
              {CARDIO_ACTIVITY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </Select>
          </Field>
          <div role="group" aria-labelledby="cardio-timer-heading" className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 id="cardio-timer-heading" className="flex items-center gap-2 text-sm font-medium"><Timer className="size-4 text-primary" aria-hidden="true" />Cronómetro</h3>
              <p className="text-xs text-muted-foreground">{timerRunning ? "En marcha" : timer.status === "paused" ? "En pausa" : timer.status === "finished" ? "Tiempo máximo alcanzado" : "Detenido"}</p>
            </div>
            <p role="timer" aria-live="off" aria-label="Tiempo de cardio" className="font-mono text-4xl tabular-nums">{formatTimer(timerValue)}</p>
            <div className="flex flex-wrap gap-2">
              {!timerActive && <Button type="button" variant="outline" disabled={Boolean(editing) || !timerReady} onClick={startTimer}><Play className="size-4" />Iniciar</Button>}
              {timerRunning && <Button type="button" variant="outline" onClick={() => timerDispatch({ type: "pause" })}><Pause className="size-4" />Pausar</Button>}
              {timer.status === "paused" && <Button type="button" variant="outline" onClick={resumeTimer}><Play className="size-4" />Reanudar</Button>}
              {timerActive && <Button type="button" onClick={finishTimer}><Square className="size-4" />Terminar</Button>}
              {timerActive && <Button type="button" variant="ghost" onClick={discardTimer}><X className="size-4" />Descartar</Button>}
            </div>
            {editing && !timerActive && <p className="text-xs text-muted-foreground">Termina la edición para usar el cronómetro.</p>}
            {timerFilled && <p role="status" className="text-xs text-muted-foreground">Duración rellenada desde el cronómetro. Se reiniciará al guardar la sesión.</p>}
            {timerReady && !timerPersistent && <Alert variant="warning" className="text-xs">El navegador no permite guardar el cronómetro. Seguirá funcionando aquí, pero se perderá al cerrar o recargar.</Alert>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minutos"><Input id="cardio-minutes" type="number" inputMode="numeric" min={0} max={1440} step={1} value={form.minutes} onChange={(event) => change("minutes", event.target.value)} placeholder="0" className="font-mono" /></Field>
            <Field label="Segundos"><Input id="cardio-seconds" type="number" inputMode="numeric" min={0} max={59} step={1} value={form.seconds} onChange={(event) => change("seconds", event.target.value)} placeholder="0" className="font-mono" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distancia (km)" suffix="opcional"><Input id="cardio-distance" type="number" inputMode="decimal" min={0.001} max={1000} step="0.001" value={form.distance} onChange={(event) => change("distance", event.target.value)} className="font-mono" /></Field>
            <Field label="Esfuerzo (RPE)" suffix="opcional">
              <Select id="cardio-rpe" value={form.rpe} onChange={(event) => change("rpe", event.target.value)}>
                <option value="">—</option>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="FC media" suffix="lpm"><Input id="cardio-avg-hr" type="number" inputMode="numeric" min={30} max={250} step={1} value={form.avgHr} onChange={(event) => change("avgHr", event.target.value)} className="font-mono" /></Field>
            <Field label="FC máxima" suffix="lpm"><Input id="cardio-max-hr" type="number" inputMode="numeric" min={30} max={250} step={1} value={form.maxHr} onChange={(event) => change("maxHr", event.target.value)} className="font-mono" /></Field>
          </div>
          <Field label="Calorías (kcal)" suffix="opcional" hint={<>Si lo dejas vacío se estimará con un peso de {DEFAULT_BODY_WEIGHT_KG} kg y se marcará como estimación.</>}>
            <Input id="cardio-calories" type="number" inputMode="numeric" min={0} max={20000} step={1} value={form.calories} onChange={(event) => change("calories", event.target.value)} placeholder={estimate !== null ? `≈ ${estimate}` : ""} className="font-mono" />
          </Field>
        </fieldset>
        {error && <Alert variant="error">{error}</Alert>}
        {loginRequired && <Button asChild variant="outline"><Link href="/acceso"><LogIn className="size-4" />Iniciar sesión</Link></Button>}
        <Button type="submit" disabled={Boolean(busy) || !date} className="w-full sm:w-auto">
          {busy === "submit" ? <LoaderCircle className="size-4 animate-spin" /> : uncertain ? <RefreshCw className="size-4" /> : editing ? <Check className="size-4" /> : <Plus className="size-4" />}
          {busy === "submit" ? "Guardando..." : uncertain ? "Reintentar guardado" : editing ? "Guardar cambios" : "Guardar cardio"}
        </Button>
      </form>
      </Card>

      <Card role="region" aria-labelledby="cardio-recent-heading" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="cardio-recent-heading" className="type-section">Sesiones recientes</h2>
          <button type="button" title="Actualizar cardio" aria-label="Actualizar cardio" disabled={locked || loading} onClick={() => setReload((value) => value + 1)} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {loading ? <p role="status" className="flex min-h-16 items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Cargando cardio...</p>
          : list.error ? <div className="space-y-4"><Alert variant="error">{list.error}</Alert>{list.loginRequired && <Button asChild variant="outline"><Link href="/acceso"><LogIn className="size-4" />Iniciar sesión</Link></Button>}</div>
          : sessions.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Todavía no has registrado cardio.</p>
          : (
            <ul className="divide-y divide-border">
              {sessions.map((session) => {
                const details = sessionDetails(session);
                return (
                  <li key={session.id} className={`flex items-start justify-between gap-3 py-3 ${editing === session.id ? "bg-primary/5" : ""}`}>
                    <div className="min-w-0 space-y-1">
                      <p className="break-words text-sm font-medium">{cardioActivityLabel(session.activity_type)} · {formatCardioDuration(session.duration_seconds)}</p>
                      <p className="break-words text-xs text-muted-foreground"><span className="capitalize">{formatDate(session.date, date)}</span>{details.length > 0 && ` · ${details.join(" · ")}`}</p>
                    </div>
                    <div className="flex shrink-0">
                      <button type="button" title={timerActive ? "Termina o descarta el cronómetro para editar" : "Editar sesión"} aria-label={`Editar ${cardioActivityLabel(session.activity_type)} del ${formatDate(session.date, date)}`} disabled={locked || timerActive} onClick={() => startEdit(session)} className={iconButtonClass}><Pencil className="size-4" /></button>
                      <button type="button" title="Eliminar sesión" aria-label={`Eliminar ${cardioActivityLabel(session.activity_type)} del ${formatDate(session.date, date)}`} disabled={locked} onClick={() => void remove(session)} className={iconButtonClass}>{busy === session.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
      </Card>
    </div>
  );
}
