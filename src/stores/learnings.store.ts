import { create } from "zustand";
import { isTauri } from "@/database/client";
import { learningsRepository, type LearningEntry, type LearningsRepository } from "@/database/repositories/learnings.repository";
import type { LearningInput } from "@/types/entities";
import type { LoadStatus } from "./daily-logs.store";

interface LearningsState {
  learnings: LearningEntry[];
  status: LoadStatus;
  load: () => Promise<void>;
  /** Crea (sin id) o actualiza (con id). */
  save: (input: LearningInput, id?: number) => Promise<LearningEntry>;
  remove: (id: number) => Promise<void>;
}

const newestFirst = (a: LearningEntry, b: LearningEntry) => b.created_at.localeCompare(a.created_at) || b.id - a.id;

export function createLearningsStore(repo: LearningsRepository, available: () => boolean = isTauri) {
  return create<LearningsState>()((set, get) => ({
    learnings: [],
    status: "idle",

    load: async () => {
      if (!available()) return set({ status: "unavailable" });
      set({ status: "loading" });
      try {
        set({ learnings: await repo.list(), status: "ready" });
      } catch (error) {
        console.error("No se pudieron cargar los aprendizajes", error);
        set({ status: "error" });
      }
    },

    save: async (input, id) => {
      const saved = id == null ? await repo.create(input) : await repo.update(id, input);
      set({ learnings: [saved, ...get().learnings.filter((l) => l.id !== saved.id)].sort(newestFirst) });
      return saved;
    },

    remove: async (id) => {
      await repo.remove(id);
      set({ learnings: get().learnings.filter((l) => l.id !== id) });
    },
  }));
}

export const useLearningsStore = createLearningsStore(learningsRepository);

export function ensureLearningsLoaded() {
  const { status, load } = useLearningsStore.getState();
  if (status === "idle" || status === "error") void load();
}
