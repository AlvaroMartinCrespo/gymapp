import * as React from "react";

import { cn } from "@/lib/utils";

const tones = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", error: "bg-error", info: "bg-info" } as const;

type ProgressProps = Omit<React.ComponentProps<"div">, "children"> & {
  value: number;
  max?: number;
  /** Nombre accesible de la barra. */
  label: string;
  tone?: keyof typeof tones;
};

function Progress({ value, max = 100, label, tone = "primary", className, ...props }: ProgressProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? Math.min(safeMax, Math.max(0, value)) : 0;
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none", tones[tone])} style={{ width: `${(safeValue / safeMax) * 100}%` }} />
    </div>
  );
}

export { Progress };
