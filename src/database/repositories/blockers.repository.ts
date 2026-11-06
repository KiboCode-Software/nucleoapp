import { getDatabase, NOW_SQL, type SqlExecutor } from "@/database/client";
import {
  blockerAttemptSchema,
  blockerInputSchema,
  type Blocker,
  type BlockerAttempt,
  type BlockerInput,
  type BlockerStatus,
} from "@/types/entities";

export interface BlockerEntry extends Blocker {
  project_name: string | null;
  attempts_count: number;
}

const SELECT_ENTRY = `
  SELECT b.*, p.name AS project_name,
         (SELECT COUNT(*) FROM blocker_attempts a WHERE a.blocker_id = b.id) AS attempts_count
  FROM blockers b
  LEFT JOIN projects p ON p.id = b.project_id`;

export function createBlockersRepository(getDb: () => Promise<SqlExecutor>) {
  async function getById(id: number): Promise<BlockerEntry> {
    const db = await getDb();
    const [row] = await db.select<BlockerEntry[]>(`${SELECT_ENTRY} WHERE b.id = $1`, [id]);
    if (!row) throw new Error("El bloqueo ya no existe.");
    return row;
  }

  return {
    getById,

    /** Abiertos primero (los más antiguos arriba: son los más urgentes), luego resueltos recientes. */
    async list(): Promise<BlockerEntry[]> {
      const db = await getDb();
      return db.select<BlockerEntry[]>(
        `${SELECT_ENTRY}
         ORDER BY b.status = 'resolved',
                  CASE WHEN b.status = 'resolved' THEN b.resolved_at END DESC,
                  b.opened_at ASC, b.id ASC`,
      );
    },

    async create(input: BlockerInput): Promise<BlockerEntry> {
      const data = blockerInputSchema.parse(input);
      const db = await getDb();
      const result = await db.execute(
        "INSERT INTO blockers (title, description, project_id, daily_log_id) VALUES ($1, $2, $3, $4)",
        [data.title, data.description, data.project_id, data.daily_log_id],
      );
      if (result.lastInsertId == null) throw new Error("No se pudo crear el bloqueo.");
      return getById(result.lastInsertId);
    },

    async update(id: number, input: BlockerInput): Promise<BlockerEntry> {
      const data = blockerInputSchema.parse(input);
      const db = await getDb();
      await db.execute(
        `UPDATE blockers SET title = $1, description = $2, project_id = $3, updated_at = ${NOW_SQL} WHERE id = $4`,
        [data.title, data.description, data.project_id, id],
      );
      return getById(id);
    },

    /** Cambia el estado; al resolver guarda la fecha de resolución y al reabrir la borra. */
    async setStatus(id: number, status: BlockerStatus): Promise<BlockerEntry> {
      const db = await getDb();
      await db.execute(
        `UPDATE blockers
         SET status = $1,
             resolved_at = CASE WHEN $1 = 'resolved' THEN COALESCE(resolved_at, ${NOW_SQL}) END,
             updated_at = ${NOW_SQL}
         WHERE id = $2`,
        [status, id],
      );
      return getById(id);
    },

    async remove(id: number): Promise<void> {
      const db = await getDb();
      await db.execute("DELETE FROM blockers WHERE id = $1", [id]);
    },

    async listAttempts(blockerId: number): Promise<BlockerAttempt[]> {
      const db = await getDb();
      return db.select<BlockerAttempt[]>(
        "SELECT * FROM blocker_attempts WHERE blocker_id = $1 ORDER BY created_at ASC, id ASC",
        [blockerId],
      );
    },

    async addAttempt(blockerId: number, description: string): Promise<BlockerAttempt> {
      const { description: text } = blockerAttemptSchema.pick({ description: true }).parse({ description });
      const db = await getDb();
      const result = await db.execute("INSERT INTO blocker_attempts (blocker_id, description) VALUES ($1, $2)", [
        blockerId,
        text,
      ]);
      const [attempt] = await db.select<BlockerAttempt[]>("SELECT * FROM blocker_attempts WHERE id = $1", [
        result.lastInsertId,
      ]);
      return attempt;
    },

    async removeAttempt(id: number): Promise<void> {
      const db = await getDb();
      await db.execute("DELETE FROM blocker_attempts WHERE id = $1", [id]);
    },
  };
}

export type BlockersRepository = ReturnType<typeof createBlockersRepository>;

export const blockersRepository = createBlockersRepository(getDatabase);
