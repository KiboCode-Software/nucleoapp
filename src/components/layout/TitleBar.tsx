import { isTauri } from "@/database/client";
import { cn } from "@/utils/cn";

type WindowAction = "close" | "minimize" | "toggleMaximize";

async function windowAction(action: WindowAction) {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow()[action]();
  } catch (error) {
    console.error(`No se pudo ejecutar ${action} en la ventana`, error);
  }
}

const LIGHTS: Array<{ action: WindowAction; label: string; color: string; ring: string; glyph: string }> = [
  { action: "close", label: "Cerrar", color: "bg-[#FF5F57]", ring: "ring-[#E0443E]", glyph: "M3.5 3.5l5 5M8.5 3.5l-5 5" },
  { action: "minimize", label: "Minimizar", color: "bg-[#FEBC2E]", ring: "ring-[#DEA123]", glyph: "M3 6h6" },
  // Las dos flechas diagonales del botón verde de macOS.
  { action: "toggleMaximize", label: "Maximizar o restaurar", color: "bg-[#28C840]", ring: "ring-[#1AAB29]", glyph: "M3.5 7.8V3.5h4.3zM8.5 4.2v4.3H4.2z" },
];

/**
 * Barra de título al estilo de macOS (la nativa de Windows está desactivada en
 * tauri.conf.json): semáforos a la izquierda, título centrado y zona para arrastrar.
 * Doble clic en la barra maximiza o restaura, como en macOS.
 */
export function TitleBar({ sidebarWidth }: { sidebarWidth: string }) {
  return (
    // z-[110]: por encima del splash y del onboarding, para poder mover o cerrar la ventana siempre.
    <header data-tauri-drag-region className="relative z-[110] flex h-[38px] shrink-0 items-center select-none print:hidden">
      {/* Tramo sobre la barra lateral: mismo material, para que se vean unidas. */}
      <div data-tauri-drag-region className={cn("material flex h-full shrink-0 items-center border-r border-separator/60 bg-sidebar pl-4", sidebarWidth)}>
        <div className="group flex items-center gap-2" role="group" aria-label="Controles de la ventana">
          {LIGHTS.map(({ action, label, color, ring, glyph }) => (
            <button
              key={action}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => void windowAction(action)}
              className={cn("grid size-3 place-items-center rounded-full ring-[0.5px] ring-inset active:brightness-90", color, ring)}
            >
              <svg viewBox="0 0 12 12" className="size-2 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                <path d={glyph} stroke="rgb(0 0 0 / 0.55)" strokeWidth="1.2" strokeLinecap="round" fill={action === "toggleMaximize" ? "rgb(0 0 0 / 0.55)" : "none"} />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <div data-tauri-drag-region className="material flex h-full flex-1 items-center justify-center border-b border-separator/40 bg-canvas/80">
        <span data-tauri-drag-region className="text-[13px] font-semibold tracking-[-0.01em] text-ink/70">
          Núcleo
        </span>
      </div>
    </header>
  );
}
