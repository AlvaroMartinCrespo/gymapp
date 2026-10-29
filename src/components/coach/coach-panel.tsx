"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, BatteryLow, Bot, HeartPulse, LoaderCircle, LogIn, Pencil, Plus, RotateCcw, Send, Square, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";

type Message = { role: "user" | "assistant"; content: string };

const prompts = [
  { label: "Estancamiento", icon: TrendingUp, message: "No progreso en mis cargas. ¿Qué revisarías en mis últimas cuatro semanas?" },
  { label: "Molestias", icon: HeartPulse, message: "Tengo dolor al entrenar. ¿Cuándo debería detener el ejercicio y consultar a un profesional?" },
  { label: "Descarga", icon: BatteryLow, message: "¿Mis últimas cuatro semanas sugieren que convendría reducir temporalmente la carga?" },
];

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function CoachPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const unanswered = messages.at(-1)?.role === "user";

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages, sending]);

  async function send(history: Message[]) {
    if (controller.current) return;
    const active = new AbortController();
    controller.current = active;
    setSending(true);
    setError("");
    setLoginRequired(false);
    setTruncated(false);
    const recent = history.slice(-11);
    while (recent.reduce((total, message) => total + message.content.length, 0) > 40000 && recent.length > 1) recent.splice(0, 2);
    try {
      const response = await fetch("/api/ai-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: localDate(), messages: recent }),
        signal: active.signal,
      });
      const result = await response.json();
      if (active.signal.aborted) throw new Error("Cancelled");
      if (!response.ok) {
        setError(result.error ?? "No se ha podido completar la consulta.");
        setLoginRequired(response.status === 401);
        return;
      }
      if (typeof result.answer !== "string" || !result.answer.trim()) throw new Error("Empty answer");
      setMessages([...history, { role: "assistant", content: result.answer }]);
      setTruncated(result.truncated === true);
    } catch {
      setError(active.signal.aborted ? "Consulta cancelada. El intento puede contar para el límite de uso." : "No se ha podido conectar con el entrenador. Puedes reintentar la consulta.");
    } finally {
      if (controller.current === active) {
        controller.current = null;
        setSending(false);
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (controller.current || sending || unanswered || !draft.trim()) return;
    const history: Message[] = [...messages, { role: "user", content: draft.trim() }];
    setMessages(history);
    setDraft("");
    void send(history);
  }

  function reset() {
    if (sending) return;
    setMessages([]);
    setDraft("");
    setError("");
    setLoginRequired(false);
    setTruncated(false);
    input.current?.focus();
  }

  function edit() {
    if (sending || !unanswered) return;
    setDraft(messages.at(-1)?.content ?? "");
    setMessages(messages.slice(0, -1));
    setError("");
    setLoginRequired(false);
    input.current?.focus();
  }

  return (
    <section aria-labelledby="coach-heading" className="min-w-0 space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/" title="Volver al perfil" aria-label="Volver al perfil" className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring md:hidden"><ArrowLeft className="size-4" /></Link>
        <div className="min-w-0 flex-1">
          <h1 id="coach-heading" className="text-2xl font-semibold">Coach IA</h1>
          <p className="break-all font-mono text-xs text-muted-foreground">qwen/qwen3.8-27b</p>
        </div>
        <Button type="button" size="icon" variant="outline" className="rounded-lg" disabled={sending || messages.length === 0} title="Nueva conversación" aria-label="Nueva conversación" onClick={reset}><Plus className="size-4" /></Button>
      </header>

      <p className="border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground">Se envían a Groq tus mensajes, un resumen de tus últimas cuatro semanas y tus alertas pendientes, sin email ni identificador de cuenta. Evita compartir datos personales. No sustituye una valoración médica.</p>

      {messages.length === 0 && (
        <div className="grid gap-2 border-y border-border py-5 sm:grid-cols-3">
          {prompts.map(({ label, icon: Icon, message }) => (
            <Button key={label} type="button" variant="outline" disabled={sending} className="h-auto min-h-12 justify-start whitespace-normal rounded-lg px-3 py-3" onClick={() => { setDraft(message); input.current?.focus(); }}><Icon className="size-4 text-primary" />{label}</Button>
          ))}
        </div>
      )}

      <div role="log" aria-label="Conversación con el entrenador" aria-live="polite" aria-relevant="additions" aria-busy={sending} className="min-h-32 space-y-5">
        {messages.map((message, index) => (
          <article key={index} aria-label={message.role === "user" ? "Tu consulta" : "Respuesta del coach"} className={`min-w-0 border-l-2 pl-4 ${message.role === "user" ? "border-border" : "border-primary"}`}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">{message.role === "user" ? "Tú" : <><Bot className="size-4 text-primary" />Coach IA</>}</h2>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{message.content}</p>
          </article>
        ))}
        {sending && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Consultando...</p>}
        <div ref={end} />
      </div>

      {truncated && <p role="status" className="text-xs text-muted-foreground">Respuesta parcial por el límite de salida. Puedes pedir que continúe.</p>}
      {error && (
        <div className="space-y-3 border-t border-border pt-4">
          <p role="alert" className="break-words text-sm text-primary">{error}</p>
          <div className="flex flex-wrap gap-2">
            {loginRequired && <Button asChild className="rounded-lg"><Link href="/acceso"><LogIn className="size-4" />Iniciar sesión</Link></Button>}
            {unanswered && !sending && <>
              <Button type="button" variant="outline" className="rounded-lg" onClick={() => void send(messages)}><RotateCcw className="size-4" />Reintentar</Button>
              <Button type="button" size="icon" variant="outline" className="rounded-lg" title="Editar consulta" aria-label="Editar consulta" onClick={edit}><Pencil className="size-4" /></Button>
            </>}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-2 border-t border-border pt-4">
        <label htmlFor="coach-message" className="text-sm font-medium">Tu consulta</label>
        <div className="flex items-end gap-2">
          <textarea ref={input} id="coach-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={3} disabled={sending || unanswered} className="min-h-24 min-w-0 flex-1 resize-y rounded-lg border border-input bg-card p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
          {sending ? <Button type="button" size="icon" variant="outline" className="rounded-lg" title="Cancelar consulta" aria-label="Cancelar consulta" onClick={() => controller.current?.abort()}><Square className="size-4" /></Button>
            : <Button type="submit" size="icon" className="rounded-lg" title="Enviar consulta" aria-label="Enviar consulta" disabled={unanswered || !draft.trim()}><Send className="size-4" /></Button>}
        </div>
        <p className="text-right text-xs tabular-nums text-muted-foreground">{draft.length}/2000</p>
      </form>
    </section>
  );
}