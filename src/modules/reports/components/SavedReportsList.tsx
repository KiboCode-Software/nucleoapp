import { FileText } from "lucide-react";
import { NavLink } from "react-router";
import type { SavedReport } from "@/database/repositories/reports.repository";
import { formatPeriod } from "@/services/reports/period";
import { cn } from "@/utils/cn";

export function SavedReportsList({ reports, selectedId }: { reports: SavedReport[]; selectedId: number | null }) {
  return (
    <section aria-labelledby="saved-reports-title" className="flex min-h-0 flex-col gap-2">
      <h2 id="saved-reports-title" className="px-1 text-[11px] font-medium tracking-wide text-ink-muted uppercase">
        Guardados
      </h2>
      {reports.length === 0 ? (
        <p className="px-1 text-[13px] text-ink-muted">Los reportes que guardes aparecerán aquí.</p>
      ) : (
        <ul aria-label="Reportes guardados" className="-mx-1 flex flex-col gap-0.5 overflow-y-auto px-1">
          {reports.map((report) => (
            <li key={report.id}>
              <NavLink
                to={`/reports/${report.id}`}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors",
                  report.id === selectedId ? "bg-accent-soft" : "hover:bg-fill",
                )}
              >
                <FileText className="mt-0.5 size-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className={cn("block text-[13.5px] font-medium", report.id === selectedId && "text-accent")}>
                    {report.period === "daily" ? "Diario" : "Semanal"}
                    {report.generator === "local_ai" && <span className="ml-1.5 text-[11px] font-medium text-ink-muted">· IA local</span>}
                  </span>
                  <span className="block truncate text-[12px] text-ink-muted first-letter:uppercase">
                    {formatPeriod({ period: report.period, start: report.period_start, end: report.period_end })}
                  </span>
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
