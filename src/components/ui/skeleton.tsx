import * as React from "react";

import { cn } from "@/lib/utils";

/** Marcador de carga. Es decorativo: el contenedor debe llevar aria-busy y un texto accesible (ver `SkeletonGroup`). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn("animate-pulse rounded-xl bg-muted motion-reduce:animate-none", className)} {...props} />;
}

type SkeletonGroupProps = Omit<React.ComponentProps<"div">, "role"> & {
  /** Texto que anuncian los lectores de pantalla mientras carga ("Cargando series..."). */
  label: string;
};

/** Zona de carga accesible: marca el contenido como ocupado y anuncia `label`. Los `Skeleton` van dentro. */
function SkeletonGroup({ label, className, children, ...props }: SkeletonGroupProps) {
  return (
    <div data-slot="skeleton-group" role="status" aria-busy="true" className={className} {...props}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

type SkeletonListProps = SkeletonGroupProps & {
  /** Número de filas (3 por defecto). */
  count?: number;
  /** Clases de cada fila; fija la altura para que la carga no mueva el contenido. */
  rowClassName?: string;
};

/** Lista de filas de carga con el mismo espaciado que las listas reales. */
function SkeletonList({ count = 3, rowClassName, className, ...props }: SkeletonListProps) {
  return (
    <SkeletonGroup className={cn("space-y-3", className)} {...props}>
      {Array.from({ length: count }, (_, index) => <Skeleton key={index} className={cn("h-14 w-full", rowClassName)} />)}
    </SkeletonGroup>
  );
}

export { Skeleton, SkeletonGroup, SkeletonList };
