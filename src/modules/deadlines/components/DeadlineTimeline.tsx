import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { Deadline } from "@/database/repositories/deadlines.repository";
import { cn } from "@/utils/cn";
import { toISODate } from "@/utils/date";
import { countdown, groupOf, KIND_META, parseDue, timelineWeeks } from "../schedule";

const weekday = new Intl.DateTimeFormat("es", { weekday: "short" });

const COUNTDOWN_TONE = {
  overdue: "text-danger font-semibold",
  today: "text-warning font-semibold",
  week: "text-ink",
  later: "text-ink-muted",
  done: "text-ink-muted",
} as const;

function DoneToggle({ deadline, onToggle }: { deadline: Deadline; onToggle: (id: number) => void }) {
  const done = Boolean(deadline.done_at);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Marcar «${deadline.title}» como pendiente` : `Marcar «${deadline.title}» como hecha`}
      onClick={() => onToggle(deadline.id)}
      className={cn(
        "pressable grid size-[24px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
        done ? "border-success bg-success text-white" : "border-ink/25 bg-surface hover:border-accent",
      )}
    >
      {done && <Check className="animate-pop size-3.5" strokeWidth={3} />}
    </button>
  );
}

/** Fila de la línea de tiempo: fecha a la izquierda, punto en la línea y tarjeta. */
function TimelineRow({ deadline, now, onToggle }: { deadline: Deadline; now: Date; onToggle: (id: number) => void }) {
  const { icon: Icon, tint, label } = KIND_META[deadline.kind];
  const due = parseDue(deadline.due_at);
  const today = deadline.due_at.slice(0, 10) === toISODate(now);
  const done = Boolean(deadline.done_at);
  const when = done ? "Hecha" : countdown(deadline.due_at, now);

  return (
    <li className="relative grid grid-cols-[52px_20px_1fr] items-center gap-x-3">
      <div className={cn("text-center leading-tight", today ? "text-accent" : "text-ink-muted")}>
        <div className="text-[11px] font-semibold uppercase">{weekday.format(due).replace(".", "")}</div>
        <div className={cn("text-[20px] font-bold tabular-nums", today ? "text-accent" : "text-ink")}>{due.getDate()}</div>
      </div>
      <div className="relative flex h-full justify-center">
        <span className="absolute inset-y-0 w-px bg-separator" aria-hidden="true" />
        <span className="relative my-auto size-3 rounded-full ring-4 ring-surface" style={{ backgroundColor: tint }} aria-hidden="true" />
      </div>
      <div className="my-1.5 flex items-center gap-3 rounded-[14px] border border-separator/50 bg-surface p-3 shadow-card transition-shadow hover:shadow-float">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] text-white" style={{ backgroundColor: tint }} title={label}>
          <Icon className="size-[18px]" strokeWidth={2} />
        </span>
        <Link to={`/deadlines/${deadline.id}`} className="min-w-0 flex-1">
          <span className={cn("block truncate text-[14.5px] font-medium", done && "text-ink-muted line-through")}>{deadline.title}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-muted">
            <span className={cn("tabular-nums", COUNTDOWN_TONE[groupOf(deadline, now)])}>{when}</span>
            {/* "Hoy a las 14:00" ya lleva la hora. */}
            {!when.includes(" a las ") && <span className="tabular-nums">· {deadline.due_at.slice(11, 16)}</span>}
            {deadline.project_name && (
              <span className="truncate">
                · <span style={{ color: deadline.project_color ?? undefined }}>●</span> {deadline.project_name}
              </span>
            )}
            {deadline.weight != null && <span>· {deadline.weight}%</span>}
            {deadline.grade != null && <span className="font-medium text-success">· Nota {deadline.grade}</span>}
          </span>
        </Link>
        <DoneToggle deadline={deadline} onToggle={onToggle} />
      </div>
    </li>
  );
}

/** Línea de tiempo por semanas (sin la entrega destacada) y, al final, las completadas. */
export function DeadlineTimeline({
  deadlines,
  excludeId,
  now,
  onToggle,
}: {
  deadlines: Deadline[];
  excludeId: number | null;
  now: Date;
  onToggle: (id: number) => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const weeks = timelineWeeks(
    deadlines.filter((d) => d.id !== excludeId),
    now,
  );
  const done = deadlines.filter((d) => d.done_at).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  return (
    <div className="flex flex-col gap-6" aria-label="Línea de tiempo de entregas">
      {weeks.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-ink-muted">No hay más entregas pendientes.</p>
      ) : (
        weeks.map((week) => (
          <section key={week.key} aria-label={week.label}>
            <h3
              className={cn(
                "mb-1 flex items-center gap-2 text-[12px] font-semibold tracking-[0.02em] uppercase",
                week.key === "overdue" ? "text-danger" : "text-ink-muted",
              )}
            >
              {week.label}
              <span className="h-px flex-1 bg-separator/70" />
              <span className="tabular-nums">{week.items.length}</span>
            </h3>
            <ul>
              {week.items.map((deadline) => (
                <TimelineRow key={deadline.id} deadline={deadline} now={now} onToggle={onToggle} />
              ))}
            </ul>
          </section>
        ))
      )}

      {done.length > 0 && (
        <section aria-label="Completadas">
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            aria-expanded={showDone}
            className="flex w-full items-center gap-2 text-[12px] font-semibold tracking-[0.02em] text-ink-muted uppercase"
          >
            Completadas
            <span className="h-px flex-1 bg-separator/70" />
            <span className="tabular-nums">{done.length}</span>
            <ChevronDown className={cn("size-4 transition-transform", showDone && "rotate-180")} />
          </button>
          {showDone && (
            <ul className="mt-1">
              {done.map((deadline) => (
                <TimelineRow key={deadline.id} deadline={deadline} now={now} onToggle={onToggle} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
