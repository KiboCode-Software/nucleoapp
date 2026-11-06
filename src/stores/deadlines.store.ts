import { create } from "zustand";
import { isTauri } from "@/database/client";
import {
  deadlinesRepository,
  type Deadline,
  type DeadlineInput,
  type DeadlinesRepository,
} from "@/database/repositories/deadlines.repository";
import type { LoadStatus } from "./daily-logs.store";

interface DeadlinesState {
  deadlines: Deadline[];
  status: LoadStatus;
  load: () => Promise<void>;
  create: (input: DeadlineInput) => Promise<Deadline>;
  update: (id: number, input: DeadlineInput) => Promise<Deadline>;
  /** Marca o desmarca como hecha al momento; si falla, vuelve atrás. */
  toggleDone: (id: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export function createDeadlinesStore(repo: DeadlinesRepository, available: () => boolean = isTauri) {
  return create<DeadlinesState>()((set, get) => {
    const replace = (deadline: Deadline) => set({ deadlines: get().deadlines.map((d) => (d.id === deadline.id ? deadline : d)) });

    return {
      deadlines: [],
      status: "idle",

      load: async () => {
        if (!available()) return set({ status: "unavailable" });
        set({ status: "loading" });
        try {
          set({ deadlines: await repo.list(), status: "ready" });
        } catch (error) {
          console.error("No se pudieron cargar las entregas", error);
          set({ status: "error" });
        }
      },

      create: async (input) => {
        const deadline = await repo.create(input);
        set({ deadlines: [...get().deadlines, deadline] });
        return deadline;
      },

      update: async (id, input) => {
        const deadline = await repo.update(id, input);
        replace(deadline);
        return deadline;
      },

      toggleDone: async (id) => {
        const previous = get().deadlines.find((d) => d.id === id);
        if (!previous) return;
        const done = !previous.done_at;
        replace({ ...previous, done_at: done ? new Date().toISOString() : null });
        try {
          replace(await repo.setDone(id, done));
        } catch (error) {
          replace(previous);
          throw error;
        }
      },

      remove: async (id) => {
        await repo.remove(id);
        set({ deadlines: get().deadlines.filter((d) => d.id !== id) });
      },
    };
  });
}

export const useDeadlinesStore = createDeadlinesStore(deadlinesRepository);

export function ensureDeadlinesLoaded() {
  const { status, load } = useDeadlinesStore.getState();
  if (status === "idle" || status === "error") void load();
}
