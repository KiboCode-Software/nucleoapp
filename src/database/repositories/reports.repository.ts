import { getDatabase, type SqlExecutor } from "@/database/client";
import type { PeriodRange } from "@/services/reports/period";
import type { Report } from "@/types/entities";
import type { BlockerEntry } from "./blockers.repository";
import type { DailyLogEntry } from "./daily-logs.repository";
import { createLearningsRepository, type LearningEntry } from "./learnings.repository";

/** Todo lo que un reporte necesita saber de un periodo. */
export interface PeriodData {
  /** Registros diarios del periodo, en orden cronológico. */
  logs: DailyLogEntry[];
  /** Bloqueos abiertos (creados) dentro del periodo. */
  blockersOpened: BlockerEntry[];
  /** Bloqueos resueltos dentro del periodo. */
  blockersResolved: BlockerEntry[];
  /** Bloqueos que seguían abiertos al final del periodo. */
  blockersPending: BlockerEntry[];
  /** Aprendizajes guardados en el módulo Aprendizajes durante el periodo, en orden cronológico. */
  learnings: LearningEntry[];
  /** Minutos y bloques del temporizador de enfoque en el periodo. */
  focus?: { minutes: number; sessions: number };
}

export type SavedReport = Report;

const BLOCKER_COLUMNS = `
  b.*, p.name AS project_name,
  (SELECT COUNT(*) FROM blocker_attempts a WHERE a.blocker_id = b.id) AS attempts_count`;

// Las marcas de tiempo están en UTC; los periodos son días locales.
const LOCAL_DAY = (column: string) => `date(${column}, 'localtime')`;

const EXPORT_TABLES = [
  "projects",
  "daily_logs",
  "blockers",
  "blocker_attempts",
  "learnings",
  "tags",
  "learning_tags",
  "reports",
  "report_daily_logs",
  "settings",
  "captures",
  "backups",
] as const;

export function createReportsRepository(getDb: () => Promise<SqlExecutor>) {
  const learningsRepo = createLearningsRepository(getDb);

  return {
    async collectPeriod({ start, end }: Pick<PeriodRange, "start" | "end">): Promise<PeriodData> {
      const db = await getDb();
      const learnings = learningsRepo.listCreatedBetween(start, end);
      const blockers = (where: string, order: string, params: string[]) =>
        db.select<BlockerEntry[]>(
          `SELECT ${BLOCKER_COLUMNS} FROM blockers b LEFT JOIN projects p ON p.id = b.project_id WHERE ${where} ORDER BY ${order}`,
          params,
        );

      const [logs, blockersOpened, blockersResolved, blockersPending, focus] = await Promise.all([
        db.select<DailyLogEntry[]>(
          `SELECT l.*, p.name AS project_name FROM daily_logs l LEFT JOIN projects p ON p.id = l.project_id
           WHERE l.log_date BETWEEN $1 AND $2 ORDER BY l.log_date, l.created_at, l.id`,
          [start, end],
        ),
        blockers(`${LOCAL_DAY("b.opened_at")} BETWEEN $1 AND $2`, "b.opened_at", [start, end]),
        blockers(`b.status = 'resolved' AND ${LOCAL_DAY("b.resolved_at")} BETWEEN $1 AND $2`, "b.resolved_at", [
          start,
          end,
        ]),
        blockers(
          `${LOCAL_DAY("b.opened_at")} <= $1 AND (b.status <> 'resolved' OR ${LOCAL_DAY("b.resolved_at")} > $1)`,
          "b.opened_at",
          [end],
        ),
        db.select<Array<{ minutes: number | null; sessions: number }>>(
          `SELECT SUM(minutes) AS minutes, COUNT(*) AS sessions FROM focus_sessions WHERE ${LOCAL_DAY("started_at")} BETWEEN $1 AND $2`,
          [start, end],
        ),
      ]);

      const focusTotals = { minutes: focus[0]?.minutes ?? 0, sessions: focus[0]?.sessions ?? 0 };
      return { logs, blockersOpened, blockersResolved, blockersPending, learnings: await learnings, focus: focusTotals };
    },

    async list(): Promise<SavedReport[]> {
      const db = await getDb();
      return db.select<SavedReport[]>("SELECT * FROM reports ORDER BY created_at DESC, id DESC");
    },

    /** Guarda un reporte y lo vincula con los registros diarios que resume. */
    async save(
      range: PeriodRange,
      content: string,
      dailyLogIds: number[],
      generator: SavedReport["generator"] = "template",
    ): Promise<SavedReport> {
      const db = await getDb();
      const result = await db.execute(
        "INSERT INTO reports (period, period_start, period_end, content, generator) VALUES ($1, $2, $3, $4, $5)",
        [range.period, range.start, range.end, content, generator],
      );
      const id = result.lastInsertId;
      if (dailyLogIds.length > 0) {
        const values = dailyLogIds.map((_, i) => `($1, $${i + 2})`).join(", ");
        await db.execute(`INSERT INTO report_daily_logs (report_id, daily_log_id) VALUES ${values}`, [id, ...dailyLogIds]);
      }
      const [report] = await db.select<SavedReport[]>("SELECT * FROM reports WHERE id = $1", [id]);
      return report;
    },

    async remove(id: number): Promise<void> {
      const db = await getDb();
      await db.execute("DELETE FROM reports WHERE id = $1", [id]);
    },

    /** Copia completa de los datos del usuario, tabla por tabla. */
    async exportAll(): Promise<Record<(typeof EXPORT_TABLES)[number], unknown[]>> {
      const db = await getDb();
      const entries = await Promise.all(
        EXPORT_TABLES.map(async (table) => [table, await db.select<unknown[]>(`SELECT * FROM ${table}`)] as const),
      );
      return Object.fromEntries(entries) as Record<(typeof EXPORT_TABLES)[number], unknown[]>;
    },
  };
}

export type ReportsRepository = ReturnType<typeof createReportsRepository>;

export const reportsRepository = createReportsRepository(getDatabase);
