import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useRef, useState } from "react";
import { useFlipAnimation } from "@/hooks/useFlipAnimation";
import { movePanelBy, reorderVisible, updatePanel, type PanelId, type PanelLayout } from "@/types/dashboard";
import { PANELS } from "../panels";
import { PanelDragPreview, PanelFrame } from "./PanelFrame";
import { useTr } from "@/modes/vocabulary";

// Primero el panel bajo el puntero; si no hay ninguno (huecos), el más cercano.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCenter(args);
};

// Los paneles no se desplazan con transformaciones de dnd-kit: el orden cambia de
// verdad mientras se arrastra y la cuadrícula se recoloca con la animación FLIP.
const noShift = () => null;

interface PanelGridProps {
  layout: PanelLayout[];
  editing: boolean;
  onChange: (layout: PanelLayout[]) => void;
}

export function PanelGrid({ layout, editing, onChange }: PanelGridProps) {
  const tr = useTr();
  const gridRef = useRef<HTMLDivElement>(null);
  // Orden provisional mientras se arrastra; se guarda al soltar.
  const [dragOrder, setDragOrder] = useState<PanelId[] | null>(null);
  const [activeId, setActiveId] = useState<PanelId | null>(null);
  // Evita el "rebote": tras un intercambio, el mismo panel bajo el puntero no vuelve a intercambiarse.
  const lastOver = useRef<PanelId | null>(null);

  const sensors = useSensors(
    // 6 px de margen: un clic en los botones de la barra no empieza un arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visible = layout.filter((p) => p.visible);
  const ordered = dragOrder ? dragOrder.map((id) => visible.find((p) => p.id === id)!).filter(Boolean) : visible;
  const ids = ordered.map((p) => p.id);
  const active = activeId ? ordered.find((p) => p.id === activeId) : null;

  useFlipAnimation(gridRef, ordered.map((p) => `${p.id}:${p.width}`).join("|"));

  function onDragOver({ active: dragged, over }: DragOverEvent) {
    const overId = over?.id as PanelId | undefined;
    if (!overId || overId === dragged.id) {
      lastOver.current = null;
      return;
    }
    if (overId === lastOver.current) return;
    lastOver.current = overId;
    setDragOrder((order) => {
      const current = order ?? ids;
      const from = current.indexOf(dragged.id as PanelId);
      const to = current.indexOf(overId);
      return from < 0 || to < 0 ? current : arrayMove(current, from, to);
    });
  }

  function finish(commit: boolean) {
    if (commit && dragOrder) onChange(reorderVisible(layout, dragOrder));
    setDragOrder(null);
    setActiveId(null);
    lastOver.current = null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={({ active: started }) => {
        setActiveId(started.id as PanelId);
        setDragOrder(ids);
      }}
      onDragOver={onDragOver}
      onDragEnd={() => finish(true)}
      onDragCancel={() => finish(false)}
    >
      <SortableContext items={ids} strategy={noShift}>
        <div ref={gridRef} className="grid items-start gap-6 lg:grid-cols-2">
          {ordered.map((panel, index) => {
            const { title, Component, layouts, items } = PANELS[panel.id];
            return (
              <PanelFrame
                key={panel.id}
                panel={panel}
                title={tr(title)}
                index={index}
                definition={{ layouts, items }}
                editing={editing}
                canMoveUp={index > 0}
                canMoveDown={index < ordered.length - 1}
                onMove={(delta) => onChange(movePanelBy(layout, panel.id, delta))}
                onToggleWidth={() => onChange(updatePanel(layout, panel.id, { width: panel.width === "full" ? "half" : "full" }))}
                onHide={() => onChange(updatePanel(layout, panel.id, { visible: false }))}
                onStyleChange={(style) => onChange(updatePanel(layout, panel.id, { style }))}
              >
                <Component width={panel.width} />
              </PanelFrame>
            );
          })}
        </div>
      </SortableContext>

      {/* La copia flotante sigue al cursor; al soltar vuela suavemente a su hueco. */}
      <DragOverlay dropAnimation={{ duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {active && (
          <PanelDragPreview panel={active} title={tr(PANELS[active.id].title)}>
            {(() => {
              const { Component } = PANELS[active.id];
              return <Component width={active.width} />;
            })()}
          </PanelDragPreview>
        )}
      </DragOverlay>
    </DndContext>
  );
}
