import { getDatabase, NOW_SQL, type SqlExecutor } from "@/database/client";
import { z } from "zod";

export type CaptureTarget = "blocker" | "learning" | "daily_log" | "discarded";

export interface Capture {
  id: number;
  content: string;
  created_at: string;
  processed_at: string | null;
  processed_as: CaptureTarget | null;
}

const contentSchema = z.string().trim().min(1, "Escribe algo para guardar").max(5000);

export function createCapturesRepository(getDb: () => Promise<SqlExecutor>) {
  return {
    /** Capturas pendientes de clasificar, las más recientes primero. */
    async listPending(): Promise<Capture[]> {
      const db = await getDb();
      return db.select<Capture[]>("SELECT * FROM captures WHERE processed_at IS NULL ORDER BY created_at DESC, id DESC");
    },

    async create(content: string): Promise<Capture> {
      const text = contentSchema.parse(content);
      const db = await getDb();
      const { lastInsertId } = await db.execute("INSERT INTO captures (content) VALUES ($1)", [text]);
      const [capture] = await db.select<Capture[]>("SELECT * FROM captures WHERE id = $1", [lastInsertId]);
      return capture;
    },

    /** Marca la captura como clasificada (convertida en otra cosa o descartada). */
    async markProcessed(id: number, target: CaptureTarget): Promise<void> {
      const db = await getDb();
      await db.execute(`UPDATE captures SET processed_at = ${NOW_SQL}, processed_as = $1 WHERE id = $2`, [target, id]);
    },
  };
}

export type CapturesRepository = ReturnType<typeof createCapturesRepository>;

export const capturesRepository = createCapturesRepository(getDatabase);
