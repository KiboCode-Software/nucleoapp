import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { Clock, ListChecks } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import type { BlockerEntry } from "@/database/repositories/blockers.repository";
import { useVocab } from "@/modes/vocabulary";
import type { BlockerStatus } from "@/types/entities";
import { cn } from "@/utils/cn";
import { elapsedBetween } from "@/utils/date";
import { useStatusMeta } from "../status";

export const BOARD_COLUMNS: BlockerStatus[] = ["pending", "escalated", "resolved"];

/** Los resueltos se acumulan: se muestran los más recientes y el resto a petición. */
const RESOLVED_LIMIT = 10;

const TINT: Record<BlockerStatus, { dot: string; bar: string; ring: string }> = {
  pending: { dot: "bg-warning", bar: "bg-warning", ring: "ring-warning/50 bg-warning-soft/40" },
  escalated: { dot: "bg-danger", bar: "bg-danger", ring: "ring-danger/50 bg-danger-soft/40" },
  resolved: { dot: "bg-success", bar: "bg-success", ring: "ring-success/50 bg-success-soft/40" },
};

function CardBody({ blocker, now }: { blocker: BlockerEntry; now: Date }) {
  const v = useVocab();
  const resolved = blocker.status === "resolved";
  return (
    <>
      <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", TINT[blocker.status].bar)} aria-hidden="true" />
      <span className={cn("line-clamp-2 text-[14px] leading-snug font-medium", resolved && "text-ink-muted")}>{blocker.title}</span>
      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Clock className="size-3" />
          {resolved && blocker.resolved_at
            ? `${v.blocker.resolvedIn} ${elapsedBetween(blocker.opened_at, blocker.resolved_at)}`
            : elapsedBetween(blocker.opened_at, null, now)}
        </span>
        {blocker.attempts_count > 0 && (
          <span className="inline-flex items-center gap-1 tabular-nums" title={v.blocker.attempts}>
            <ListChecks className="size-3" />
            {blocker.attempts_count}
          </span>
        )}
        {blocker.project_name && <span className="truncate rounded-full bg-fill px-2 py-px font-medium text-ink">{blocker.project_name}</span>}
      </span>
    </>
  );
}

const cardClass =
  "relative block overflow-hidden rounded-[14px] border border-separator/50 bg-surface py-3 pr-3 pl-4 shadow-card transition-[box-shadow,transform] hover:shadow-float";

function BoardCard({ blocker, now, suppressClick }: { blocker: BlockerEntry; now: Date; suppressClick: () => boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: blocker.id });
  return (
    // Solo se arrastra con el puntero: el foco y el teclado van al enlace (el estado se cambia en la hoja).
    <li ref={setNodeRef} {...attributes} {...listeners} role="listitem" tabIndex={-1} className={cn("touch-none", isDragging && "opacity-30")}>
      <Link
        to={`/blockers/${blocker.id}`}
        draggable={false}
        onClick={(e) => suppressClick() && e.preventDefault()}
        className={cardClass}
      >
        <CardBody blocker={blocker} now={now} />
      </Link>
    </li>
  );
}

function Column({
  status,
  items,
  now,
  suppressClick,
}: {
  status: BlockerStatus;
  items: BlockerEntry[];
  now: Date;
  suppressClick: () => boolean;
}) {
  const v = useVocab();
  const label = useStatusMeta()[status].label;
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [showAll, setShowAll] = useState(false);
  const limited = status === "resolved" && !showAll ? items.slice(0, RESOLVED_LIMIT) : items;

  const empty =
    status === "pending" ? v.blocker.noneOpenHint : status === "escalated" ? `Arrastra aquí lo que necesite ayuda: ${v.blocker.escalate.toLowerCase()}.` : "Arrastra aquí lo que ya resolviste.";

  return (
    <section
      ref={setNodeRef}
      aria-label={`${label} (${items.length})`}
      className={cn(
        "flex min-h-[220px] flex-col rounded-[18px] bg-fill/50 p-2.5 ring-2 ring-transparent transition-[box-shadow,background-color] duration-200",
        isOver && TINT[status].ring,
      )}
    >
      <h2 className="flex items-center gap-2 px-1.5 pt-1 pb-2.5 text-[13.5px] font-semibold">
        <span className={cn("size-2 rounded-full", TINT[status].dot)} />
        {label}
        <span className="ml-auto rounded-full bg-surface px-2 text-[12px] font-medium text-ink-muted tabular-nums">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="m-1 flex flex-1 items-center justify-center rounded-[12px] border border-dashed border-ink/15 px-4 py-6 text-center text-[12.5px] text-ink-muted">
          {empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={label}>
          {limited.map((blocker) => (
            <BoardCard key={blocker.id} blocker={blocker} now={now} suppressClick={suppressClick} />
          ))}
        </ul>
      )}
      {limited.length < items.length && (
        <button type="button" onClick={() => setShowAll(true)} className="mt-2 rounded-lg py-1.5 text-[13px] font-medium text-accent hover:bg-surface">
          Ver {items.length - limited.length} más
        </button>
      )}
    </section>
  );
}

/** Tablero por estado: se arrastran las tarjetas entre columnas para cambiarlo. */
export function BlockerBoard({
  blockers,
  now,
  onMove,
}: {
  blockers: BlockerEntry[];
  now: Date;
  onMove: (id: number, status: BlockerStatus) => void;
}) {
  // 6 px de margen: un clic abre la tarjeta, un arrastre la mueve.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<number | null>(null);
  // Tras soltar, el navegador dispara un clic sobre la tarjeta: no debe abrirla.
  const justDragged = useRef(false);
  const active = blockers.find((b) => b.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active: started }) => {
        setActiveId(Number(started.id));
        justDragged.current = true;
      }}
      onDragEnd={({ active: dragged, over }) => {
        setActiveId(null);
        window.setTimeout(() => (justDragged.current = false), 0);
        const blocker = blockers.find((b) => b.id === Number(dragged.id));
        const target = over?.id as BlockerStatus | undefined;
        if (blocker && target && target !== blocker.status) onMove(blocker.id, target);
      }}
      onDragCancel={() => {
        setActiveId(null);
        justDragged.current = false;
      }}
    >
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {BOARD_COLUMNS.map((status) => (
          <Column
            key={status}
            status={status}
            items={blockers.filter((b) => b.status === status)}
            now={now}
            suppressClick={() => justDragged.current}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {active && (
          <div className={cn(cardClass, "rotate-[1.5deg] cursor-grabbing shadow-float")}>
            <CardBody blocker={active} now={now} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
