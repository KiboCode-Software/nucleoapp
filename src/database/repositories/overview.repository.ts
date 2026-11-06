import { getDatabase } from "@/database/client";
import { startOfWeek, toISODate } from "@/utils/date";

export interface OverviewStats {
  logsThisWeek: number;
  openBlockers: number;
  learnings: number;
  activeProjects: number;
}

export const EMPTY_OVERVIEW_STATS: OverviewStats = {
  logsThisWeek: 0,
  openBlockers: 0,
  learnings: 0,
  activeProjects: 0,
};

type CountsRow = {
  logs_this_week: number;
  open_blockers: number;
  learnings: number;
  active_projects: number;
};

export async function getOverviewStats(now = new Date()): Promise<OverviewStats> {
  const db = await getDatabase();
  const [row] = await db.select<CountsRow[]>(
    `SELECT
       (SELECT COUNT(*) FROM daily_logs WHERE log_date >= $1)          AS logs_this_week,
       (SELECT COUNT(*) FROM blockers   WHERE status <> 'resolved')    AS open_blockers,
       (SELECT COUNT(*) FROM learnings)                                AS learnings,
       (SELECT COUNT(*) FROM projects   WHERE archived = 0)            AS active_projects`,
    [toISODate(startOfWeek(now))],
  );

  return {
    logsThisWeek: row.logs_this_week,
    openBlockers: row.open_blockers,
    learnings: row.learnings,
    activeProjects: row.active_projects,
  };
}
