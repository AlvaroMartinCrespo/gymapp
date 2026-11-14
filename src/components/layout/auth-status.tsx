"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, LogIn, LogOut, User } from "lucide-react";

type Account = { id: string; email: string | null; username: string | null };

export function AuthStatus() {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    function onPointer(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { setMenuOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
    <div className="ml-auto flex min-w-0 max-w-full flex-col items-end text-sm">
      {loading ? (
        <span role="status" className="flex min-h-11 items-center gap-2 text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Comprobando sesión...</span>
      ) : user ? (
        <div className="relative">
          <button
            ref={trigger}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Menú de ${user.username ?? user.email ?? "mi cuenta"}`}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex min-h-11 items-center gap-2 rounded-full pl-1 pr-1 outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring sm:pr-3"
          >
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold uppercase text-primary">{(user.username ?? user.email ?? "?").charAt(0)}</span>
            <span className="hidden max-w-32 truncate sm:inline">{user.username ?? user.email ?? "Mi cuenta"}</span>
          </button>
          {menuOpen && (
            <div ref={menu} role="menu" aria-label="Cuenta" className="absolute right-0 top-full z-50 mt-2 w-56 surface-2 overflow-hidden rounded-2xl p-1">
              <p className="truncate px-3 py-2 text-xs text-muted-foreground">{user.email ?? user.username}</p>
              <Link role="menuitem" href="/" onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm outline-none hover:bg-accent focus-visible:bg-accent"><User className="size-4" />Perfil</Link>
              <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); void logout(); }} disabled={busy} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent disabled:opacity-50">
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}Cerrar sesión
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link href="/acceso" className="flex min-h-11 items-center gap-2 rounded-xl px-2 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"><LogIn className="size-4" />Acceder</Link>
      )}
      {error && <p role="alert" className="mt-1 max-w-full break-words text-right text-xs text-error">{error}</p>}
    </div>
  );
}