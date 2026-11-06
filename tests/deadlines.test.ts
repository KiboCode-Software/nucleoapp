// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createDeadlinesRepository, type Deadline } from "@/database/repositories/deadlines.repository";
import { countdown, daysUntil, defaultDue, dueReminders, groupOf, nextDeadline, preciseCountdown, timelineWeeks, upcoming } from "@/modules/deadlines/schedule";
import { createTestDatabase } from "./helpers/sqlite";

// Domingo 1 de noviembre de 2026, 10:00 (hora local).
const NOW = new Date(2026, 10, 1, 10, 0);

const deadline = (id: number, due_at: string, done_at: string | null = null): Deadline => ({
  id,
  project_id: null,
  project_name: null,
  project_color: null,
  title: `Entrega ${id}`,
  kind: "assignment",
  due_at,
  notes: "",
  weight: null,
  grade: null,
  done_at,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
});

describe("cuenta regresiva de entregas", () => {
  it("cuenta días naturales, no horas", () => {
    expect(daysUntil("2026-11-01T08:00", NOW)).toBe(0);
    expect(daysUntil("2026-11-02T00:30", NOW)).toBe(1);
    expect(daysUntil("2026-10-30T23:59", NOW)).toBe(-2);
  });

  it("describe el plazo en lenguaje natural", () => {
    expect(countdown("2026-11-01T14:00", NOW)).toBe("Hoy a las 14:00");
    expect(countdown("2026-11-01T08:00", NOW)).toBe("Venció hoy a las 08:00");
    expect(countdown("2026-11-02T09:15", NOW)).toBe("Mañana a las 09:15");
    expect(countdown("2026-10-31T23:59", NOW)).toBe("Venció ayer");
    expect(countdown("2026-10-28T12:00", NOW)).toBe("Venció hace 4 días");
    expect(countdown("2026-11-06T12:00", NOW)).toBe("En 5 días");
    expect(countdown("2026-11-29T12:00", NOW)).toBe("En 4 semanas");
    expect(countdown("2027-03-01T12:00", NOW)).toBe("En 4 meses");
  });

  it("agrupa la línea de tiempo por semanas, con las vencidas primero", () => {
    const list = [
      deadline(1, "2026-11-20T12:00"),
      deadline(2, "2026-11-01T08:00"),
      deadline(3, "2026-11-01T18:00"),
      deadline(4, "2026-11-05T12:00"),
      deadline(5, "2026-10-20T12:00", "2026-10-19T10:00:00.000Z"),
      deadline(6, "2026-11-03T12:00"),
    ];
    // NOW es domingo 1: su semana empezó el lunes 26 de octubre.
    expect(timelineWeeks(list, NOW).map(({ label, items }) => [label, items.map((d) => d.id)])).toEqual([
      ["Vencidas", [2]],
      ["Esta semana", [3]],
      ["Próxima semana", [6, 4]],
      ["Semana del 16 nov", [1]],
    ]);
    expect(groupOf(list[4], NOW)).toBe("done");
    expect(nextDeadline(list)?.id).toBe(2);
    expect(nextDeadline([list[4]])).toBeNull();
  });

  it("la cuenta regresiva destacada llega a los minutos", () => {
    expect(preciseCountdown("2026-11-02T14:32", NOW)).toBe("1 d 4 h 32 min");
    expect(preciseCountdown("2026-11-01T10:45", NOW)).toBe("45 min");
    expect(preciseCountdown("2026-11-01T13:05", NOW)).toBe("3 h 5 min");
    expect(preciseCountdown("2026-11-10T10:00", NOW)).toBe("9 d 0 h");
    expect(preciseCountdown("2026-11-01T07:00", NOW)).toBe("Vencida hace 3 h 0 min");
  });

  it("las próximas incluyen las vencidas sin hacer y excluyen las lejanas", () => {
    const list = [deadline(1, "2026-12-30T12:00"), deadline(2, "2026-10-30T12:00"), deadline(3, "2026-11-03T12:00"), deadline(4, "2026-11-02T12:00", "x")];
    expect(upcoming(list, NOW).map((d) => d.id)).toEqual([2, 3]);
  });

  it("propone una semana después a última hora", () => {
    expect(defaultDue(NOW)).toBe("2026-11-08T23:59");
  });
});

describe("avisos de entregas", () => {
  const ids = (list: ReturnType<typeof dueReminders>) => list.map((r) => [r.deadline.id, r.offset, r.keys]);

  it("avisa cuando llega la antelación elegida, una sola vez", () => {
    const list = [deadline(1, "2026-11-02T09:00"), deadline(2, "2026-11-05T09:00"), deadline(3, "2026-11-01T10:30")];
    // Domingo 10:00: la 1 vence mañana a las 9 (menos de un día) y la 3 en 30 min.
    expect(ids(dueReminders(list, [1440, 60], [], NOW))).toEqual([
      [1, 1440, ["1@1440"]],
      [3, 60, ["3@60", "3@1440"]],
    ]);
    expect(dueReminders(list, [1440, 60], ["1@1440", "3@60", "3@1440"], NOW)).toEqual([]);
  });

  it("tras la app cerrada, avisa con la antelación más cercana y no con las demás", () => {
    expect(ids(dueReminders([deadline(1, "2026-11-01T10:45")], [10080, 1440, 60], [], NOW))).toEqual([[1, 60, ["1@60", "1@1440", "1@10080"]]]);
  });

  it("no avisa de completadas, vencidas ni lejanas", () => {
    const list = [deadline(1, "2026-11-01T12:00", "x"), deadline(2, "2026-10-31T12:00"), deadline(3, "2026-11-20T12:00")];
    expect(dueReminders(list, [1440, 60], [], NOW)).toEqual([]);
  });
});

describe("repositorio de entregas", () => {
  let sqlite: ReturnType<typeof createTestDatabase>;
  let repo: ReturnType<typeof createDeadlinesRepository>;

  beforeEach(() => {
    sqlite = createTestDatabase();
    repo = createDeadlinesRepository(async () => sqlite.executor);
  });

  it("crea, edita, completa y borra entregas con su materia", async () => {
    sqlite.db.exec("INSERT INTO projects (name, color) VALUES ('Cálculo', '#FF9F0A')");
    const created = await repo.create({ title: " Parcial 2 ", kind: "exam", due_at: "2026-11-10T09:00", project_id: 1, weight: 30 });
    expect(created).toMatchObject({ title: "Parcial 2", kind: "exam", project_name: "Cálculo", project_color: "#FF9F0A", weight: 30, grade: null, done_at: null });

    const edited = await repo.update(created.id, { title: "Parcial 2", kind: "exam", due_at: "2026-11-12T09:00", project_id: 1, weight: 30, grade: 8.5 });
    expect(edited).toMatchObject({ due_at: "2026-11-12T09:00", grade: 8.5 });

    expect((await repo.setDone(created.id, true)).done_at).not.toBeNull();
    expect((await repo.setDone(created.id, false)).done_at).toBeNull();

    await repo.remove(created.id);
    expect(await repo.list()).toEqual([]);
  });

  it("lista primero las pendientes por fecha y luego las completadas", async () => {
    const a = await repo.create({ title: "A", due_at: "2026-11-20T12:00" });
    const b = await repo.create({ title: "B", due_at: "2026-11-05T12:00" });
    await repo.create({ title: "C", due_at: "2026-11-01T12:00" }).then((c) => repo.setDone(c.id, true));
    expect((await repo.list()).map((d) => d.title)).toEqual([b.title, a.title, "C"]);
  });

  it("borrar la materia deja la entrega sin materia", async () => {
    sqlite.db.exec("INSERT INTO projects (name) VALUES ('Física')");
    await repo.create({ title: "Informe", due_at: "2026-11-05T12:00", project_id: 1 });
    sqlite.db.exec("DELETE FROM projects");
    expect((await repo.list())[0]).toMatchObject({ project_id: null, project_name: null });
  });

  it("valida título, fecha y ponderación", async () => {
    await expect(repo.create({ title: "  ", due_at: "2026-11-05T12:00" })).rejects.toThrow();
    await expect(repo.create({ title: "X", due_at: "2026-11-05" })).rejects.toThrow();
    await expect(repo.create({ title: "X", due_at: "2026-11-05T12:00", weight: 120 })).rejects.toThrow();
    // La base de datos también lo impide si algo se salta la validación.
    expect(() => sqlite.db.exec("INSERT INTO deadlines (title, due_at) VALUES ('X', 'mañana')")).toThrow();
  });
});

describe("apertura de la base de datos", () => {
  it("reintenta si otra ventana está aplicando las migraciones a la vez", async () => {
    const { loadWithRetry } = await import("@/database/client");
    let calls = 0;
    const load = async () => {
      calls++;
      if (calls < 3) throw new Error("error returned from database: (code: 1) table _sqlx_migrations already exists");
      return "conexión";
    };
    await expect(loadWithRetry(load, 5, 1)).resolves.toBe("conexión");
    expect(calls).toBe(3);
  });

  it("reintenta si la ventana pide la base antes de que el plugin de SQL esté listo", async () => {
    const { loadWithRetry } = await import("@/database/client");
    let calls = 0;
    const load = async () => {
      if (++calls === 1) throw "plugin sql not found";
      return "conexión";
    };
    await expect(loadWithRetry(load, 5, 1)).resolves.toBe("conexión");
  });

  it("no reintenta otros errores", async () => {
    const { loadWithRetry } = await import("@/database/client");
    let calls = 0;
    await expect(
      loadWithRetry(async () => {
        calls++;
        throw new Error("unable to open database file");
      }, 5, 1),
    ).rejects.toThrow("unable to open");
    expect(calls).toBe(1);
  });
});
