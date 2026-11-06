import { CircleAlert, GraduationCap, ListTodo, NotebookPen, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { fieldClass } from "@/components/ui/fields";
import type { DailyLogEntry } from "@/database/repositories/daily-logs.repository";
import { useProjects } from "@/hooks/useProjects";
import { cn } from "@/utils/cn";
import { formatDayLabel, fromISODate } from "@/utils/date";
import { parseTasks, taskProgress } from "../tasks";
import { useVocab } from "@/modes/vocabulary";

const monthLabel = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });

function matches(log: DailyLogEntry, query: string): boolean {
  const haystack = [log.yesterday, log.today, log.blockers_note, log.learnings, log.project_name ?? "", log.log_date]
    .join("\n")
    .toLocaleLowerCase("es");
  return haystack.includes(query.toLocaleLowerCase("es"));
}

function DayRow({ log }: { log: DailyLogEntry }) {
  const v = useVocab();
  const { done, total } = taskProgress(log.today);
  const tasks = parseTasks(log.today);
  const preview = tasks.slice(0, 3);

  return (
    <li>
      <Link
        to={`/daily-log/${log.id}`}
        className="grid gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-accent/40 sm:grid-cols-[140px_1fr_auto]"
      >
        <div>
          <p className="text-[15px] font-semibold first-letter:uppercase">{formatDayLabel(log.log_date)}</p>
          <p className="text-xs text-ink-muted">{log.log_date}</p>
          {log.project_name && (
            <span className="mt-2 inline-block">
              <Badge>{log.project_name}</Badge>
            </span>
          )}
        </div>

        <div className="min-w-0">
          {preview.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {preview.map((t, i) => (
                <li key={i} className={cn("flex items-center gap-2 truncate text-[13.5px]", t.done && "text-ink-muted line-through")}>
                  <span className={cn("size-1.5 shrink-0 rounded-full", t.done ? "bg-success" : "bg-ink-muted/50")} />
                  <span className="truncate">{t.text}</span>
                </li>
              ))}
              {tasks.length > preview.length && <li className="text-xs text-ink-muted">y {tasks.length - preview.length} más</li>}
            </ul>
          ) : (
            <p className="truncate text-[13.5px] text-ink-muted">{log.learnings || log.blockers_note || log.yesterday || "Sin plan"}</p>
          )}
        </div>

        <div className="flex items-start gap-2 sm:flex-col sm:items-end">
          {total > 0 && (
            <span className="inline-flex items-center gap-1 text-[12.5px] font-medium tabular-nums" title="Tareas hechas">
              <ListTodo className="size-3.5 text-ink-muted" /> {done}/{total}
            </span>
          )}
          {log.blockers_note.trim() && (
            <span className="inline-flex items-center gap-1 text-[12.5px] text-warning" title={v.blocker.withBadge}>
              <CircleAlert className="size-3.5" /> {v.blocker.badge}
            </span>
          )}
          {log.learnings.trim() && (
            <span className="inline-flex items-center gap-1 text-[12.5px] text-[#AF52DE]" title={v.learning.withBadge}>
              <GraduationCap className="size-3.5" /> {v.learning.badge}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

/** Historial a pantalla completa, agrupado por mes, con búsqueda y filtro por proyecto. */
export function HistoryView({ logs }: { logs: DailyLogEntry[] }) {
  const v = useVocab();
  const projects = useProjects();
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState<number | "all">("all");

  const groups = useMemo(() => {
    const visible = logs.filter(
      (l) => (projectId === "all" || l.project_id === projectId) && (!query.trim() || matches(l, query.trim())),
    );
    const byMonth = new Map<string, DailyLogEntry[]>();
    for (const log of visible) {
      const key = log.log_date.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), log]);
    }
    return [...byMonth.entries()];
  }, [logs, query, projectId]);

  if (logs.length === 0) {
    return (
      <Card>
        <EmptyState icon={NotebookPen} title="Aún no hay registros" description="Lo que anotes en «Hoy» aparecerá aquí, día por día." />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Buscar en el historial</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar en tareas, ${v.blocker.many} y ${v.learning.many}`}
            className={fieldClass + " h-10 w-full pl-9"}
          />
        </label>
        {projects.length > 0 && (
          <select
            aria-label={`Filtrar por ${v.project.one}`}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value === "all" ? "all" : Number(e.target.value))}
            className={fieldClass + " h-10 min-w-48"}
          >
            <option value="all">{v.project.all}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-ink-muted">Sin resultados.</p>
      ) : (
        groups.map(([month, monthLogs]) => (
          <section key={month} aria-label={monthLabel.format(fromISODate(`${month}-01`))} className="flex flex-col gap-3">
            <h2 className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">
              {monthLabel.format(fromISODate(`${month}-01`))} · {monthLogs.length} {monthLogs.length === 1 ? "día" : "días"}
            </h2>
            <ul aria-label="Historial de registros" className="flex flex-col gap-2.5">
              {monthLogs.map((log) => (
                <DayRow key={log.id} log={log} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
