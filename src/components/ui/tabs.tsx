"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = { value: string; onValueChange: (value: string) => void; baseId: string };
const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error("Los componentes Tabs deben usarse dentro de <Tabs>.");
  return context;
}

type TabsProps = Omit<React.ComponentProps<"div">, "onChange"> & { value: string; onValueChange: (value: string) => void };

/** Pestañas controladas con patrón WAI-ARIA y navegación con flechas, Inicio y Fin. */
function Tabs({ value, onValueChange, className, ...props }: TabsProps) {
  const baseId = React.useId();
  return (
    <TabsContext.Provider value={{ value, onValueChange, baseId }}>
      <div data-slot="tabs" className={className} {...props} />
    </TabsContext.Provider>
  );
}

function TabsList({ label, className, ...props }: Omit<React.ComponentProps<"div">, "role" | "aria-label"> & { label: string }) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    const index = tabs.findIndex((tab) => tab === document.activeElement);
    if (index < 0) return;
    const target = event.key === "ArrowRight" ? index + 1
      : event.key === "ArrowLeft" ? index - 1
      : event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : null;
    if (target === null) return;
    event.preventDefault();
    const next = tabs[(target + tabs.length) % tabs.length];
    next.focus();
    next.click();
  }

  return (
    <div
      data-slot="tabs-list"
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex gap-1 rounded-xl border border-border p-1", className)}
      {...props}
    />
  );
}

function TabsTrigger({ value, className, ...props }: Omit<React.ComponentProps<"button">, "value" | "role"> & { value: string }) {
  const context = useTabs();
  const selected = context.value === value;
  return (
    <button
      data-slot="tabs-trigger"
      type="button"
      role="tab"
      id={`${context.baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${context.baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => context.onValueChange(value)}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-card hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ value, className, ...props }: Omit<React.ComponentProps<"div">, "role"> & { value: string }) {
  const context = useTabs();
  return (
    <div
      data-slot="tabs-content"
      role="tabpanel"
      id={`${context.baseId}-panel-${value}`}
      aria-labelledby={`${context.baseId}-tab-${value}`}
      hidden={context.value !== value}
      className={className}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
