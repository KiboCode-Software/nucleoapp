import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { MarkdownView, parseMarkdown } from "@/components/shared/MarkdownView";
import { exportFile } from "@/services/export";
import { toISODate } from "@/utils/date";
import { createTestDatabase } from "./helpers/sqlite";
import { resetStores } from "./helpers/stores";

let sqlite: ReturnType<typeof createTestDatabase>;
vi.mock("@/database/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/database/client")>();
  return { ...actual, isTauri: () => true, getDatabase: async () => sqlite.executor };
});
vi.mock("@/services/export", () => ({ exportFile: vi.fn(async (name: string) => `C:\\exports\\${name}`) }));

const exportMock = vi.mocked(exportFile);
const today = toISODate(new Date());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sqlite = createTestDatabase();
  resetStores();
  exportMock.mockClear();
});

afterEach(cleanup);

describe("módulo Reportes", () => {
  it("genera la vista previa del reporte diario a partir de los registros de hoy", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (log_date, today) VALUES ('${today}', 'Diseñar la exportación')`);
    renderAt("/reports");

    expect(await screen.findByRole("heading", { level: 1, name: "Reporte diario" })).toBeInTheDocument();
    expect(screen.getByText(/se centró en diseñar la exportación/)).toBeInTheDocument();
  });

  it("cambia a reporte semanal", async () => {
    renderAt("/reports");
    await screen.findByRole("heading", { level: 1, name: "Reporte diario" });

    fireEvent.click(screen.getByRole("radio", { name: "Semanal" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Reporte semanal" })).toBeInTheDocument();
    expect(screen.getByText("No hay registros diarios en esta semana.")).toBeInTheDocument();
  });

  it("navega al periodo anterior y no permite ir al futuro", async () => {
    renderAt("/reports");
    await screen.findByRole("heading", { level: 1, name: "Reporte diario" });

    expect(screen.getByRole("button", { name: "Periodo siguiente" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Periodo anterior" }));
    expect(await screen.findByRole("button", { name: "Ir a hoy" })).toBeInTheDocument();
  });

  it("exporta el reporte en Markdown y en JSON", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (log_date, today) VALUES ('${today}', 'Probar exportación')`);
    renderAt("/reports");
    await screen.findByText(/probar exportación/);

    fireEvent.click(screen.getByRole("button", { name: "Markdown" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    const [name, markdown, format] = exportMock.mock.calls[0];
    expect(name).toBe(`reporte-diario-${today}`);
    expect(format).toBe("markdown");
    expect(markdown).toContain("- Probar exportación");
    expect(await screen.findByText(`Exportado: C:\\exports\\reporte-diario-${today}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(2));
    const json = JSON.parse(exportMock.mock.calls[1][1]);
    expect(json.report).toMatchObject({ type: "daily", period_start: today });
    expect(json.daily_logs[0].today).toBe("Probar exportación");
  });

  it("exporta a CSV y abre la impresión para guardar como PDF", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (log_date, today) VALUES ('${today}', 'Tabla de actividad')`);
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderAt("/reports");
    await screen.findByText(/tabla de actividad/);

    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    const [name, csv, format] = exportMock.mock.calls[0];
    expect([name, format]).toEqual([`reporte-diario-${today}`, "csv"]);
    expect(csv).toContain(`registro,${today},,Tabla de actividad,Plan del día: Tabla de actividad,`);

    fireEvent.click(screen.getByRole("radio", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    // Imprime la vista previa, no el editor.
    expect(screen.queryByLabelText("Contenido del reporte")).not.toBeInTheDocument();
    print.mockRestore();
  });

  it("muestra las estadísticas del periodo", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (log_date, today) VALUES ('${today}', 'Uno
Dos')`);
    renderAt("/reports");

    const panel = (await screen.findByText("Estadísticas del periodo")).closest("section")!;
    expect(within(panel).getByText("Tareas planificadas").previousSibling).toHaveTextContent("2");
  });

  it("permite editar el texto, guardarlo y verlo en Guardados", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (id, log_date, today) VALUES (9, '${today}', 'Escribir el reporte')`);
    renderAt("/reports");
    await screen.findByText(/escribir el reporte/);

    fireEvent.click(screen.getByRole("radio", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Contenido del reporte"), { target: { value: "# Mi reporte\n\nTexto propio." } });
    expect(screen.getByRole("button", { name: "Restaurar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    const savedList = await screen.findByRole("list", { name: "Reportes guardados" });
    expect(within(savedList).getByText("Diario")).toBeInTheDocument();
    expect(await screen.findByText("Texto propio.")).toBeInTheDocument();
    expect(sqlite.db.prepare("SELECT content FROM reports").get()).toEqual({ content: "# Mi reporte\n\nTexto propio." });
    expect(sqlite.db.prepare("SELECT daily_log_id FROM report_daily_logs").all()).toEqual([{ daily_log_id: 9 }]);
  });

  it("elimina un reporte guardado", async () => {
    sqlite.db.exec(
      "INSERT INTO reports (id, period, period_start, period_end, content) VALUES (3, 'weekly', '2026-10-26', '2026-11-01', '# Semana')",
    );
    renderAt("/reports/3");

    fireEvent.click(await screen.findByRole("button", { name: "Eliminar reporte" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(sqlite.db.prepare("SELECT COUNT(*) AS n FROM reports").get()).toEqual({ n: 0 }));
  });

  it("exporta una copia completa de los datos en JSON", async () => {
    sqlite.db.exec("INSERT INTO projects (name) VALUES ('Prácticas')");
    renderAt("/reports");

    fireEvent.click(await screen.findByRole("button", { name: "Exportar todos los datos" }));

    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    const [name, contents, format] = exportMock.mock.calls[0];
    expect(name).toBe(`nucleo-datos-${today}`);
    expect(format).toBe("json");
    expect(JSON.parse(contents).tables.projects[0].name).toBe("Prácticas");
  });
});

describe("MarkdownView", () => {
  it("interpreta el subconjunto de Markdown de los reportes", () => {
    expect(parseMarkdown("# T\n\n**fecha**\n\n## S\n\n- a\n- b\n\n---\n\nlínea 1\nlínea 2")).toEqual([
      { type: "heading", level: 1, text: "T" },
      { type: "paragraph", text: "**fecha**" },
      { type: "heading", level: 2, text: "S" },
      { type: "list", items: ["a", "b"] },
      { type: "rule" },
      { type: "paragraph", text: "línea 1 línea 2" },
    ]);
  });

  it("muestra el HTML del usuario como texto, sin interpretarlo", () => {
    const html = '<img src=x onerror="alert(1)">';
    const { container } = render(<MarkdownView source={`- ${html}`} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(html)).toBeInTheDocument();
  });
});
