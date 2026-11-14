import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = Omit<React.ComponentProps<"div">, "title"> & {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Acción principal (normalmente un Button). */
  action?: React.ReactNode;
};

function EmptyState({ icon: Icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div data-slot="empty-state" className={cn("flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-8 text-center", className)} {...props}>
      {Icon && <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon aria-hidden="true" className="size-6" /></span>}
      <div className="space-y-1">
        <p className="type-card">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
