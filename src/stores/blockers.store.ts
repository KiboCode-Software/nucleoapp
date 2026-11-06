import { create } from "zustand";
import { isTauri } from "@/database/client";
import { blockersRepository, type BlockerEntry, type BlockersRepository } from "@/database/repositories/blockers.repository";
import type { BlockerInput, BlockerStatus } from "@/types/entities";
import type { LoadStatus } from "./daily-logs.store";

interface BlockersState {
  blockers: BlockerEntry[];
  status: LoadStatus;
  load: () => Promise<void>;
  create: (input: BlockerInput) => Promise<BlockerEntry>;
  update: (id: number, input: BlockerInput) => Promise<BlockerEntry>;
  setStatus: (id: number, status: BlockerStatus) => Promise<BlockerEntry>;
  remove: (id: number) => Promise<void>;
  /** Vuelve a leer un bloqueo (p. ej. tras añadir intentos, para su contador). */
  refresh: (id: number) => Promise<void>;
}

/** Mismo orden que BlockersRepository.list(). */
export function sortBlockers(blockers: BlockerEntry[]): BlockerEntry[] {
  const resolved = (b: BlockerEntry) => (b.status === "resolved" ? 1 : 0);
  return [...blockers].sort(
    (a, b) =>
      resolved(a) - resolved(b) ||
      (resolved(a) ? (b.resolved_at ?? "").localeCompare(a.resolved_at ?? "") : 0) ||
      a.opened_at.localeCompare(b.opened_at) ||
      a.id - b.id,
  );
}

export function isOpen(blocker: Pick<BlockerEntry, "status">): boolean {
  return blocker.status !== "resolved";
}

export function createBlockersStore(repo: BlockersRepository, available: () => boolean = isTauri) {
  return create<BlockersState>()((set, get) => {
    const upsert = (entry: BlockerEntry) => {
      set({ blockers: sortBlockers([entry, ...get().blockers.filter((b) => b.id !== entry.id)]) });
      return entry;
    };

    return {
      blockers: [],
      status: "idle",

      load: async () => {
        if (!available()) return set({ status: "unavailable" });
        set({ status: "loading" });
        try {
          set({ blockers: await repo.list(), status: "ready" });
        } catch (error) {
          console.error("No se pudieron cargar los bloqueos", error);
          set({ status: "error" });
        }
      },

      create: async (input) => upsert(await repo.create(input)),
      update: async (id, input) => upsert(await repo.update(id, input)),
      // Al momento (p. ej. al soltar una tarjeta en otra columna); si falla, vuelve atrás.
      setStatus: async (id, status) => {
        const previous = get().blockers.find((b) => b.id === id);
        if (previous) upsert({ ...previous, status, resolved_at: status === "resolved" ? new Date().toISOString() : null });
        try {
          return upsert(await repo.setStatus(id, status));
        } catch (error) {
          if (previous) upsert(previous);
          throw error;
        }
      },
      refresh: async (id) => void upsert(await repo.getById(id)),

      remove: async (id) => {
        await repo.remove(id);
        set({ blockers: get().blockers.filter((b) => b.id !== id) });
      },
    };
  });
}

export const useBlockersStore = createBlockersStore(blockersRepository);

export function ensureBlockersLoaded() {
  const { status, load } = useBlockersStore.getState();
  if (status === "idle" || status === "error") void load();
}
