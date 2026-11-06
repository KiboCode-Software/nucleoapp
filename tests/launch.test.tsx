import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { createTestDatabase } from "./helpers/sqlite";
import { useProfileStore } from "@/stores/profile.store";
import { resetStores } from "./helpers/stores";

let sqlite: ReturnType<typeof createTestDatabase>;
vi.mock("@/database/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/database/client")>();
  return { ...actual, isTauri: () => true, getDatabase: async () => sqlite.executor };
});
const notify = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/services/reminder", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/reminder")>()),
  notify,
}));

const row = <T,>(sql: string) => sqlite.db.prepare(sql).get() as T;
const setting = (key: string) => (sqlite.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value;

beforeEach(() => {
  sqlite = createTestDatabase();
  resetStores();
  notify.mockClear();
  window.location.hash = "#/";
});

afterEach(cleanup);

describe("arranque de la app", () => {
  it("muestra el splash con el indicador de iOS mientras carga", () => {
    render(<App />);
    expect(screen.getByRole("status", { name: "Cargando Núcleo" })).toBeInTheDocument();
  });

  it("recorre el onboarding, aplica las elecciones y no vuelve a mostrarlo", async () => {
    render(<App />);
    const dialog = await screen.findByRole("dialog", { name: "Bienvenida a Núcleo" });
    expect(dialog).toHaveTextContent("Te damos la bienvenida");

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Crea tu perfil")).toBeInTheDocument();
    // Sin nombre ni modo no se puede seguir, ni saltar el paso.
    expect(screen.getByRole("button", { name: "Crear perfil" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Saltar" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nombre del perfil"), { target: { value: "Trabajo" } });
    expect(screen.getByRole("button", { name: "Crear perfil" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Desarrollo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Crear perfil" }));
    expect(await screen.findByText("Tu día, en tres momentos")).toBeInTheDocument();
    expect(useProfileStore.getState().active).toMatchObject({ name: "Trabajo", mode: "dev" });
    expect(screen.getByText("Por la mañana · Plan del día")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Tus datos son tuyos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    fireEvent.change(await screen.findByPlaceholderText(/Prácticas en Acme/), { target: { value: "Prácticas en Acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Todo listo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Saltar" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empezar mi día" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Bienvenida a Núcleo" })).not.toBeInTheDocument());
    expect(setting("onboarding_completed")).toBe("true");
    expect(row("SELECT name FROM projects")).toEqual({ name: "Prácticas en Acme" });
    expect(notify).toHaveBeenCalled();
    expect(JSON.parse(setting("reminder")!)).toMatchObject({ enabled: true });
    expect(window.location.hash).toBe("#/daily-log");
  });

  it("se puede volver atrás y, con el perfil creado, saltar el resto", async () => {
    render(<App />);
    await screen.findByRole("dialog", { name: "Bienvenida a Núcleo" });
    expect(screen.queryByRole("button", { name: "Saltar" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(await screen.findByRole("button", { name: /Atrás/ }));
    expect(await screen.findByText(/Te damos la bienvenida/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(await screen.findByLabelText("Nombre del perfil"), { target: { value: "Uni" } });
    fireEvent.click(screen.getByRole("radio", { name: /Estudio/ }));
    fireEvent.click(screen.getByRole("button", { name: "Crear perfil" }));
    fireEvent.click(await screen.findByRole("button", { name: "Saltar" }));
    await waitFor(() => expect(setting("onboarding_completed")).toBe("true"));
    expect(row("SELECT COUNT(*) AS n FROM projects")).toEqual({ n: 0 });
    expect(notify).not.toHaveBeenCalled();
  });

  it("los puntos no pasan del perfil hasta crearlo; después llevan a cada paso", async () => {
    render(<App />);
    await screen.findByRole("dialog", { name: "Bienvenida a Núcleo" });
    expect(screen.getByRole("tab", { name: "Paso 4 de 6" })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "Paso 2 de 6" }));
    fireEvent.change(await screen.findByLabelText("Nombre del perfil"), { target: { value: "Trabajo" } });
    fireEvent.click(screen.getByRole("radio", { name: /Desarrollo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Crear perfil" }));
    await screen.findByText("Tu día, en tres momentos");
    fireEvent.click(screen.getByRole("tab", { name: "Paso 4 de 6" }));
    expect(await screen.findByText("Tus datos son tuyos")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Paso 4 de 6" })).toHaveAttribute("aria-selected", "true");
  });

  it("elegir el modo estudiante cambia el vocabulario al momento", async () => {
    render(<App />);
    await screen.findByRole("dialog", { name: "Bienvenida a Núcleo" });
    fireEvent.click(screen.getByRole("tab", { name: "Paso 2 de 6" }));
    fireEvent.click(await screen.findByRole("radio", { name: /Estudio/ }));
    expect(screen.getByRole("radio", { name: /Estudio/ })).toHaveAttribute("aria-checked", "true");
    expect(useProfileStore.getState().active.mode).toBe("student");
    fireEvent.change(screen.getByLabelText("Nombre del perfil"), { target: { value: "Universidad" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear perfil" }));
    expect(await screen.findByText("Por la mañana · Plan de estudio")).toBeInTheDocument();
    expect(screen.getByText("Durante el día · Dudas")).toBeInTheDocument();
    expect(useProfileStore.getState().active).toMatchObject({ mode: "student", name: "Universidad" });
  });

  it("un perfil creado desde Ajustes llega con su nombre y modo propuestos", async () => {
    const profile = { id: "p1", name: "Sena", mode: "student" as const, db: "perfil-p1.db" };
    useProfileStore.setState({ profiles: [profile], active: profile, status: "ready" });
    render(<App />);
    await screen.findByRole("dialog", { name: "Bienvenida a Núcleo" });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByLabelText("Nombre del perfil")).toHaveValue("Sena");
    expect(screen.getByRole("radio", { name: /Estudio/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Crear perfil" })).toBeEnabled();
  });

  it("explica qué falta para crear el perfil", async () => {
    render(<App />);
    await screen.findByRole("dialog", { name: "Bienvenida a Núcleo" });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Escribe un nombre para tu perfil para continuar.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nombre del perfil"), { target: { value: "Trabajo" } });
    expect(screen.getByText("Elige Desarrollo o Estudio para continuar.")).toBeInTheDocument();
  });

  it("no muestra el onboarding si ya se completó", async () => {
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('onboarding_completed', 'true')`);
    render(<App />);
    await waitFor(() => expect(screen.queryByRole("status", { name: "Cargando Núcleo" })).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog", { name: "Bienvenida a Núcleo" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("la ventana de captura rápida no tiene splash ni onboarding", () => {
    window.location.hash = "#/capture";
    render(<App />);
    expect(screen.getByLabelText("Nueva captura")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Cargando Núcleo" })).not.toBeInTheDocument();
  });
});
