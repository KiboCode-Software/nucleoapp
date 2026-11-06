// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createLearningsRepository, type LearningsRepository } from "@/database/repositories/learnings.repository";
import {
  createProjectsRepository,
  DuplicateProjectError,
  type ProjectsRepository,
} from "@/database/repositories/projects.repository";
import { createTestDatabase } from "./helpers/sqlite";

let sqlite: ReturnType<typeof createTestDatabase>;
let projects: ProjectsRepository;
let learnings: LearningsRepository;

beforeEach(() => {
  sqlite = createTestDatabase();
  projects = createProjectsRepository(async () => sqlite.executor);
  learnings = createLearningsRepository(async () => sqlite.executor);
});

describe("repositorio de proyectos", () => {
  it("crea un proyecto con color y métricas en cero", async () => {
    const project = await projects.create({ name: " Portafolio ", description: "Sitio personal", color: "#AF52DE" });
    expect(project).toMatchObject({
      name: "Portafolio",
      description: "Sitio personal",
      color: "#AF52DE",
      archived: false,
      logs_count: 0,
      open_blockers: 0,
      learnings_count: 0,
      last_log_date: null,
    });
  });

  it("rechaza nombres duplicados con un error comprensible", async () => {
    await projects.create({ name: "API" });
    await expect(projects.create({ name: "api" })).rejects.toBeInstanceOf(DuplicateProjectError);
    const other = await projects.create({ name: "Web" });
    await expect(projects.update(other.id, { name: "API" })).rejects.toThrow("Ya existe un proyecto");
  });

  it("calcula métricas a partir de registros, bloqueos y aprendizajes", async () => {
    const { id } = await projects.create({ name: "API" });
    sqlite.db.exec(`INSERT INTO daily_logs (project_id, log_date, today) VALUES (${id}, '2026-10-20', 'a'), (${id}, '2026-10-28', 'b')`);
    sqlite.db.exec(`INSERT INTO blockers (project_id, title, status, resolved_at) VALUES
      (${id}, 'abierto', 'pending', NULL), (${id}, 'cerrado', 'resolved', '2026-10-21T00:00:00.000Z')`);
    sqlite.db.exec(`INSERT INTO learnings (project_id, title) VALUES (${id}, 'JWT')`);

    expect(await projects.getById(id)).toMatchObject({
      logs_count: 2,
      open_blockers: 1,
      resolved_blockers: 1,
      learnings_count: 1,
      last_log_date: "2026-10-28",
    });
  });

  it("archiva proyectos: salen de los selectores y van al final de la lista", async () => {
    const old = await projects.create({ name: "Viejo" });
    await projects.create({ name: "Nuevo" });
    await projects.setArchived(old.id, true);

    expect((await projects.listActive()).map((p) => p.name)).toEqual(["Nuevo"]);
    expect((await projects.list()).map((p) => [p.name, p.archived])).toEqual([
      ["Nuevo", false],
      ["Viejo", true],
    ]);
  });

  it("al eliminar un proyecto conserva sus registros sin proyecto", async () => {
    const { id } = await projects.create({ name: "Temporal" });
    sqlite.db.exec(`INSERT INTO daily_logs (project_id, log_date, today) VALUES (${id}, '2026-10-20', 'a')`);
    await projects.remove(id);
    expect(sqlite.db.prepare("SELECT project_id FROM daily_logs").get()).toEqual({ project_id: null });
  });
});

describe("repositorio de aprendizajes", () => {
  it("crea un aprendizaje con etiquetas sin duplicados", async () => {
    const learning = await learnings.create({
      kind: "command",
      title: "Limpiar caché de cargo",
      content: "cargo clean",
      tags: ["Rust", " rust ", "CLI"],
    });

    expect(learning).toMatchObject({ kind: "command", title: "Limpiar caché de cargo", content: "cargo clean" });
    expect(learning.tags).toEqual(["CLI", "Rust"]);
    expect(await learnings.listTags()).toEqual([
      { name: "CLI", count: 1 },
      { name: "Rust", count: 1 },
    ]);
  });

  it("reutiliza etiquetas existentes sin distinguir mayúsculas y cuenta su uso", async () => {
    await learnings.create({ title: "Ownership", tags: ["Rust"] });
    await learnings.create({ title: "Lifetimes", tags: ["rust", "Memoria"] });

    expect(await learnings.listTags()).toEqual([
      { name: "Rust", count: 2 },
      { name: "Memoria", count: 1 },
    ]);
  });

  it("actualiza contenido y etiquetas y limpia las que quedan sin uso", async () => {
    const created = await learnings.create({ title: "CORS", tags: ["HTTP", "Backend"] });
    const updated = await learnings.update(created.id, { kind: "error_fix", title: "CORS en Express", tags: ["Express"] });

    expect(updated).toMatchObject({ kind: "error_fix", title: "CORS en Express", tags: ["Express"] });
    expect((await learnings.listTags()).map((t) => t.name)).toEqual(["Express"]);
  });

  it("lista los más recientes primero, con proyecto", async () => {
    sqlite.db.exec("INSERT INTO projects (id, name) VALUES (1, 'API')");
    sqlite.db.exec(`INSERT INTO learnings (title, project_id, created_at) VALUES
      ('viejo', NULL, '2026-10-01T00:00:00.000Z'), ('nuevo', 1, '2026-10-30T00:00:00.000Z')`);

    const list = await learnings.list();
    expect(list.map((l) => [l.title, l.project_name])).toEqual([
      ["nuevo", "API"],
      ["viejo", null],
    ]);
  });

  it("elimina un aprendizaje y sus etiquetas huérfanas", async () => {
    const { id } = await learnings.create({ title: "Temporal", tags: ["borrar"] });
    await learnings.remove(id);
    expect(await learnings.list()).toEqual([]);
    expect(await learnings.listTags()).toEqual([]);
  });

  it("valida título y número de etiquetas", async () => {
    await expect(learnings.create({ title: " " })).rejects.toThrow();
    await expect(learnings.create({ title: "x", tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })).rejects.toThrow(
      "Máximo 10 etiquetas",
    );
  });
});
