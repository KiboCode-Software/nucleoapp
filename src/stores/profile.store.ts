import { create } from "zustand";
import { DEFAULT_PROFILE, loadProfiles, profilesApi, type Mode, type Profile } from "@/database/profiles";

interface ProfileState {
  profiles: Profile[];
  active: Profile;
  /** "idle" hasta leer la lista; la interfaz usa el perfil inicial mientras tanto. */
  status: "idle" | "ready";
  load: () => Promise<void>;
  /** Crea un perfil y cambia a él (la app se reinicia). */
  createAndSwitch: (name: string, mode: Mode) => Promise<void>;
  switchTo: (id: string) => Promise<void>;
  update: (id: string, name: string, mode: Mode) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Cambia nombre y/o modo del perfil activo al momento (misma base de datos, sin reiniciar). */
  configureActive: (changes: { name?: string; mode?: Mode }) => Promise<void>;
}

/** Nombres que la app pone sola; si el perfil se llama así, el nombre sigue al modo. */
const AUTO_NAMES: Record<Mode, string> = { dev: "Desarrollo", student: "Estudio" };

export const useProfileStore = create<ProfileState>()((set, get) => {
  const apply = (profiles: Profile[], activeId: string) =>
    set({ profiles, active: profiles.find((p) => p.id === activeId) ?? profiles[0], status: "ready" });

  return {
    profiles: [DEFAULT_PROFILE],
    active: DEFAULT_PROFILE,
    status: "idle",

    load: async () => {
      const { profiles, active } = await loadProfiles();
      apply(profiles, active);
    },

    createAndSwitch: async (name, mode) => {
      const profile = await profilesApi.create(name, mode);
      await profilesApi.switchTo(profile.id);
    },

    switchTo: (id) => profilesApi.switchTo(id),

    update: async (id, name, mode) => {
      const { profiles } = await profilesApi.update(id, name, mode);
      apply(profiles, get().active.id);
    },

    configureActive: async (changes) => {
      const { active, profiles } = get();
      const mode = changes.mode ?? active.mode;
      // Sin nombre explícito, uno puesto por la app sigue al modo ("Desarrollo" → "Estudio").
      const name = changes.name?.trim() || (Object.values(AUTO_NAMES).includes(active.name) ? AUTO_NAMES[mode] : active.name);
      if (name === active.name && mode === active.mode) return;
      const next = { ...active, name, mode };
      set({ active: next, profiles: profiles.map((p) => (p.id === next.id ? next : p)) });
      try {
        await profilesApi.update(next.id, name, mode);
      } catch (error) {
        // Fuera de la app de escritorio no hay perfiles que guardar: el cambio queda en memoria.
        console.warn("No se pudo guardar el perfil", error);
      }
    },

    remove: async (id) => {
      const { profiles } = await profilesApi.remove(id);
      apply(profiles, get().active.id);
    },
  };
});

export function ensureProfileLoaded() {
  if (useProfileStore.getState().status === "idle") void useProfileStore.getState().load();
}

export const useMode = (): Mode => useProfileStore((s) => s.active.mode);
