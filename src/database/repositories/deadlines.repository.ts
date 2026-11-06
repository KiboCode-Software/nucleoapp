import { getDatabase, NOW_SQL, type SqlExecutor } from "@/database/client";
import { z } from "zod";

export const DEADLINE_KINDS = ["assignment", "exam", "presentation", "other"] as const;
export type DeadlineKind = (typeof DEADLINE_KINDS)[number];

/** Fecha y hora local "YYYY-MM-DDTHH:MM", como la da un <input type="datetime-local">. */
const localDateTime = z.string().regex(/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d$/, "Indica fecha y hora");
const score = (max: number) => z.number().min(0).max(max).nullable().default(null);

export const deadlineInputSchema = z.object({
  title: z.string().trim().min(1, "La entrega necesita un título.").max(140),
  kind: z.enum(DEADLINE_KINDS).default("assignment"),
  due_at: localDateTime,
  project_id: z.number().int().positive().nullable().default(null),
  notes: z.string().trim().max(5000).default(""),
  /** Porcentaje de la nota final (0–100). */
  weight: score(100),
  grade: score(1000),
});

export type DeadlineInput = z.input<typeof deadlineInputSchema>;

export interface Deadline {
  id: number;
  project_id: number | null;
  project_name: string | null;
  project_color: string | null;
  title: string;
  kind: DeadlineKind;
  due_at: string;
  notes: string;
  weight: number | null;
  grade: number | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT = `
  SELECT d.*, p.name AS project_name, p.color AS project_color
  FROM deadlines d LEFT JOIN projects p ON p.id = d.project_id`;

export function createDeadlinesRepository(getDb: () => Promise<SqlExecutor>) {
  async function get(db: SqlExecutor, id: number): Promise<Deadline> {
    const [row] = await db.select<Deadline[]>(`${SELECT} WHERE d.id = $1`, [id]);
    if (!row) throw new Error("La entrega ya no existe.");
    return row;
  }

  return {
    /** Todas las entregas: primero las pendientes por fecha, luego las completadas. */
    async list(): Promise<Deadline[]> {
      const db = await getDb();
      return db.select<Deadline[]>(`${SELECT} ORDER BY d.done_at IS NOT NULL, d.due_at, d.id`);
    },

    async create(input: DeadlineInput): Promise<Deadline> {
      const d = deadlineInputSchema.parse(input);
      const db = await getDb();
      const { lastInsertId } = await db.execute(
        "INSERT INTO deadlines (title, kind, due_at, project_id, notes, weight, grade) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [d.title, d.kind, d.due_at, d.project_id, d.notes, d.weight, d.grade],
      );
      if (lastInsertId == null) throw new Error("No se pudo crear la entrega.");
      return get(db, lastInsertId);
    },

    async update(id: number, input: DeadlineInput): Promise<Deadline> {
      const d = deadlineInputSchema.parse(input);
      const db = await getDb();
      await db.execute(
        `UPDATE deadlines SET title = $1, kind = $2, due_at = $3, project_id = $4, notes = $5, weight = $6, grade = $7,
         updated_at = ${NOW_SQL} WHERE id = $8`,
        [d.title, d.kind, d.due_at, d.project_id, d.notes, d.weight, d.grade, id],
      );
      return get(db, id);
    },

    async setDone(id: number, done: boolean): Promise<Deadline> {
      const db = await getDb();
      await db.execute(
        `UPDATE deadlines SET done_at = ${done ? NOW_SQL : "NULL"}, updated_at = ${NOW_SQL} WHERE id = $1`,
        [id],
      );
      return get(db, id);
    },

    async remove(id: number): Promise<void> {
      const db = await getDb();
      await db.execute("DELETE FROM deadlines WHERE id = $1", [id]);
    },
  };
}

export type DeadlinesRepository = ReturnType<typeof createDeadlinesRepository>;

export const deadlinesRepository = createDeadlinesRepository(getDatabase);
