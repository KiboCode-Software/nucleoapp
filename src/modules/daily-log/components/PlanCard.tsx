import { Check, CornerDownLeft, ListTodo, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { fieldClass } from "@/components/ui/fields";
import { cn } from "@/utils/cn";
import { parseTasks, serializeTasks, type Task } from "../tasks";
import type { SaveState } from "../useDayLog";
import { MomentCard } from "./MomentCard";
import { useVocab } from "@/modes/vocabulary";

interface PlanCardProps {
  text: string;
  current: boolean;
  saveState?: SaveState;
  /** Tareas sin terminar del registro anterior, para traerlas a este día. */
  carryOver: { label: string; tasks: Task[] } | null;
  onChange: (text: string) => void;
}

function TaskRow({ task, onToggle, onEdit, onRemove }: { task: Task; onToggle: () => void; onEdit: (text: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== task.text) onEdit(draft.trim());
    else setDraft(task.text);
  };

  return (
    <li className="group flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface-muted">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `Desmarcar "${task.text}"` : `Marcar como hecha "${task.text}"`}
        onClick={onToggle}
        className={cn(
          "grid size-[22px] shrink-0 place-items-center rounded-full border-2 transition-all duration-150",
          task.done ? "border-success bg-success text-white" : "border-ink-muted/40 hover:border-success",
        )}
      >
        {task.done && <Check className="animate-pop size-3" strokeWidth={3.5} />}
      </button>
      {editing ? (
        <input
          autoFocus
          value={draft}
          aria-label="Editar tarea"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(task.text);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-md bg-surface px-1.5 py-0.5 text-[14.5px] outline-1 outline-accent"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Clic para editar"
          className={cn(
            "min-w-0 flex-1 truncate text-left text-[14.5px] transition-colors",
            task.done && "text-ink-muted line-through decoration-ink-muted/60",
          )}
        >
          {task.text}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar tarea "${task.text}"`}
        className="grid size-6 shrink-0 place-items-center rounded-md text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-fill focus:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

/** "¿Qué harás hoy?" como lista de tareas que se van tachando durante el día. */
export function PlanCard({ text, current, saveState, carryOver, onChange }: PlanCardProps) {
  const v = useVocab();
  // La lista cambia al instante en pantalla y se guarda detrás: varios cambios seguidos
  // (añadir dos tareas rápido) parten siempre de la lista más reciente, no de la guardada.
  const [tasks, setTasks] = useState(() => parseTasks(text));
  const lastSent = useRef(text);
  useEffect(() => {
    if (text !== lastSent.current) {
      lastSent.current = text;
      setTasks(parseTasks(text));
    }
  }, [text]);

  const [draft, setDraft] = useState("");
  const done = tasks.filter((t) => t.done).length;
  const update = (next: Task[]) => {
    setTasks(next);
    lastSent.current = serializeTasks(next);
    onChange(lastSent.current);
  };

  const pendingToBring = carryOver?.tasks.filter((t) => !tasks.some((own) => own.text === t.text)) ?? [];

  function add(event?: KeyboardEvent) {
    if (event && event.key !== "Enter") return;
    event?.preventDefault();
    const value = draft.trim();
    if (!value) return;
    update([...tasks, { text: value, done: false }]);
    setDraft("");
  }

  return (
    <MomentCard
      moment="morning"
      icon={ListTodo}
      title={v.day.planTitle}
      question={v.day.planQuestion}
      current={current}
      saveState={saveState}
      className="min-h-[420px]"
      action={
        tasks.length > 0 && (
          <span className="text-[13px] font-semibold tabular-nums" aria-label={`${done} de ${tasks.length} tareas hechas`}>
            {done}/{tasks.length}
          </span>
        )
      }
    >
      {tasks.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full rounded-full bg-success transition-[width] duration-300" style={{ width: `${(done / tasks.length) * 100}%` }} />
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-ink-muted">{v.day.planEmpty}</p>
      ) : (
        <ul aria-label="Tareas del día" className="-mx-2 flex flex-col">
          {tasks.map((task, i) => (
            <TaskRow
              key={`${i}-${task.text}`}
              task={task}
              onToggle={() => update(tasks.map((t, j) => (j === i ? { ...t, done: !t.done } : t)))}
              onEdit={(value) => update(tasks.map((t, j) => (j === i ? { ...t, text: value } : t)))}
              onRemove={() => update(tasks.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <label className="relative">
          <span className="sr-only">Nueva tarea</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={add}
            maxLength={300}
            placeholder="Añade una tarea y pulsa Enter"
            className={fieldClass + " h-11 w-full pr-10 text-[14px]"}
          />
          <CornerDownLeft className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted/60" />
        </label>
        {pendingToBring.length > 0 && carryOver && (
          <button
            type="button"
            onClick={() => update([...tasks, ...pendingToBring.map((t) => ({ text: t.text, done: false }))])}
            className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-accent hover:underline"
          >
            <Undo2 className="size-3.5" />
            Traer {pendingToBring.length} {pendingToBring.length === 1 ? "pendiente" : "pendientes"} de {carryOver.label}
          </button>
        )}
      </div>
    </MomentCard>
  );
}
