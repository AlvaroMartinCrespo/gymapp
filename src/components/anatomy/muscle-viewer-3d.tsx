"use client";

import { useEffect, useId, useRef, useState } from "react";
import { muscleGroups } from "../../../public/anatomy/muscles.mjs";

type Heat = { mesh: string; primary_sets: number; secondary_sets: number };
type Props = {
  primary?: string[];
  secondary?: string[];
  camera?: string;
  heat?: Heat[];
  mode?: "exercise" | "heat";
  title?: string;
};

const label = (id: string) => muscleGroups[id as keyof typeof muscleGroups] ?? id;
const controlClass = "min-h-11 rounded-lg border border-border px-3 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

export function MuscleViewer3D({ primary = [], secondary = [], camera = "front", heat, mode = "exercise", title = "Anatomía del ejercicio" }: Props) {
  const headingId = useId();
  const frame = useRef<HTMLIFrameElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ready = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [available, setAvailable] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const payload = JSON.stringify({ primary, secondary, camera, heat, mode });
  const missing = status === "ready" ? [...primary, ...secondary].filter((group) => !available.includes(group)) : [];

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.source !== "gymapp-anatomy") return;
      if (event.data.type === "ready") {
        ready.current = true;
        if (timeout.current) clearTimeout(timeout.current);
        setAvailable(Array.isArray(event.data.groups) ? event.data.groups.filter((group: unknown) => typeof group === "string") : []);
        setStatus("ready");
      } else if (event.data.type === "error") {
        if (timeout.current) clearTimeout(timeout.current);
        setError("No se pudo mostrar el modelo. Comprueba tu conexión y que WebGL esté habilitado.");
        setStatus("error");
      } else if (event.data.type === "selection" && typeof event.data.group === "string" && Object.hasOwn(muscleGroups, event.data.group)) {
        setSelected(event.data.group);
      }
    }
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [attempt]);

  useEffect(() => {
    if (status !== "ready") return;
    frame.current?.contentWindow?.postMessage({ source: "gymapp-host", type: "state", state: JSON.parse(payload) }, window.location.origin);
  }, [payload, status, attempt]);

  function command(type: "view" | "rotate", value: string) {
    frame.current?.contentWindow?.postMessage({ source: "gymapp-host", type, ...(type === "view" ? { view: value } : { direction: value }) }, window.location.origin);
  }

  function loaded() {
    if (timeout.current) clearTimeout(timeout.current);
    frame.current?.contentWindow?.postMessage({ source: "gymapp-host", type: "hello" }, window.location.origin);
    if (ready.current) return;
    // The frame document loads before its GLB. Cover stalled module/model downloads too.
    timeout.current = setTimeout(() => {
      setError("La carga 3D ha tardado demasiado. Puedes reintentarlo sin perder tus datos.");
      setStatus("error");
    }, 45000);
  }

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-3 rounded-2xl border border-border bg-background p-4">
      <header className="space-y-1">
        <h2 id={headingId} className="text-base font-semibold">{title}</h2>
      </header>
      <div className="relative h-[360px] overflow-hidden rounded-xl border border-border sm:h-[440px]" aria-busy={status === "loading"}>
        {status !== "error" && <iframe
          key={attempt}
          ref={frame}
          src="/anatomy/viewer.html"
          title="Anatomía muscular 3D interactiva"
          loading="lazy"
          onLoad={loaded}
          onError={() => { setError("No se pudo abrir el visor 3D."); setStatus("error"); }}
          className="h-full w-full border-0"
        />}
        {status === "loading" && <p role="status" className="pointer-events-none absolute inset-x-0 top-4 text-center text-xs text-muted-foreground">Cargando modelo anatómico…</p>}
        {status === "error" && <div className="flex h-full flex-col items-center justify-center gap-4 p-5 text-center">
          <p role="alert" className="text-sm text-muted-foreground">{error}</p>
          <button type="button" className={controlClass} onClick={() => { ready.current = false; setStatus("loading"); setSelected(""); setAttempt((value) => value + 1); }}>Reintentar</button>
        </div>}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Controles del modelo 3D">
        <button type="button" className={controlClass} disabled={status !== "ready"} onClick={() => command("view", "front")}>Frente</button>
        <button type="button" className={controlClass} disabled={status !== "ready"} onClick={() => command("view", "back")}>Espalda</button>
        <button type="button" className={controlClass} disabled={status !== "ready"} onClick={() => command("rotate", "left")} aria-label="Girar a la izquierda">← Girar</button>
        <button type="button" className={controlClass} disabled={status !== "ready"} onClick={() => command("rotate", "right")} aria-label="Girar a la derecha">Girar →</button>
      </div>
      <p className="text-xs text-muted-foreground"><span className="text-[#ef4444]">●</span> {mode === "heat" ? "Más series principales = rojo más intenso" : "Principal"} <span className="ml-3 text-[#991b1b]">●</span> {mode === "heat" ? "Solo series secundarias" : "Secundario"}</p>
      <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">{selected ? `Músculo seleccionado: ${label(selected)}` : ""}</p>
      {mode === "exercise" && <dl className="space-y-1 text-xs leading-relaxed text-muted-foreground">
        <div><dt className="inline font-medium text-foreground">Principales: </dt><dd className="inline">{primary.map(label).join(", ") || "Ninguno seleccionado"}</dd></div>
        <div><dt className="inline font-medium text-foreground">Secundarios: </dt><dd className="inline">{secondary.map(label).join(", ") || "Ninguno"}</dd></div>
      </dl>}
      {missing.length > 0 && <p role="status" className="text-xs text-primary">Sin equivalencia en este modelo: {[...new Set(missing)].map(label).join(", ")}.</p>}
      {mode === "heat" && (heat === undefined ? <p role="status" className="text-xs text-muted-foreground">El detalle muscular no está disponible.</p>
        : <div className="space-y-2">
          {heat.length === 0 ? <p className="text-xs text-muted-foreground">Sin series musculares en este periodo.</p> : <ul className="grid gap-1 text-xs sm:grid-cols-2">{heat.map((row) => <li key={row.mesh} className="text-muted-foreground"><span className="text-foreground">{label(row.mesh)}</span>: {row.primary_sets} principales · {row.secondary_sets} secundarias</li>)}</ul>}
        </div>)}
      <a href="/models/ATTRIBUTION.md" target="_blank" rel="noreferrer" className="inline-block text-[10px] text-muted-foreground underline">Créditos y licencia</a>
    </section>
  );
}