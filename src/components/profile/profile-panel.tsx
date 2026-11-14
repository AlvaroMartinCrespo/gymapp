"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { BarChart3, Bot, CalendarDays, Dumbbell, LoaderCircle, LogIn, Pencil, RefreshCw, Save, Trash2, Trophy, UserRound } from "lucide-react";

import quotes from "@/data/athlete-quotes.json";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Stat } from "@/components/ui/stat";
import { useToast } from "@/components/ui/toast";
import { AvatarLightbox } from "@/components/ui/avatar-lightbox";
import { TrainingAlerts } from "@/components/profile/training-alerts";

type Profile = { id: string; username: string; avatar_url: string | null; created_at: string };
type Summary = { days: number; sets: number; exercises: number; volume: number };
type Overview = {
  profile: Profile;
  email: string | null;
  summary: Summary;
  /** Los 28 días anteriores a `summary`; ausente si la base de datos aún no los calcula. */
  previous?: Summary;
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
  const { toast } = useToast();
  const date = useSyncExternalStore(subscribeDate, localDate, () => "");
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<ViewState>({ key: "", data: null, error: "", loginRequired: false });
  const [avatarDraft, setAvatarDraft] = useState("");
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const queryKey = `${date}:${reload}`;
  const loading = !date || view.key !== queryKey;
  const data = loading ? null : view.data;
  const dayIndex = date ? Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000) : 0;
  const quote = quotes[dayIndex % quotes.length];
  const trendFor = (field: keyof Summary) => data?.previous ? { current: data.summary[field], previous: data.previous[field], against: "los 28 días anteriores" } : undefined;
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
    try {
      const { response, result } = await profileRequest({ action: "avatar", avatarUrl: value });
      if (!response.ok) {
        setSaveError(result.error ?? "No se ha podido guardar la foto.");
        return;
      }
      setAvatarDraft(result.profile.avatar_url ?? "");
      setFailedAvatar(null);
      setEditOpen(false);
      toast(result.profile.avatar_url ? "Foto actualizada." : "Foto eliminada.", { variant: "success" });
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

  const avatarUrl = data?.profile.avatar_url ?? null;
  const showAvatar = Boolean(avatarUrl) && failedAvatar !== avatarUrl;

  const quoteCard = (
    <Card className="gap-2 p-4">
      <blockquote className="border-l-2 border-primary pl-3">
        <p className="text-sm font-medium leading-relaxed">{quote.text}</p>
        <footer className="mt-1.5 text-xs text-muted-foreground"><cite className="not-italic">{quote.author}</cite></footer>
      </blockquote>
    </Card>
  );

  return (
    <section aria-labelledby="profile-heading" className="space-y-6">
      <Card className="flex-row items-center gap-4">
        {data && showAvatar && avatarUrl ? (
          <AvatarLightbox url={avatarUrl} name={data.profile.username} className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card">
            <Image src={avatarUrl} width={64} height={64} alt={`Foto de ${data.profile.username}`} unoptimized referrerPolicy="no-referrer" onError={() => setFailedAvatar(avatarUrl)} className="size-16 object-cover" />
          </AvatarLightbox>
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
            <UserRound className="size-6 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 id="profile-heading" className="type-page break-words">{data ? `Hola, ${data.profile.username}` : "Perfil"}</h1>
          {data && <p className="text-sm text-muted-foreground">Miembro desde {new Date(data.profile.created_at).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</p>}
          {data?.email && <p className="truncate text-xs text-muted-foreground">{data.email}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {data && <Button type="button" variant="outline" size="icon" title="Editar perfil" aria-label="Editar perfil" onClick={() => { setSaveError(""); setEditOpen(true); }}><Pencil /></Button>}
          <Button type="button" variant="outline" size="icon" title="Actualizar perfil" aria-label="Actualizar perfil" disabled={loading || saving} onClick={() => setReload((current) => current + 1)}><RefreshCw className={loading ? "animate-spin" : ""} /></Button>
        </div>
      </Card>

      {loading ? (
        <p role="status" className="flex min-h-40 items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Cargando perfil...</p>
      ) : !data ? (
        <div className="space-y-4">
          <Alert variant="error">{view.error}</Alert>
          {view.loginRequired && <Button asChild><Link href="/acceso"><LogIn className="size-4" />Iniciar sesión</Link></Button>}
          {quoteCard}
        </div>
      ) : (
        <>
          <Card role="region" aria-labelledby="summary-heading">
            <div className="space-y-1">
              <h2 id="summary-heading" className="type-section">Últimos 28 días</h2>
              {data.previous && <p className="type-label">Frente a los 28 días anteriores</p>}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
              <Stat label="Días" value={formatNumber(data.summary.days)} trend={trendFor("days")} />
              <Stat label="Series" value={formatNumber(data.summary.sets)} trend={trendFor("sets")} />
              <Stat label="Ejercicios" value={formatNumber(data.summary.exercises)} trend={trendFor("exercises")} />
              <Stat label="Volumen (kg)" value={formatNumber(data.summary.volume, data.summary.volume >= 100000)} trend={trendFor("volume")} title={formatNumber(data.summary.volume)} />
            </dl>
          </Card>

          <nav aria-label="Accesos rápidos" className="grid grid-cols-3 gap-3">
            {[
              { href: "/coach", label: "Asistente", icon: Bot },
              { href: "/historial", label: "Historial", icon: CalendarDays },
              { href: "/recap", label: "Recap", icon: BarChart3 },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="surface-1 flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl px-2 py-3 text-xs font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                <Icon aria-hidden="true" className="size-5 text-primary" />{label}
              </Link>
            ))}
          </nav>

          <Card>
            <figure aria-labelledby="activity-heading" className="space-y-4">
              <figcaption id="activity-heading" className="type-section">Actividad de los últimos 7 días</figcaption>
              <ul className="grid grid-cols-7 gap-3">
                {data.activity.map((day) => {
                  const today = day.date === date;
                  return (
                    <li key={day.date} className="min-w-0 text-center">
                      <span className="sr-only">{formatDate(day.date)}: {day.sets} series{today ? " (hoy)" : ""}</span>
                      <span aria-hidden="true" className="block h-4 font-mono text-xs tabular-nums text-muted-foreground">{day.sets > 0 ? day.sets : ""}</span>
                      <div aria-hidden="true" className="flex h-20 items-end border-b border-border">
                        <div className={`min-h-1 w-full rounded-t-sm ${today ? "bg-primary" : day.sets > 0 ? "bg-primary/50" : "bg-muted"}`} style={{ height: `${day.sets / maxActivity * 100}%` }} />
                      </div>
                      <span aria-hidden="true" className={`mt-2 block text-xs ${today ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{new Date(`${day.date}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short" })}</span>
                    </li>
                  );
                })}
              </ul>
            </figure>
          </Card>

          <TrainingAlerts />

          {quoteCard}

          <Card role="region" aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="type-section flex items-center gap-2"><CalendarDays className="size-5 text-primary" />Últimos entrenamientos</h2>
            {data.recent_days.length === 0 ? <div className="space-y-4"><p className="text-sm text-muted-foreground">Todavía no hay entrenamientos registrados.</p><Button asChild><Link href="/entrenar"><Dumbbell className="size-4" />Entrenar</Link></Button></div> : (
              <ul className="divide-y divide-border">{data.recent_days.map((day) => <li key={day.date} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"><div><p className="text-sm">{formatDate(day.date)}</p><p className="text-xs text-muted-foreground">{day.sets} series</p></div><p className="type-data">{formatNumber(day.volume)} kg</p></li>)}</ul>
            )}
          </Card>

          <Card role="region" aria-labelledby="marks-heading">
            <h2 id="marks-heading" className="type-section flex items-center gap-2"><Trophy className="size-5 text-primary" />Mejores marcas por peso</h2>
            {data.best_marks.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay marcas registradas.</p> : (
              <ul className="divide-y divide-border">{data.best_marks.map((mark) => <li key={mark.exercise_id} className="flex items-start justify-between gap-4 py-3"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{mark.name}</p><p className="mt-1 text-xs text-muted-foreground">{mark.category} · {formatDate(mark.date)}</p></div><div className="shrink-0 text-right"><p className="type-data">{formatNumber(mark.weight)} kg</p><p className="mt-1 text-xs text-muted-foreground">{mark.reps} reps</p></div></li>)}</ul>
            )}
          </Card>
        </>
      )}

      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        dismissible={!saving}
        title="Editar perfil"
        description="Cambia tu foto de perfil con la dirección HTTPS de una imagen."
        footer={
          <>
            <Button type="button" variant="outline" disabled={saving || !data?.profile.avatar_url} onClick={() => void updateAvatar(null)}><Trash2 />Quitar foto</Button>
            <Button type="submit" form="avatar-form" disabled={saving || avatarDraft.trim() === (data?.profile.avatar_url ?? "")}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}Guardar foto
            </Button>
          </>
        }
      >
        <form id="avatar-form" onSubmit={submitAvatar} className="space-y-3">
          <Field label="URL de la foto (HTTPS)">
            <Input id="avatar-url" type="url" pattern="https://.*" maxLength={2048} autoComplete="url" spellCheck={false} value={avatarDraft} disabled={saving} onChange={(event) => setAvatarDraft(event.target.value)} />
          </Field>
          {saveError && <Alert variant="error">{saveError}</Alert>}
          {avatarUrl && failedAvatar === avatarUrl && <p role="status" className="text-sm text-muted-foreground">No se ha podido cargar la foto.</p>}
        </form>
      </Dialog>
    </section>
  );
}
