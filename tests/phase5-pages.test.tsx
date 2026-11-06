import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { useCapturesStore } from "@/stores/captures.store";
import { useSettingsStore } from "@/stores/settings.store";
import { DEFAULT_SETTINGS } from "@/database/repositories/settings.repository";
import { toISODate } from "@/utils/date";
import { createTestDatabase } from "./helpers/sqlite";
import { resetStores } from "./helpers/stores";

let sqlite: ReturnType<typeof createTestDatabase>;
vi.mock("@/database/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/database/client")>();
  return { ...actual, isTauri: () => true, getDatabase: async () => sqlite.executor };
});

const native = vi.hoisted(() => ({
  hide: vi.fn(async () => {}),
  show: vi.fn(async () => {}),
  emitSaved: vi.fn(async () => {}),
  notify: vi.fn(async () => true),
  backupRun: vi.fn(async () => "C:\\backups\\nucleo-2026-11-01-090000.db"),
}));

vi.mock("@/services/quick-capture", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/quick-capture")>()),
  hideQuickCapture: native.hide,
  showQuickCapture: native.show,
  emitCaptureSaved: native.emitSaved,
  onTauriEvent: async () => () => {},
}));
vi.mock("@/services/reminder", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/reminder")>()),
  notify: native.notify,
}));
vi.mock("@/services/backup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/backup")>();
  return { ...actual, backupService: { ...actual.backupService, run: native.backupRun } };
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const row = <T,>(sql: string) => sqlite.db.prepare(sql).get() as T;

beforeEach(() => {
  sqlite = createTestDatabase();
  resetStores();
  useCapturesStore.setState({ pending: [], status: "idle" });
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, status: "idle" });
  Object.values(native).forEach((fn) => fn.mockClear());
});

afterEach(cleanup);

describe("ventana flotante de captura", () => {
  it("guarda con Enter, avisa a la ventana principal y se oculta", async () => {
    renderAt("/capture");
    const input = screen.getByLabelText("Nueva captura");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Preguntar por el deploy del viernes" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("Guardado en la bandeja")).toBeInTheDocument();
    expect(row("SELECT content FROM captures")).toEqual({ content: "Preguntar por el deploy del viernes" });
    expect(native.emitSaved).toHaveBeenCalled();
    await waitFor(() => expect(native.hide).toHaveBeenCalled(), { timeout: 2000 });
  });

  it("Shift+Enter no guarda y Esc cierra", () => {
    renderAt("/capture");
    const input = screen.getByLabelText("Nueva captura");
    fireEvent.change(input, { target: { value: "línea 1" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(row("SELECT COUNT(*) AS n FROM captures")).toEqual({ n: 0 });
    expect(native.hide).toHaveBeenCalled();
  });
});

describe("bandeja de captura rápida", () => {
  it("captura desde la página y muestra el contador en la barra lateral", async () => {
    renderAt("/quick-capture");
    const input = await screen.findByLabelText("Nueva captura");
    fireEvent.change(input, { target: { value: "Idea suelta" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const inbox = await screen.findByRole("list", { name: "Bandeja de capturas" });
    expect(within(inbox).getByText("Idea suelta")).toBeInTheDocument();
    expect(screen.getByLabelText("1 sin clasificar")).toBeInTheDocument();
  });

  it("convierte capturas en bloqueo, aprendizaje y plan de hoy", async () => {
    sqlite.db.exec(`INSERT INTO captures (id, content) VALUES
      (1, 'Docker no levanta
Error de puertos'), (2, 'Usar git worktree'), (3, 'Revisar PR de login')`);
    renderAt("/quick-capture");
    const inbox = await screen.findByRole("list", { name: "Bandeja de capturas" });
    const item = (text: string) => within(inbox).getByText(text, { exact: false }).closest("li")!;

    fireEvent.click(within(item("Docker no levanta")).getByRole("button", { name: "Bloqueo" }));
    await waitFor(() =>
      expect(row("SELECT title, description FROM blockers")).toEqual({ title: "Docker no levanta", description: "Error de puertos" }),
    );

    fireEvent.click(within(item("Usar git worktree")).getByRole("button", { name: "Aprendizaje" }));
    await waitFor(() => expect(row("SELECT title FROM learnings")).toEqual({ title: "Usar git worktree" }));

    fireEvent.click(within(item("Revisar PR de login")).getByRole("button", { name: "Al plan de hoy" }));
    await waitFor(() =>
      expect(row("SELECT log_date, today FROM daily_logs")).toEqual({ log_date: toISODate(new Date()), today: "- [ ] Revisar PR de login" }),
    );

    expect(await screen.findByText("Bandeja vacía")).toBeInTheDocument();
    expect(sqlite.db.prepare("SELECT processed_as FROM captures ORDER BY id").all()).toEqual([
      { processed_as: "blocker" },
      { processed_as: "learning" },
      { processed_as: "daily_log" },
    ]);
  });

  it("añade al check-in de hoy si ya existe y permite descartar", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (id, log_date, today) VALUES (1, '${toISODate(new Date())}', 'Tarea previa')`);
    sqlite.db.exec("INSERT INTO captures (id, content) VALUES (1, 'Tarea nueva'), (2, 'Ruido')");
    renderAt("/quick-capture");
    const inbox = await screen.findByRole("list", { name: "Bandeja de capturas" });

    fireEvent.click(within(within(inbox).getByText("Tarea nueva").closest("li")!).getByRole("button", { name: "Al plan de hoy" }));
    await waitFor(() => expect(row("SELECT today FROM daily_logs")).toEqual({ today: "- [ ] Tarea previa\n- [ ] Tarea nueva" }));

    fireEvent.click(within(within(inbox).getByText("Ruido").closest("li")!).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(row("SELECT processed_as FROM captures WHERE id = 2")).toEqual({ processed_as: "discarded" }));
    expect(row("SELECT COUNT(*) AS n FROM daily_logs")).toEqual({ n: 1 });
  });

  it("abre la ventana flotante desde la página", async () => {
    renderAt("/quick-capture");
    fireEvent.click(await screen.findByRole("button", { name: "Abrir ventana flotante" }));
    expect(native.show).toHaveBeenCalled();
  });
});

describe("ajustes", () => {
  it("activa el recordatorio pidiendo permiso y cambia la hora", async () => {
    renderAt("/settings");
    const toggle = await screen.findByRole("switch", { name: "Recordarme el check-in" });
    expect(screen.getByLabelText("Hora del recordatorio")).toBeDisabled();

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
    expect(native.notify).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Hora del recordatorio"), { target: { value: "16:45" } });
    await waitFor(() =>
      expect(row("SELECT value FROM settings WHERE key = 'reminder'")).toEqual({ value: '{"enabled":true,"time":"16:45"}' }),
    );
  });

  it("no activa el recordatorio si Windows niega las notificaciones", async () => {
    native.notify.mockResolvedValueOnce(false);
    renderAt("/settings");
    fireEvent.click(await screen.findByRole("switch", { name: "Recordarme el check-in" }));

    expect(await screen.findByText(/Windows no permitió las notificaciones/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Recordarme el check-in" })).toHaveAttribute("aria-checked", "false");
  });

  it("configura los respaldos y crea uno al momento", async () => {
    renderAt("/settings");
    const auto = await screen.findByRole("switch", { name: "Respaldo automático" });
    expect(auto).toHaveAttribute("aria-checked", "true");

    fireEvent.click(auto);
    fireEvent.change(screen.getByLabelText("Respaldos a conservar"), { target: { value: "20" } });
    await waitFor(() =>
      expect(JSON.parse(row<{ value: string }>("SELECT value FROM settings WHERE key = 'backup'").value)).toEqual({
        auto: false,
        directory: null,
        keep: 20,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Respaldar ahora" }));
    expect(await screen.findByText(/Respaldo creado: C:\\backups/)).toBeInTheDocument();
    expect(native.backupRun).toHaveBeenCalledWith({ auto: false, directory: null, keep: 20 });
  });

  it("cambia el tema", async () => {
    renderAt("/settings");
    fireEvent.click(await screen.findByRole("radio", { name: "Oscuro" }));
    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(screen.getByRole("radio", { name: "Claro" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
