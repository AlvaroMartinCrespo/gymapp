"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pinta el botón de confirmar como acción destructiva. */
  destructive?: boolean;
};
type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<Confirm | null>(null);

/** Sustituye a window.confirm: `if (!(await confirm({ title: "..." }))) return;` */
function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const [open, setOpen] = React.useState(false);
  const resolver = React.useRef<((value: boolean) => void) | null>(null);

  const settle = React.useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  }, []);

  const confirm = React.useCallback<Confirm>((next) => {
    resolver.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => { if (!next) settle(false); }}
        title={options?.title ?? ""}
        description={options?.description}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => settle(false)}>{options?.cancelLabel ?? "Cancelar"}</Button>
            <Button type="button" variant={options?.destructive ? "destructive" : "default"} onClick={() => settle(true)}>{options?.confirmLabel ?? "Aceptar"}</Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

function useConfirm() {
  const context = React.useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm debe usarse dentro de <ConfirmProvider>.");
  return context;
}

export { ConfirmProvider, useConfirm };
