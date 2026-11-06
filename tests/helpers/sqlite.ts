import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SqlExecutor } from "@/database/client";

// Ruta desde la raíz del proyecto: en el entorno jsdom, `URL` no admite file://.
const migrationsDir = resolve(process.cwd(), "src/database/migrations");

/**
 * Base de datos SQLite en memoria con todas las migraciones aplicadas, expuesta
 * con la misma interfaz que tauri-plugin-sql para probar los repositorios.
 */
export function createTestDatabase(): { db: DatabaseSync; executor: SqlExecutor } {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }

  // sqlx usa $1, $2…; en node:sqlite el equivalente posicional exacto es ?1, ?2…
  const prepare = (query: string) => db.prepare(query.replace(/\$(\d+)/g, "?$1"));
  const bind = (values: unknown[] = []) => values.map((v) => (typeof v === "boolean" ? Number(v) : v)) as SQLInputValue[];

  const executor: SqlExecutor = {
    async select<T>(query: string, values?: unknown[]) {
      return prepare(query).all(...bind(values)) as T;
    },
    async execute(query: string, values?: unknown[]) {
      const result = prepare(query).run(...bind(values));
      return { rowsAffected: Number(result.changes), lastInsertId: Number(result.lastInsertRowid) };
    },
  };

  return { db, executor };
}
