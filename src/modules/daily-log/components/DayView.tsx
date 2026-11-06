import { ArrowUpRight, ChevronLeft, ChevronRight, CircleAlert, GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ConfirmDelete } from "@/components/shared/ConfirmDelete";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/fields";
import { useProjects } from "@/hooks/useProjects";
import { useBlockersStore } from "@/stores/blockers.store";
import { useDailyLogsStore } from "@/stores/daily-logs.store";
import { useLearningsStore } from "@/stores/learnings.store";
import { formatDayLabel, formatLongDate, fromISODate, toISODate } from "@/utils/date";
import { parseTasks } from "../tasks";
import { useDayLog } from "../useDayLog";
import { currentMoment, SaveIndicator } from "./MomentCard";
import { CommitsCard } from "./CommitsCard";
import { NoteCard } from "./NoteCard";
import { PlanCard } from "./PlanCard";
import { useVocab } from "@/modes/vocabulary";

/** Primera línea como título (máx. 140) y el resto como descripción. */
function splitAnswer(text: string): { title: string; rest: string } {
  const [title, ...rest] = text.trim().split("\n");
  return { title: title.slice(0, 140), rest: rest.join("\n").trim() };
}

const shiftDay = (date: string, delta: number) => {
  const d = fromISODate(date);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta));
};

export const dayPath = (date: string) => (date === toISODate(new Date()) ? "/daily-log" : `/daily-log/dia/${date}`);

const linkClass = "inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline";

/** Un día del registro: plan (mañana), bloqueos (durante el día) y aprendizajes (al cerrar). */
export function DayView({ date, logId }: { date: string; logId?: number }) {
  const v = useVocab();
  const navigate = useNavigate();
  const projects = useProjects();
  const { log, save, state } = useDayLog(date, logId);
  const logs = useDailyLogsStore((s) => s.logs);
  const blockers = useBlockersStore((s) => s.blockers);
  const createBlocker = useBlockersStore((s) => s.create);
  const learnings = useLearningsStore((s) => s.learnings);
  const saveLearning = useLearningsStore((s) => s.save);

  const today = toISODate(new Date());
  const isToday = date === today;
  const moment = isToday ? currentMoment() : null;

  // El proyecto se recuerda aunque el día aún no tenga contenido; se aplica al primer guardado.
  const [project, setProject] = useState<number | null>(log?.project_id ?? null);
  useEffect(() => setProject(log?.project_id ?? null), [log?.id, log?.project_id]);
  const saveField = (changes: Parameters<typeof save>[0]) => void save({ project_id: project, ...changes });

  // Tareas sin terminar del registro anterior a este día.
  const previous = logs.find((l) => l.log_date < date && parseTasks(l.today).some((t) => !t.done));
  const carryOver = previous
    ? { label: formatDayLabel(previous.log_date).toLowerCase(), tasks: parseTasks(previous.today).filter((t) => !t.done) }
    : null;

  const linkedBlocker = log ? blockers.find((b) => b.daily_log_id === log.id) : undefined;
  const linkedLearning = log ? learnings.find((l) => l.daily_log_id === log.id) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Día anterior"
            onClick={() => navigate(dayPath(shiftDay(date, -1)))}
            className="grid size-9 place-items-center rounded-xl text-ink-muted hover:bg-fill hover:text-ink"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Día siguiente"
            disabled={isToday}
            onClick={() => navigate(dayPath(shiftDay(date, 1)))}
            className="grid size-9 place-items-center rounded-xl text-ink-muted hover:bg-fill hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="min-w-0">
          <p className="text-[20px] font-semibold tracking-tight first-letter:uppercase">
            {isToday ? "Hoy" : formatDayLabel(date)}
            <span className="ml-2 text-[14px] font-normal text-ink-muted">{formatLongDate(fromISODate(date))}</span>
          </p>
        </div>
        {!isToday && (
          <Button variant="ghost" onClick={() => navigate("/daily-log")} className="px-3">
            Ir a hoy
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <SaveIndicator state={state} />
          {projects.length > 0 && (
            <select
              aria-label={v.project.ofDay}
              value={project ?? ""}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : null;
                setProject(value);
                if (log) void save({ project_id: value });
              }}
              className={fieldClass + " h-9 min-w-44"}
            >
              <option value="">{v.project.none}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {log && <ConfirmDelete label="Eliminar el registro del día" question="¿Borrar todo lo de este día?" onConfirm={() => useDailyLogsStore.getState().remove(log.id)} />}
        </div>
      </div>

      {log?.yesterday.trim() && (
        // Registros antiguos: se conserva lo que se escribió en "¿Qué hice ayer?".
        <p className="rounded-xl border border-line bg-surface-muted px-4 py-3 text-[13px] text-ink-muted">
          <span className="font-medium text-ink">Avances anotados (formato anterior):</span> {log.yesterday}
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-6">
          <PlanCard text={log?.today ?? ""} current={moment === "morning"} carryOver={carryOver} onChange={(today) => saveField({ today })} />
          {v.mode === "dev" && <CommitsCard date={date} plan={log?.today ?? ""} onPlanChange={(today) => saveField({ today })} />}
        </div>

        <div className="flex flex-col gap-6">
          <NoteCard
            key={`blockers-${date}-${logId ?? ""}`}
            moment="day"
            icon={CircleAlert}
            title={v.day.blockersTitle}
            question={v.day.blockersQuestion}
            placeholder={v.day.blockersPlaceholder}
            value={log?.blockers_note ?? ""}
            current={moment === "day"}
            onSave={(blockers_note) => saveField({ blockers_note })}
            footer={
              log?.blockers_note.trim() &&
              (linkedBlocker ? (
                <Link to={`/blockers/${linkedBlocker.id}`} className={linkClass}>
                  {v.blocker.viewFromDay} <ArrowUpRight className="size-3.5" />
                </Link>
              ) : (
                <button
                  type="button"
                  className={linkClass + " self-start"}
                  onClick={async () => {
                    const { title, rest } = splitAnswer(log.blockers_note);
                    const blocker = await createBlocker({ title, description: rest, project_id: log.project_id, daily_log_id: log.id });
                    navigate(`/blockers/${blocker.id}`);
                  }}
                >
                  {v.blocker.registerFromDay}
                </button>
              ))
            }
          />

          <NoteCard
            key={`learnings-${date}-${logId ?? ""}`}
            moment="evening"
            icon={GraduationCap}
            title={v.day.learningsTitle}
            question={v.day.learningsQuestion}
            placeholder={v.day.learningsPlaceholder}
            value={log?.learnings ?? ""}
            current={moment === "evening"}
            onSave={(learnings) => saveField({ learnings })}
            footer={
              log?.learnings.trim() &&
              (linkedLearning ? (
                <Link to={`/learning/${linkedLearning.id}`} className={linkClass}>
                  {v.learning.viewFromDay} <ArrowUpRight className="size-3.5" />
                </Link>
              ) : (
                <button
                  type="button"
                  className={linkClass + " self-start"}
                  onClick={async () => {
                    const { title, rest } = splitAnswer(log.learnings);
                    const learning = await saveLearning({ kind: "note", title, content: rest, project_id: log.project_id, daily_log_id: log.id });
                    navigate(`/learning/${learning.id}`);
                  }}
                >
                  {v.learning.saveFromDay}
                </button>
              ))
            }
          />
        </div>
      </div>
    </div>
  );
}
