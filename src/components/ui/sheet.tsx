"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

/** Distancia (px) a partir de la cual soltar el asa cierra la hoja. */
const CLOSE_DRAG = 90;

/**
 * Hoja inferior (bottom sheet) sobre <dialog>: foco atrapado, Esc y fondo los gestiona el navegador.
 * Se cierra también arrastrando el asa hacia abajo. Respeta el área segura inferior.
 */
function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const drag = React.useRef<{ pointer: number; startY: number } | null>(null);
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    drag.current = { pointer: event.pointerId, startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    setOffset(Math.max(0, event.clientY - drag.current.startY));
  }
  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    if (offset > CLOSE_DRAG) onOpenChange(false);
    else setOffset(0);
  }

  return (
    <dialog
      ref={ref}
      data-slot="sheet"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => { setOffset(0); onOpenChange(false); }}
      onClick={(event) => { if (event.target === event.currentTarget) onOpenChange(false); }}
      style={offset ? { transform: `translateY(${offset}px)`, transition: "none" } : undefined}
      className={cn(
        "m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain surface-2 rounded-b-none rounded-t-2xl border-b-0 p-0 text-card-foreground backdrop:bg-black/70 backdrop:backdrop-blur-sm open:animate-in open:slide-in-from-bottom open:fade-in-0 motion-reduce:open:animate-none md:mx-auto md:mb-auto md:max-w-lg md:rounded-2xl md:border-b",
        className,
      )}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        aria-hidden="true"
        className="flex h-6 touch-none items-end justify-center pb-1 md:hidden"
      >
        <span className="h-1 w-10 rounded-full bg-muted-foreground/40" />
      </div>
      <div className="flex flex-col gap-4 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 md:pt-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 id={titleId} className="type-section">{title}</h2>
            {description && <p id={descriptionId} className="text-sm text-muted-foreground">{description}</p>}
          </div>
          <button type="button" title="Cerrar" aria-label="Cerrar" onClick={() => onOpenChange(false)} className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export { Sheet };
