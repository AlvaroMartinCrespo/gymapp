import * as React from "react";

import { cn } from "@/lib/utils";

/** Marcador de carga. Es decorativo: el contenedor debe llevar aria-busy y un texto accesible. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn("animate-pulse rounded-xl bg-muted motion-reduce:animate-none", className)} {...props} />;
}

export { Skeleton };
