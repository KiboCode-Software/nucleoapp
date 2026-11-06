import type { PeriodStats } from "@/services/stats";
import { formatElapsed } from "@/utils/date";
import { ActivityChart } from "./ActivityChart";
import { useTr } from "@/modes/vocabulary";

interface Metric {
  label: string;
  value: string | number;
  detail?: string;
}

function MetricTile({ label, value, detail }: Metric) {
  return (
    <div className="min-w-0">
      <p className="text-[22px] leading-tight font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-[12.5px] text-ink-muted">{label}</p>
      {detail && <p className="text-[11.5px] text-ink-muted/80">{detail}</p>}
    </div>
  );
}

/** Métricas de un periodo y, si abarca varios días, el gráfico de actividad diaria. */
export function PeriodStatsPanel({
  stats,
  extra,
  show = "all",
}: {
  stats: PeriodStats;
  extra?: Metric;
  /** Qué mostrar: todo, solo las métricas o solo el gráfico. */
  show?: "all" | "metrics" | "chart";
}) {
  const tr = useTr();
  const multiDay = stats.days.length > 1;
  if (show === "chart" && multiDay) return <ActivityChart days={stats.days} />;
  const checkIns: Metric = { label: tr("Días con check-in"), value: `${stats.daysWithLog}/${stats.workdays}`, detail: "sobre días laborables" };
  const planned: Metric = { label: "Tareas planificadas", value: stats.plannedTasks };
  const opened: Metric = { label: tr("Bloqueos nuevos"), value: stats.blockersOpened };

  // Cuatro métricas: las dos primeras dependen del periodo; `extra` (p. ej. la racha) va delante.
  const leading = multiDay ? [checkIns, planned] : [planned, opened];
  const metrics: Metric[] = [
    ...(extra ? [extra, leading[0]] : leading),
    {
      label: tr("Bloqueos resueltos"),
      value: stats.blockersResolved,
      detail: stats.avgResolutionMs != null ? `en ${formatElapsed(stats.avgResolutionMs)} de media` : undefined,
    },
    { label: tr("Aprendizajes"), value: stats.learnings },
  ];

  const withChart = multiDay && show === "all";
  return (
    <div className={withChart ? "grid gap-6 md:grid-cols-[1fr_1.2fr]" : undefined}>
      <div className={withChart || show === "all" ? "grid grid-cols-2 gap-4 self-center" : "grid grid-cols-2 gap-4 sm:grid-cols-4"}>
        {metrics.map((m) => (
          <MetricTile key={m.label} {...m} />
        ))}
      </div>
      {withChart && <ActivityChart days={stats.days} />}
    </div>
  );
}
