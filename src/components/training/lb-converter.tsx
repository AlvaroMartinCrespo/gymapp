"use client";

import { useState } from "react";
import { ArrowRight, Scale } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const KG_PER_LB = 0.45359237;

export function LbConverter() {
  const [pounds, setPounds] = useState("");
  const value = Number(pounds);
  const kilos = pounds.trim() !== "" && Number.isFinite(value) && value >= 0
    ? (value * KG_PER_LB).toLocaleString("es-ES", { maximumFractionDigits: 2 })
    : "—";

  return (
    <Card role="region" aria-labelledby="lb-heading">
      <h2 id="lb-heading" className="type-section flex items-center gap-2"><Scale className="size-5 text-primary" />Conversor lb → kg</h2>
      <div className="flex items-center gap-3">
        <Field label="Libras" className="flex-1">
          <Input id="lb-input" type="number" inputMode="decimal" min={0} step="0.1" value={pounds} onChange={(event) => setPounds(event.target.value)} placeholder="0" className="font-mono" />
        </Field>
        <ArrowRight className="mt-7 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2">
          <span className="block text-sm font-medium">Kilos</span>
          <output aria-live="polite" className="flex h-12 items-center rounded-xl border border-border px-3 font-mono text-base tabular-nums">{kilos}</output>
        </div>
      </div>
    </Card>
  );
}
