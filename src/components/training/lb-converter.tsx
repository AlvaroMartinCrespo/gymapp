"use client";

import { useState } from "react";
import { ArrowLeftRight, ArrowRight, Scale } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const KG_PER_LB = 0.45359237;

type Unit = "lb" | "kg";

const unitName: Record<Unit, string> = { lb: "Libras", kg: "Kilos" };

/** Convierte el texto de un input y devuelve el resultado con un máximo de 2 decimales ("" si no es válido). */
function convert(text: string, from: Unit) {
  const value = Number(text.replace(",", "."));
  if (text.trim() === "" || !Number.isFinite(value) || value < 0) return "";
  const result = from === "lb" ? value * KG_PER_LB : value / KG_PER_LB;
  return String(Math.round(result * 100) / 100);
}

/**
 * Conversor lb ⇄ kg. Se puede escribir en cualquiera de los dos campos y el otro se rellena solo;
 * el botón intercambia la dirección (qué unidad va a la izquierda).
 */
export function LbConverter() {
  const [leftUnit, setLeftUnit] = useState<Unit>("lb");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const rightUnit: Unit = leftUnit === "lb" ? "kg" : "lb";

  function editLeft(text: string) {
    setLeft(text);
    setRight(convert(text, leftUnit));
  }

  function editRight(text: string) {
    setRight(text);
    setLeft(convert(text, rightUnit));
  }

  function swap() {
    setLeftUnit(rightUnit);
    setLeft(right);
    setRight(left);
  }

  return (
    <Card role="region" aria-labelledby="lb-heading" className="gap-3 p-4">
      <h2 id="lb-heading" className="type-section flex items-center gap-2">
        <Scale className="size-5 text-primary" aria-hidden="true" />
        Conversor
        <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
          {leftUnit} <ArrowRight className="size-3.5" aria-hidden="true" /> {rightUnit}
        </span>
      </h2>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor="conv-left" className="block text-sm font-medium">{unitName[leftUnit]}</label>
          <Input id="conv-left" type="number" inputMode="decimal" min={0} step="any" value={left} onChange={(event) => editLeft(event.target.value)} placeholder="0" className="font-mono" />
        </div>
        <button
          type="button"
          onClick={swap}
          aria-label={`Cambiar dirección: pasar de ${unitName[rightUnit].toLowerCase()} a ${unitName[leftUnit].toLowerCase()}`}
          title="Cambiar dirección"
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeftRight className="size-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor="conv-right" className="block text-sm font-medium">{unitName[rightUnit]}</label>
          <Input id="conv-right" type="number" inputMode="decimal" min={0} step="any" value={right} onChange={(event) => editRight(event.target.value)} placeholder="0" className="font-mono" />
        </div>
      </div>
    </Card>
  );
}
