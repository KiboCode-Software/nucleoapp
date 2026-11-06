import { create } from "zustand";
import { isTauri } from "@/database/client";
import { capturesRepository, type Capture, type CapturesRepository, type CaptureTarget } from "@/database/repositories/captures.repository";
import type { LoadStatus } from "./daily-logs.store";

interface CapturesState {
  pending: Capture[];
  status: LoadStatus;
  load: () => Promise<void>;
  add: (content: string) => Promise<Capture>;
  /** Quita la captura de la bandeja marcándola como clasificada. */
  process: (id: number, target: CaptureTarget) => Promise<void>;
}

export function createCapturesStore(repo: CapturesRepository, available: () => boolean = isTauri) {
  return create<CapturesState>()((set, get) => ({
    pending: [],
    status: "idle",

    load: async () => {
      if (!available()) return set({ status: "unavailable" });
      try {
        set({ pending: await repo.listPending(), status: "ready" });
      } catch (error) {
        console.error("No se pudo cargar la bandeja de capturas", error);
        set({ status: "error" });
      }
    },

    add: async (content) => {
      const capture = await repo.create(content);
      set({ pending: [capture, ...get().pending] });
      return capture;
    },

    process: async (id, target) => {
      await repo.markProcessed(id, target);
      set({ pending: get().pending.filter((c) => c.id !== id) });
    },
  }));
}

export const useCapturesStore = createCapturesStore(capturesRepository);

export function ensureCapturesLoaded() {
  const { status, load } = useCapturesStore.getState();
  if (status === "idle" || status === "error") void load();
}
