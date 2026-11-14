import * as React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { recapChange } from "@/lib/recap.mjs";

const numberFormat = (value: number, signed = false) =>
  value.toLocaleString("es-ES", { maximumFractionDigits: 2, signDisplay: signed ? "exceptZero" : "auto" });

type TrendProps = React.ComponentProps<"span"> & {
  current: number;
  previous: number;
  /** Texto accesible que explica con qué se compara, p. ej. "los 28 días anteriores". */
  against?: string;
};

/** Flecha y porcentaje frente al periodo anterior. Subir es verde, bajar ámbar, igual neutro. */
function Trend({ current, previous, against = "el periodo anterior", className, ...props }: TrendProps) {
  const change = recapChange(current, previous);
  const direction = change.difference > 0 ? "up" : change.difference < 0 ? "down" : "flat";
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  const text = `${numberFormat(change.difference, true)}${change.percent === null ? " · Sin base" : ` · ${numberFormat(change.percent, true)} %`}`;
  return (
    <span
      data-slot="trend"
      data-direction={direction}
      className={cn(
        "type-label flex items-start gap-1",
        direction === "up" ? "text-success" : direction === "down" ? "text-warning" : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="break-words tabular-nums">
        {text}
        <span className="sr-only"> frente a {against}</span>
      </span>
    </span>
  );
}

type StatProps = Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  size?: "md" | "lg";
  /** Valores numéricos con los que calcular la tendencia. */
  trend?: { current: number; previous: number; against?: string };
};

/** Cifra destacada (mono, cifras tabulares). Debe colocarse dentro de un <dl>. */
function Stat({ label, value, hint, size = "md", trend, className, ...props }: StatProps) {
  return (
    <div data-slot="stat" className={cn("min-w-0 space-y-1", className)} {...props}>
      <dt className="type-label">{label}</dt>
      <dd className={cn("break-words", size === "lg" ? "type-kpi-lg" : "type-kpi")}>{value}</dd>
      {trend && <dd><Trend current={trend.current} previous={trend.previous} against={trend.against} /></dd>}
      {hint && <dd className="type-label">{hint}</dd>}
    </div>
  );
}

export { Stat, Trend };
