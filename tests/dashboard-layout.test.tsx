import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useSettingsStore } from "@/stores/settings.store";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { createSettingsRepository } from "@/database/repositories/settings.repository";
import { DEFAULT_DASHBOARD, DEFAULT_PANEL_STYLE, movePanelBy, reorderVisible, movePanelTo, normalizeDashboard, updatePanel, type PanelLayout } from "@/types/dashboard";
import { createTestDatabase } from "./helpers/sqlite";
import { resetStores } from "./helpers/stores";

let sqlite: ReturnType<typeof createTestDatabase>;
vi.mock("@/database/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/database/client")>();
  return { ...actual, isTauri: () => true, getDatabase: async () => sqlite.executor };
});

const ids = (panels: PanelLayout[]) => panels.map((p) => p.id);

beforeEach(() => {
  sqlite = createTestDatabase();
  resetStores();
});

afterEach(cleanup);

describe("diseño del Resumen (funciones)", () => {
  it("mueve paneles a la posición de otro y entre los visibles", () => {
    expect(ids(movePanelTo(DEFAULT_DASHBOARD, "recent", "stats"))).toEqual(["recent", "stats", "deadlines", "checkin", "blockers", "week", "quick-links"]);
    expect(ids(movePanelTo(DEFAULT_DASHBOARD, "stats", "week"))).toEqual(["deadlines", "checkin", "blockers", "week", "stats", "recent", "quick-links"]);
    // "recent" es el último visible: no puede bajar (quick-links está oculto).
    expect(movePanelBy(DEFAULT_DASHBOARD, "recent", 1)).toBe(DEFAULT_DASHBOARD);
    expect(ids(movePanelBy(DEFAULT_DASHBOARD, "blockers", -1)).slice(0, 4)).toEqual(["stats", "deadlines", "blockers", "checkin"]);
  });

  it("aplica un orden nuevo a los visibles y deja los ocultos al final", () => {
    const reordered = reorderVisible(DEFAULT_DASHBOARD, ["recent", "stats", "week", "checkin", "blockers"]);
    expect(ids(reordered)).toEqual(["recent", "stats", "week", "checkin", "blockers", "deadlines", "quick-links"]);
    // Ids ocultos o desconocidos en el orden se ignoran.
    expect(ids(reorderVisible(DEFAULT_DASHBOARD, ["quick-links", "week"]))).toEqual(["week", "stats", "deadlines", "checkin", "blockers", "recent", "quick-links"]);
  });

  it("normaliza diseños guardados: sin duplicados y con los paneles nuevos al final, ocultos", () => {
    const style = DEFAULT_PANEL_STYLE;
    const stored: PanelLayout[] = [
      { id: "recent", visible: true, width: "half", style },
      { id: "recent", visible: false, width: "full", style },
      { id: "stats", visible: true, width: "full", style },
    ];
    const normalized = normalizeDashboard(stored);
    expect(ids(normalized)).toEqual(["recent", "stats", "deadlines", "checkin", "blockers", "week", "quick-links"]);
    expect(normalized.slice(2).every((p) => !p.visible)).toBe(true);
    expect(updatePanel(normalized, "week", { visible: true }).find((p) => p.id === "week")?.visible).toBe(true);
  });

  it("ignora diseños guardados inválidos", async () => {
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('dashboard', '[{"id":"no-existe"}]')`);
    expect((await createSettingsRepository(async () => sqlite.executor).load()).dashboard).toEqual(DEFAULT_DASHBOARD);
  });
});

describe("personalizar el Resumen", () => {
  const savedLayout = () =>
    JSON.parse((sqlite.db.prepare("SELECT value FROM settings WHERE key = 'dashboard'").get() as { value: string }).value) as PanelLayout[];

  function renderDashboard() {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
  }

  it("oculta y vuelve a mostrar paneles, guardando el diseño", async () => {
    renderDashboard();
    fireEvent.click(await screen.findByRole("button", { name: "Personalizar" }));

    fireEvent.click(screen.getByRole("button", { name: "Ocultar Actividad reciente" }));
    await waitFor(() => expect(savedLayout().find((p) => p.id === "recent")?.visible).toBe(false));

    fireEvent.click(screen.getByRole("button", { name: "Mostrar Accesos rápidos" }));
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    expect(screen.queryByText("Actividad reciente")).not.toBeInTheDocument();
    expect(screen.getByText("Accesos rápidos")).toBeInTheDocument();
    await waitFor(() => expect(savedLayout().find((p) => p.id === "quick-links")?.visible).toBe(true));
  });

  it("reordena con flechas y cambia el ancho", async () => {
    renderDashboard();
    fireEvent.click(await screen.findByRole("button", { name: "Personalizar" }));

    fireEvent.click(screen.getByRole("button", { name: "Subir Bloqueos pendientes" }));
    fireEvent.click(screen.getByRole("button", { name: "Media anchura: Esta semana" }));

    await waitFor(() => {
      const layout = savedLayout();
      expect(ids(layout).slice(0, 3)).toEqual(["stats", "blockers", "checkin"]);
      expect(layout.find((p) => p.id === "week")?.width).toBe("half");
    });
    expect(screen.getByRole("button", { name: "Subir Cifras generales" })).toBeDisabled();
  });


  it("restablece el diseño por defecto y conserva el guardado al volver", async () => {
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('dashboard', '${JSON.stringify(updatePanel(DEFAULT_DASHBOARD, "checkin", { visible: false }))}')`);
    renderDashboard();

    await screen.findByRole("button", { name: "Personalizar" });
    expect(screen.queryByText("Check-in de hoy")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Personalizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Restablecer" }));
    await waitFor(() => expect(savedLayout()).toEqual(DEFAULT_DASHBOARD));
    expect(within(screen.getByRole("group", { name: "Panel Check-in de hoy" })).getByText("Plan del día")).toBeInTheDocument();
  });

  it("cambia la apariencia, el color y la densidad de un panel", async () => {
    renderDashboard();
    fireEvent.click(await screen.findByRole("button", { name: "Personalizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajustes de Bloqueos pendientes" }));

    const picker = screen.getByRole("dialog", { name: "Ajustes de Bloqueos pendientes" });
    fireEvent.click(within(picker).getByRole("radio", { name: "Suave" }));
    fireEvent.click(within(picker).getByRole("radio", { name: "#AF52DE" }));
    fireEvent.click(within(picker).getByRole("radio", { name: "Compacta" }));

    await waitFor(() =>
      expect(savedLayout().find((p) => p.id === "blockers")?.style).toEqual({ ...DEFAULT_PANEL_STYLE, variant: "soft", color: "#AF52DE", density: "compact" }),
    );
    const card = screen.getByRole("group", { name: "Panel Bloqueos pendientes" }).querySelector("section")!;
    expect(card).toHaveAttribute("data-variant", "soft");
    expect(card).toHaveClass("p-3.5");

    // Escape cierra el selector; "Estilo por defecto" lo devuelve a la tarjeta normal.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ajustes de Bloqueos pendientes" }));
    fireEvent.click(screen.getByRole("button", { name: "Estilo por defecto" }));
    await waitFor(() => expect(savedLayout().find((p) => p.id === "blockers")?.style).toEqual(DEFAULT_PANEL_STYLE));
  });

  it("cambia la disposición del contenido de un panel", async () => {
    renderDashboard();
    fireEvent.click(await screen.findByRole("button", { name: "Personalizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajustes de Check-in de hoy" }));
    const picker = screen.getByRole("dialog", { name: "Ajustes de Check-in de hoy" });

    fireEvent.click(within(picker).getByRole("radio", { name: "Cuadros" }));
    await waitFor(() => expect(savedLayout().find((p) => p.id === "checkin")?.style.layout).toBe("tiles"));
    const panel = screen.getByRole("group", { name: "Panel Check-in de hoy" });
    expect(panel.querySelector('[data-layout="tiles"]')).not.toBeNull();

    fireEvent.click(within(picker).getByRole("radio", { name: "Botones" }));
    await waitFor(() => expect(panel.querySelector('[data-layout="buttons"]')).not.toBeNull());

    // Volver a la predeterminada guarda null (así un cambio futuro de valor por defecto se aplica).
    fireEvent.click(within(picker).getByRole("radio", { name: "Lista" }));
    await waitFor(() => expect(savedLayout().find((p) => p.id === "checkin")?.style.layout).toBeNull());
  });

  it("elige y ordena los elementos de Accesos rápidos", async () => {
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('dashboard', '${JSON.stringify(updatePanel(DEFAULT_DASHBOARD, "quick-links", { visible: true }))}')`);
    renderDashboard();
    fireEvent.click(await screen.findByRole("button", { name: "Personalizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajustes de Accesos rápidos" }));
    const picker = screen.getByRole("dialog", { name: "Ajustes de Accesos rápidos" });

    // Cuadros es la disposición por defecto de este panel.
    expect(within(picker).getByRole("radio", { name: "Cuadros" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(within(picker).getByRole("checkbox", { name: "Nuevo proyecto" }));
    fireEvent.click(within(picker).getByRole("checkbox", { name: "Captura rápida" }));
    fireEvent.click(within(picker).getByRole("button", { name: "Subir Nuevo proyecto" }));
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    await waitFor(() =>
      expect(savedLayout().find((p) => p.id === "quick-links")?.style.items).toEqual(["new-log", "blocker", "project", "learning"]),
    );
    const tiles = screen.getByRole("list", { name: "Accesos rápidos" });
    expect(tiles).toHaveAttribute("data-layout", "tiles");
    const links = within(tiles).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Registro de hoy", "Registrar bloqueo", "Nuevo proyecto", "Guardar aprendizaje"]);
    expect(links[2]).toHaveAttribute("href", "/projects/nuevo");
  });

  it("puede volver a mostrar los accesos rápidos como lista", async () => {
    const styled = updatePanel(DEFAULT_DASHBOARD, "quick-links", { visible: true, style: { ...DEFAULT_PANEL_STYLE, layout: "list" } });
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('dashboard', '${JSON.stringify(styled)}')`);
    renderDashboard();
    expect(await screen.findByRole("list", { name: "Accesos rápidos" })).toHaveAttribute("data-layout", "list");
  });

  it("muestra las cifras como lista con solo las elegidas", async () => {
    const styled = updatePanel(DEFAULT_DASHBOARD, "stats", { style: { ...DEFAULT_PANEL_STYLE, layout: "list", items: ["learnings", "logs"] } });
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('dashboard', '${JSON.stringify(styled)}')`);
    renderDashboard();

    const list = await screen.findByRole("list", { name: "Cifras generales" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent?.replace(/\d+$/, ""))).toEqual(["Aprendizajes", "Registros semanales"]);
  });

  it("aplica los estilos guardados fuera del modo personalizar", async () => {
    const styled = updatePanel(DEFAULT_DASHBOARD, "checkin", { style: { ...DEFAULT_PANEL_STYLE, variant: "outline", color: "#34C759" } });
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('dashboard', '${JSON.stringify(styled)}')`);
    renderDashboard();

    const card = (await screen.findByText("Check-in de hoy")).closest("section")!;
    expect(card).toHaveAttribute("data-variant", "outline");
    // Las tarjetas de otros módulos no se ven afectadas.
    expect((await screen.findByText("Bloqueos pendientes")).closest("section")).toHaveAttribute("data-variant", "card");
  });

  it("acepta diseños guardados antes de existir los estilos", async () => {
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('dashboard', '[{"id":"recent","visible":true,"width":"full"}]')`);
    const layout = (await createSettingsRepository(async () => sqlite.executor).load()).dashboard;
    expect(layout[0]).toEqual({ id: "recent", visible: true, width: "full", style: DEFAULT_PANEL_STYLE });
  });

  it("vuelve a cargar los ajustes si el store se reinicia con el Resumen abierto", async () => {
    renderDashboard();
    await screen.findByRole("button", { name: "Personalizar" });

    // Lo que hace una recarga en caliente del store: vuelve a "idle" sin desmontar la página.
    act(() => useSettingsStore.setState({ status: "idle" }));

    expect(await screen.findByText("Check-in de hoy")).toBeInTheDocument();
    expect(useSettingsStore.getState().status).toBe("ready");
  });

  it("muestra el diseño por defecto si no se pueden leer los ajustes", async () => {
    sqlite.db.exec("DROP TABLE settings");
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderDashboard();

    expect(await screen.findByText("Check-in de hoy")).toBeInTheDocument();
    expect(useSettingsStore.getState().status).toBe("error");
    vi.mocked(console.error).mockRestore();
  });

  it("avisa si se ocultan todos los paneles", async () => {
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('dashboard', '${JSON.stringify(DEFAULT_DASHBOARD.map((p) => ({ ...p, visible: false })))}')`);
    renderDashboard();
    expect(await screen.findByText(/Ocultaste todos los paneles/)).toBeInTheDocument();
  });
});
