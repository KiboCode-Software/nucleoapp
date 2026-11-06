import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusTicker } from "@/components/focus/FocusTimer";
import { FocusWidgetWindow } from "@/modules/focus/FocusWidgetWindow";
import type { FocusSnapshot } from "@/services/focus-widget";
import { useFocusStore } from "@/stores/focus.store";

/** Eventos de Tauri simulados: los manejadores registrados y lo que se emite. */
const handlers = new Map<string, (payload: unknown) => void>();
const emitted: Array<[string, unknown]> = [];
const playChime = vi.fn(async () => true);
const win = { setTitle: vi.fn(async () => {}), minimize: vi.fn(async () => {}), startDragging: vi.fn(async () => {}) };

vi.mock("@/services/sounds", () => ({ playChime: (...args: unknown[]) => playChime(...(args as [])) }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => win }));
vi.mock("@/services/focus-widget", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/focus-widget")>();
  return {
    ...actual,
    emitFocus: vi.fn(async (event: string, payload?: unknown) => void emitted.push([event, payload])),
    onFocusEvent: vi.fn(async (event: string, handler: (payload: unknown) => void) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    }),
    showFocusWidget: vi.fn(async () => {}),
    hideFocusWidget: vi.fn(async () => {}),
  };
});

const { FOCUS_COMMAND_EVENT, FOCUS_ENDED_EVENT, FOCUS_HELLO_EVENT, FOCUS_STATE_EVENT, useFocusPrefs } = await import("@/services/focus-widget");

const snapshot = (extra: Partial<FocusSnapshot> = {}): FocusSnapshot => ({
  phase: "focus",
  endsAt: Date.now() + 18 * 60_000 + 30_000,
  remainingMs: null,
  durationMs: 25 * 60_000,
  label: "Tests de integración",
  sound: true,
  ...extra,
});

const commands = () => emitted.filter(([event]) => event === FOCUS_COMMAND_EVENT).map(([, payload]) => payload);

beforeEach(() => {
  handlers.clear();
  emitted.length = 0;
  playChime.mockClear();
  win.setTitle.mockClear();
  localStorage.clear();
});

afterEach(cleanup);

describe("widget flotante del enfoque", () => {
  it("pide el estado al abrirse y muestra el tiempo, la fase y la etiqueta", async () => {
    render(<FocusWidgetWindow />);
    await waitFor(() => expect(handlers.has(FOCUS_STATE_EVENT)).toBe(true));
    expect(emitted.some(([event]) => event === FOCUS_HELLO_EVENT)).toBe(true);

    act(() => handlers.get(FOCUS_STATE_EVENT)!(snapshot()));
    expect(await screen.findByText(/^18:(29|30)$/)).toBeInTheDocument();
    expect(screen.getByText("Enfoque")).toBeInTheDocument();
    expect(screen.getByText("Tests de integración")).toBeInTheDocument();
    // El tiempo va en el título: se ve en la barra de tareas al minimizar.
    await waitFor(() => expect(win.setTitle).toHaveBeenCalledWith(expect.stringMatching(/^18:\d\d · Enfoque$/)));
  });

  it("sus botones envían órdenes a la ventana principal y minimizan", async () => {
    render(<FocusWidgetWindow initial={snapshot()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    fireEvent.click(screen.getByRole("button", { name: "Detener" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir Núcleo" }));
    expect(commands()).toEqual(["pause", "stop", "open-app"]);

    fireEvent.click(screen.getByRole("button", { name: "Minimizar a la barra de tareas" }));
    await waitFor(() => expect(win.minimize).toHaveBeenCalled());
  });

  it("en pausa ofrece reanudar", () => {
    render(<FocusWidgetWindow initial={snapshot({ endsAt: null, remainingMs: 5 * 60_000 })} />);
    expect(screen.getByText(/en pausa/)).toBeInTheDocument();
    expect(screen.getByText("05:00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reanudar" }));
    expect(commands()).toEqual(["resume"]);
  });

  it("al llegar a cero avisa una sola vez y suena cuando la principal confirma", async () => {
    render(<FocusWidgetWindow initial={snapshot({ endsAt: Date.now() - 1 })} />);
    await waitFor(() => expect(commands()).toEqual(["tick"]));
    await waitFor(() => expect(handlers.has(FOCUS_ENDED_EVENT)).toBe(true));
    act(() => handlers.get(FOCUS_ENDED_EVENT)!("focus"));
    expect(playChime).toHaveBeenCalledWith("focus-end");
    await new Promise((r) => setTimeout(r, 400));
    expect(commands()).toEqual(["tick"]);
  });

  it("la transparencia se ajusta con un deslizador y se recuerda", () => {
    render(<FocusWidgetWindow initial={snapshot()} />);
    fireEvent.click(screen.getByRole("button", { name: "Transparencia" }));
    fireEvent.change(screen.getByRole("slider", { name: "Opacidad del widget" }), { target: { value: "0.5" } });
    expect(localStorage.getItem("nucleo-widget-opacity")).toBe("0.5");
  });
});

describe("reloj de la ventana principal", () => {
  function Probe() {
    useFocusTicker();
    return null;
  }

  it("sin widget, el aviso suena en la ventana principal al acabar el bloque", async () => {
    useFocusPrefs.getState().set({ showWidget: false, sound: true });
    useFocusStore.setState({ phase: "focus", focusMinutes: 25, durationMs: 25 * 60_000, endsAt: Date.now() - 1, startedAt: new Date().toISOString() });
    render(<Probe />);
    await waitFor(() => expect(playChime).toHaveBeenCalledWith("focus-end"), { timeout: 4000 });
    expect(useFocusStore.getState().phase).toBe("break");
  });

  it("con el sonido apagado no suena", async () => {
    useFocusPrefs.getState().set({ showWidget: false, sound: false });
    useFocusStore.setState({ phase: "break", durationMs: 5 * 60_000, endsAt: Date.now() - 1 });
    render(<Probe />);
    await waitFor(() => expect(useFocusStore.getState().phase).toBe("idle"), { timeout: 4000 });
    expect(playChime).not.toHaveBeenCalled();
  });
});
