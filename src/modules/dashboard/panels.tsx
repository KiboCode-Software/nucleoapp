import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  CircleCheck,
  FileText,
  FolderKanban,
  FolderPlus,
  Lightbulb,
  NotebookPen,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, type ComponentType } from "react";
import { Link } from "react-router";
import { PeriodStatsPanel } from "@/components/shared/PeriodStatsPanel";
import { useTr } from "@/modes/vocabulary";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { usePanelStyle } from "@/components/ui/surface";
import { useOverviewStats } from "@/hooks/useOverviewStats";
import { usePeriodStats } from "@/hooks/usePeriodStats";
import { logSummary } from "@/modules/daily-log/summary";
import { periodContaining } from "@/services/reports/period";
import { computeStreak } from "@/services/stats";
import type { Mode } from "@/database/profiles";
import { KIND_META as DEADLINE_KINDS, countdown, groupOf, upcoming } from "@/modules/deadlines/schedule";
import { isOpen, useBlockersStore } from "@/stores/blockers.store";
import { ensureDeadlinesLoaded, useDeadlinesStore } from "@/stores/deadlines.store";
import { useMode } from "@/stores/profile.store";
import { useDailyLogsStore } from "@/stores/daily-logs.store";
import { resolveItems, type CollectionLayout, type PanelId, type PanelWidth } from "@/types/dashboard";
import type { DailyLogInput } from "@/types/entities";
import { cn } from "@/utils/cn";
import { elapsedBetween, formatDayLabel, toISODate } from "@/utils/date";
import { ItemCollection, type CollectionItem } from "./components/ItemCollection";
import { taskProgress } from "@/modules/daily-log/tasks";

interface PanelProps {
  width: PanelWidth;
}

interface Option {
  value: string;
  label: string;
}

const RECENT_LIMIT = 5;
const BLOCKERS_LIMIT = 3;
const linkClass = "text-[13px] font-medium text-accent hover:underline";

const COLLECTION_LAYOUTS: Option[] = [
  { value: "list", label: "Lista" },
  { value: "tiles", label: "Cuadros" },
  { value: "buttons", label: "Botones" },
];

/** Disposición elegida para el panel (o la primera de las que admite). */
function useLayout<T extends string>(allowed: Option[]): T {
  const chosen = usePanelStyle()?.layout;
  return (allowed.some((o) => o.value === chosen) ? chosen : allowed[0].value) as T;
}

// ─── Cifras generales ──────────────────────────────────────────────────────────

const STAT_ITEMS = [
  { id: "logs", label: "Registros semanales", icon: CalendarDays, tone: "accent" },
  { id: "blockers", label: "Bloqueos abiertos", icon: CircleAlert, tone: "warning" },
  { id: "learnings", label: "Aprendizajes", icon: Lightbulb, tone: "success" },
  { id: "projects", label: "Proyectos activos", icon: FolderKanban, tone: "accent" },
] as const;

const STAT_LAYOUTS: Option[] = [
  { value: "tiles", label: "Cuadros" },
  { value: "list", label: "Lista" },
  { value: "buttons", label: "Botones" },
];

const TONE_TEXT = { accent: "text-accent", warning: "text-warning", success: "text-success" } as const;

function StatsPanel({ width }: PanelProps) {
  const tr = useTr();
  const { stats, loading } = useOverviewStats();
  const layout = useLayout<CollectionLayout>(STAT_LAYOUTS);
  const chosen = resolveItems([...STAT_ITEMS], usePanelStyle()?.items ?? null, STAT_ITEMS.map((s) => s.id));
  const values = { logs: stats.logsThisWeek, blockers: stats.openBlockers, learnings: stats.learnings, projects: stats.activeProjects };
  const show = (n: number) => (loading ? "–" : n);

  if (layout === "tiles") {
    return (
      <section aria-label="Cifras generales" className={cn("grid grid-cols-2 gap-4", width === "full" && "lg:grid-cols-4")}>
        {chosen.map((s) => (
          <StatCard key={s.id} label={tr(s.label)} value={show(values[s.id])} icon={s.icon} tone={s.tone} />
        ))}
      </section>
    );
  }

  const items: CollectionItem[] = chosen.map((s) => ({
    key: s.id,
    leading: <s.icon className={cn("size-4", TONE_TEXT[s.tone])} strokeWidth={1.75} />,
    title: tr(s.label),
    meta: <span className="text-[15px] font-semibold text-ink">{show(values[s.id])}</span>,
  }));
  return (
    <Card title="Cifras generales">
      <ItemCollection items={items} layout={layout} width={width} label="Cifras generales" />
    </Card>
  );
}

// ─── Check-in de hoy ───────────────────────────────────────────────────────────

// Los tres momentos del día del Registro diario.
const CHECK_IN_MOMENTS: Array<{ key: keyof Pick<DailyLogInput, "today" | "blockers_note" | "learnings">; label: string; when: string }> = [
  { key: "today", label: "Plan del día", when: "Por la mañana" },
  { key: "blockers_note", label: "Bloqueos", when: "Durante el día" },
  { key: "learnings", label: "Aprendizajes", when: "Al cerrar el día" },
];

function CheckInPanel({ width }: PanelProps) {
  const tr = useTr();
  const todayLog = useDailyLogsStore((s) => s.logs.find((l) => l.log_date === toISODate(new Date())));
  const layout = useLayout<CollectionLayout>(COLLECTION_LAYOUTS);
  const target = "/daily-log";
  const progress = taskProgress(todayLog?.today ?? "");

  const items: CollectionItem[] = CHECK_IN_MOMENTS.map(({ key, label, when }, i) => {
    const answered = Boolean(todayLog?.[key]?.trim());
    const detail = key === "today" && progress.total > 0 ? `${progress.done}/${progress.total} tareas` : answered ? "Anotado" : when;
    return {
      key,
      to: layout === "list" ? undefined : target,
      leading: (
        <span
          className={cn(
            "grid size-6 place-items-center rounded-full text-xs font-medium tabular-nums",
            answered ? "bg-success-soft text-success" : "bg-line/70 text-ink-muted",
          )}
        >
          {answered ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
        </span>
      ),
      title: tr(label),
      meta: detail,
    };
  });

  return (
    <Card
      title={tr("Check-in de hoy")}
      action={
        <div className="flex items-center gap-3">
          {progress.total > 0 && progress.done === progress.total && <Badge tone="success">Plan completado</Badge>}
          <Link to={target} className={cn(linkClass, "flex items-center gap-1")}>
            {todayLog ? "Abrir el día" : "Empezar"} <ArrowRight className="size-3.5" />
          </Link>
        </div>
      }
    >
      <ItemCollection items={items} layout={layout} width={width} label={tr("Preguntas del check-in")} />
    </Card>
  );
}

// ─── Bloqueos pendientes ───────────────────────────────────────────────────────

function BlockersPanel({ width }: PanelProps) {
  const tr = useTr();
  const openBlockers = useBlockersStore((s) => s.blockers).filter(isOpen);
  const layout = useLayout<CollectionLayout>(COLLECTION_LAYOUTS);
  const now = new Date();
  const limit = layout === "list" ? BLOCKERS_LIMIT : width === "full" ? 8 : 4;

  const items: CollectionItem[] = openBlockers.slice(0, limit).map((b) => ({
    key: String(b.id),
    to: `/blockers/${b.id}`,
    leading: <span className={cn("size-2 rounded-full", b.status === "escalated" ? "bg-danger" : "bg-warning")} />,
    title: b.title,
    meta: elapsedBetween(b.opened_at, null, now),
  }));

  return (
    <Card
      title={tr("Bloqueos pendientes")}
      action={
        openBlockers.length > limit && (
          <Link to="/blockers" className={linkClass}>
            Ver todos ({openBlockers.length})
          </Link>
        )
      }
    >
      {items.length === 0 ? (
        <EmptyState icon={CircleCheck} title={tr("Sin bloqueos abiertos")} description={tr("Cuando registres uno, aparecerá aquí con el tiempo que lleva abierto.")} />
      ) : (
        <ItemCollection items={items} layout={layout} width={width} label={tr("Bloqueos abiertos")} />
      )}
    </Card>
  );
}

// ─── Próximas entregas (modo estudiante) ───────────────────────────────────────

const DEADLINES_DAYS = 14;

function DeadlinesPanel({ width }: PanelProps) {
  const deadlines = useDeadlinesStore((s) => s.deadlines);
  const layout = useLayout<CollectionLayout>(COLLECTION_LAYOUTS);
  const now = new Date();
  const limit = layout === "list" ? 5 : width === "full" ? 8 : 4;
  const next = upcoming(deadlines, now, DEADLINES_DAYS);

  useEffect(ensureDeadlinesLoaded, []);

  const tones = { overdue: "text-danger", today: "text-warning", week: "text-ink-muted", later: "text-ink-muted", done: "text-ink-muted" };
  const items: CollectionItem[] = next.slice(0, limit).map((d) => {
    const { icon: Icon, tint } = DEADLINE_KINDS[d.kind];
    return {
      key: String(d.id),
      to: `/deadlines/${d.id}`,
      leading: (
        <span className="grid size-6 place-items-center rounded-[6px] text-white" style={{ backgroundColor: tint }}>
          <Icon className="size-3.5" strokeWidth={2} />
        </span>
      ),
      title: d.title,
      meta: <span className={tones[groupOf(d, now)]}>{countdown(d.due_at, now)}</span>,
      trailing: d.project_name ? <Badge>{d.project_name}</Badge> : undefined,
    };
  });

  return (
    <Card
      title="Próximas entregas"
      action={
        <Link to="/deadlines" className={linkClass}>
          {next.length > limit ? `Ver todas (${next.length})` : "Ver todas"}
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title="Nada en las próximas dos semanas"
          description="Añade trabajos, exámenes y exposiciones en Entregas para ver aquí su cuenta regresiva."
        />
      ) : (
        <ItemCollection items={items} layout={layout} width={width} label="Próximas entregas" />
      )}
    </Card>
  );
}

// ─── Esta semana ───────────────────────────────────────────────────────────────

const WEEK_LAYOUTS: Option[] = [
  { value: "all", label: "Completo" },
  { value: "metrics", label: "Métricas" },
  { value: "chart", label: "Gráfico" },
];

function WeekPanel() {
  const tr = useTr();
  const logs = useDailyLogsStore((s) => s.logs);
  const show = useLayout<"all" | "metrics" | "chart">(WEEK_LAYOUTS);
  const now = new Date();
  // Se recalcula cuando cambian los registros (p. ej. al volver tras guardar uno).
  const week = usePeriodStats(periodContaining("weekly", now), logs);
  const streak = computeStreak(logs.map((l) => l.log_date), now);

  return (
    <Card
      title="Esta semana"
      action={
        <Link to="/reports" className={linkClass}>
          {tr("Ver reporte")}
        </Link>
      }
    >
      {week ? (
        <PeriodStatsPanel
          stats={week.stats}
          show={show}
          extra={{ label: "Racha", value: `${streak} ${streak === 1 ? "día" : "días"}`, detail: tr("laborables seguidos con check-in") }}
        />
      ) : (
        <p className="text-[13px] text-ink-muted">Las estadísticas se calculan con tu base de datos local.</p>
      )}
    </Card>
  );
}

// ─── Actividad reciente ────────────────────────────────────────────────────────

function RecentPanel({ width }: PanelProps) {
  const logs = useDailyLogsStore((s) => s.logs);
  const layout = useLayout<CollectionLayout>(COLLECTION_LAYOUTS);
  const now = new Date();
  const limit = layout === "tiles" && width === "full" ? 8 : RECENT_LIMIT;

  const items: CollectionItem[] = logs.slice(0, limit).map((log) => ({
    key: String(log.id),
    to: `/daily-log/${log.id}`,
    leading: layout === "list" ? <span className="w-20 text-[13px] font-medium">{formatDayLabel(log.log_date, now)}</span> : undefined,
    title: logSummary(log) || "Sin contenido",
    meta: layout === "list" ? undefined : formatDayLabel(log.log_date, now),
    trailing: log.project_name ? <Badge>{log.project_name}</Badge> : undefined,
  }));

  return (
    <Card
      title="Actividad reciente"
      action={
        logs.length > limit && (
          <Link to="/daily-log" className={linkClass}>
            Ver historial
          </Link>
        )
      }
    >
      {items.length === 0 ? (
        <EmptyState icon={NotebookPen} title="Todavía no hay registros" description="Completa tu primer registro del día para empezar tu historial." />
      ) : (
        <ItemCollection items={items} layout={layout} width={width} label="Registros recientes" />
      )}
    </Card>
  );
}

// ─── Accesos rápidos ───────────────────────────────────────────────────────────

type ActionTone = "accent" | "warning" | "success" | "violet";

const QUICK_LINKS: Array<{ id: string; to: string; label: string; icon: LucideIcon; tone: ActionTone }> = [
  { id: "new-log", to: "/daily-log", label: "Registro de hoy", icon: NotebookPen, tone: "accent" },
  { id: "blocker", to: "/blockers/nuevo", label: "Registrar bloqueo", icon: CircleAlert, tone: "warning" },
  { id: "learning", to: "/learning/nuevo", label: "Guardar aprendizaje", icon: Lightbulb, tone: "success" },
  { id: "capture", to: "/quick-capture", label: "Captura rápida", icon: Zap, tone: "violet" },
  { id: "project", to: "/projects/nuevo", label: "Nuevo proyecto", icon: FolderPlus, tone: "accent" },
  { id: "report", to: "/reports", label: "Generar reporte", icon: FileText, tone: "success" },
];

const DEFAULT_QUICK_LINKS = ["new-log", "blocker", "learning", "capture"];

// Cuadros primero: un acceso rápido debe verse y pulsarse de un vistazo.
const QUICK_LINK_LAYOUTS: Option[] = [
  { value: "tiles", label: "Cuadros" },
  { value: "buttons", label: "Botones" },
  { value: "list", label: "Lista" },
];

const ACTION_TONES: Record<ActionTone, string> = {
  accent: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  violet: "bg-[#AF52DE]/12 text-[#AF52DE]",
};

function QuickLinksPanel({ width }: PanelProps) {
  const tr = useTr();
  const layout = useLayout<CollectionLayout>(QUICK_LINK_LAYOUTS);
  const compact = usePanelStyle()?.density === "compact";
  const links = resolveItems(QUICK_LINKS, usePanelStyle()?.items ?? null, DEFAULT_QUICK_LINKS);

  if (links.length === 0) {
    return (
      <Card title="Accesos rápidos">
        <p className="text-[13px] text-ink-muted">Elige qué accesos mostrar en los ajustes del panel.</p>
      </Card>
    );
  }

  if (layout === "tiles") {
    return (
      <Card title="Accesos rápidos">
        {/* Columnas automáticas que reparten todo el ancho entre los accesos (sin huecos al final). */}
        <ul aria-label="Accesos rápidos" data-layout="tiles" className="grid grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-3">
          {links.map(({ id, to, label, icon: Icon, tone }) => (
            <li key={id}>
              <Link
                to={to}
                className={cn(
                  "group flex h-full flex-col items-center justify-center gap-2.5 rounded-2xl border border-line bg-surface-muted text-center transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface hover:shadow-card active:translate-y-0",
                  compact ? "px-2 py-3" : "px-3 py-4",
                )}
              >
                <span className={cn("grid place-items-center rounded-xl transition-transform group-hover:scale-105", ACTION_TONES[tone], compact ? "size-9" : "size-11")}>
                  <Icon className={compact ? "size-[18px]" : "size-5"} strokeWidth={1.75} />
                </span>
                <span className="text-[13px] leading-tight font-medium">{tr(label)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  const items: CollectionItem[] = links.map(({ id, to, label, icon: Icon }) => ({
    key: id,
    to,
    leading: <Icon className="size-4 text-accent" strokeWidth={1.75} />,
    title: tr(label),
    trailing: <ArrowRight className="size-3.5 text-ink-muted" />,
  }));

  return (
    <Card title="Accesos rápidos">
      <ItemCollection items={items} layout={layout} width={width} label="Accesos rápidos" />
    </Card>
  );
}

// ─── Registro de paneles ───────────────────────────────────────────────────────

export interface PanelDefinition {
  title: string;
  Component: ComponentType<PanelProps>;
  /** Modos en los que existe; sin indicar, en todos. */
  modes?: Mode[];
  /** Disposiciones que admite; la primera es la predeterminada. */
  layouts: Option[];
  /** Elementos que se pueden mostrar, ocultar y ordenar (si el panel los tiene). */
  items?: { all: Option[]; defaults: string[] };
}

export const PANELS: Record<PanelId, PanelDefinition> = {
  stats: {
    title: "Cifras generales",
    Component: StatsPanel,
    layouts: STAT_LAYOUTS,
    items: { all: STAT_ITEMS.map((s) => ({ value: s.id, label: s.label })), defaults: STAT_ITEMS.map((s) => s.id) },
  },
  deadlines: { title: "Próximas entregas", Component: DeadlinesPanel, layouts: COLLECTION_LAYOUTS, modes: ["student"] },
  checkin: { title: "Check-in de hoy", Component: CheckInPanel, layouts: COLLECTION_LAYOUTS },
  blockers: { title: "Bloqueos pendientes", Component: BlockersPanel, layouts: COLLECTION_LAYOUTS },
  week: { title: "Esta semana", Component: WeekPanel, layouts: WEEK_LAYOUTS },
  recent: { title: "Actividad reciente", Component: RecentPanel, layouts: COLLECTION_LAYOUTS },
  "quick-links": {
    title: "Accesos rápidos",
    Component: QuickLinksPanel,
    layouts: QUICK_LINK_LAYOUTS,
    items: { all: QUICK_LINKS.map((l) => ({ value: l.id, label: l.label })), defaults: DEFAULT_QUICK_LINKS },
  },
};

/** Si el panel existe en el modo del perfil activo. */
export function usePanelAvailable(): (id: PanelId) => boolean {
  const mode = useMode();
  return (id) => PANELS[id].modes?.includes(mode) ?? true;
}
