// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createDailyLogsRepository, type DailyLogsRepository } from "@/database/repositories/daily-logs.repository";
import { createProjectsRepository } from "@/database/repositories/projects.repository";
import type { DailyLogInput } from "@/types/entities";
import { createTestDatabase } from "./helpers/sqlite";

const input = (overrides: Partial<DailyLogInput> = {}): DailyLogInput => ({
  project_id: null,
  log_date: "2026-11-01",
  yesterday: "",
  today: "Implementar autenticación",
  blockers_note: "",
  learnings: "",
  ...overrides,
});

let repo: DailyLogsRepository;
let sqlite: ReturnType<typeof createTestDatabase>;

beforeEach(() => {
  sqlite = createTestDatabase();
  repo = createDailyLogsRepository(async () => sqlite.executor);
});

describe("repositorio de registros diarios", () => {
  it("crea un registro y lo devuelve con su proyecto", async () => {
    sqlite.db.exec("INSERT INTO projects (id, name) VALUES (1, 'API REST')");
    const log = await repo.create(input({ project_id: 1, learnings: "Middlewares en Express" }));

    expect(log).toMatchObject({
      id: 1,
      project_id: 1,
      project_name: "API REST",
      log_date: "2026-11-01",
      today: "Implementar autenticación",
      learnings: "Middlewares en Express",
    });
    expect(log.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("lista del más reciente al más antiguo", async () => {
    await repo.create(input({ log_date: "2026-10-30", today: "a" }));
    await repo.create(input({ log_date: "2026-11-01", today: "c" }));
    await repo.create(input({ log_date: "2026-10-31", today: "b" }));

    expect((await repo.list()).map((l) => l.today)).toEqual(["c", "b", "a"]);
    expect(await repo.list(1)).toHaveLength(1);
  });

  it("actualiza el contenido y la fecha de modificación", async () => {
    const created = await repo.create(input());
    sqlite.db.exec("UPDATE daily_logs SET updated_at = '2000-01-01T00:00:00.000Z'");

    const updated = await repo.update(created.id, input({ today: "Corregir error en JWT" }));

    expect(updated.today).toBe("Corregir error en JWT");
    expect(updated.updated_at > "2000-01-01T00:00:00.000Z").toBe(true);
    expect(updated.created_at).toBe(created.created_at);
  });

  it("falla al actualizar un registro inexistente", async () => {
    await expect(repo.update(99, input())).rejects.toThrow("ya no existe");
  });

  it("elimina registros", async () => {
    const created = await repo.create(input());
    await repo.remove(created.id);
    expect(await repo.getById(created.id)).toBeNull();
  });

  it("valida antes de escribir: rechaza un check-in vacío", async () => {
    await expect(repo.create(input({ today: "   " }))).rejects.toThrow("al menos una");
    expect(await repo.list()).toHaveLength(0);
  });
});

describe("repositorio de proyectos", () => {
  it("lista solo los proyectos activos, ordenados por nombre", async () => {
    sqlite.db.exec("INSERT INTO projects (name, archived) VALUES ('zeta', 0), ('Alfa', 0), ('Viejo', 1)");
    const projects = await createProjectsRepository(async () => sqlite.executor).listActive();
    expect(projects.map((p) => p.name)).toEqual(["Alfa", "zeta"]);
  });
});
