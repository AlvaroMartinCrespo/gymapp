import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = Omit<React.ComponentProps<"div">, "title"> & {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Acción principal (normalmente un Button). */
  action?: React.ReactNode;
  /** Versión baja para vacíos dentro de una tarjeta que ya tiene título. */
  compact?: boolean;
};

function EmptyState({ icon: Icon, title, description, action, compact = false, className, ...props }: EmptyStateProps) {
  return (
    <div data-slot="empty-state" className={cn("flex flex-col items-center rounded-2xl border border-dashed border-border text-center", compact ? "gap-2 px-4 py-5" : "gap-3 px-6 py-8", className)} {...props}>
      {Icon && <span className={cn("flex items-center justify-center rounded-full bg-muted text-muted-foreground", compact ? "size-10" : "size-12")}><Icon aria-hidden="true" className={compact ? "size-5" : "size-6"} /></span>}
      <div className="space-y-1">
        <p className="type-card">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
