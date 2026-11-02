"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = { url: string; name: string; className?: string; children: ReactNode };

/** Botón con la miniatura; al pulsarlo muestra la foto completa en grande. Se cierra pulsando fuera de la imagen o con Escape. */
export function AvatarLightbox({ url, name, className = "", children }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const previousOverflow = document.body.style.overflow;
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Ver la foto de ${name} en grande`} className={`cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}>
        {children}
      </button>
      {open && createPortal(
        <div role="dialog" aria-modal="true" aria-label={`Foto de ${name}`} onClick={() => setOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Foto de ${name}`} referrerPolicy="no-referrer" onClick={(event) => event.stopPropagation()} className="max-h-full max-w-full rounded-lg object-contain" />
        </div>,
        document.body,
      )}
    </>
  );
}
