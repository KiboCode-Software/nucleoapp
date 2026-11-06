import { fromISODate, startOfWeek, toISODate } from "@/utils/date";

export type ReportPeriod = "daily" | "weekly";

export interface PeriodRange {
  period: ReportPeriod;
  /** Primer día incluido (YYYY-MM-DD). */
  start: string;
  /** Último día incluido (YYYY-MM-DD). */
  end: string;
}

/** Rango que contiene `date`: el propio día, o de lunes a domingo. */
export function periodContaining(period: ReportPeriod, date: Date): PeriodRange {
  if (period === "daily") {
    const day = toISODate(date);
    return { period, start: day, end: day };
  }
  const monday = startOfWeek(date);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { period, start: toISODate(monday), end: toISODate(sunday) };
}

/** Periodo anterior (-1) o siguiente (+1). */
export function shiftPeriod(range: PeriodRange, delta: number): PeriodRange {
  const start = fromISODate(range.start);
  const days = range.period === "daily" ? delta : delta * 7;
  return periodContaining(range.period, new Date(start.getFullYear(), start.getMonth(), start.getDate() + days));
}

/** "sábado, 1 de noviembre de 2026" o "27 oct – 2 nov 2026". */
export function formatPeriod(range: Pick<PeriodRange, "period" | "start" | "end">, locale = "es"): string {
  const start = fromISODate(range.start);
  if (range.period === "daily") {
    return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(start);
  }
  const end = fromISODate(range.end);
  const short = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return `${short.format(start)} – ${short.format(end)} ${end.getFullYear()}`.replace(/\./g, "");
}

/** Nombre de archivo seguro: "reporte-diario-2026-11-01", "reporte-semanal-2026-10-27". */
export function reportFileName(range: Pick<PeriodRange, "period" | "start">): string {
  return `reporte-${range.period === "daily" ? "diario" : "semanal"}-${range.start}`;
}
