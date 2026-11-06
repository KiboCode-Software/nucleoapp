import { z } from "zod";

/** Modo de un perfil: decide el vocabulario y algunos módulos de la interfaz. */
export const modeSchema = z.enum(["dev", "student"]);
export type Mode = z.infer<typeof modeSchema>;

export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mode: modeSchema,
  /** Archivo SQLite del perfil (dentro del directorio de datos de la app). */
  db: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;

export const profilesSchema = z.object({ active: z.string(), profiles: z.array(profileSchema).min(1) });
export type Profiles = z.infer<typeof profilesSchema>;

/** Perfil inicial: conserva el nombre heredado de la base de datos para no perder datos existentes. */
export const DEFAULT_PROFILE: Profile = { id: "default", name: "Desarrollo", mode: "dev", db: "daily-dev-log.db" };

/**
 * Fuera de la app de escritorio no hay perfiles; `?modo=estudiante` en la URL
 * permite revisar el modo estudiante en el navegador.
 */
function browserProfiles(): Profiles {
  const student = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("modo") === "estudiante";
  const profile = student ? { ...DEFAULT_PROFILE, name: "Estudio", mode: "student" as const } : DEFAULT_PROFILE;
  return { active: profile.id, profiles: [profile] };
}

const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

let cached: Promise<Profiles> | null = null;

/** Lista de perfiles y el activo (se lee una vez; al cambiar de perfil las ventanas se recargan). */
export function loadProfiles(): Promise<Profiles> {
  if (!inTauri()) return Promise.resolve(browserProfiles());
  cached ??= invoke<unknown>("get_profiles")
    .then((raw) => profilesSchema.parse(raw))
    .catch((error: unknown) => {
      console.error("No se pudieron leer los perfiles; se usa el inicial", error);
      return { active: DEFAULT_PROFILE.id, profiles: [DEFAULT_PROFILE] };
    });
  return cached;
}

export async function activeProfile(): Promise<Profile> {
  const { active, profiles } = await loadProfiles();
  return profiles.find((p) => p.id === active) ?? profiles[0];
}

export const profilesApi = {
  create: (name: string, mode: Mode) => invoke<Profile>("create_profile", { name, mode }),
  update: (id: string, name: string, mode: Mode) => invoke<Profiles>("update_profile", { id, name, mode }),
  remove: (id: string) => invoke<Profiles>("delete_profile", { id }),
  /** Activa el perfil: recarga las ventanas (o reinicia la app si su base es nueva). */
  switchTo: (id: string) => invoke<void>("switch_profile", { id }),
};
