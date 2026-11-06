import { useEffect, useState } from "react";
import { isTauri } from "@/database/client";
import { reportsRepository, type PeriodData } from "@/database/repositories/reports.repository";
import type { PeriodRange } from "@/services/reports/period";
import { computePeriodStats, type PeriodStats } from "@/services/stats";

/** Datos y estadísticas de un periodo; se recalculan si cambia el rango o `refreshKey`. */
export function usePeriodStats(range: Pick<PeriodRange, "start" | "end">, refreshKey: unknown = null) {
  const [result, setResult] = useState<{ data: PeriodData; stats: PeriodStats } | null>(null);
  const { start, end } = range;

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    reportsRepository.collectPeriod({ start, end }).then((data) => {
      if (!cancelled) setResult({ data, stats: computePeriodStats({ start, end }, data) });
    }, console.error);
    return () => {
      cancelled = true;
    };
  }, [start, end, refreshKey]);

  return result;
}
