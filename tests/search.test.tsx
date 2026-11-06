import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { createSearchRepository, likePattern, snippetAround } from "@/database/repositories/search.repository";
import { useCommandPalette } from "@/components/shell/CommandPalette";
import { createTestDatabase } from "./helpers/sqlite";
import { resetStores } from "./helpers/stores";

let sqlite: ReturnType<typeof createTestDatabase>;
vi.mock("@/database/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/database/client")>();
  return { ...actual, isTauri: () => true, getDatabase: async () => sqlite.executor };
});

beforeEach(() => {
  sqlite = createTestDatabase();
  resetStores();
  useCommandPalette.setState({ open: false });
});

afterEach(cleanup);

describe("búsqueda en la base de datos", () => {
  it("encuentra en todos los módulos y escapa los comodines", async () => {
    sqlite.db.exec(`
      INSERT INTO projects (id, name) VALUES (1, 'API de pagos');
      INSERT INTO blockers (id, title, description) VALUES (1, 'Webhook de pagos falla', 'Firma inválida');
      INSERT INTO learnings (id, kind, title, content) VALUES (1, 'concept', 'Idempotencia', 'Clave para pagos repetidos');
      INSERT INTO daily_logs (id, log_date, today) VALUES (1, '2026-10-30', '- [x] Revisar pagos con tarjeta');
      INSERT INTO deadlines (id, title, due_at) VALUES (1, 'Informe de pagos', '2026-11-10T12:00');
      INSERT INTO blockers (id, title) VALUES (2, '100% de CPU');`);
    const repo = createSearchRepository(async () => sqlite.executor);

    const hits = await repo.search("pagos", { deadlines: true });
    expect(hits.map((h) => [h.kind, h.to])).toEqual([
      ["deadline", "/deadlines/1"],
      ["blocker", "/blockers/1"],
      ["learning", "/learning/1"],
      ["project", "/projects/1"],
      ["daily-log", "/daily-log/dia/2026-10-30"],
    ]);
    expect(hits.find((h) => h.kind === "daily-log")?.snippet).toBe("Revisar pagos con tarjeta");
    expect((await repo.search("pagos", { deadlines: false })).some((h) => h.kind === "deadline")).toBe(false);
    expect((await repo.search("0%", { deadlines: false })).map((h) => h.title)).toEqual(["100% de CPU"]);
    expect(await repo.search("p", { deadlines: true })).toEqual([]);
  });

  it("recorta el fragmento alrededor de la coincidencia", () => {
    expect(likePattern(" 50%_x ")).toBe("%50\\%\\_x%");
    const text = "a".repeat(100) + " aquí está la palabra clave " + "b".repeat(100);
    const snippet = snippetAround(text, "clave", 40);
    expect(snippet).toContain("clave");
    expect(snippet.startsWith("…") && snippet.endsWith("…")).toBe(true);
  });
});

describe("búsqueda global (Ctrl + K)", () => {
  const renderApp = () =>
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

  it("se abre con Ctrl + K, busca y abre el resultado con Enter", async () => {
    sqlite.db.exec("INSERT INTO blockers (id, title) VALUES (7, 'Migración rota en CI')");
    renderApp();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const dialog = await screen.findByRole("dialog", { name: "Buscar" });
    expect(within(dialog).getByText("Acciones")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "migracion" } });
    const option = await within(dialog).findByRole("option", { name: /Migración rota en CI/ });
    // Las acciones no coinciden: el primer resultado ya es el bloqueo.
    expect(option).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(dialog, { key: "Enter" });

    expect(await screen.findByRole("dialog", { name: "Migración rota en CI" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Buscar" })).not.toBeInTheDocument();
  });

  it("filtra acciones sin tildes y navega con las flechas", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Buscar/ }));
    const dialog = await screen.findByRole("dialog", { name: "Buscar" });
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "captura rapida" } });
    await waitFor(() => expect(within(dialog).getAllByRole("option").length).toBeGreaterThan(0));
    expect(within(dialog).getAllByRole("option")[0]).toHaveTextContent("Captura rápida");

    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "" } });
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    expect(within(dialog).getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Buscar" })).not.toBeInTheDocument());
  });
});
