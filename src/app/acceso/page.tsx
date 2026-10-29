"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AccessPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const signup = mode === "signup";
  const inputClass = "h-12 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (fragment.has("access_token") || fragment.has("refresh_token") || fragment.has("error_description")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (fragment.has("error_description")) {
        setError("El enlace de confirmación no es válido o ha caducado. Solicita uno nuevo desde el correo de Supabase.");
      } else {
        setMessage("Correo confirmado. Ya puedes iniciar sesión.");
      }
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email: data.get("email"),
          password: data.get("password"),
          remember: data.get("remember") === "on",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "No se ha podido completar el acceso.");
        return;
      }
      if (result.user) {
        window.location.assign("/");
        return;
      }
      form.reset();
      setMode("login");
      setShowPassword(false);
      setMessage(result.message ?? "Revisa tu correo para confirmar la cuenta.");
    } catch {
      setError("No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md py-4 sm:py-10" aria-labelledby="access-title">
      <span aria-hidden="true" className="mb-5 block size-20 bg-[url('/icons/icon-192.png')] bg-cover bg-center" />
      <h1 id="access-title" className="text-3xl font-semibold">Tu cuenta GymRat</h1>
      <div role="tablist" aria-label="Acceso a la cuenta" className="mb-7 mt-7 grid grid-cols-2 border-b border-border">
        {(["login", "signup"] as const).map((value) => (
          <button
            key={value}
            id={`tab-${value}`}
            role="tab"
            type="button"
            aria-selected={mode === value}
            aria-controls="access-form"
            disabled={busy}
            onClick={() => { setMode(value); setError(""); setMessage(""); setShowPassword(false); }}
            className={`min-h-12 border-b-2 px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${mode === value ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            {value === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        ))}
      </div>
      <form key={mode} id="access-form" role="tabpanel" aria-labelledby={`tab-${mode}`} onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium">Correo electrónico</label>
          <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy} className={inputClass} />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium">Contraseña</label>
          <div className="relative">
            <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 10 : 1} maxLength={128} required disabled={busy} aria-describedby={signup ? "password-hint" : undefined} className={`${inputClass} pr-12`} />
            <button type="button" title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-lg text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          {signup && <p id="password-hint" className="text-sm text-muted-foreground">Mínimo 10 caracteres.</p>}
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input name="remember" type="checkbox" disabled={busy} className="size-4 accent-primary" />
          Mantener sesión iniciada
        </label>
        {error && <p role="alert" className="break-words text-sm text-primary">{error}</p>}
        {message && <p role="status" className="break-words text-sm text-foreground">{message}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : signup ? <UserPlus className="size-4" /> : <LogIn className="size-4" />}
          {busy ? "Conectando..." : signup ? "Crear cuenta" : "Iniciar sesión"}
        </Button>
      </form>
    </section>
  );
}