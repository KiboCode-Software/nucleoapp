import { getDatabase, type SqlExecutor } from "@/database/client";

export interface BackupRecord {
  id: number;
  file_path: string;
  size_bytes: number;
  created_at: string;
}

export function createBackupsRepository(getDb: () => Promise<SqlExecutor>) {
  return {
    async listRecent(limit = 10): Promise<BackupRecord[]> {
      const db = await getDb();
      return db.select<BackupRecord[]>("SELECT * FROM backups ORDER BY created_at DESC, id DESC LIMIT $1", [limit]);
    },

    async record(filePath: string, sizeBytes: number): Promise<void> {
      const db = await getDb();
      await db.execute("INSERT INTO backups (file_path, size_bytes) VALUES ($1, $2)", [filePath, sizeBytes]);
    },

    /** Olvida los registros de archivos que ya no existen (p. ej. tras la rotación). */
    async forget(filePaths: string[]): Promise<void> {
      if (filePaths.length === 0) return;
      const db = await getDb();
      const placeholders = filePaths.map((_, i) => `$${i + 1}`).join(", ");
      await db.execute(`DELETE FROM backups WHERE file_path IN (${placeholders})`, filePaths);
    },

    /** Copia consistente de la base de datos abierta en un archivo nuevo. */
    async vacuumInto(filePath: string): Promise<void> {
      const db = await getDb();
      await db.execute("VACUUM INTO $1", [filePath]);
    },
  };
}

export type BackupsRepository = ReturnType<typeof createBackupsRepository>;

export const backupsRepository = createBackupsRepository(getDatabase);
