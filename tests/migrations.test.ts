// @vitest-environment node
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

// Misma migración que src-tauri incluye con include_str!.
const schema = readFileSync(new URL("../src/database/migrations/0001_initial_schema.sql", import.meta.url), "utf8");

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(schema);
});

describe("migración 0001_initial_schema", () => {
  it("crea todas las tablas del modelo de datos", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => row.name as string);

    expect(tables).toEqual([
      "backups",
      "blocker_attempts",
      "blockers",
      "daily_logs",
      "learning_tags",
      "learnings",
      "projects",
      "report_daily_logs",
      "reports",
      "settings",
      "tags",
    ]);
  });

  it("inserta las preferencias por defecto (tema claro, sin telemetría)", () => {
    const rows = db.prepare("SELECT key, value FROM settings ORDER BY key").all();
    expect(rows).toEqual([
      { key: "language", value: '"es"' },
      { key: "telemetry", value: "false" },
      { key: "theme", value: '"light"' },
    ]);
  });

  it("rechaza fechas de registro mal formadas", () => {
    expect(() => db.exec("INSERT INTO daily_logs (log_date) VALUES ('01/11/2026')")).toThrow(/CHECK/);
    expect(() => db.exec("INSERT INTO daily_logs (log_date) VALUES ('2026-11-01')")).not.toThrow();
  });

  it("exige fecha de resolución solo para bloqueos resueltos", () => {
    expect(() => db.exec("INSERT INTO blockers (title, status) VALUES ('JWT expira', 'resolved')")).toThrow(/CHECK/);
    expect(() =>
      db.exec("INSERT INTO blockers (title, status, resolved_at) VALUES ('JWT expira', 'pending', '2026-11-01T10:00:00.000Z')"),
    ).toThrow(/CHECK/);
    expect(() =>
      db.exec("INSERT INTO blockers (title, status, resolved_at) VALUES ('JWT expira', 'resolved', '2026-11-01T10:00:00.000Z')"),
    ).not.toThrow();
  });

  it("aplica las claves foráneas: borrar un proyecto desvincula sus registros", () => {
    db.exec("INSERT INTO projects (id, name) VALUES (1, 'API de autenticación')");
    db.exec("INSERT INTO daily_logs (id, project_id, log_date) VALUES (1, 1, '2026-11-01')");
    db.exec("DELETE FROM projects WHERE id = 1");

    expect(db.prepare("SELECT project_id FROM daily_logs WHERE id = 1").get()).toEqual({ project_id: null });
    expect(() => db.exec("INSERT INTO daily_logs (project_id, log_date) VALUES (99, '2026-11-01')")).toThrow(/FOREIGN KEY/);
  });

  it("borra en cascada los intentos de solución de un bloqueo", () => {
    db.exec("INSERT INTO blockers (id, title) VALUES (1, 'Build falla en CI')");
    db.exec("INSERT INTO blocker_attempts (blocker_id, description) VALUES (1, 'Limpiar caché de cargo')");
    db.exec("DELETE FROM blockers WHERE id = 1");

    expect(db.prepare("SELECT COUNT(*) AS n FROM blocker_attempts").get()).toEqual({ n: 0 });
  });

  it("no permite proyectos duplicados sin distinguir mayúsculas", () => {
    db.exec("INSERT INTO projects (name) VALUES ('Núcleo')");
    expect(() => db.exec("INSERT INTO projects (name) VALUES ('núcleo')")).toThrow(/UNIQUE/);
  });
});
