import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function PagePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardTitle>{description}</CardTitle>
        <CardDescription>Se construye en la {phase}.</CardDescription>
      </Card>
    </div>
  );
}
