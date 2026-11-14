"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TooltipProps = {
  content: React.ReactNode;
  /** Un único elemento enfocable (botón, enlace...). Recibe aria-describedby. */
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  side?: "top" | "bottom";
  className?: string;
};

/** Ayuda breve al pasar el ratón o enfocar. Para información esencial usa texto visible, no un tooltip. */
function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const id = React.useId();
  return (
    <span className="group/tooltip relative inline-flex">
      {React.cloneElement(children, { "aria-describedby": id })}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-56 -translate-x-1/2 surface-2 rounded-xl px-2.5 py-1.5 text-xs text-popover-foreground opacity-0 transition-opacity motion-reduce:transition-none group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}

export { Tooltip };
