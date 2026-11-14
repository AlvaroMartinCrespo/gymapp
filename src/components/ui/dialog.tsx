"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Botones de acción, alineados a la derecha en escritorio. */
  footer?: React.ReactNode;
  /** Si es false, Esc y el clic en el fondo no lo cierran (p. ej. mientras se guarda). */
  dismissible?: boolean;
  className?: string;
};

/** Diálogo modal sobre <dialog>: foco atrapado, Esc y fondo gestionados por el navegador. */
function Dialog({ open, onOpenChange, title, description, children, footer, dismissible = true, className }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-slot="dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => onOpenChange(false)}
      onCancel={(event) => { if (!dismissible) event.preventDefault(); }}
      onClick={(event) => { if (dismissible && event.target === event.currentTarget) onOpenChange(false); }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md surface-2 rounded-2xl p-0 text-card-foreground backdrop:bg-black/70 backdrop:backdrop-blur-sm open:animate-in open:fade-in-0 open:zoom-in-95 motion-reduce:open:animate-none",
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="space-y-1.5">
          <h2 id={titleId} className="type-section">{title}</h2>
          {description && <p id={descriptionId} className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
        {footer && <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </dialog>
  );
}

export { Dialog };
