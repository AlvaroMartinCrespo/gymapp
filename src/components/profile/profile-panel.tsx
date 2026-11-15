"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BarChart3, Bot, CalendarDays, Dumbbell, LoaderCircle, Pencil, RefreshCw, Save, Trash2, Trophy, UserRound } from "lucide-react";

import quotes from "@/data/athlete-quotes.json";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { useToast } from "@/components/ui/toast";
import { AvatarLightbox } from "@/components/ui/avatar-lightbox";
import { TrainingAlerts } from "@/components/profile/training-alerts";
import { postJson } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { useLocalDate } from "@/lib/use-local-date";

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

export function ProfilePanel() {
  const { toast } = useToast();
  const date = useLocalDate();
  const [reload, setReload] = useState(0);
  // null = sin editar: el campo muestra la foto actual del perfil.
  const [draft, setDraft] = useState<string | null>(null);
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const { data, loading, error, loginRequired } = useApi<Overview>({
    url: "/api/profile",
    body: date ? { action: "load", date } : null,
    queryKey: `${date}:${reload}`,
    errors: { http: "No se ha podido cargar el perfil.", network: "No se ha podido conectar con tu perfil." },
  });
  const avatarDraft = draft ?? data?.profile.avatar_url ?? "";
  const dayIndex = date ? Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000) : 0;
  const quote = quotes[dayIndex % quotes.length];
  const trendFor = (field: keyof Summary) => data?.previous ? { current: data.summary[field], previous: data.previous[field], against: "los 28 días anteriores" } : undefined;
  const maxActivity = Math.max(1, ...(data?.activity.map((day) => day.sets) ?? []));

  async function updateAvatar(value: string | null) {
    if (saving || !data) return;
    setSaving(true);
    setSaveError("");
    const result = await postJson<{ profile: Profile }>("/api/profile", { action: "avatar", avatarUrl: value });
    if (!result.ok) {
      setSaveError(result.unreachable ? "No se ha podido confirmar el cambio. Puedes volver a guardar la misma URL." : result.error ?? "No se ha podido guardar la foto.");
    } else {
      setDraft(null);
      setFailedAvatar(null);
      setEditOpen(false);
      toast(result.data.profile.avatar_url ? "Foto actualizada." : "Foto eliminada.", { variant: "success" });
      setReload((current) => current + 1);
    }
    setSaving(false);
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
          {data && <p className="text-sm text-muted-foreground">Miembro desde {formatDate(data.profile.created_at, "monthYear")}</p>}
          {data?.email && <p className="truncate text-xs text-muted-foreground">{data.email}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {data && <Button type="button" variant="outline" size="icon" title="Editar perfil" aria-label="Editar perfil" onClick={() => { setSaveError(""); setEditOpen(true); }}><Pencil /></Button>}
          <Button type="button" variant="outline" size="icon" title="Actualizar perfil" aria-label="Actualizar perfil" disabled={loading || saving} onClick={() => setReload((current) => current + 1)}><RefreshCw className={loading ? "animate-spin" : ""} /></Button>
        </div>
      </Card>

      {loading ? (
        <SkeletonGroup label="Cargando perfil..." className="space-y-6">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)}</div>
          <Skeleton className="h-52 w-full rounded-2xl" />
        </SkeletonGroup>
      ) : !data ? (
        <div className="space-y-4">
          <ErrorState loginRequired={loginRequired} onRetry={() => setReload((current) => current + 1)}>{error}</ErrorState>
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
              <Stat label="Volumen (kg)" value={formatNumber(data.summary.volume, { compact: data.summary.volume >= 100000 })} trend={trendFor("volume")} title={formatNumber(data.summary.volume)} />
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
                      <span aria-hidden="true" className={`mt-2 block text-xs ${today ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{formatDate(day.date, "weekday")}</span>
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
            {data.recent_days.length === 0 ? <EmptyState compact icon={CalendarDays} title="Aún no hay entrenamientos" description="Tus últimos días de entrenamiento aparecerán aquí." action={<Button asChild><Link href="/entrenar"><Dumbbell />Registrar mi primer entreno</Link></Button>} /> : (
              <ul className="divide-y divide-border">{data.recent_days.map((day) => <li key={day.date} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"><div><p className="text-sm">{formatDate(day.date)}</p><p className="text-xs text-muted-foreground">{day.sets} series</p></div><p className="type-data">{formatNumber(day.volume)} kg</p></li>)}</ul>
            )}
          </Card>

          <Card role="region" aria-labelledby="marks-heading">
            <h2 id="marks-heading" className="type-section flex items-center gap-2"><Trophy className="size-5 text-primary" />Mejores marcas por peso</h2>
            {data.best_marks.length === 0 ? <EmptyState compact icon={Trophy} title="Aún no hay marcas" description="Tu mejor serie de cada ejercicio aparecerá aquí cuando guardes alguna." /> : (
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
            <Input id="avatar-url" type="url" pattern="https://.*" maxLength={2048} autoComplete="url" spellCheck={false} value={avatarDraft} disabled={saving} onChange={(event) => setDraft(event.target.value)} />
          </Field>
          {saveError && <Alert variant="error">{saveError}</Alert>}
          {avatarUrl && failedAvatar === avatarUrl && <p role="status" className="text-sm text-muted-foreground">No se ha podido cargar la foto.</p>}
        </form>
      </Dialog>
    </section>
  );
}
