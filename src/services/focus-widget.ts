import { create } from "zustand";
import { isTauri } from "@/database/client";
import type { FocusPhase } from "@/stores/focus.store";

/**
 * Widget flotante del temporizador de enfoque (ventana "focus-widget").
 * La ventana principal lleva el reloj y le envía el estado; el widget le devuelve
 * órdenes (pausar, reanudar, detener) y le avisa cuando el tiempo llega a cero.
 */
export const FOCUS_STATE_EVENT = "focus:state";
export const FOCUS_COMMAND_EVENT = "focus:command";
export const FOCUS_HELLO_EVENT = "focus:hello";
export const FOCUS_ENDED_EVENT = "focus:ended";

export interface FocusSnapshot {
  phase: FocusPhase;
  endsAt: number | null;
  remainingMs: number | null;
  durationMs: number;
  label: string;
  sound: boolean;
}

export type FocusCommand = "pause" | "resume" | "stop" | "tick" | "open-app";

// ─── Preferencias (se guardan en el equipo; las comparten ambas ventanas) ─────────

interface FocusPrefs {
  /** Mostrar el widget flotante mientras hay un bloque o un descanso. */
  showWidget: boolean;
  /** Sonar al terminar el bloque y el descanso. */
  sound: boolean;
  set: (changes: Partial<Pick<FocusPrefs, "showWidget" | "sound">>) => void;
}

const PREFS_KEY = "nucleo-focus-prefs";

function readPrefs(): Pick<FocusPrefs, "showWidget" | "sound"> {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<FocusPrefs>;
    return { showWidget: saved.showWidget ?? true, sound: saved.sound ?? true };
  } catch {
    return { showWidget: true, sound: true };
  }
}

export const useFocusPrefs = create<FocusPrefs>()((set, get) => ({
  ...readPrefs(),
  set: (changes) => {
    set(changes);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ showWidget: get().showWidget, sound: get().sound }));
    } catch {
      // Sin almacenamiento (modo privado): la preferencia dura hasta cerrar la app.
    }
  },
}));

// ─── Ventana y eventos ─────────────────────────────────────────────────────────

async function invokeIfTauri(command: string) {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke(command);
}

export const showFocusWidget = () => invokeIfTauri("show_focus_widget");
export const hideFocusWidget = () => invokeIfTauri("hide_focus_widget");

export async function emitFocus(event: string, payload?: unknown): Promise<void> {
  if (!isTauri()) return;
  const { emit } = await import("@tauri-apps/api/event");
  await emit(event, payload);
}

/** Suscripción a un evento con datos; devuelve la función para cancelarla. */
export async function onFocusEvent<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen<T>(event, (e) => handler(e.payload));
  } catch (error) {
    console.warn(`No se pudo escuchar el evento ${event}`, error);
    return () => {};
  }
}
