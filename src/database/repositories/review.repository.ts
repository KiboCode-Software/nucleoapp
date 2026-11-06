import { getDatabase, NOW_SQL, type SqlExecutor } from "@/database/client";
import { schedule, type Rating, type ReviewState } from "@/modules/learning/review";
import { z } from "zod";

export interface ReviewCard extends ReviewState {
  id: number;
  learning_id: number;
  question: string;
  answer: string;
  due_on: string;
  last_reviewed_at: string | null;
}

/** Tarjeta pendiente de repaso, con el apunte del que sale. */
export interface DueCard extends ReviewCard {
  learning_title: string;
  project_name: string | null;
}

const cardInput = z.object({
  question: z.string().trim().min(1, "Escribe la pregunta").max(1000),
  answer: z.string().trim().min(1, "Escribe la respuesta").max(4000),
});

export function createReviewRepository(getDb: () => Promise<SqlExecutor>) {
  async function get(db: SqlExecutor, id: number): Promise<ReviewCard> {
    const [row] = await db.select<ReviewCard[]>("SELECT * FROM review_cards WHERE id = $1", [id]);
    if (!row) throw new Error("La tarjeta ya no existe.");
    return row;
  }

  return {
    async listForLearning(learningId: number): Promise<ReviewCard[]> {
      const db = await getDb();
      return db.select<ReviewCard[]>("SELECT * FROM review_cards WHERE learning_id = $1 ORDER BY id", [learningId]);
    },

    /** Una tarjeta nueva se puede repasar desde hoy. */
    async create(learningId: number, input: { question: string; answer: string }, today: string): Promise<ReviewCard> {
      const { question, answer } = cardInput.parse(input);
      const db = await getDb();
      const { lastInsertId } = await db.execute(
        "INSERT INTO review_cards (learning_id, question, answer, due_on) VALUES ($1, $2, $3, $4)",
        [learningId, question, answer, today],
      );
      if (lastInsertId == null) throw new Error("No se pudo crear la tarjeta.");
      return get(db, lastInsertId);
    },

    async update(id: number, input: { question: string; answer: string }): Promise<ReviewCard> {
      const { question, answer } = cardInput.parse(input);
      const db = await getDb();
      await db.execute(`UPDATE review_cards SET question = $1, answer = $2, updated_at = ${NOW_SQL} WHERE id = $3`, [question, answer, id]);
      return get(db, id);
    },

    async remove(id: number): Promise<void> {
      const db = await getDb();
      await db.execute("DELETE FROM review_cards WHERE id = $1", [id]);
    },

    /** Tarjetas que tocan hoy (o se quedaron atrás), las más atrasadas primero. */
    async due(today: string): Promise<DueCard[]> {
      const db = await getDb();
      return db.select<DueCard[]>(
        `SELECT c.*, l.title AS learning_title, p.name AS project_name
         FROM review_cards c JOIN learnings l ON l.id = c.learning_id LEFT JOIN projects p ON p.id = l.project_id
         WHERE c.due_on <= $1 ORDER BY c.due_on, c.id`,
        [today],
      );
    },

    async countDue(today: string): Promise<number> {
      const db = await getDb();
      const [row] = await db.select<Array<{ n: number }>>("SELECT COUNT(*) AS n FROM review_cards WHERE due_on <= $1", [today]);
      return row?.n ?? 0;
    },

    /** Aplica la respuesta del repaso y programa la siguiente fecha. */
    async review(id: number, rating: Rating, today: string): Promise<ReviewCard> {
      const db = await getDb();
      const next = schedule(await get(db, id), rating, today);
      await db.execute(
        `UPDATE review_cards SET ease = $1, interval_days = $2, repetitions = $3, due_on = $4,
         last_reviewed_at = ${NOW_SQL}, updated_at = ${NOW_SQL} WHERE id = $5`,
        [next.ease, next.interval_days, next.repetitions, next.due_on, id],
      );
      return get(db, id);
    },
  };
}

export type ReviewRepository = ReturnType<typeof createReviewRepository>;

export const reviewRepository = createReviewRepository(getDatabase);
