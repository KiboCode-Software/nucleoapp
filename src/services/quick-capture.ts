import { isTauri } from "@/database/client";

/** Atajo global registrado en src-tauri/src/lib.rs. */
export const QUICK_CAPTURE_SHORTCUT = ["Ctrl", "Shift", "Espacio"];

/** Evento que la ventana flotante emite al guardar, para que la principal recargue la bandeja. */
export const CAPTURE_SAVED_EVENT = "capture:saved";
/** Evento que Rust emite al mostrar la ventana flotante. */
export const CAPTURE_OPENED_EVENT = "quick-capture:opened";

async function invokeIfTauri(command: string) {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke(command);
}

export const showQuickCapture = () => invokeIfTauri("show_quick_capture");
export const hideQuickCapture = () => invokeIfTauri("hide_quick_capture");

export async function emitCaptureSaved(): Promise<void> {
  if (!isTauri()) return;
  const { emit } = await import("@tauri-apps/api/event");
  await emit(CAPTURE_SAVED_EVENT);
}

/** Suscripción a un evento de Tauri; devuelve la función para cancelarla. */
export async function onTauriEvent(event: string, handler: () => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen(event, handler);
  } catch (error) {
    // Sin el puente de Tauri (p. ej. en pruebas) la suscripción no es posible; no es fatal.
    console.warn(`No se pudo escuchar el evento ${event}`, error);
    return () => {};
  }
}
