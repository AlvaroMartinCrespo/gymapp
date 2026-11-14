import type { Metadata } from "next";
import Link from "next/link";
import { Home, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <section aria-labelledby="not-found-heading" className="py-6">
      <h1 id="not-found-heading" className="sr-only">Página no encontrada</h1>
      <EmptyState
        icon={SearchX}
        title="No encontramos esta página"
        description="El enlace puede estar mal escrito o la página ya no existe."
        action={<Button asChild><Link href="/"><Home />Volver al inicio</Link></Button>}
      />
    </section>
  );
}
