"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type NumberStepperProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Incremento de los botones − y +. */
  step: number;
  min?: number;
  max?: number;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
  /** Valor de la caja HTML (precisión admitida al teclear). */
  inputStep?: string;
};

const round = (value: number) => Math.round(value * 100) / 100;

/** Campo numérico con botones − / + grandes, pensado para usarse con una mano. */
export function NumberStepper({ id, label, value, onChange, step, min = 0, max = 10000, placeholder, inputMode = "decimal", inputStep = "any" }: NumberStepperProps) {
  const typed = value.trim() !== "" && Number.isFinite(Number(value));
  const fallback = Number.isFinite(Number(placeholder)) && placeholder?.trim() ? Number(placeholder) : min;

  function bump(delta: number) {
    const base = typed ? Number(value) : fallback;
    onChange(String(round(Math.min(max, Math.max(min, base + delta)))));
  }

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-1.5">
        <Button type="button" variant="outline" size="icon" className="size-12 shrink-0" aria-label={`Reducir ${label.toLowerCase()}`} onClick={() => bump(-step)}><Minus /></Button>
        <Input id={id} type="number" inputMode={inputMode} min={min} max={max} step={inputStep} required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="px-1 text-center font-mono text-lg" />
        <Button type="button" variant="outline" size="icon" className="size-12 shrink-0" aria-label={`Aumentar ${label.toLowerCase()}`} onClick={() => bump(step)}><Plus /></Button>
      </div>
    </div>
  );
}
