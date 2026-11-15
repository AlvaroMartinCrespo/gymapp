"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const SlotContext = createContext<{ element: HTMLElement | null; setElement: (element: HTMLElement | null) => void }>({
  element: null,
  setElement: () => {},
});

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  return <SlotContext.Provider value={{ element, setElement }}>{children}</SlotContext.Provider>;
}

/** Hueco de la cabecera fija donde cada pantalla coloca su acción principal. */
export function HeaderActionSlot() {
  const { setElement } = useContext(SlotContext);
  return <div ref={setElement} className="flex shrink-0 items-center gap-2 empty:hidden" />;
}

/** Pinta `children` en la cabecera fija (los eventos y el estado siguen siendo de la pantalla que lo declara). */
export function HeaderAction({ children }: { children: ReactNode }) {
  const { element } = useContext(SlotContext);
  return element ? createPortal(children, element) : null;
}
