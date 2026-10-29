"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bot, Check, LoaderCircle, LogIn, RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

type TrainingAlert = { id: string; exercise: string; alert_type: "STAGNATION" | "FATIGUE"; message: string; analysis_week: string | null };
type View = { key: number; alerts: TrainingAlert[] | null; error: string; loginRequired: boolean };

export function TrainingAlerts() {
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<View>({ key: -1, alerts: null, error: "", loginRequired: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const mutation = useRef<AbortController | null>(null);
  const loading = view.key !== reload;

  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "alerts" }), signal: controller.signal });
        const result = await response.json();
        if (!controller.signal.aborted) setView({ key: reload, alerts: response.ok ? result.alerts : null, error: response.ok ? "" : result.error ?? "No se han podido cargar los avisos.", loginRequired: response.status === 401 });
      } catch {
        if (!controller.signal.aborted) setView({ key: reload, alerts: null, error: "No se ha podido conectar con los avisos.", loginRequired: false });
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  async function markRead(alertId: string) {
    if (mutation.current) return;
    const controller = new AbortController();
    mutation.current = controller;
    setBusy(alertId);
    setError("");
    try {
      const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "readAlert", alertId }), signal: controller.signal });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok && response.status !== 404) {
        setError(result.error ?? "No se ha podido marcar el aviso como leído.");
        return;
      }
      setReload((current) => current + 1);
    } catch {
      if (!controller.signal.aborted) setError("No se ha podido confirmar el cambio. Puedes reintentarlo.");
    } finally {
      if (!controller.signal.aborted) setBusy(null);
      if (mutation.current === controller) mutation.current = null;
    }
  }

  return <section aria-labelledby="training-alerts-heading" className="min-w-0 space-y-4 border-y border-border py-5">
    <header className="flex items-center gap-3"><h2 id="training-alerts-heading" className="min-w-0 flex-1 text-base font-semibold">Avisos de entrenamiento</h2><Button type="button" variant="ghost" size="icon" className="rounded-lg" title="Actualizar avisos" aria-label="Actualizar avisos" disabled={loading || Boolean(busy)} onClick={() => { setError(""); setReload((current) => current + 1); }}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></Button></header>
    {loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Cargando avisos...</p>
      : view.alerts === null ? <div className="space-y-3"><p role="alert" className="break-words text-sm text-primary">{view.error}</p>{view.loginRequired && <Button asChild className="rounded-lg"><Link href="/acceso"><LogIn className="size-4" />Iniciar sesión</Link></Button>}</div>
      : view.alerts.length === 0 ? <p className="text-sm text-muted-foreground">Sin avisos pendientes.</p>
      : <ul className="space-y-5">{view.alerts.map((alert) => <li key={alert.id} className="min-w-0 space-y-3 border-l-2 border-primary pl-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="flex items-start gap-2 text-sm font-medium"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary" /><span className="break-words">{alert.exercise}</span></h3><p className="mt-1 text-xs text-muted-foreground">{alert.alert_type === "STAGNATION" ? "Posible estancamiento" : "Revisar recuperación"}{alert.analysis_week ? ` · Semana del ${new Date(`${alert.analysis_week}T12:00:00`).toLocaleDateString("es-ES")}` : ""}</p></div><Button type="button" variant="outline" size="icon" className="rounded-lg" title="Marcar aviso como leído" aria-label={`Marcar como leído el aviso de ${alert.exercise}`} disabled={Boolean(busy)} onClick={() => void markRead(alert.id)}>{busy === alert.id ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}</Button></div><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{alert.message}</p><Link href="/coach" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline"><Bot className="size-4" />Consultar al Coach</Link></li>)}</ul>}
    {error && <p role="alert" className="break-words text-sm text-primary">{error}</p>}
  </section>;
}