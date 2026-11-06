import { isTauri } from "@/database/client";

/** Quién hace la app y dónde se descarga (Ajustes → Acerca de, splash). */
export const BRAND = {
  app: "Núcleo",
  version: __APP_VERSION__,
  website: "https://nucleo.kibocode.lat",
  maker: { name: "KiboCode", url: "https://kibocode.lat" },
} as const;

/** Abre un enlace en el navegador del sistema (en la vista previa, en otra pestaña). */
export async function openExternal(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank", "noopener");
    return;
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}
