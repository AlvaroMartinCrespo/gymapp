import * as React from "react";

import { cn } from "@/lib/utils";

/** Estilo común de controles de formulario (Input y Select). */
export const controlClass =
  "h-12 w-full min-w-0 rounded-xl border border-input bg-card px-3 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error aria-invalid:focus-visible:ring-error/50";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" type={type} className={cn(controlClass, className)} {...props} />;
}

export { Input };
