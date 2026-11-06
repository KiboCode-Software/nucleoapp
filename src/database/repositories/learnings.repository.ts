import { getDatabase, NOW_SQL, type SqlExecutor } from "@/database/client";
import { learningInputSchema, type Learning, type LearningInput } from "@/types/entities";

export interface LearningEntry extends Learning {
  project_name: string | null;
  tags: string[];
}

export interface TagCount {
  name: string;
  count: number;
}

type LearningRow = Omit<LearningEntry, "tags">;

const SELECT_ENTRY = `
  SELECT le.*, p.name AS project_name
  FROM learnings le
  LEFT JOIN projects p ON p.id = le.project_id`;

export function createLearningsRepository(getDb: () => Promise<SqlExecutor>) {
  async function withTags(rows: LearningRow[]): Promise<LearningEntry[]> {
    if (rows.length === 0) return [];
    const db = await getDb();
    const links = await db.select<Array<{ learning_id: number; name: string }>>(
      `SELECT lt.learning_id, t.name FROM learning_tags lt JOIN tags t ON t.id = lt.tag_id
       ORDER BY t.name COLLATE NOCASE`,
    );
    const byLearning = new Map<number, string[]>();
    for (const { learning_id, name } of links) byLearning.set(learning_id, [...(byLearning.get(learning_id) ?? []), name]);
    return rows.map((row) => ({ ...row, tags: byLearning.get(row.id) ?? [] }));
  }

  async function getById(id: number): Promise<LearningEntry> {
    const db = await getDb();
    const rows = await db.select<LearningRow[]>(`${SELECT_ENTRY} WHERE le.id = $1`, [id]);
    if (rows.length === 0) throw new Error("El aprendizaje ya no existe.");
    return (await withTags(rows))[0];
  }

  /** Reemplaza las etiquetas de un aprendizaje y elimina las que quedan sin uso. */
  async function setTags(learningId: number, tags: string[]): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM learning_tags WHERE learning_id = $1", [learningId]);
    for (const tag of tags) {
      await db.execute("INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [tag]);
      await db.execute(
        "INSERT INTO learning_tags (learning_id, tag_id) SELECT $1, id FROM tags WHERE name = $2 COLLATE NOCASE",
        [learningId, tag],
      );
    }
    await db.execute("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM learning_tags)");
  }

  return {
    getById,

    /** Más recientes primero. */
    async list(): Promise<LearningEntry[]> {
      const db = await getDb();
      return withTags(await db.select<LearningRow[]>(`${SELECT_ENTRY} ORDER BY le.created_at DESC, le.id DESC`));
    },

    /** Aprendizajes creados entre dos días locales (YYYY-MM-DD, ambos incluidos), en orden cronológico. */
    async listCreatedBetween(start: string, end: string): Promise<LearningEntry[]> {
      const db = await getDb();
      return withTags(
        await db.select<LearningRow[]>(
          `${SELECT_ENTRY} WHERE date(le.created_at, 'localtime') BETWEEN $1 AND $2 ORDER BY le.created_at, le.id`,
          [start, end],
        ),
      );
    },

    /** Etiquetas en uso, de la más usada a la menos. */
    async listTags(): Promise<TagCount[]> {
      const db = await getDb();
      return db.select<TagCount[]>(
        `SELECT t.name, COUNT(*) AS count FROM tags t JOIN learning_tags lt ON lt.tag_id = t.id
         GROUP BY t.id ORDER BY count DESC, t.name COLLATE NOCASE`,
      );
    },

    async create(input: LearningInput): Promise<LearningEntry> {
      const data = learningInputSchema.parse(input);
      const db = await getDb();
      const result = await db.execute(
        "INSERT INTO learnings (kind, title, content, project_id, daily_log_id) VALUES ($1, $2, $3, $4, $5)",
        [data.kind, data.title, data.content, data.project_id, data.daily_log_id],
      );
      if (result.lastInsertId == null) throw new Error("No se pudo guardar el aprendizaje.");
      await setTags(result.lastInsertId, data.tags);
      return getById(result.lastInsertId);
    },

    async update(id: number, input: LearningInput): Promise<LearningEntry> {
      const data = learningInputSchema.parse(input);
      const db = await getDb();
      await db.execute(
        `UPDATE learnings SET kind = $1, title = $2, content = $3, project_id = $4, updated_at = ${NOW_SQL} WHERE id = $5`,
        [data.kind, data.title, data.content, data.project_id, id],
      );
      await setTags(id, data.tags);
      return getById(id);
    },

    async remove(id: number): Promise<void> {
      const db = await getDb();
      await db.execute("DELETE FROM learnings WHERE id = $1", [id]);
      await db.execute("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM learning_tags)");
    },
  };
}

export type LearningsRepository = ReturnType<typeof createLearningsRepository>;

export const learningsRepository = createLearningsRepository(getDatabase);
