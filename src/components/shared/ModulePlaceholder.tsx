import { Circle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useModule } from "@/modules/registry";

/** Pantalla temporal para los módulos que llegan en fases posteriores del roadmap. */
export function ModulePlaceholder({ moduleId }: { moduleId: string }) {
  const { label, description, icon: Icon, phase, features } = useModule(moduleId);

  return (
    <>
      <PageHeader title={label} subtitle={description} />
      <Card>
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-[15px] font-semibold">En construcción</h2>
              <Badge tone="accent">Fase {phase}</Badge>
            </div>
            <p className="mb-4 text-[13.5px] text-ink-muted">Este módulo incluirá:</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-[13.5px]">
                  <Circle className="size-1.5 fill-ink-muted text-ink-muted" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </>
  );
}
