import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/** Se muestra mientras cargan las rutas. Los Skeleton son decorativos: el aviso accesible lo da `SkeletonGroup`. */
export default function Loading() {
  return (
    <SkeletonGroup label="Cargando..." className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
    </SkeletonGroup>
  );
}
