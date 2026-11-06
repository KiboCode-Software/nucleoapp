import { useSortable } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, EyeOff, GripVertical, PanelLeft, Palette, RectangleHorizontal } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { PanelStyleContext } from "@/components/ui/surface";
import type { PanelLayout, PanelStyle } from "@/types/dashboard";
import { cn } from "@/utils/cn";
import type { PanelDefinition } from "../panels";
import { PanelStylePicker } from "./PanelStylePicker";

interface PanelFrameProps {
  panel: PanelLayout;
  title: string;
  /** Posición en la cuadrícula: escalona la animación de entrada. */
  index: number;
  definition: Pick<PanelDefinition, "layouts" | "items">;
  editing: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (delta: -1 | 1) => void;
  onToggleWidth: () => void;
  onHide: () => void;
  onStyleChange: (style: PanelStyle) => void;
  children: ReactNode;
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-fill hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const spanClass = (panel: PanelLayout) => (panel.width === "full" ? "lg:col-span-2" : "");

/** Contenido del panel con su estilo aplicado (se usa en la cuadrícula y en la vista flotante). */
export function PanelContent({ panel, children }: { panel: PanelLayout; children: ReactNode }) {
  return <PanelStyleContext.Provider value={panel.style}>{children}</PanelStyleContext.Provider>;
}

/** Copia del panel que sigue al cursor mientras se arrastra. */
export function PanelDragPreview({ panel, title, children }: { panel: PanelLayout; title: string; children: ReactNode }) {
  return (
    <div className="relative cursor-grabbing rounded-[22px] border-2 border-accent bg-canvas/70 p-1.5 pt-5 shadow-[0_18px_50px_rgb(0_0_0/0.18)] backdrop-blur-sm">
      <div className="absolute -top-3.5 right-4 flex items-center gap-1 rounded-full border border-accent/40 bg-surface px-2.5 py-1 shadow-card">
        <GripVertical className="size-3.5 text-accent" aria-hidden />
        <span className="text-[12px] font-medium text-accent">{title}</span>
      </div>
      <div className="pointer-events-none select-none">
        <PanelContent panel={panel}>{children}</PanelContent>
      </div>
    </div>
  );
}

/**
 * Envoltorio de un panel del Resumen. En modo personalizar se arrastra con el
 * puntero (dnd-kit): el original deja un hueco y los demás se recolocan en vivo.
 */
export function PanelFrame({
  panel,
  title,
  index,
  definition,
  editing,
  canMoveUp,
  canMoveDown,
  onMove,
  onToggleWidth,
  onHide,
  onStyleChange,
  children,
}: PanelFrameProps) {
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const closePicker = useCallback(() => setStylePickerOpen(false), []);
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: panel.id, disabled: !editing });

  if (!editing) {
    return (
      <div ref={setNodeRef} data-flip-id={panel.id} className={cn("min-w-0", spanClass(panel))}>
        {/* Aparición escalonada al abrir el Resumen (en otro nodo: el FLIP usa la transformación del exterior). */}
        <div className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
          <PanelContent panel={panel}>{children}</PanelContent>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      data-flip-id={panel.id}
      {...attributes}
      {...listeners}
      // Después de `attributes` (que pone role="button"): un grupo describe mejor un panel con herramientas.
      role="group"
      aria-label={`Panel ${title}`}
      aria-roledescription="panel arrastrable"
      className={cn(
        "relative min-w-0 touch-none rounded-[22px] border-2 border-dashed p-1.5 pt-5 transition-[border-color,background-color] duration-150 outline-none focus-visible:border-accent",
        spanClass(panel),
        isDragging ? "cursor-grabbing border-accent/60 bg-accent-soft" : "cursor-grab border-ink-muted/30 hover:border-accent/50",
      )}
    >
      {/* Barra flotante: no desplaza el contenido ni repite el título de la tarjeta. */}
      <div
        className={cn(
          "absolute -top-3.5 right-4 z-10 flex items-center gap-0.5 rounded-full border border-line bg-surface py-0.5 pr-1 pl-2 shadow-card transition-opacity",
          isDragging && "opacity-0",
        )}
        // Los botones no inician un arrastre.
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-3.5 shrink-0 text-ink-muted" aria-hidden />
        <span className="mr-1 max-w-40 truncate text-[12px] font-medium text-ink-muted">{title}</span>
        <ToolButton label={`Subir ${title}`} onClick={() => onMove(-1)} disabled={!canMoveUp}>
          <ArrowUp className="size-3.5" />
        </ToolButton>
        <ToolButton label={`Bajar ${title}`} onClick={() => onMove(1)} disabled={!canMoveDown}>
          <ArrowDown className="size-3.5" />
        </ToolButton>
        <ToolButton label={panel.width === "full" ? `Media anchura: ${title}` : `Ancho completo: ${title}`} onClick={onToggleWidth}>
          {panel.width === "full" ? <PanelLeft className="size-3.5" /> : <RectangleHorizontal className="size-3.5" />}
        </ToolButton>
        <ToolButton label={`Ajustes de ${title}`} onClick={() => setStylePickerOpen(true)}>
          <Palette className="size-3.5" />
        </ToolButton>
        <ToolButton label={`Ocultar ${title}`} onClick={onHide}>
          <EyeOff className="size-3.5" />
        </ToolButton>
      </div>
      {stylePickerOpen && (
        <div onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <PanelStylePicker
            title={title}
            value={panel.style}
            layouts={definition.layouts}
            items={definition.items}
            onChange={onStyleChange}
            onClose={closePicker}
          />
        </div>
      )}
      {/* El contenido no responde a clics mientras se personaliza; el hueco del panel arrastrado se atenúa. */}
      <div className={cn("pointer-events-none select-none transition-opacity duration-150", isDragging && "opacity-25")} aria-hidden>
        <PanelContent panel={panel}>{children}</PanelContent>
      </div>
    </div>
  );
}
