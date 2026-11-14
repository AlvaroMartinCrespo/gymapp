import * as React from "react";
import { ChevronDown } from "lucide-react";

import { controlClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SelectProps = React.ComponentProps<"select"> & { wrapperClassName?: string };

/** <select> nativo (mejor teclado y móvil) con el mismo aspecto que Input. */
function Select({ className, wrapperClassName, children, ...props }: SelectProps) {
  return (
    <span className={cn("relative block w-full", wrapperClassName)}>
      <select data-slot="select" className={cn(controlClass, "appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}

export { Select };
