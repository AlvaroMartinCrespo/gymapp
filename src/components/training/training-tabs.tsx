"use client";

import { useState } from "react";
import { Dumbbell, HeartPulse, type LucideIcon } from "lucide-react";

import { CardioPanel } from "@/components/training/cardio-panel";
import { TrainingPanel } from "@/components/training/training-panel";
import { useLocalDate } from "@/components/training/use-local-date";
import { setTrainingTab, useTrainingTab } from "@/components/training/use-training-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  if (active === "cardio" && !cardioOpened) setCardioOpened(true);

  return (
    <section aria-labelledby="training-heading" className="space-y-7">
      <header>
        <h1 id="training-heading" className="type-page">Entrenar</h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{date ? new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : "Cargando fecha..."}</p>
      </header>

      <Tabs value={active} onValueChange={(next) => setTrainingTab(next as TabId)}>
        <TabsList label="Tipo de entrenamiento" className="grid grid-cols-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}><Icon aria-hidden="true" />{label}</TabsTrigger>
          ))}
        </TabsList>
        {/* Fuerza se mantiene montada para no perder lo escrito; Cardio se monta al abrirla por primera vez. */}
        <TabsContent value="strength" className="mt-7"><TrainingPanel /></TabsContent>
        <TabsContent value="cardio" className="mt-7">{cardioOpened && <CardioPanel />}</TabsContent>
      </Tabs>
    </section>
  );
}
