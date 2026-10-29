"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoaderCircle, LogIn, LogOut, UserRound } from "lucide-react";

type Account = { id: string; email: string | null; username: string | null };

export function AuthStatus() {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function checkSession() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      try {
        const response = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "session" }),
          signal: controller.signal,
        });
        if (response.ok) {
          const result = await response.json();
          if (!controller.signal.aborted) {
            setUser(result.user);
            setError("");
          }
        } else if (!controller.signal.aborted) {
          setError("No se ha podido comprobar la sesión.");
        }
      } catch {
        if (!controller.signal.aborted) setError("Sin conexión con el servicio de acceso.");
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void checkSession();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkSession();
    }, 60000);
    const onFocus = () => { void checkSession(); };
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!response.ok) {
        const result = await response.json();
        setUser(null);
        setError(result.error ?? "No se ha podido cerrar la sesión.");
        return;
      }
      window.location.assign("/acceso");
    } catch {
      setError("No se ha podido cerrar la sesión. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="mb-6 flex min-h-11 flex-wrap items-center justify-end gap-x-3 gap-y-1 border-b border-border pb-3 text-sm">
      {loading ? (
        <span role="status" className="flex min-h-11 items-center gap-2 text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Comprobando sesión...</span>
      ) : user ? (
        <>
          <span className="flex min-w-0 max-w-full items-center gap-2"><UserRound className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{user.username ?? user.email ?? "Mi cuenta"}</span></span>
          <button type="button" onClick={logout} disabled={busy} title="Cerrar sesión" aria-label="Cerrar sesión" className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          </button>
        </>
      ) : (
        <Link href="/acceso" className="flex min-h-11 items-center gap-2 rounded-lg px-2 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"><LogIn className="size-4" />Acceder</Link>
      )}
      {error && <p role="alert" className="w-full break-words text-right text-xs text-primary">{error}</p>}
    </header>
  );
}