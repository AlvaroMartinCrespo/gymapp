import * as React from "react";
import { cva } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "error" | "info";

const alertVariants = cva("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm text-foreground", {
  variants: {
    variant: {
      success: "border-success/30 bg-success/10",
      warning: "border-warning/30 bg-warning/10",
      error: "border-error/30 bg-error/10",
      info: "border-info/30 bg-info/10",
    },
  },
  defaultVariants: { variant: "info" },
});

const icons = { success: CircleCheck, warning: TriangleAlert, error: CircleAlert, info: Info } as const;
const iconColors = { success: "text-success", warning: "text-warning", error: "text-error", info: "text-info" } as const;

/** Aviso en línea con icono. Errores y avisos usan role="alert"; el resto, role="status". */
function Alert({ variant = "info", className, children, ...props }: Omit<React.ComponentProps<"div">, "role"> & { variant?: Tone }) {
  const Icon = icons[variant];
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", iconColors[variant])} />
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}

export { Alert, alertVariants, icons as toneIcons, iconColors as toneIconColors };
