import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { AppRoutes } from "@/App";
import { MODULES } from "@/modules/registry";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

describe("estructura de la app", () => {
  it("muestra los módulos del modo desarrollo en la barra lateral", () => {
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: "Módulos" });
    for (const module of MODULES.filter((m) => !m.modes || m.modes.includes("dev"))) {
      expect(nav).toHaveTextContent(module.label);
    }
    expect(nav).not.toHaveTextContent("Entregas");
  });

  it("abre el resumen por defecto con el check-in del día", () => {
    renderAt("/");
    expect(screen.getByText("Check-in de hoy")).toBeInTheDocument();
    expect(within(screen.getByText("Check-in de hoy").closest("section")!).getByText("Plan del día")).toBeInTheDocument();
  });

  it("indica que fuera de Tauri no hay SQLite", () => {
    renderAt("/");
    expect(screen.getByText("Vista previa sin SQLite")).toBeInTheDocument();
  });

  it("navega a un módulo y marca su enlace como activo", async () => {
    renderAt("/blockers");
    // Bloqueos se carga bajo demanda.
    expect(await screen.findByRole("heading", { level: 1, name: "Bloqueos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bloqueos" })).toHaveAttribute("aria-current", "page");
  });

  it("redirige rutas desconocidas al resumen", () => {
    renderAt("/no-existe");
    expect(screen.getByText("Check-in de hoy")).toBeInTheDocument();
  });

  it("alterna entre modo claro y oscuro", () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: "Activar modo oscuro" }));
    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(screen.getByRole("button", { name: "Activar modo claro" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
