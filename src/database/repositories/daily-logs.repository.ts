import { getDatabase, NOW_SQL, type SqlExecutor } from "@/database/client";
import { dailyLogInputSchema, type DailyLog, type DailyLogInput } from "@/types/entities";

export interface DailyLogEntry extends DailyLog {
  project_name: string | null;
}

const SELECT_ENTRY = `
  SELECT l.*, p.name AS project_name
  FROM daily_logs l
  LEFT JOIN projects p ON p.id = l.project_id`;

export function createDailyLogsRepository(getDb: () => Promise<SqlExecutor>) {
  async function getById(id: number): Promise<DailyLogEntry | null> {
    const db = await getDb();
    const rows = await db.select<DailyLogEntry[]>(`${SELECT_ENTRY} WHERE l.id = $1`, [id]);
    return rows[0] ?? null;
  }

  return {
    getById,

    /** Registros más recientes primero (por día y luego por hora de creación). */
    async list(limit = 500): Promise<DailyLogEntry[]> {
      const db = await getDb();
      return db.select<DailyLogEntry[]>(
        `${SELECT_ENTRY} ORDER BY l.log_date DESC, l.created_at DESC, l.id DESC LIMIT $1`,
        [limit],
      );
    },

    async hasLogOn(date: string): Promise<boolean> {
      const db = await getDb();
      const rows = await db.select<unknown[]>("SELECT 1 FROM daily_logs WHERE log_date = $1 LIMIT 1", [date]);
      return rows.length > 0;
    },

    async create(input: DailyLogInput): Promise<DailyLogEntry> {
      const data = dailyLogInputSchema.parse(input);
      const db = await getDb();
      const result = await db.execute(
        `INSERT INTO daily_logs (project_id, log_date, yesterday, today, blockers_note, learnings)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [data.project_id, data.log_date, data.yesterday, data.today, data.blockers_note, data.learnings],
      );
      const created = result.lastInsertId != null ? await getById(result.lastInsertId) : null;
      if (!created) throw new Error("No se pudo recuperar el registro recién creado.");
      return created;
    },

    async update(id: number, input: DailyLogInput): Promise<DailyLogEntry> {
      const data = dailyLogInputSchema.parse(input);
      const db = await getDb();
      const result = await db.execute(
        `UPDATE daily_logs
         SET project_id = $1, log_date = $2, yesterday = $3, today = $4,
             blockers_note = $5, learnings = $6, updated_at = ${NOW_SQL}
         WHERE id = $7`,
        [data.project_id, data.log_date, data.yesterday, data.today, data.blockers_note, data.learnings, id],
      );
      const updated = result.rowsAffected > 0 ? await getById(id) : null;
      if (!updated) throw new Error("El registro ya no existe.");
      return updated;
    },

    async remove(id: number): Promise<void> {
      const db = await getDb();
      await db.execute("DELETE FROM daily_logs WHERE id = $1", [id]);
    },
  };
}

export type DailyLogsRepository = ReturnType<typeof createDailyLogsRepository>;

export const dailyLogsRepository = createDailyLogsRepository(getDatabase);
