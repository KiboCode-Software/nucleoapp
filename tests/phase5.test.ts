// @vitest-environment node
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBackupsRepository } from "@/database/repositories/backups.repository";
import { createCapturesRepository } from "@/database/repositories/captures.repository";
import { createSettingsRepository, DEFAULT_SETTINGS } from "@/database/repositories/settings.repository";
import { backupFileName, createBackupService, isBackupDue, type BackupNative } from "@/services/backup";
import { shouldRemind } from "@/services/reminder";
import { createTestDatabase } from "./helpers/sqlite";

let sqlite: ReturnType<typeof createTestDatabase>;
const executor = async () => sqlite.executor;

beforeEach(() => {
  sqlite = createTestDatabase();
});

describe("migración 0002: capturas", () => {
  it("exige que processed_at y processed_as vayan juntos", () => {
    expect(() => sqlite.db.exec("INSERT INTO captures (content, processed_as) VALUES ('x', 'blocker')")).toThrow(/CHECK/);
    expect(() => sqlite.db.exec("INSERT INTO captures (content) VALUES ('   ')")).toThrow(/CHECK/);
  });
});

describe("repositorio de capturas", () => {
  it("guarda capturas y lista solo las pendientes, recientes primero", async () => {
    const repo = createCapturesRepository(executor);
    const first = await repo.create("  Revisar el PR de Ana  ");
    sqlite.db.exec("UPDATE captures SET created_at = '2026-01-01T00:00:00.000Z' WHERE id = 1");
    await repo.create("Idea: modo concentración");

    expect(first.content).toBe("Revisar el PR de Ana");
    expect((await repo.listPending()).map((c) => c.content)).toEqual(["Idea: modo concentración", "Revisar el PR de Ana"]);

    await repo.markProcessed(first.id, "learning");
    expect((await repo.listPending()).map((c) => c.id)).toEqual([2]);
    expect(sqlite.db.prepare("SELECT processed_as FROM captures WHERE id = 1").get()).toEqual({ processed_as: "learning" });
    await expect(repo.create(" ")).rejects.toThrow("Escribe algo");
  });
});

describe("ajustes", () => {
  it("usa valores por defecto y guarda cambios validados", async () => {
    const repo = createSettingsRepository(executor);
    expect(await repo.load()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.backup).toEqual({ auto: true, directory: null, keep: 10 });

    await repo.save("reminder", { enabled: true, time: "18:15" });
    await repo.save("reminder", { enabled: true, time: "09:00" });
    expect((await repo.load()).reminder).toEqual({ enabled: true, time: "09:00" });
    await expect(repo.save("reminder", { enabled: true, time: "25:00" })).rejects.toThrow();
  });

  it("ignora valores guardados corruptos", async () => {
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('backup', '{"auto":"sí"}')`);
    expect((await createSettingsRepository(executor).load()).backup).toEqual(DEFAULT_SETTINGS.backup);
  });
});

describe("recordatorio de check-in", () => {
  const reminder = { enabled: true, time: "17:30" };
  const tuesday = (h: number, m = 0) => new Date(2026, 9, 27, h, m);

  it("avisa en día laborable a partir de la hora si no hay check-in", () => {
    expect(shouldRemind({ now: tuesday(17, 30), reminder, hasTodayLog: false, lastReminderDate: null })).toBe(true);
    expect(shouldRemind({ now: tuesday(17, 29), reminder, hasTodayLog: false, lastReminderDate: null })).toBe(false);
  });

  it("no avisa si ya hay check-in, ya avisó hoy, está desactivado o es fin de semana", () => {
    const base = { now: tuesday(18), reminder, hasTodayLog: false, lastReminderDate: null };
    expect(shouldRemind({ ...base, hasTodayLog: true })).toBe(false);
    expect(shouldRemind({ ...base, lastReminderDate: "2026-10-27" })).toBe(false);
    expect(shouldRemind({ ...base, reminder: { ...reminder, enabled: false } })).toBe(false);
    expect(shouldRemind({ ...base, now: new Date(2026, 10, 1, 18) })).toBe(false); // domingo
  });
});

describe("respaldos", () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it("nombra los archivos con fecha y hora ordenables", () => {
    expect(backupFileName(new Date(2026, 10, 1, 9, 5, 7))).toBe("nucleo-2026-11-01-090507.db");
  });

  it("decide cuándo toca un respaldo automático", () => {
    const now = new Date("2026-11-02T12:00:00.000Z");
    expect(isBackupDue(null, now)).toBe(true);
    expect(isBackupDue("2026-11-01T13:00:00.000Z", now)).toBe(false);
    expect(isBackupDue("2026-11-01T12:00:00.000Z", now)).toBe(true);
  });

  it("crea una copia real con VACUUM INTO, la registra y rota las antiguas", async () => {
    const backupDir = mkdtempSync(join(tmpdir(), "ddl-backups-"));
    dir = backupDir;
    sqlite.db.exec("INSERT INTO projects (name) VALUES ('Respaldado')");

    // Rust se simula con el sistema de archivos real del entorno de pruebas.
    const native: BackupNative = {
      backupDir: async () => backupDir,
      join: async (d, f) => join(d, f),
      fileSize: async (p) => statSync(p).size,
      prune: async (d, keep) => {
        const files = readdirSync(d).filter((f) => f.startsWith("nucleo-")).sort().reverse();
        const removed = files.slice(keep).map((f) => join(d, f));
        removed.forEach((p) => rmSync(p));
        return removed;
      },
    };
    const repo = createBackupsRepository(executor);
    const service = createBackupService(repo, native);

    const first = await service.run({ directory: null, keep: 2 }, new Date(2026, 10, 1, 9, 0, 0));
    await service.run({ directory: null, keep: 2 }, new Date(2026, 10, 2, 9, 0, 0));
    const third = await service.run({ directory: null, keep: 2 }, new Date(2026, 10, 3, 9, 0, 0));

    // La copia es una base SQLite válida con los datos.
    const copy = new DatabaseSync(third, { readOnly: true });
    expect(copy.prepare("SELECT name FROM projects").get()).toEqual({ name: "Respaldado" });
    copy.close();

    expect(existsSync(first)).toBe(false);
    expect(readdirSync(backupDir)).toHaveLength(2);
    const records = await repo.listRecent();
    expect(records.map((r) => r.file_path)).not.toContain(first);
    expect(records).toHaveLength(2);
    expect(records[0].size_bytes).toBeGreaterThan(0);
  });

  it("el respaldo automático respeta la configuración y el intervalo", async () => {
    const calls: string[] = [];
    const native: BackupNative = {
      backupDir: async () => "C:/b",
      join: async (d, f) => `${d}/${f}`,
      fileSize: async () => 1,
      prune: async () => [],
    };
    const repo = { ...createBackupsRepository(executor), vacuumInto: async (p: string) => void calls.push(p) };
    const service = createBackupService(repo, native);
    const settings = { auto: true, directory: null, keep: 5 };

    expect(await service.runIfDue({ ...settings, auto: false })).toBeNull();
    expect(await service.runIfDue(settings, new Date())).not.toBeNull();
    expect(await service.runIfDue(settings, new Date())).toBeNull(); // ya hay uno reciente
    expect(calls).toHaveLength(1);
  });

  it("nunca hace dos respaldos a la vez (mismo archivo en el mismo segundo)", async () => {
    const calls: string[] = [];
    const native: BackupNative = {
      backupDir: async () => "C:/b",
      join: async (d, f) => `${d}/${f}`,
      fileSize: async () => 1,
      prune: async () => [],
    };
    const repo = { ...createBackupsRepository(executor), vacuumInto: async (p: string) => void calls.push(p) };
    const service = createBackupService(repo, native);
    const settings = { auto: true, directory: null, keep: 5 };
    const now = new Date(2026, 10, 5, 23, 18, 43);

    // El automático (dos veces, como los efectos dobles de React) y "Respaldar ahora" a la vez.
    const results = await Promise.all([service.runIfDue(settings, now), service.runIfDue(settings, now), service.run(settings, now)]);
    expect(calls).toEqual(["C:/b/nucleo-2026-11-05-231843.db"]);
    expect(new Set(results)).toEqual(new Set(["C:/b/nucleo-2026-11-05-231843.db"]));
  });
});
