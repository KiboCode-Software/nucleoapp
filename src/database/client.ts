import type Database from "@tauri-apps/plugin-sql";
import { activeProfile } from "./profiles";

/**
 * Lo mínimo que los repositorios necesitan de una conexión. `Database` de
 * tauri-plugin-sql lo cumple; las pruebas usan un adaptador sobre node:sqlite.
 * Los parámetros se escriben como $1, $2…
 */
export interface SqlExecutor {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
}

let connection: Promise<Database> | null = null;

/** true cuando la interfaz se ejecuta dentro de la ventana de Tauri (no en un navegador). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Modo demostración (demo.html): datos de ejemplo en memoria para las capturas de la web. */
export function isDemo(): boolean {
  return typeof window !== "undefined" && "__DEMO__" in window;
}

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("SQLite solo está disponible dentro de la app de escritorio.");
    this.name = "DatabaseUnavailableError";
  }
}

/**
 * Reintenta dos fallos pasajeros al abrir la base de datos:
 * - con una base recién creada (perfil nuevo), la ventana principal y la de captura
 *   rápida aplican las migraciones a la vez y la segunda falla con "already exists";
 * - al arrancar, la ventana puede pedir la base antes de que Rust termine de registrar
 *   el plugin de SQL ("plugin sql not found").
 */
export async function loadWithRetry<T>(load: () => Promise<T>, attempts = 5, delayMs = 250): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await load();
    } catch (error) {
      if (attempt >= attempts || !/already exists|plugin sql not found/i.test(String(error))) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}

/**
 * Devuelve una conexión única a la base de datos del perfil activo.
 * Las migraciones se aplican en el lado nativo (src-tauri/src/lib.rs) al arrancar.
 */
export function getDatabase(): Promise<Database> {
  if (!isTauri()) return Promise.reject(new DatabaseUnavailableError());

  connection ??= Promise.all([import("@tauri-apps/plugin-sql"), activeProfile()])
    .then(([{ default: Database }, profile]) => loadWithRetry(() => Database.load(`sqlite:${profile.db}`)))
    .catch((error: unknown) => {
      connection = null;
      throw error;
    });

  return connection;
}

/** Marca de tiempo UTC con el mismo formato que los DEFAULT del esquema. */
export const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
