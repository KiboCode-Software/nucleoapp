import { create } from "zustand";
import { isTauri } from "@/database/client";
import {
  DEFAULT_SETTINGS,
  settingsRepository,
  type AppSettings,
  type SettingKey,
  type SettingsRepository,
} from "@/database/repositories/settings.repository";
import type { LoadStatus } from "./daily-logs.store";

interface SettingsState {
  settings: AppSettings;
  status: LoadStatus;
  load: () => Promise<void>;
  update: <K extends SettingKey>(key: K, value: AppSettings[K]) => Promise<void>;
  /** Cambia solo algunos campos de un ajuste-objeto, sobre su valor más reciente. */
  patch: <K extends "ai" | "reminder" | "backup" | "deadline_reminders" | "grading">(key: K, changes: Partial<AppSettings[K]>) => Promise<void>;
}

export function createSettingsStore(repo: SettingsRepository, available: () => boolean = isTauri) {
  return create<SettingsState>()((set, get) => ({
    settings: DEFAULT_SETTINGS,
    status: "idle",

    load: async () => {
      if (!available()) return set({ status: "unavailable" });
      set({ status: "loading" });
      try {
        set({ settings: await repo.load(), status: "ready" });
      } catch (error) {
        console.error("No se pudieron cargar los ajustes", error);
        set({ status: "error" });
      }
    },

    // Se aplica antes de guardar para que dos cambios seguidos no se pisen; si falla, se revierte.
    update: async (key, value) => {
      const previous = get().settings[key];
      set({ settings: { ...get().settings, [key]: value } });
      try {
        await repo.save(key, value);
      } catch (error) {
        set({ settings: { ...get().settings, [key]: previous } });
        throw error;
      }
    },

    patch: (key, changes) => get().update(key, { ...get().settings[key], ...changes }),
  }));
}

export const useSettingsStore = createSettingsStore(settingsRepository);

export function ensureSettingsLoaded(): Promise<void> {
  const { status, load } = useSettingsStore.getState();
  return status === "idle" || status === "error" ? load() : Promise.resolve();
}
