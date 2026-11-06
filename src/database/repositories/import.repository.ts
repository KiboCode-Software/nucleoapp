import { getDatabase, type SqlExecutor } from "@/database/client";
import { z } from "zod";

/**
 * Columnas aceptadas por tabla al importar. Los nombres de columna nunca salen
 * del archivo importado: solo se usan estos, así que el archivo no puede inyectar SQL.
 * Orden de las tablas = orden de inserción (padres antes que hijos).
 */
export const IMPORT_TABLES = {
  projects: ["id", "name", "description", "color", "archived", "created_at", "updated_at"],
  daily_logs: ["id", "project_id", "log_date", "yesterday", "today", "blockers_note", "learnings", "created_at", "updated_at"],
  blockers: ["id", "daily_log_id", "project_id", "title", "description", "status", "opened_at", "resolved_at", "created_at", "updated_at"],
  blocker_attempts: ["id", "blocker_id", "description", "created_at"],
  learnings: ["id", "daily_log_id", "project_id", "kind", "title", "content", "created_at", "updated_at"],
  tags: ["id", "name"],
  learning_tags: ["learning_id", "tag_id"],
  reports: ["id", "period", "period_start", "period_end", "content", "generator", "created_at"],
  report_daily_logs: ["report_id", "daily_log_id"],
  captures: ["id", "content", "created_at", "processed_at", "processed_as"],
  deadlines: ["id", "project_id", "title", "kind", "due_at", "notes", "weight", "grade", "done_at", "created_at", "updated_at"],
  focus_sessions: ["id", "project_id", "label", "started_at", "minutes", "completed", "created_at"],
  review_cards: ["id", "learning_id", "question", "answer", "ease", "interval_days", "repetitions", "due_on", "last_reviewed_at", "created_at", "updated_at"],
} as const;

export type ImportTable = keyof typeof IMPORT_TABLES;

const cell = z.union([z.string(), z.number(), z.null()]);
const rows = z.array(z.record(z.string(), cell)).default([]);

/** Nombre del producto en las exportaciones; también acepta el nombre histórico por compatibilidad. */
export const EXPORT_APP = "Núcleo";
const EXPORT_APPS = [EXPORT_APP, "Daily Dev Log"] as const;

/** Formato de "Exportar todos los datos". Ajustes y respaldos no se importan: son de este equipo. */
export const exportFileSchema = z.object({
  app: z.enum(EXPORT_APPS),
  format_version: z.literal(1),
  exported_at: z.string().optional(),
  tables: z.object(Object.fromEntries(Object.keys(IMPORT_TABLES).map((t) => [t, rows])) as Record<ImportTable, typeof rows>),
});

export type ExportFile = z.infer<typeof exportFileSchema>;

export class InvalidImportError extends Error {
  constructor(detail: string) {
    super(`El archivo no es una exportación válida de Núcleo (${detail}).`);
    this.name = "InvalidImportError";
  }
}

export function parseExportFile(value: unknown): ExportFile {
  const parsed = exportFileSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new InvalidImportError(`${issue.path.join(".") || "raíz"}: ${issue.message}`);
  }
  for (const [table, list] of Object.entries(parsed.data.tables) as Array<[ImportTable, ExportFile["tables"][ImportTable]]>) {
    const allowed = new Set<string>(IMPORT_TABLES[table]);
    const unknown = list.flatMap((row) => Object.keys(row)).find((column) => !allowed.has(column));
    if (unknown) throw new InvalidImportError(`columna desconocida "${unknown}" en ${table}`);
  }
  return parsed.data;
}

export function countRows(file: ExportFile): Record<ImportTable, number> {
  return Object.fromEntries(Object.entries(file.tables).map(([t, list]) => [t, list.length])) as Record<ImportTable, number>;
}

export function createImportRepository(getDb: () => Promise<SqlExecutor>) {
  return {
    /**
     * Sustituye todos los datos por los del archivo. El llamador debe crear antes
     * un respaldo: tauri-plugin-sql no garantiza una transacción entre consultas.
     */
    async replaceAll(file: ExportFile): Promise<void> {
      const db = await getDb();
      const order = Object.keys(IMPORT_TABLES) as ImportTable[];

      for (const table of [...order].reverse()) await db.execute(`DELETE FROM ${table}`);

      for (const table of order) {
        const columns = IMPORT_TABLES[table];
        for (const row of file.tables[table]) {
          const present = columns.filter((c) => c in row);
          if (present.length === 0) continue;
          const placeholders = present.map((_, i) => `$${i + 1}`).join(", ");
          await db.execute(
            `INSERT INTO ${table} (${present.join(", ")}) VALUES (${placeholders})`,
            present.map((c) => row[c]),
          );
        }
      }
    },
  };
}

export const importRepository = createImportRepository(getDatabase);
