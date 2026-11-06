// @vitest-environment node
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Las migraciones publicadas no se pueden tocar: tauri-plugin-sql (sqlx) guarda una
 * suma de verificación de cada una y se niega a abrir una base de datos si el archivo
 * cambió, aunque sea un comentario. Los cambios van en una migración nueva.
 * Al añadir una migración, añade aquí su hash.
 */
const FROZEN: Record<string, string> = {
  "0001_initial_schema.sql": "3fbd1acd8aeef8a4247fbf194c5b6fc5668222a21cda82bdcea21899546fa9be",
  "0002_quick_capture.sql": "a7996352deef33919ec6768a23481b74986f0699a374ce7ee17abbac8f7e9838",
  "0003_deadlines.sql": "58f8c33596261382f42bc89a5aec6443b55fb606ae3b72cfcdfbdc194191e7df",
  "0004_focus_and_review.sql": "b2ef44f09968fb5d278b9b646972be97c172403586a841989383385b2ef3a626",
};

const dir = resolve(process.cwd(), "src/database/migrations");

describe("migraciones publicadas", () => {
  it.each(Object.entries(FROZEN))("%s no ha cambiado", (file, hash) => {
    expect(createHash("sha256").update(readFileSync(join(dir, file))).digest("hex")).toBe(hash);
  });

  it("toda migración tiene su hash registrado", () => {
    expect(readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()).toEqual(Object.keys(FROZEN).sort());
  });
});
