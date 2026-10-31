"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Dumbbell, HeartPulse, type LucideIcon } from "lucide-react";

import { CardioPanel } from "@/components/training/cardio-panel";
import { TrainingPanel } from "@/components/training/training-panel";
import { useLocalDate } from "@/components/training/use-local-date";
import { setTrainingTab, useTrainingTab } from "@/components/training/use-training-tab";

const tabs: { id: "strength" | "cardio"; label: string; icon: LucideIcon }[] = [
  { id: "strength", label: "Fuerza", icon: Dumbbell },
  { id: "cardio", label: "Cardio", icon: HeartPulse },
];
type TabId = (typeof tabs)[number]["id"];

export function TrainingTabs() {
  const date = useLocalDate();
  const active: TabId = useTrainingTab();
  // Fuerza se mantiene montada para no perder lo escrito ni recargar; Cardio se monta al abrirla por primera vez.
  const [cardioOpened, setCardioOpened] = useState(false);
  const buttons = useRef<Record<TabId, HTMLButtonElement | null>>({ strength: null, cardio: null });

  if (active === "cardio" && !cardioOpened) setCardioOpened(true);

  function choose(next: TabId, focus = false) {
    setTrainingTab(next);
    if (focus) buttons.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
      : event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : null;
    if (target === null) return;
    event.preventDefault();
    choose(tabs[target].id, true);
  }

  return (
    <section aria-labelledby="training-heading" className="space-y-7">
      <header>
        <h1 id="training-heading" className="text-2xl font-semibold">Entrenar</h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{date ? new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : "Cargando fecha..."}</p>
      </header>

      <div role="tablist" aria-label="Tipo de entrenamiento" className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
        {tabs.map((tab, index) => {
          const selected = active === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              ref={(element) => { buttons.current[tab.id] = element; }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}
            >
              <Icon className="size-4" aria-hidden="true" />{tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="panel-strength" aria-labelledby="tab-strength" hidden={active !== "strength"}>
        <TrainingPanel />
      </div>
      <div role="tabpanel" id="panel-cardio" aria-labelledby="tab-cardio" hidden={active !== "cardio"}>
        {cardioOpened && <CardioPanel />}
      </div>
    </section>
  );
}
