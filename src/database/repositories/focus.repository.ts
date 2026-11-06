import { getDatabase, type SqlExecutor } from "@/database/client";

export interface FocusSession {
  id: number;
  project_id: number | null;
  project_name: string | null;
  label: string;
  started_at: string;
  minutes: number;
  completed: boolean;
}

export interface FocusSummary {
  minutes: number;
  sessions: number;
}

/** Inicio y fin (UTC ISO) de un día local "YYYY-MM-DD". */
function dayBounds(day: string): [string, string] {
  const [y, m, d] = day.split("-").map(Number);
  return [new Date(y, m - 1, d).toISOString(), new Date(y, m - 1, d + 1).toISOString()];
}

export function createFocusRepository(getDb: () => Promise<SqlExecutor>) {
  return {
    async record(session: { project_id: number | null; label: string; started_at: string; minutes: number; completed: boolean }): Promise<void> {
      if (session.minutes < 1) return;
      const db = await getDb();
      await db.execute("INSERT INTO focus_sessions (project_id, label, started_at, minutes, completed) VALUES ($1, $2, $3, $4, $5)", [
        session.project_id,
        session.label.trim().slice(0, 140),
        session.started_at,
        Math.round(session.minutes),
        session.completed ? 1 : 0,
      ]);
    },

    /** Sesiones de un día local, de la más reciente a la más antigua. */
    async listOn(day: string): Promise<FocusSession[]> {
      const db = await getDb();
      const [from, to] = dayBounds(day);
      const rows = await db.select<Array<Omit<FocusSession, "completed"> & { completed: number }>>(
        `SELECT f.id, f.project_id, p.name AS project_name, f.label, f.started_at, f.minutes, f.completed
         FROM focus_sessions f LEFT JOIN projects p ON p.id = f.project_id
         WHERE f.started_at >= $1 AND f.started_at < $2 ORDER BY f.started_at DESC`,
        [from, to],
      );
      return rows.map((r) => ({ ...r, completed: r.completed === 1 }));
    },

    /** Minutos y bloques de enfoque entre dos días locales (ambos incluidos). */
    async summary(fromDay: string, toDay: string): Promise<FocusSummary> {
      const db = await getDb();
      const [from] = dayBounds(fromDay);
      const [, to] = dayBounds(toDay);
      const [row] = await db.select<Array<{ minutes: number | null; sessions: number }>>(
        "SELECT SUM(minutes) AS minutes, COUNT(*) AS sessions FROM focus_sessions WHERE started_at >= $1 AND started_at < $2",
        [from, to],
      );
      return { minutes: row?.minutes ?? 0, sessions: row?.sessions ?? 0 };
    },
  };
}

export type FocusRepository = ReturnType<typeof createFocusRepository>;

export const focusRepository = createFocusRepository(getDatabase);
