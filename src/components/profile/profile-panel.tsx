"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Bot, CalendarDays, Check, Dumbbell, LoaderCircle, LogIn, RefreshCw, Save, Trash2, Trophy, UserRound } from "lucide-react";

import quotes from "@/data/athlete-quotes.json";
import { Button } from "@/components/ui/button";

type Profile = { id: string; username: string; avatar_url: string | null; created_at: string };
type Overview = {
  profile: Profile;
  email: string | null;
  summary: { days: number; sets: number; exercises: number; volume: number };
  activity: { date: string; sets: number }[];
  recent_days: { date: string; sets: number; volume: number }[];
  best_marks: { exercise_id: string; name: string; category: string; weight: number; reps: number; date: string }[];
};
type ViewState = { key: string; data: Overview | null; error: string; loginRequired: boolean };

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

function formatNumber(value: number, compact = false) {
  return Number(value).toLocaleString("es-ES", { maximumFractionDigits: compact ? 1 : 2, notation: compact ? "compact" : "standard" });
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

async function profileRequest(body: object, signal?: AbortSignal) {
  const response = await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  return { response, result: await response.json() };
}

export function ProfilePanel() {
  const date = useSyncExternalStore(subscribeDate, localDate, () => "");
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<ViewState>({ key: "", data: null, error: "", loginRequired: false });
  const [avatarDraft, setAvatarDraft] = useState("");
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [message, setMessage] = useState("");
  const queryKey = `${date}:${reload}`;
  const loading = !date || view.key !== queryKey;
  const data = loading ? null : view.data;
  const dayIndex = date ? Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000) : 0;
  const quote = quotes[dayIndex % quotes.length];
  const maxActivity = Math.max(1, ...(data?.activity.map((day) => day.sets) ?? []));

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    async function load() {
      try {
        const { response, result } = await profileRequest({ action: "load", date }, controller.signal);
        if (controller.signal.aborted) return;
        setView({ key: queryKey, data: response.ok ? result : null, error: response.ok ? "" : result.error ?? "No se ha podido cargar el perfil.", loginRequired: response.status === 401 });
        if (response.ok) setAvatarDraft(result.profile.avatar_url ?? "");
      } catch {
        if (!controller.signal.aborted) setView({ key: queryKey, data: null, error: "No se ha podido conectar con tu perfil.", loginRequired: false });
      }
    }
    void load();
    return () => controller.abort();
  }, [date, queryKey]);

  async function updateAvatar(value: string | null) {
    if (saving || !data) return;
    setSaving(true);
    setSaveError("");
    setMessage("");
    try {
      const { response, result } = await profileRequest({ action: "avatar", avatarUrl: value });
      if (!response.ok) {
        setSaveError(result.error ?? "No se ha podido guardar la foto.");
        return;
      }
      setAvatarDraft(result.profile.avatar_url ?? "");
      setFailedAvatar(null);
      setMessage(result.profile.avatar_url ? "Foto actualizada." : "Foto eliminada.");
      setReload((current) => current + 1);
    } catch {
      setSaveError("No se ha podido confirmar el cambio. Puedes volver a guardar la misma URL.");
    } finally {
      setSaving(false);
    }
  }

  function submitAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void updateAvatar(avatarDraft);
  }

  return (
    <section aria-labelledby="profile-heading" className="space-y-7">
      <header className="flex items-center justify-between gap-3">
        <h1 id="profile-heading" className="min-w-0 flex-1 break-words text-xl font-bold sm:text-2xl">{data ? `Bienvenido, ${data.profile.username}` : "Perfil"}</h1>
        <Link href="/coach" title="Asistente" aria-label="Asistente" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"><Bot className="size-4" />Asistente</Link>
        <button type="button" title="Actualizar perfil" aria-label="Actualizar perfil" disabled={loading || saving} onClick={() => setReload((current) => current + 1)} className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      {data && (
        <div className="flex items-center gap-4">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
            {data.profile.avatar_url && failedAvatar !== data.profile.avatar_url ? (
              <Image src={data.profile.avatar_url} width={96} height={96} alt={`Foto de ${data.profile.username}`} unoptimized referrerPolicy="no-referrer" onError={() => setFailedAvatar(data.profile.avatar_url)} className="size-24 object-cover" />
            ) : <UserRound className="size-10 text-primary" aria-hidden="true" />}
          </div>
          <div className="min-w-0">
            {data.email && <p className="break-all text-sm text-muted-foreground">{data.email}</p>}
          </div>
        </div>
      )}

      <blockquote className="border-l-2 border-primary pl-4">
        <p className="text-xl font-semibold leading-relaxed tracking-wide">{quote.text}</p>
        <footer className="mt-3 text-sm font-semibold text-foreground"><cite className="not-italic">{quote.author}</cite></footer>
      </blockquote>

      <Button asChild variant="outline" className="rounded-lg"><Link href="/historial"><CalendarDays className="size-4" />Historial de entrenamientos</Link></Button>

      {loading ? (
        <p role="status" className="flex min-h-40 items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Cargando perfil...</p>
      ) : !data ? (
        <div className="space-y-4 border-t border-border pt-5">
          <p role="alert" className="break-words text-sm text-primary">{view.error}</p>
          {view.loginRequired && <Button asChild><Link href="/acceso"><LogIn className="size-4" />Iniciar sesión</Link></Button>}
        </div>
      ) : (
        <>
          <form onSubmit={submitAvatar} className="space-y-3 border-y border-border py-5">
            <label htmlFor="avatar-url" className="block text-sm font-medium">URL de la foto (HTTPS)</label>
            <input id="avatar-url" type="url" pattern="https://.*" maxLength={2048} autoComplete="url" spellCheck={false} value={avatarDraft} disabled={saving} onChange={(event) => setAvatarDraft(event.target.value)} className="h-12 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving || avatarDraft.trim() === (data.profile.avatar_url ?? "")}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar foto
              </Button>
              <button type="button" title="Quitar foto" aria-label="Quitar foto de perfil" disabled={saving || !data.profile.avatar_url} onClick={() => updateAvatar(null)} className="flex size-11 items-center justify-center rounded-lg border border-border text-muted-foreground outline-none hover:bg-card hover:text-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"><Trash2 className="size-4" /></button>
            </div>
            {saveError && <p role="alert" className="break-words text-sm text-primary">{saveError}</p>}
            {message && <p role="status" className="flex items-center gap-2 text-sm"><Check className="size-4 shrink-0 text-primary" />{message}</p>}
            {data.profile.avatar_url && failedAvatar === data.profile.avatar_url && <p role="status" className="text-sm text-muted-foreground">No se ha podido cargar la foto.</p>}
          </form>

          <section aria-labelledby="summary-heading" className="section-divider">
            <h2 id="summary-heading" className="mb-4 section-heading">Últimos 28 días</h2>
            <dl className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
              {[
                { label: "Días", value: data.summary.days },
                { label: "Series", value: data.summary.sets },
                { label: "Ejercicios", value: data.summary.exercises },
                { label: "Volumen (kg)", value: data.summary.volume },
              ].map((metric) => (
                <div key={metric.label} className="min-w-0 px-3 py-4">
                  <dt className="text-xs text-muted-foreground">{metric.label}</dt>
                  <dd title={formatNumber(metric.value)} className="mt-1 break-words font-mono text-2xl font-medium tabular-nums">{formatNumber(metric.value, metric.value >= 100000)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <figure aria-labelledby="activity-heading" className="section-divider">
            <figcaption id="activity-heading" className="mb-4 section-heading">Actividad de los últimos 7 días</figcaption>
            <ul className="grid grid-cols-7 gap-3">
              {data.activity.map((day) => (
                <li key={day.date} className="min-w-0 text-center">
                  <span className="sr-only">{formatDate(day.date)}: {day.sets} series</span>
                  <div aria-hidden="true" className="flex h-20 items-end border-b border-border"><div className="w-full rounded-t-sm bg-primary" style={{ height: `${day.sets / maxActivity * 100}%` }} /></div>
                  <span aria-hidden="true" className="mt-2 block text-xs text-muted-foreground">{new Date(`${day.date}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short" })}</span>
                </li>
              ))}
            </ul>
          </figure>

          <section aria-labelledby="recent-heading" className="section-divider">
            <h2 id="recent-heading" className="mb-3 flex items-center gap-2 section-heading"><CalendarDays className="size-4 text-primary" />Últimos entrenamientos</h2>
            {data.recent_days.length === 0 ? <div className="space-y-4"><p className="text-sm text-muted-foreground">Todavía no hay entrenamientos registrados.</p><Button asChild><Link href="/entrenar"><Dumbbell className="size-4" />Entrenar</Link></Button></div> : (
              <ul className="divide-y divide-border">{data.recent_days.map((day) => <li key={day.date} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"><div><p className="text-sm">{formatDate(day.date)}</p><p className="text-xs text-muted-foreground">{day.sets} series</p></div><p className="font-mono text-sm tabular-nums">{formatNumber(day.volume)} kg</p></li>)}</ul>
            )}
          </section>

          <section aria-labelledby="marks-heading" className="section-divider">
            <h2 id="marks-heading" className="mb-3 flex items-center gap-2 section-heading"><Trophy className="size-4 text-primary" />Mejores marcas por peso</h2>
            {data.best_marks.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay marcas registradas.</p> : (
              <ul className="divide-y divide-border">{data.best_marks.map((mark) => <li key={mark.exercise_id} className="flex items-start justify-between gap-4 py-3"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{mark.name}</p><p className="mt-1 text-xs text-muted-foreground">{mark.category} · {formatDate(mark.date)}</p></div><div className="shrink-0 text-right"><p className="font-mono text-sm tabular-nums">{formatNumber(mark.weight)} kg</p><p className="mt-1 text-xs text-muted-foreground">{mark.reps} reps</p></div></li>)}</ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}