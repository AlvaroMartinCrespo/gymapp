"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Home, RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section aria-labelledby="error-heading" className="py-6">
      <h1 id="error-heading" className="sr-only">Algo ha salido mal</h1>
      <EmptyState
        icon={TriangleAlert}
        title="Algo ha salido mal"
        description={error.digest ? `No hemos podido mostrar esta pantalla. Código del error: ${error.digest}.` : "No hemos podido mostrar esta pantalla. Puedes volver a intentarlo."}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={() => reset()}><RotateCcw />Reintentar</Button>
            <Button asChild variant="outline"><Link href="/"><Home />Inicio</Link></Button>
          </div>
        }
      />
    </section>
  );
}
