import { CalendarDays, FileX, History, Monitor } from "lucide-react";
import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useModule } from "@/modules/registry";
import { ensureBlockersLoaded } from "@/stores/blockers.store";
import { ensureDailyLogsLoaded, useDailyLogsStore } from "@/stores/daily-logs.store";
import { ensureLearningsLoaded } from "@/stores/learnings.store";
import { cn } from "@/utils/cn";
import { toISODate } from "@/utils/date";
import { DayView } from "./components/DayView";
import { HistoryView } from "./components/HistoryView";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function Tabs({ view }: { view: "day" | "history" }) {
  const tab = (to: string, label: string, Icon: typeof History, active: boolean) => (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition-all",
        active ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} /> {label}
    </Link>
  );
  return (
    <nav aria-label="Vistas del registro diario" className="flex rounded-[10px] bg-line/60 p-0.5">
      {tab("/daily-log", "Día", CalendarDays, view === "day")}
      {tab("/daily-log/historial", "Historial", History, view === "history")}
    </nav>
  );
}

/**
 * Registro diario en dos vistas separadas: el día (plan, bloqueos, aprendizajes)
 * y el historial. Rutas: /daily-log (hoy), /daily-log/dia/:date,
 * /daily-log/:logId (un registro concreto) y /daily-log/historial.
 */
export function DailyLogPage({ view = "day" }: { view?: "day" | "history" }) {
  const { label, description } = useModule("daily-log");
  const { logId, date } = useParams();
  const { logs, status } = useDailyLogsStore();

  useEffect(() => {
    ensureDailyLogsLoaded();
    ensureBlockersLoaded();
    ensureLearningsLoaded();
  }, []);

  const header = <PageHeader title={label} subtitle={description} actions={status === "ready" && <Tabs view={view} />} />;

  if (status === "unavailable" || status === "error") {
    return (
      <>
        {header}
        <Card>
          {status === "unavailable" ? (
            <EmptyState
              icon={Monitor}
              title="Disponible en la app de escritorio"
              description="Los registros se guardan en SQLite local. Abre la app con npm run tauri dev."
            />
          ) : (
            <p className="text-[14px] text-danger">No se pudieron cargar los registros. Revisa la consola para más detalles.</p>
          )}
        </Card>
      </>
    );
  }

  if (status !== "ready") return header;

  let content;
  if (view === "history") {
    content = <HistoryView logs={logs} />;
  } else if (logId === "nuevo" || (date && !ISO_DATE.test(date)) || date === toISODate(new Date())) {
    // "nuevo" (enlaces antiguos) y la fecha de hoy van a la vista de hoy.
    return <Navigate to="/daily-log" replace />;
  } else if (logId) {
    const log = logs.find((l) => l.id === Number(logId));
    content = log ? (
      <DayView key={log.id} date={log.log_date} logId={log.id} />
    ) : (
      <Card>
        <EmptyState icon={FileX} title="Este registro ya no existe" />
      </Card>
    );
  } else {
    const day = date ?? toISODate(new Date());
    content = <DayView key={day} date={day} />;
  }

  return (
    <>
      {header}
      {content}
    </>
  );
}
