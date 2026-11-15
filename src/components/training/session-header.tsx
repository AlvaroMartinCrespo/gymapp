"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { formatNumber } from "@/lib/format";
import { formatCardioDuration } from "@/lib/cardio.mjs";
import { useSessionNow, useSessionStart } from "./session-clock";

type SessionHeaderProps = {
  date: string;
  sets: number;
  volume: number;
  /** ISO de finalización, si el entrenamiento ya se cerró. */
  completedAt?: string | null;
  finishing: boolean;
  finishDisabled: boolean;
  onFinish: () => void;
};

/** Cabecera de la sesión del día: duración, series y volumen en vivo, y el botón Finalizar siempre a mano. */
export function SessionHeader({ date, sets, volume, completedAt, finishing, finishDisabled, onFinish }: SessionHeaderProps) {
  const start = useSessionStart(date);
  const now = useSessionNow(Boolean(start) && !completedAt);
  const end = completedAt ? Date.parse(completedAt) : now;
  const seconds = start && end > start ? Math.floor((end - start) / 60000) * 60 : null;

  return (
    <Card role="region" aria-label="Sesión de hoy" className="gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-section">Sesión de hoy</h2>
        {completedAt
          ? <Badge variant="success"><CircleCheck />Finalizado</Badge>
          : <Button type="button" size="sm" disabled={finishDisabled} onClick={onFinish}>{finishing ? <LoaderCircle className="animate-spin" /> : <CircleCheck />}{finishing ? "Finalizando..." : "Finalizar"}</Button>}
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Duración" value={seconds === null ? "—" : formatCardioDuration(seconds)} />
        <Stat label="Series" value={sets} />
        <Stat label="Volumen (kg)" value={formatNumber(volume)} />
      </dl>
    </Card>
  );
}
