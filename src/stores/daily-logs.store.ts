import { create } from "zustand";
import { isTauri } from "@/database/client";
import { dailyLogsRepository, type DailyLogEntry, type DailyLogsRepository } from "@/database/repositories/daily-logs.repository";
import type { DailyLogInput } from "@/types/entities";

export type LoadStatus = "idle" | "loading" | "ready" | "unavailable" | "error";

interface DailyLogsState {
  logs: DailyLogEntry[];
  status: LoadStatus;
  load: () => Promise<void>;
  /** Crea (sin id) o actualiza (con id) y devuelve el registro guardado. */
  save: (input: DailyLogInput, id?: number) => Promise<DailyLogEntry>;
  remove: (id: number) => Promise<void>;
}

function sortLogs(logs: DailyLogEntry[]): DailyLogEntry[] {
  return [...logs].sort(
    (a, b) => b.log_date.localeCompare(a.log_date) || b.created_at.localeCompare(a.created_at) || b.id - a.id,
  );
}

export function createDailyLogsStore(repo: DailyLogsRepository, available: () => boolean = isTauri) {
  return create<DailyLogsState>()((set, get) => ({
    logs: [],
    status: "idle",

    load: async () => {
      if (!available()) return set({ status: "unavailable" });
      set({ status: "loading" });
      try {
        set({ logs: await repo.list(), status: "ready" });
      } catch (error) {
        console.error("No se pudieron cargar los registros", error);
        set({ status: "error" });
      }
    },

    save: async (input, id) => {
      const saved = id == null ? await repo.create(input) : await repo.update(id, input);
      set({ logs: sortLogs([saved, ...get().logs.filter((l) => l.id !== saved.id)]) });
      return saved;
    },

    remove: async (id) => {
      await repo.remove(id);
      set({ logs: get().logs.filter((l) => l.id !== id) });
    },
  }));
}

export const useDailyLogsStore = createDailyLogsStore(dailyLogsRepository);

/** Carga los registros la primera vez que algún componente los necesita. */
export function ensureDailyLogsLoaded() {
  const { status, load } = useDailyLogsStore.getState();
  if (status === "idle" || status === "error") void load();
}
