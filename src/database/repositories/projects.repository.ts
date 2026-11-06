import { getDatabase, NOW_SQL, type SqlExecutor } from "@/database/client";
import { projectInputSchema, type ProjectInput } from "@/types/entities";

export interface ProjectOption {
  id: number;
  name: string;
}

/** Proyecto con sus métricas, para tarjetas y detalle. */
export interface ProjectSummary {
  id: number;
  name: string;
  description: string;
  color: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  logs_count: number;
  open_blockers: number;
  resolved_blockers: number;
  learnings_count: number;
  /** Fecha (YYYY-MM-DD) del registro diario más reciente, o null. */
  last_log_date: string | null;
}

type ProjectRow = Omit<ProjectSummary, "archived"> & { archived: number };

const SELECT_SUMMARY = `
  SELECT p.*,
    (SELECT COUNT(*)       FROM daily_logs l WHERE l.project_id = p.id)                              AS logs_count,
    (SELECT COUNT(*)       FROM blockers b   WHERE b.project_id = p.id AND b.status <> 'resolved')   AS open_blockers,
    (SELECT COUNT(*)       FROM blockers b   WHERE b.project_id = p.id AND b.status = 'resolved')    AS resolved_blockers,
    (SELECT COUNT(*)       FROM learnings le WHERE le.project_id = p.id)                             AS learnings_count,
    (SELECT MAX(log_date)  FROM daily_logs l WHERE l.project_id = p.id)                              AS last_log_date
  FROM projects p`;

const toSummary = (row: ProjectRow): ProjectSummary => ({ ...row, archived: Boolean(row.archived) });

export class DuplicateProjectError extends Error {
  constructor() {
    super("Ya existe un proyecto con ese nombre.");
    this.name = "DuplicateProjectError";
  }
}

/** Traduce la violación de UNIQUE(name) a un error comprensible. */
function rethrow(error: unknown): never {
  if (String(error).includes("UNIQUE")) throw new DuplicateProjectError();
  throw error;
}

export function createProjectsRepository(getDb: () => Promise<SqlExecutor>) {
  async function getById(id: number): Promise<ProjectSummary> {
    const db = await getDb();
    const [row] = await db.select<ProjectRow[]>(`${SELECT_SUMMARY} WHERE p.id = $1`, [id]);
    if (!row) throw new Error("El proyecto ya no existe.");
    return toSummary(row);
  }

  return {
    getById,

    /** Proyectos no archivados, para selectores. */
    async listActive(): Promise<ProjectOption[]> {
      const db = await getDb();
      return db.select<ProjectOption[]>("SELECT id, name FROM projects WHERE archived = 0 ORDER BY name COLLATE NOCASE");
    },

    /** Todos los proyectos con métricas; los de actividad más reciente primero. */
    async list(): Promise<ProjectSummary[]> {
      const db = await getDb();
      const rows = await db.select<ProjectRow[]>(
        `${SELECT_SUMMARY} ORDER BY p.archived, COALESCE(last_log_date, substr(p.created_at, 1, 10)) DESC, p.name COLLATE NOCASE`,
      );
      return rows.map(toSummary);
    },

    async create(input: ProjectInput): Promise<ProjectSummary> {
      const data = projectInputSchema.parse(input);
      const db = await getDb();
      const result = await db
        .execute("INSERT INTO projects (name, description, color) VALUES ($1, $2, $3)", [data.name, data.description, data.color])
        .catch(rethrow);
      if (result.lastInsertId == null) throw new Error("No se pudo crear el proyecto.");
      return getById(result.lastInsertId);
    },

    async update(id: number, input: ProjectInput): Promise<ProjectSummary> {
      const data = projectInputSchema.parse(input);
      const db = await getDb();
      await db
        .execute(`UPDATE projects SET name = $1, description = $2, color = $3, updated_at = ${NOW_SQL} WHERE id = $4`, [
          data.name,
          data.description,
          data.color,
          id,
        ])
        .catch(rethrow);
      return getById(id);
    },

    async setArchived(id: number, archived: boolean): Promise<ProjectSummary> {
      const db = await getDb();
      await db.execute(`UPDATE projects SET archived = $1, updated_at = ${NOW_SQL} WHERE id = $2`, [archived ? 1 : 0, id]);
      return getById(id);
    },

    /** Elimina el proyecto; sus registros, bloqueos y aprendizajes se conservan sin proyecto. */
    async remove(id: number): Promise<void> {
      const db = await getDb();
      await db.execute("DELETE FROM projects WHERE id = $1", [id]);
    },
  };
}

export type ProjectsRepository = ReturnType<typeof createProjectsRepository>;

export const projectsRepository = createProjectsRepository(getDatabase);
