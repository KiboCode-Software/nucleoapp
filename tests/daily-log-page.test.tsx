import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { parseTasks, serializeTasks, taskProgress } from "@/modules/daily-log/tasks";
import { toISODate } from "@/utils/date";
import { createTestDatabase } from "./helpers/sqlite";
import { resetStores } from "./helpers/stores";

// La app cree estar dentro de Tauri, pero usa una SQLite en memoria con el esquema real.
let sqlite: ReturnType<typeof createTestDatabase>;
vi.mock("@/database/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/database/client")>();
  return { ...actual, isTauri: () => true, getDatabase: async () => sqlite.executor };
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const today = toISODate(new Date());
const row = <T,>(sql: string) => sqlite.db.prepare(sql).get() as T;

function addTask(text: string) {
  const input = screen.getByRole("textbox", { name: "Nueva tarea" });
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: "Enter" });
}

beforeEach(() => {
  sqlite = createTestDatabase();
  resetStores();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("tareas del plan", () => {
  it("lee y escribe listas de tareas, aceptando texto antiguo sin casillas", () => {
    expect(parseTasks("- [x] Login\n- [ ] Tests\nRevisar PR\n\n* Docs")).toEqual([
      { text: "Login", done: true },
      { text: "Tests", done: false },
      { text: "Revisar PR", done: false },
      { text: "Docs", done: false },
    ]);
    expect(serializeTasks([{ text: "A", done: true }, { text: " ", done: false }, { text: "B", done: false }])).toBe("- [x] A\n- [ ] B");
    expect(taskProgress("- [x] A\n- [ ] B\n- [x] C")).toEqual({ done: 2, total: 3 });
  });
});

describe("módulo Registro diario: el día", () => {
  it("muestra los tres momentos del día por separado, sin «¿Qué hice ayer?»", async () => {
    renderAt("/daily-log");
    expect(await screen.findByRole("region", { name: "Plan del día" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bloqueos" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Aprendizajes" })).toBeInTheDocument();
    expect(screen.queryByText(/Qué hice ayer/)).not.toBeInTheDocument();
    expect(screen.getByText("Hoy")).toBeInTheDocument();
  });

  it("añade tareas y las marca como hechas, guardando al momento", async () => {
    renderAt("/daily-log");
    await screen.findByRole("region", { name: "Plan del día" });

    addTask("Implementar el login");
    addTask("Escribir pruebas");
    await waitFor(() => expect(row("SELECT today FROM daily_logs")).toEqual({ today: "- [ ] Implementar el login\n- [ ] Escribir pruebas" }));
    expect(row("SELECT log_date FROM daily_logs")).toEqual({ log_date: today });

    fireEvent.click(screen.getByRole("checkbox", { name: 'Marcar como hecha "Implementar el login"' }));
    await waitFor(() => expect(row("SELECT today FROM daily_logs")).toEqual({ today: "- [x] Implementar el login\n- [ ] Escribir pruebas" }));
    expect(screen.getByLabelText("1 de 2 tareas hechas")).toBeInTheDocument();
    // Dos cambios seguidos no crean dos registros del mismo día.
    expect(row("SELECT COUNT(*) AS n FROM daily_logs")).toEqual({ n: 1 });
  });

  it("edita y quita tareas; si el día queda vacío, se elimina", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (log_date, today) VALUES ('${today}', '- [ ] Tarea con errata')`);
    renderAt("/daily-log");

    fireEvent.click(await screen.findByRole("button", { name: "Tarea con errata" }));
    const input = screen.getByRole("textbox", { name: "Editar tarea" });
    fireEvent.change(input, { target: { value: "Tarea corregida" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(row("SELECT today FROM daily_logs")).toEqual({ today: "- [ ] Tarea corregida" }));

    fireEvent.click(screen.getByRole("button", { name: 'Quitar tarea "Tarea corregida"' }));
    await waitFor(() => expect(row("SELECT COUNT(*) AS n FROM daily_logs")).toEqual({ n: 0 }));
  });

  it("guarda bloqueos y aprendizajes solos, al dejar de escribir", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt("/daily-log");
    const blockers = within(await screen.findByRole("region", { name: "Bloqueos" })).getByRole("textbox");

    fireEvent.change(blockers, { target: { value: "El build de CI falla" } });
    expect(row("SELECT COUNT(*) AS n FROM daily_logs")).toEqual({ n: 0 });
    await act(async () => void vi.advanceTimersByTime(1000));
    await waitFor(() => expect(row("SELECT blockers_note FROM daily_logs")).toEqual({ blockers_note: "El build de CI falla" }));

    const learnings = within(screen.getByRole("region", { name: "Aprendizajes" })).getByRole("textbox");
    fireEvent.change(learnings, { target: { value: "Cachear dependencias en Actions" } });
    fireEvent.blur(learnings);
    await waitFor(() => expect(row("SELECT learnings FROM daily_logs")).toEqual({ learnings: "Cachear dependencias en Actions" }));
    expect(row("SELECT COUNT(*) AS n FROM daily_logs")).toEqual({ n: 1 });
  });

  it("trae las tareas pendientes del registro anterior", async () => {
    sqlite.db.exec("INSERT INTO daily_logs (log_date, today) VALUES ('2026-10-20', '- [x] Hecha\n- [ ] Pendiente A\n- [ ] Pendiente B')");
    renderAt("/daily-log");

    fireEvent.click(await screen.findByRole("button", { name: /Traer 2 pendientes de/ }));
    await waitFor(() => expect(row(`SELECT today FROM daily_logs WHERE log_date = '${today}'`)).toEqual({ today: "- [ ] Pendiente A\n- [ ] Pendiente B" }));
    expect(screen.queryByRole("button", { name: /Traer/ })).not.toBeInTheDocument();
  });

  it("navega a días anteriores y abre un registro concreto", async () => {
    sqlite.db.exec("INSERT INTO daily_logs (id, log_date, today) VALUES (7, '2026-10-20', '- [ ] Configurar CI')");
    renderAt("/daily-log/7");

    expect(await screen.findByRole("button", { name: "Configurar CI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a hoy" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Día anterior" }));
    expect(await screen.findByText("Empieza el día anotando lo que quieres sacar adelante.")).toBeInTheDocument();
  });

  it("conserva lo escrito en «¿Qué hice ayer?» en registros antiguos", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (id, log_date, yesterday) VALUES (3, '2026-10-15', 'Terminé el módulo de pagos')`);
    renderAt("/daily-log/3");
    expect(await screen.findByText("Terminé el módulo de pagos")).toBeInTheDocument();
  });

  it("borra el día tras confirmar", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (log_date, today) VALUES ('${today}', '- [ ] Algo')`);
    renderAt("/daily-log");

    fireEvent.click(await screen.findByRole("button", { name: "Eliminar el registro del día" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(row("SELECT COUNT(*) AS n FROM daily_logs")).toEqual({ n: 0 }));
  });
});

describe("módulo Registro diario: historial", () => {
  it("es una vista aparte, agrupada por mes y con búsqueda", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (id, log_date, today, learnings) VALUES
      (1, '2026-09-30', '- [x] Migrar a Tailwind', ''),
      (2, '2026-10-21', '- [ ] Refactor del router\n- [x] Revisar PR', 'Rutas anidadas')`);
    renderAt("/daily-log/historial");

    expect(await screen.findByRole("region", { name: "octubre de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "septiembre de 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Plan del día" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Refactor del router/ })).toHaveAttribute("href", "/daily-log/2");
    expect(screen.getAllByTitle("Tareas hechas")).toHaveLength(2);

    fireEvent.change(screen.getByPlaceholderText("Buscar en tareas, bloqueos y aprendizajes"), { target: { value: "tailwind" } });
    expect(screen.queryByRole("link", { name: /Refactor del router/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Migrar a Tailwind/ })).toBeInTheDocument();
  });

  it("cambia entre las pestañas Día e Historial", async () => {
    renderAt("/daily-log");
    const tabs = await screen.findByRole("navigation", { name: "Vistas del registro diario" });
    expect(within(tabs).getByRole("link", { name: /Día/ })).toHaveAttribute("aria-current", "page");

    fireEvent.click(within(tabs).getByRole("link", { name: /Historial/ }));
    expect(await screen.findByText("Aún no hay registros")).toBeInTheDocument();
    expect(within(tabs).getByRole("link", { name: /Historial/ })).toHaveAttribute("aria-current", "page");
  });
});

describe("resumen", () => {
  it("muestra el progreso de los tres momentos de hoy", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (id, log_date, today, learnings) VALUES (1, '${today}', '- [x] A\n- [ ] B', 'Algo')`);
    renderAt("/");

    const checkin = (await screen.findByText("Check-in de hoy")).closest("section")!;
    expect(within(checkin).getByText("1/2 tareas")).toBeInTheDocument();
    expect(within(checkin).getByText("Anotado")).toBeInTheDocument();
    expect(within(checkin).getByRole("link", { name: /Abrir el día/ })).toHaveAttribute("href", "/daily-log");
  });

  it("muestra la semana con la racha", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (log_date, today) VALUES ('${today}', '- [ ] Algo')`);
    renderAt("/");

    const week = (await screen.findByText("Esta semana")).closest("section")!;
    expect(await within(week).findByText("Racha")).toBeInTheDocument();
    expect(within(week).getByText("Racha").previousSibling).toHaveTextContent("1 día");
  });
});
