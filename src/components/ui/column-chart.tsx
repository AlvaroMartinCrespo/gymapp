"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type ColumnDatum = {
  key: string;
  /** Etiqueta corta del eje X (p. ej. "lun", "12", "ene"). */
  label: string;
  /** Texto completo para el detalle y los lectores de pantalla (p. ej. "lun 12 nov"). */
  title: string;
  value: number;
};

type ColumnChartProps = {
  data: ColumnDatum[];
  /** Nombre accesible del gráfico. */
  label: string;
  unit: string;
  formatValue: (value: number) => string;
  className?: string;
};

/**
 * Gráfico de columnas sin dependencias. El detalle de la columna activa se muestra
 * en una línea fija (hover, foco o toque) y es navegable con flechas, Inicio y Fin.
 */
function ColumnChart({ data, label, unit, formatValue, className }: ColumnChartProps) {
  const [active, setActive] = React.useState<number | null>(null);
  const [tabStop, setTabStop] = React.useState(0);
  const buttons = React.useRef<(HTMLButtonElement | null)[]>([]);
  const maximum = Math.max(1, ...data.map((datum) => datum.value));
  const labelStep = data.length <= 12 ? 1 : Math.ceil(data.length / 6);
  const current = active !== null ? data[active] : undefined;

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === "ArrowRight" ? Math.min(data.length - 1, index + 1)
      : event.key === "ArrowLeft" ? Math.max(0, index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? data.length - 1
      : null;
    if (target === null) return;
    event.preventDefault();
    setTabStop(target);
    buttons.current[target]?.focus();
  }

  return (
    <figure className={cn("min-w-0 space-y-3", className)}>
      <figcaption aria-live="polite" className="flex min-h-5 items-baseline justify-between gap-3 text-xs">
        {current ? (
          <>
            <span className="min-w-0 truncate text-muted-foreground">{current.title}</span>
            <span className="type-data shrink-0 font-semibold">{formatValue(current.value)} <span className="text-xs font-normal text-muted-foreground">{unit}</span></span>
          </>
        ) : (
          <span className="text-muted-foreground">Toca una columna para ver el detalle · máx. {formatValue(maximum)} {unit}</span>
        )}
      </figcaption>
      <div role="group" aria-label={label} className="flex h-40 items-end gap-0.5 border-b border-border">
        {data.map((datum, index) => {
          const selected = active === index;
          return (
            <button
              key={datum.key}
              ref={(element) => { buttons.current[index] = element; }}
              type="button"
              tabIndex={index === tabStop ? 0 : -1}
              aria-label={`${datum.title}: ${formatValue(datum.value)} ${unit}`}
              onPointerEnter={() => setActive(index)}
              onFocus={() => { setActive(index); setTabStop(index); }}
              onClick={() => setActive(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className="group flex h-full min-w-0 flex-1 items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className={cn("block min-h-0.5 w-full rounded-t-sm transition-colors motion-reduce:transition-none", datum.value === 0 ? "bg-muted" : selected ? "bg-primary" : "bg-primary/55 group-hover:bg-primary")}
                style={{ height: `${(datum.value / maximum) * 100}%` }}
              />
            </button>
          );
        })}
      </div>
      <div aria-hidden="true" className="flex gap-0.5 text-[10px] text-muted-foreground">
        {data.map((datum, index) => (
          <span key={datum.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">{index % labelStep === 0 ? datum.label : ""}</span>
        ))}
      </div>
    </figure>
  );
}

export { ColumnChart };
