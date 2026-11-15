import * as React from "react";
import Link from "next/link";
import { LogIn, RefreshCw } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Mensaje del error. */
  children: React.ReactNode;
  /** Vuelve a lanzar la carga. Sin ella no se muestra el botón. */
  onRetry?: () => void;
  /** Si es true (401), el botón es "Iniciar sesión" en vez de "Reintentar": reintentar no serviría. */
  loginRequired?: boolean;
};

/** Error de carga con su salida: "Reintentar", o "Iniciar sesión" cuando falta la sesión. */
function ErrorState({ children, onRetry, loginRequired = false, className, ...props }: ErrorStateProps) {
  return (
    <div data-slot="error-state" className={cn("space-y-3", className)} {...props}>
      <Alert variant="error">{children}</Alert>
      {loginRequired ? (
        <Button asChild><Link href="/acceso"><LogIn />Iniciar sesión</Link></Button>
      ) : onRetry && (
        <Button type="button" variant="outline" onClick={onRetry}><RefreshCw />Reintentar</Button>
      )}
    </div>
  );
}

export { ErrorState };
