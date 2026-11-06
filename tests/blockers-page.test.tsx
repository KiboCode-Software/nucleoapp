import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
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

/** Columna del tablero por estado: "Pendiente (2)", "Resuelto (0)"… */
const column = (label: string) => screen.getByRole("region", { name: new RegExp(`^${label} \\(`) });
const sheet = () => screen.getByRole("dialog");
const row = <T,>(sql: string) => sqlite.db.prepare(sql).get() as T;

beforeEach(() => {
  sqlite = createTestDatabase();
  resetStores();
});

afterEach(cleanup);

describe("módulo Bloqueos", () => {
  it("muestra un tablero con una columna por estado", async () => {
    sqlite.db.exec(`INSERT INTO blockers (id, title, status, resolved_at) VALUES
      (1, 'Pendiente A', 'pending', NULL),
      (2, 'Escalado B', 'escalated', NULL),
      (3, 'Resuelto C', 'resolved', '2026-10-20T00:00:00.000Z')`);
    renderAt("/blockers");

    expect(within(await screen.findByRole("region", { name: "Pendiente (1)" })).getByText("Pendiente A")).toBeInTheDocument();
    expect(within(column("Escalado")).getByText("Escalado B")).toBeInTheDocument();
    expect(within(column("Resuelto")).getByText("Resuelto C")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("busca en el tablero", async () => {
    sqlite.db.exec("INSERT INTO blockers (id, title) VALUES (1, 'CORS en producción'), (2, 'Token JWT')");
    renderAt("/blockers");
    fireEvent.change(await screen.findByPlaceholderText("Buscar"), { target: { value: "jwt" } });
    expect(within(column("Pendiente")).getByText("Token JWT")).toBeInTheDocument();
    expect(screen.queryByText("CORS en producción")).not.toBeInTheDocument();
  });

  it("registra un bloqueo nuevo en una hoja y abre su detalle", async () => {
    renderAt("/blockers");

    fireEvent.click(await screen.findByRole("button", { name: "Nuevo bloqueo" }));
    fireEvent.change(await screen.findByLabelText("Problema"), { target: { value: "CORS bloquea la API" } });
    fireEvent.change(screen.getByLabelText("Contexto"), { target: { value: "Solo en producción" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar bloqueo" }));

    expect(await screen.findByRole("dialog", { name: "CORS bloquea la API" })).toBeInTheDocument();
    expect(within(sheet()).getByText("Pendiente")).toBeInTheDocument();
    expect(within(column("Pendiente")).getByText("CORS bloquea la API")).toBeInTheDocument();
    expect(row("SELECT title, description, status FROM blockers")).toEqual({
      title: "CORS bloquea la API",
      description: "Solo en producción",
      status: "pending",
    });
  });

  it("exige un título", async () => {
    renderAt("/blockers/nuevo");
    fireEvent.change(await screen.findByLabelText("Contexto"), { target: { value: "algo" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar bloqueo" }));
    expect(await screen.findByText("El bloqueo necesita un título.")).toBeInTheDocument();
  });

  it("registra intentos de solución y actualiza el contador", async () => {
    sqlite.db.exec("INSERT INTO blockers (id, title) VALUES (1, 'Migración falla')");
    renderAt("/blockers/1");

    fireEvent.change(await screen.findByLabelText("Nuevo intento de solución"), {
      target: { value: "Borrar la base local" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));

    expect(await screen.findByText("Borrar la base local")).toBeInTheDocument();
    // El contador de la tarjeta del tablero se actualiza.
    await waitFor(() => expect(within(column("Pendiente")).getByTitle("Intentos de solución")).toHaveTextContent("1"));
    expect(row("SELECT COUNT(*) AS n FROM blocker_attempts WHERE blocker_id = 1")).toEqual({ n: 1 });
  });

  it("marca un bloqueo como resuelto y lo mueve a su columna", async () => {
    sqlite.db.exec("INSERT INTO blockers (id, title) VALUES (1, 'Build roto')");
    renderAt("/blockers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Marcar como resuelto" }));

    expect(await screen.findByRole("button", { name: "Reabrir" })).toBeInTheDocument();
    expect(within(sheet()).getByText(/^Resuelto en/)).toBeInTheDocument();
    expect(row<{ status: string; resolved: number }>("SELECT status, resolved_at IS NOT NULL AS resolved FROM blockers")).toEqual({
      status: "resolved",
      resolved: 1,
    });

    expect(within(column("Resuelto")).getByText("Build roto")).toBeInTheDocument();
    expect(column("Pendiente")).not.toHaveTextContent("Build roto");
  });

  it("cierra la hoja con Esc y vuelve al tablero", async () => {
    sqlite.db.exec("INSERT INTO blockers (id, title) VALUES (1, 'Build roto')");
    renderAt("/blockers/1");
    expect(await screen.findByRole("dialog", { name: "Build roto" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(column("Pendiente")).getByRole("link", { name: /Build roto/ })).toHaveAttribute("href", "/blockers/1");
  });

  it("escala un bloqueo pendiente", async () => {
    sqlite.db.exec("INSERT INTO blockers (id, title) VALUES (1, 'Permisos de AWS')");
    renderAt("/blockers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Escalar" }));

    await waitFor(() => expect(within(column("Escalado")).getByText("Permisos de AWS")).toBeInTheDocument());
    expect(row("SELECT status FROM blockers")).toEqual({ status: "escalated" });
  });

  it("elimina un bloqueo tras confirmar", async () => {
    sqlite.db.exec("INSERT INTO blockers (id, title) VALUES (1, 'Duplicado')");
    renderAt("/blockers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Eliminar bloqueo" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(row("SELECT COUNT(*) AS n FROM blockers")).toEqual({ n: 0 }));
  });

  it("crea un bloqueo desde el registro diario y los enlaza", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (id, log_date, blockers_note)
      VALUES (4, '2026-10-20', 'El emulador no arranca
Probé con otra imagen de Android')`);
    renderAt("/daily-log/4");

    fireEvent.click(await screen.findByRole("button", { name: "Registrar en Bloqueos" }));

    expect(await screen.findByRole("link", { name: /Ver registro diario/ })).toHaveAttribute("href", "/daily-log/4");
    expect(row("SELECT title, description, daily_log_id FROM blockers")).toEqual({
      title: "El emulador no arranca",
      description: "Probé con otra imagen de Android",
      daily_log_id: 4,
    });

    fireEvent.click(screen.getByRole("link", { name: /Ver registro diario/ }));
    expect(await screen.findByRole("link", { name: "Ver en Bloqueos" })).toBeInTheDocument();
  });

  it("muestra los bloqueos abiertos en el resumen", async () => {
    sqlite.db.exec(`INSERT INTO blockers (id, title, status, resolved_at) VALUES
      (1, 'Abierto importante', 'pending', NULL),
      (2, 'Ya resuelto', 'resolved', '2026-10-20T00:00:00.000Z')`);
    renderAt("/");

    expect(await screen.findByRole("link", { name: /Abierto importante/ })).toHaveAttribute("href", "/blockers/1");
    expect(screen.queryByText("Ya resuelto")).not.toBeInTheDocument();
  });
});
