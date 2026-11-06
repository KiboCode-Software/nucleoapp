import { create } from "zustand";
import { isTauri } from "@/database/client";
import { focusRepository, type FocusRepository } from "@/database/repositories/focus.repository";

export type FocusPhase = "idle" | "focus" | "break";

export const FOCUS_PRESETS = [15, 25, 45, 50] as const;

/** Descanso proporcional al bloque, como en la técnica Pomodoro (25 → 5). */
export const breakMinutesFor = (focusMinutes: number) => Math.max(3, Math.round(focusMinutes / 5));

interface FocusState {
  phase: FocusPhase;
  /** Duración total de la fase en curso (ms). */
  durationMs: number;
  /** Cuándo termina la fase (ms) mientras corre; null en pausa o parado. */
  endsAt: number | null;
  /** Lo que quedaba al pausar (ms). */
  remainingMs: number | null;
  startedAt: string | null;
  focusMinutes: number;
  label: string;
  projectId: number | null;
  /** Se incrementa al guardar una sesión, para que las vistas recarguen el resumen. */
  savedCount: number;
  setPlan: (changes: Partial<Pick<FocusState, "focusMinutes" | "label" | "projectId">>) => void;
  start: (now?: number) => void;
  pause: (now?: number) => void;
  resume: (now?: number) => void;
  /** Detiene la fase; un enfoque de al menos un minuto se guarda como interrumpido. */
  stop: (now?: number) => Promise<void>;
  /** Llamado cada segundo: termina la fase cuando llega su hora. */
  tick: (now?: number) => Promise<FocusPhase | null>;
}

export function remainingMs(state: Pick<FocusState, "endsAt" | "remainingMs" | "durationMs">, now = Date.now()): number {
  if (state.endsAt != null) return Math.max(0, state.endsAt - now);
  return state.remainingMs ?? state.durationMs;
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function createFocusStore(repo: FocusRepository, notify: (title: string, body: string) => Promise<unknown>, available: () => boolean = isTauri) {
  return create<FocusState>()((set, get) => {
    const save = async (minutes: number, completed: boolean) => {
      const { startedAt, label, projectId } = get();
      if (!available() || !startedAt || minutes < 1) return;
      try {
        await repo.record({ project_id: projectId, label, started_at: startedAt, minutes, completed });
        set((s) => ({ savedCount: s.savedCount + 1 }));
      } catch (error) {
        console.error("No se pudo guardar la sesión de enfoque", error);
      }
    };

    const reset = () => set({ phase: "idle", endsAt: null, remainingMs: null, startedAt: null, durationMs: get().focusMinutes * 60_000 });

    return {
      phase: "idle",
      durationMs: 25 * 60_000,
      endsAt: null,
      remainingMs: null,
      startedAt: null,
      focusMinutes: 25,
      label: "",
      projectId: null,
      savedCount: 0,

      setPlan: (changes) => {
        set(changes);
        if (get().phase === "idle") set({ durationMs: get().focusMinutes * 60_000 });
      },

      start: (now = Date.now()) => {
        const durationMs = get().focusMinutes * 60_000;
        set({ phase: "focus", durationMs, endsAt: now + durationMs, remainingMs: null, startedAt: new Date(now).toISOString() });
      },

      pause: (now = Date.now()) => {
        const state = get();
        if (state.endsAt == null) return;
        set({ remainingMs: Math.max(0, state.endsAt - now), endsAt: null });
      },

      resume: (now = Date.now()) => {
        const state = get();
        if (state.remainingMs == null || state.phase === "idle") return;
        set({ endsAt: now + state.remainingMs, remainingMs: null });
      },

      stop: async (now = Date.now()) => {
        const state = get();
        if (state.phase === "focus") await save(Math.floor((state.durationMs - remainingMs(state, now)) / 60_000), false);
        reset();
      },

      tick: async (now = Date.now()) => {
        const state = get();
        if (state.phase === "idle" || state.endsAt == null || now < state.endsAt) return null;
        if (state.phase === "focus") {
          await save(state.focusMinutes, true);
          const breakMs = breakMinutesFor(state.focusMinutes) * 60_000;
          set({ phase: "break", durationMs: breakMs, endsAt: now + breakMs, remainingMs: null });
          void notify("¡Bloque de enfoque terminado!", `Tómate ${breakMinutesFor(state.focusMinutes)} minutos de descanso.`).catch(() => undefined);
          return "focus";
        }
        reset();
        void notify("Descanso terminado", "Cuando quieras, empieza otro bloque de enfoque.").catch(() => undefined);
        return "break";
      },
    };
  });
}

const notifyLazily = async (title: string, body: string) => {
  if (!isTauri()) return false;
  const { notify } = await import("@/services/reminder");
  return notify(title, body);
};

export const useFocusStore = createFocusStore(focusRepository, notifyLazily);
