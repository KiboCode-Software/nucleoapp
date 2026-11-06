import type { PeriodData } from "@/database/repositories/reports.repository";
import { fromISODate, toISODate } from "@/utils/date";
import type { PeriodRange } from "./reports/period";
import { learningTitles, toItems } from "./reports/template";

export interface DayActivity {
  date: string;
  /** Check-ins de ese día. */
  logs: number;
  /** Elementos escritos en las cuatro respuestas (una línea = un elemento). */
  items: number;
}

export interface PeriodStats {
  days: DayActivity[];
  daysWithLog: number;
  /** Días laborables (lunes a viernes) del periodo. */
  workdays: number;
  plannedTasks: number;
  blockersOpened: number;
  blockersResolved: number;
  /** Tiempo medio de resolución de los bloqueos resueltos en el periodo, o null. */
  avgResolutionMs: number | null;
  learnings: number;
}

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = fromISODate(start); toISODate(d) <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    days.push(toISODate(d));
  }
  return days;
}

export function computePeriodStats(range: Pick<PeriodRange, "start" | "end">, data: PeriodData): PeriodStats {
  const days = eachDay(range.start, range.end).map((date): DayActivity => {
    const logs = data.logs.filter((l) => l.log_date === date);
    const items = logs.reduce(
      (sum, l) => sum + [l.yesterday, l.today, l.blockers_note, l.learnings].reduce((n, text) => n + toItems(text).length, 0),
      0,
    );
    return { date, logs: logs.length, items };
  });

  const durations = data.blockersResolved
    .filter((b) => b.resolved_at)
    .map((b) => new Date(b.resolved_at!).getTime() - new Date(b.opened_at).getTime());

  return {
    days,
    daysWithLog: days.filter((d) => d.logs > 0).length,
    workdays: days.filter((d) => !isWeekend(fromISODate(d.date))).length,
    plannedTasks: data.logs.reduce((n, l) => n + toItems(l.today).length, 0),
    blockersOpened: data.blockersOpened.length,
    blockersResolved: data.blockersResolved.length,
    avgResolutionMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    learnings: learningTitles(data).length,
  };
}

/**
 * Racha de días laborables consecutivos con check-in, contando hacia atrás desde hoy.
 * Los fines de semana no la rompen (pero suman si tienen registro). Si hoy aún no
 * hay check-in, la racha se mide hasta ayer: el día no ha terminado.
 */
export function computeStreak(logDates: Iterable<string>, today = new Date()): number {
  const dates = new Set(logDates);
  let streak = 0;
  let day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!dates.has(toISODate(day))) day.setDate(day.getDate() - 1);

  for (;;) {
    if (dates.has(toISODate(day))) streak++;
    else if (!isWeekend(day)) break;
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1);
  }
  return streak;
}
