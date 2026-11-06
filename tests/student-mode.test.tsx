import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { vocabularyFor } from "@/modes/vocabulary";
import { generateMarkdown } from "@/services/reports/template";
import type { PeriodData } from "@/database/repositories/reports.repository";
import { createTestDatabase } from "./helpers/sqlite";
import { resetStores } from "./helpers/stores";

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

const row = <T,>(sql: string) => sqlite.db.prepare(sql).get() as T;
const localDue = (daysAhead: number, time = "12:00") => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}`;
};

beforeEach(() => {
  sqlite = createTestDatabase();
  resetStores("student");
});

afterEach(cleanup);

describe("modo estudiante", () => {
  it("la barra lateral usa el vocabulario de estudio e incluye Entregas", () => {
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: "Módulos" });
    for (const label of ["Entregas", "Dudas", "Apuntes", "Materias", "Resúmenes"]) expect(nav).toHaveTextContent(label);
    expect(nav).not.toHaveTextContent("Bloqueos");
    expect(screen.getByRole("button", { name: /Perfil: Desarrollo \(modo estudio\)/ })).toBeInTheDocument();
  });

  it("el Resumen muestra las próximas entregas con su cuenta regresiva", async () => {
    sqlite.db.exec(`INSERT INTO deadlines (title, kind, due_at) VALUES ('Parcial de Álgebra', 'exam', '${localDue(1, "09:00")}')`);
    sqlite.db.exec(`INSERT INTO deadlines (title, due_at) VALUES ('Ensayo final', '${localDue(60)}')`);
    renderAt("/");

    const panel = (await screen.findByText("Próximas entregas")).closest("section")!;
    expect(await within(panel).findByText("Parcial de Álgebra")).toBeInTheDocument();
    expect(within(panel).getByText("Mañana a las 09:00")).toBeInTheDocument();
    expect(within(panel).queryByText("Ensayo final")).not.toBeInTheDocument();
    expect(screen.getByText("Estudio de hoy")).toBeInTheDocument();
    expect(screen.getByText("Dudas pendientes")).toBeInTheDocument();
  });

  it("añade una entrega desde la hoja y la destaca con su cuenta regresiva", async () => {
    renderAt("/deadlines");

    fireEvent.click(await screen.findByRole("button", { name: "Añadir la primera" }));
    const sheet = await screen.findByRole("dialog", { name: "Nueva entrega" });
    fireEvent.click(within(sheet).getByRole("radio", { name: "Examen" }));
    fireEvent.change(within(sheet).getByLabelText("Título"), { target: { value: "Parcial 2" } });
    fireEvent.change(within(sheet).getByLabelText("Fecha límite"), { target: { value: localDue(3, "10:30") } });
    fireEvent.change(within(sheet).getByLabelText("Ponderación (%)"), { target: { value: "30" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Añadir entrega" }));

    const hero = await screen.findByRole("region", { name: "Próxima entrega" });
    expect(hero).toHaveTextContent("Parcial 2");
    expect(hero).toHaveTextContent("30% de la nota");
    expect(hero).toHaveTextContent(/\d+ d \d+ h/);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(row("SELECT title, kind, weight FROM deadlines")).toEqual({ title: "Parcial 2", kind: "exam", weight: 30 });
  });

  it("la línea de tiempo agrupa por semanas y permite marcar como hecha", async () => {
    sqlite.db.exec(`INSERT INTO deadlines (title, due_at) VALUES ('Informe', '${localDue(1)}'), ('Ensayo', '${localDue(40)}')`);
    renderAt("/deadlines");

    // La más urgente va destacada; el resto, en la línea de tiempo.
    expect(await screen.findByRole("region", { name: "Próxima entrega" })).toHaveTextContent("Informe");
    const timeline = screen.getByLabelText("Línea de tiempo de entregas");
    expect(within(timeline).getByRole("region", { name: /^Semana del/ })).toHaveTextContent("Ensayo");

    fireEvent.click(within(timeline).getByRole("checkbox", { name: "Marcar «Ensayo» como hecha" }));
    await waitFor(() => expect(within(timeline).getByRole("region", { name: "Completadas" })).toBeInTheDocument());
    await waitFor(() => expect(row<{ n: number }>("SELECT COUNT(*) AS n FROM deadlines WHERE done_at IS NOT NULL").n).toBe(1));

    fireEvent.click(within(screen.getByRole("region", { name: "Próxima entrega" })).getByRole("button", { name: "Marcar como hecha" }));
    expect(await screen.findByText("Todo entregado")).toBeInTheDocument();
  });

  it("abre el detalle de una entrega en una hoja", async () => {
    sqlite.db.exec(`INSERT INTO deadlines (id, title, kind, due_at) VALUES (7, 'Exposición final', 'presentation', '${localDue(2)}')`);
    renderAt("/deadlines/7");
    const sheet = await screen.findByRole("dialog", { name: "Exposición final" });
    expect(within(sheet).getByLabelText("Título")).toHaveValue("Exposición final");
    expect(within(sheet).getByRole("radio", { name: "Exposición" })).toHaveAttribute("aria-checked", "true");
    expect(within(sheet).getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it("Dudas usa sus propios estados y textos", async () => {
    renderAt("/blockers");
    fireEvent.click(await screen.findByRole("button", { name: "Nueva duda" }));
    fireEvent.change(await screen.findByLabelText("Duda"), { target: { value: "No entiendo la regla de la cadena" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar duda" }));

    expect(await screen.findByRole("button", { name: "Consultar al profesor" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Consultar al profesor" }));
    expect(await within(screen.getByRole("dialog")).findByText("Consultada")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Consultada (1)" })).toHaveTextContent("No entiendo la regla de la cadena");
    expect(screen.getByRole("button", { name: /Marcar como resuelta/ })).toBeInTheDocument();
    expect(row("SELECT status FROM blockers")).toEqual({ status: "escalated" });
  });

  it("Apuntes ofrece fórmulas y ejercicios resueltos", async () => {
    renderAt("/learning");
    expect(await screen.findByRole("radio", { name: "Fórmula" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Ejercicio resuelto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar apunte" })).toBeInTheDocument();
  });

  it("el registro diario habla de plan de estudio, dudas y lo aprendido", async () => {
    renderAt("/daily-log");
    expect(await screen.findByText("Plan de estudio")).toBeInTheDocument();
    expect(screen.getAllByText("Lo que aprendí").length).toBeGreaterThan(0);
    expect(screen.getByText("¿Algo no te quedó claro? Anótalo para resolverlo.")).toBeInTheDocument();
  });
});

describe("resumen de estudio", () => {
  it("genera el Markdown con el vocabulario y la concordancia del modo", () => {
    const blocker = { id: 1, daily_log_id: null, project_id: null, project_name: null, title: "Regla de la cadena", description: "", status: "pending", opened_at: new Date(Date.now() - 2 * 864e5).toISOString(), resolved_at: null, attempts_count: 0, created_at: "", updated_at: "" };
    const data = {
      logs: [{ id: 1, project_id: 1, project_name: "Cálculo", log_date: "2026-11-02", yesterday: "", today: "- [x] Repasar derivadas", blockers_note: "", learnings: "Regla del producto", created_at: "", updated_at: "" }],
      blockersOpened: [blocker],
      blockersResolved: [],
      blockersPending: [blocker],
      learnings: [],
    } as unknown as PeriodData;
    const range = { period: "daily", start: "2026-11-02", end: "2026-11-02" } as const;

    const md = generateMarkdown(range, data, new Date(2026, 10, 2, 20), vocabularyFor("student"));
    expect(md).toContain("# Resumen de estudio diario");
    expect(md).toContain("de la materia Cálculo");
    expect(md).toContain("**Plan de estudio**");
    expect(md).toContain("## Dudas");
    expect(md).toContain("Queda 1 duda pendiente, abierta hace");
    expect(md).toContain("Se registró un apunte: regla del producto.");

    const dev = generateMarkdown(range, data, new Date(2026, 10, 2, 20));
    expect(dev).toContain("# Reporte diario");
    expect(dev).toContain("del proyecto Cálculo");
    expect(dev).toContain("Queda 1 bloqueo pendiente, abierto hace");
  });
});
