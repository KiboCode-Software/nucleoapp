import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { DEFAULT_SETTINGS } from "@/database/repositories/settings.repository";
import { decryptJson, encryptJson } from "@/services/crypto";
import { useSettingsStore } from "@/stores/settings.store";
import { toISODate } from "@/utils/date";
import { createTestDatabase } from "./helpers/sqlite";
import { resetStores } from "./helpers/stores";

let sqlite: ReturnType<typeof createTestDatabase>;
vi.mock("@/database/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/database/client")>();
  return { ...actual, isTauri: () => true, getDatabase: async () => sqlite.executor };
});

const mocks = vi.hoisted(() => ({
  status: vi.fn(async () => ({ running: true, models: ["llama3.2:3b", "qwen2.5:7b"] })),
  summarize: vi.fn(async () => "Se trabajó en el módulo de reportes con ayuda de la IA."),
  exportFile: vi.fn(async (name: string) => `C:\\exports\\${name}.json`),
  pickImportFile: vi.fn<() => Promise<unknown>>(),
  backupRun: vi.fn(async () => "C:\\backups\\nucleo-previo.db"),
}));

vi.mock("@/services/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/ai")>()),
  getOllamaStatus: mocks.status,
  summarizeWithLocalAi: mocks.summarize,
}));
vi.mock("@/services/export", () => ({ exportFile: mocks.exportFile }));
vi.mock("@/services/data-export", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/data-export")>()),
  pickImportFile: mocks.pickImportFile,
}));
vi.mock("@/services/backup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/backup")>();
  return { ...actual, backupService: { ...actual.backupService, run: mocks.backupRun } };
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const row = <T,>(sql: string) => sqlite.db.prepare(sql).get() as T;
const today = toISODate(new Date());

beforeEach(() => {
  sqlite = createTestDatabase();
  resetStores();
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, status: "idle" });
  Object.values(mocks).forEach((fn) => fn.mockClear());
});

afterEach(cleanup);

describe("IA local en Ajustes", () => {
  it("detecta Ollama, elige el primer modelo y permite activarla", async () => {
    renderAt("/settings");

    const select = await screen.findByLabelText("Modelo de Ollama");
    await waitFor(() => expect(select).toHaveValue("llama3.2:3b"));
    fireEvent.click(screen.getByRole("switch", { name: "Usar IA local en los reportes" }));
    fireEvent.change(select, { target: { value: "qwen2.5:7b" } });

    await waitFor(() =>
      expect(JSON.parse(row<{ value: string }>("SELECT value FROM settings WHERE key = 'ai'").value)).toEqual({
        enabled: true,
        model: "qwen2.5:7b",
      }),
    );
  });

  it("explica cómo instalar Ollama si no está en marcha", async () => {
    mocks.status.mockResolvedValueOnce({ running: false, models: [] });
    renderAt("/settings");
    expect(await screen.findByText("No se detectó Ollama en este equipo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar Ollama" })).toBeInTheDocument();
  });
});

describe("resumen con IA en Reportes", () => {
  it("no muestra el botón si la IA está desactivada", async () => {
    renderAt("/reports");
    await screen.findByRole("heading", { level: 1, name: "Reporte diario" });
    expect(screen.queryByRole("button", { name: /Resumen con IA/ })).not.toBeInTheDocument();
  });

  it("reemplaza el resumen y guarda el reporte como generado con IA local", async () => {
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('ai', '{"enabled":true,"model":"llama3.2:3b"}')`);
    sqlite.db.exec(`INSERT INTO daily_logs (log_date, today) VALUES ('${today}', 'Módulo de reportes')`);
    renderAt("/reports");

    fireEvent.click(await screen.findByRole("button", { name: /Resumen con IA/ }));

    expect(await screen.findByText("Se trabajó en el módulo de reportes con ayuda de la IA.")).toBeInTheDocument();
    expect(mocks.summarize).toHaveBeenCalledWith("llama3.2:3b", expect.stringContaining("## Resumen"), "dev");
    expect(screen.queryByText(/La jornada se centró en/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(row("SELECT generator FROM reports")).toEqual({ generator: "local_ai" }));
  });

  it("muestra el error si Ollama falla", async () => {
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('ai', '{"enabled":true,"model":"llama3.2:3b"}')`);
    mocks.summarize.mockRejectedValueOnce(new Error("Ollama no respondió: connection refused"));
    renderAt("/reports");

    fireEvent.click(await screen.findByRole("button", { name: /Resumen con IA/ }));
    expect(await screen.findByText("Ollama no respondió: connection refused")).toBeInTheDocument();
  });
});

describe("exportación cifrada e importación", () => {
  it("exporta todos los datos cifrados con contraseña", async () => {
    sqlite.db.exec("INSERT INTO projects (name) VALUES ('Secreto')");
    renderAt("/settings");

    fireEvent.click(await screen.findByRole("switch", { name: "Cifrar con contraseña" }));
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "mi-clave-larga" } });
    fireEvent.change(screen.getByLabelText("Repetir contraseña"), { target: { value: "otra" } });
    expect(screen.getByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar todos los datos (JSON)" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Repetir contraseña"), { target: { value: "mi-clave-larga" } });
    fireEvent.click(screen.getByRole("button", { name: "Exportar todos los datos (JSON)" }));

    await waitFor(() => expect(mocks.exportFile).toHaveBeenCalled(), { timeout: 10_000 });
    const [name, contents] = mocks.exportFile.mock.calls[0] as unknown as [string, string];
    expect(name).toBe(`nucleo-datos-${today}-cifrado`);
    expect(contents).not.toContain("Secreto");
    const decrypted = (await decryptJson(JSON.parse(contents), "mi-clave-larga")) as { tables: { projects: Array<{ name: string }> } };
    expect(decrypted.tables.projects[0].name).toBe("Secreto");
  });

  it("importa una exportación cifrada tras pedir la contraseña y confirmar", async () => {
    sqlite.db.exec("INSERT INTO projects (name) VALUES ('Actual')");
    const exported = {
      app: "Núcleo",
      format_version: 1,
      tables: {
        projects: [{ id: 5, name: "Importado" }],
        daily_logs: [{ id: 1, project_id: 5, log_date: "2026-10-01", today: "Algo" }],
      },
    };
    mocks.pickImportFile.mockResolvedValueOnce(await encryptJson(exported, "clave-de-prueba", 1_000));
    renderAt("/settings");

    fireEvent.click(await screen.findByRole("button", { name: /Elegir archivo/ }));
    fireEvent.change(await screen.findByLabelText("Contraseña del archivo cifrado"), { target: { value: "incorrecta" } });
    fireEvent.click(screen.getByRole("button", { name: "Descifrar" }));
    expect(await screen.findByText("La contraseña no es correcta o el archivo está dañado.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Contraseña del archivo cifrado"), { target: { value: "clave-de-prueba" } });
    fireEvent.click(screen.getByRole("button", { name: "Descifrar" }));
    expect(await screen.findByText("1 proyecto · 1 registro")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reemplazar mis datos" }));
    expect(await screen.findByText(/Datos importados. Copia previa en: C:\\backups/)).toBeInTheDocument();
    expect(mocks.backupRun).toHaveBeenCalled();
    expect(sqlite.db.prepare("SELECT id, name FROM projects").all()).toEqual([{ id: 5, name: "Importado" }]);
  });

  it("rechaza un archivo que no es una exportación", async () => {
    mocks.pickImportFile.mockResolvedValueOnce({ cualquier: "cosa" });
    renderAt("/settings");
    fireEvent.click(await screen.findByRole("button", { name: /Elegir archivo/ }));
    expect(await screen.findByText(/no es una exportación válida/)).toBeInTheDocument();
    expect(mocks.backupRun).not.toHaveBeenCalled();
  });
});
