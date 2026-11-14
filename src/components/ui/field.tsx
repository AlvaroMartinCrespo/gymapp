"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("block text-sm font-medium", className)} {...props} />;
}

type FieldControlProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean };

type FieldProps = {
  label: React.ReactNode;
  /** Texto atenuado junto a la etiqueta, p. ej. "opcional" o "lpm". */
  suffix?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  /** Un único control (Input, Select...). Recibe id, aria-describedby y aria-invalid. */
  children: React.ReactElement<FieldControlProps>;
};

/** Etiqueta + control + ayuda/error, con los atributos de accesibilidad enlazados. */
function Field({ label, suffix, hint, error, className, labelClassName, children }: FieldProps) {
  const generated = React.useId();
  const id = children.props.id ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div data-slot="field" className={cn("min-w-0 space-y-2", className)}>
      <Label htmlFor={id} className={labelClassName}>
        {label}
        {suffix && <span className="font-normal text-muted-foreground"> · {suffix}</span>}
      </Label>
      {React.cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : children.props["aria-invalid"] })}
      {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-xs text-error">{error}</p>}
    </div>
  );
}

export { Field, Label };
