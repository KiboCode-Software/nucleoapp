// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createBlockersRepository, type BlockersRepository } from "@/database/repositories/blockers.repository";
import { createTestDatabase } from "./helpers/sqlite";

let repo: BlockersRepository;
let sqlite: ReturnType<typeof createTestDatabase>;

beforeEach(() => {
  sqlite = createTestDatabase();
  repo = createBlockersRepository(async () => sqlite.executor);
});

describe("repositorio de bloqueos", () => {
  it("crea un bloqueo pendiente asociado a proyecto y registro diario", async () => {
    sqlite.db.exec("INSERT INTO projects (id, name) VALUES (1, 'API REST')");
    sqlite.db.exec("INSERT INTO daily_logs (id, log_date, today) VALUES (5, '2026-11-01', 'Login')");

    const blocker = await repo.create({ title: "  El token JWT expira antes de tiempo ", project_id: 1, daily_log_id: 5 });

    expect(blocker).toMatchObject({
      title: "El token JWT expira antes de tiempo",
      description: "",
      status: "pending",
      resolved_at: null,
      project_id: 1,
      project_name: "API REST",
      daily_log_id: 5,
      attempts_count: 0,
    });
  });

  it("rechaza bloqueos sin título", async () => {
    await expect(repo.create({ title: "  " })).rejects.toThrow();
  });

  it("resuelve, escala y reabre manteniendo la coherencia de resolved_at", async () => {
    const { id } = await repo.create({ title: "CORS en producción" });

    const resolved = await repo.setStatus(id, "resolved");
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_at).toMatch(/Z$/);

    // Volver a marcarlo como resuelto no cambia la fecha original.
    expect((await repo.setStatus(id, "resolved")).resolved_at).toBe(resolved.resolved_at);

    expect(await repo.setStatus(id, "escalated")).toMatchObject({ status: "escalated", resolved_at: null });
    expect(await repo.setStatus(id, "pending")).toMatchObject({ status: "pending", resolved_at: null });
  });

  it("edita título, descripción y proyecto", async () => {
    const { id } = await repo.create({ title: "Build lento" });
    const updated = await repo.update(id, { title: "Build lento en CI", description: "Tarda 12 min" });
    expect(updated).toMatchObject({ title: "Build lento en CI", description: "Tarda 12 min" });
  });

  it("lista abiertos primero (más antiguos arriba) y después los resueltos", async () => {
    sqlite.db.exec(`INSERT INTO blockers (title, status, opened_at, resolved_at) VALUES
      ('resuelto viejo', 'resolved', '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z'),
      ('abierto reciente', 'pending', '2026-10-30T00:00:00.000Z', NULL),
      ('resuelto reciente', 'resolved', '2026-10-01T00:00:00.000Z', '2026-10-20T00:00:00.000Z'),
      ('escalado antiguo', 'escalated', '2026-10-10T00:00:00.000Z', NULL)`);

    expect((await repo.list()).map((b) => b.title)).toEqual([
      "escalado antiguo",
      "abierto reciente",
      "resuelto reciente",
      "resuelto viejo",
    ]);
  });

  it("registra intentos de solución en orden y los cuenta", async () => {
    const { id } = await repo.create({ title: "Migración falla" });
    await repo.addAttempt(id, "Revisar la versión de SQLite");
    const second = await repo.addAttempt(id, "Recrear la base de datos");

    expect((await repo.listAttempts(id)).map((a) => a.description)).toEqual([
      "Revisar la versión de SQLite",
      "Recrear la base de datos",
    ]);
    expect((await repo.getById(id)).attempts_count).toBe(2);

    await repo.removeAttempt(second.id);
    expect(await repo.listAttempts(id)).toHaveLength(1);
    await expect(repo.addAttempt(id, "   ")).rejects.toThrow();
  });

  it("al eliminar un bloqueo se eliminan sus intentos", async () => {
    const { id } = await repo.create({ title: "Error 500" });
    await repo.addAttempt(id, "Leer los logs");
    await repo.remove(id);

    await expect(repo.getById(id)).rejects.toThrow("ya no existe");
    expect(sqlite.db.prepare("SELECT COUNT(*) AS n FROM blocker_attempts").get()).toEqual({ n: 0 });
  });
});
