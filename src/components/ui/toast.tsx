"use client";

import * as React from "react";
import { X } from "lucide-react";

import { toneIconColors, toneIcons, type Tone } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type ToastOptions = { description?: string; variant?: Tone; /** ms; 0 = no se cierra solo. */ duration?: number };
type ToastItem = { id: number; title: string; description?: string; variant: Tone };
type ToastContextValue = { toast: (title: string, options?: ToastOptions) => number; dismiss: (id: number) => void };

const ToastContext = React.createContext<ToastContextValue | null>(null);
const MAX_VISIBLE = 3;

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback((title: string, { description, variant = "info", duration = 4000 }: ToastOptions = {}) => {
    const id = ++counter.current;
    setItems((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, title, description, variant }]);
    if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  React.useEffect(() => {
    const active = timers.current;
    return () => { active.forEach((timer) => clearTimeout(timer)); active.clear(); };
  }, []);

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notificaciones"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
      >
        {items.map((item) => {
          const Icon = toneIcons[item.variant];
          return (
            <div
              key={item.id}
              role={item.variant === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 surface-2 rounded-xl p-3 text-sm animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
            >
              <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", toneIconColors[item.variant])} />
              <div className="min-w-0 flex-1 break-words">
                <p className="font-medium">{item.title}</p>
                {item.description && <p className="mt-0.5 text-muted-foreground">{item.description}</p>}
              </div>
              <button type="button" aria-label="Cerrar aviso" onClick={() => dismiss(item.id)} className="-m-1.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  return context;
}

export { ToastProvider, useToast };
