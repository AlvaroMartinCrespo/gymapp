"use client";

import { useState } from "react";
import { ArrowRight, Scale } from "lucide-react";

const KG_PER_LB = 0.45359237;
const inputClass = "h-12 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base font-mono outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring";

export function LbConverter() {
  const [pounds, setPounds] = useState("");
  const value = Number(pounds);
  const kilos = pounds.trim() !== "" && Number.isFinite(value) && value >= 0
    ? (value * KG_PER_LB).toLocaleString("es-ES", { maximumFractionDigits: 2 })
    : "—";

  return (
    <section className="border-t border-border pt-5">
      <h2 className="mb-4 flex items-center gap-2 section-heading"><Scale className="size-4 text-primary" />Conversor lb → kg</h2>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="lb-input" className="block text-sm font-medium">Libras</label>
          <input id="lb-input" type="number" inputMode="decimal" min={0} step="0.1" value={pounds} onChange={(event) => setPounds(event.target.value)} placeholder="0" className={inputClass} />
        </div>
        <ArrowRight className="mt-7 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2">
          <span className="block text-sm font-medium">Kilos</span>
          <output aria-live="polite" className="flex h-12 items-center rounded-lg border border-border px-3 font-mono text-base tabular-nums">{kilos}</output>
        </div>
      </div>
    </section>
  );
}
