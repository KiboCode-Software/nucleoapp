import { CalendarCheck, FileX, Monitor, Plus, RotateCcw } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDelete } from "@/components/shared/ConfirmDelete";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useNow } from "@/hooks/useNow";
import { useProjects } from "@/hooks/useProjects";
import type { Deadline } from "@/database/repositories/deadlines.repository";
import { useModule } from "@/modules/registry";
import { ensureDeadlinesLoaded, useDeadlinesStore } from "@/stores/deadlines.store";
import { DeadlineForm } from "./components/DeadlineForm";
import { DeadlineTimeline } from "./components/DeadlineTimeline";
import { GradesView } from "./components/GradesView";
import { NextDeadline } from "./components/NextDeadline";
import { countdown, defaultDue, formatDue, groupOf, KIND_META, nextDeadline } from "./schedule";

const NEW = "nuevo";

const toInput = (d: Deadline) => ({
  title: d.title,
  kind: d.kind,
  due_at: d.due_at,
  project_id: d.project_id,
  notes: d.notes,
  weight: d.weight,
  grade: d.grade,
});

export function DeadlinesPage() {
  const { label, description } = useModule("deadlines");
  const { deadlineId } = useParams();
  const navigate = useNavigate();
  const projects = useProjects();
  // Cada 30 s: la cuenta regresiva destacada muestra minutos.
  const now = useNow(30_000);
  const { deadlines, status, create, update, toggleDone, remove } = useDeadlinesStore();

  useEffect(ensureDeadlinesLoaded, []);

  // Vista "Notas" en la URL (?vista=notas) para que abrir y cerrar una entrega no la pierda.
  const [params] = useSearchParams();
  const view = params.get("vista") === "notas" ? "grades" : "timeline";
  const suffix = view === "grades" ? "?vista=notas" : "";
  const close = () => navigate(`/deadlines${suffix}`);
  const toggle = (id: number) => void toggleDone(id).catch((error: unknown) => console.error("No se pudo actualizar la entrega", error));
  const next = nextDeadline(deadlines);
  const selected = deadlineId && deadlineId !== NEW ? (deadlines.find((d) => d.id === Number(deadlineId)) ?? null) : null;

  const header = (
    <PageHeader
      title={label}
      subtitle={description}
      actions={
        status === "ready" && (
          <div className="flex items-center gap-3">
            <div className="w-52">
              <SegmentedControl<"timeline" | "grades">
                label="Vista"
                value={view}
                onChange={(next) => navigate(next === "grades" ? "/deadlines?vista=notas" : "/deadlines")}
                segments={[
                  { value: "timeline", label: "Entregas" },
                  { value: "grades", label: "Notas" },
                ]}
              />
            </div>
            <Button onClick={() => navigate(`/deadlines/${NEW}${suffix}`)}>
              <Plus className="size-4" /> Nueva entrega
            </Button>
          </div>
        )
      }
    />
  );

  if (status === "unavailable" || status === "error") {
    return (
      <>
        {header}
        <Card>
          {status === "unavailable" ? (
            <EmptyState
              icon={Monitor}
              title="Disponible en la app de escritorio"
              description="Las entregas se guardan en SQLite local. Abre la app con npm run tauri dev."
            />
          ) : (
            <p className="text-[14px] text-danger">No se pudieron cargar las entregas. Revisa la consola para más detalles.</p>
          )}
        </Card>
      </>
    );
  }

  if (status !== "ready") return header;

  return (
    <>
      {header}

      {view === "grades" ? (
        <GradesView deadlines={deadlines} />
      ) : deadlines.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarCheck}
            title="Aún no hay entregas"
            description="Añade trabajos, exámenes y exposiciones con su fecha límite para ver la cuenta regresiva."
            action={<Button onClick={() => navigate(`/deadlines/${NEW}`)}>Añadir la primera</Button>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          <NextDeadline deadline={next} now={now} onDone={toggle} />
          <DeadlineTimeline deadlines={deadlines} excludeId={next?.id ?? null} now={now} onToggle={toggle} />
        </div>
      )}

      {deadlineId === NEW && (
        <Sheet title="Nueva entrega" onClose={close}>
          <DeadlineForm
            initial={{ title: "", kind: "assignment", due_at: defaultDue(now), project_id: null, notes: "", weight: null, grade: null }}
            projects={projects}
            submitLabel="Añadir entrega"
            autoFocus
            onSubmit={async (input) => {
              await create(input);
              close();
            }}
          />
        </Sheet>
      )}

      {deadlineId && deadlineId !== NEW && (
        <Sheet title={selected?.title ?? "Esta entrega ya no existe"} onClose={close}>
          {selected ? (
            <DeadlineDetail
              key={selected.id}
              deadline={selected}
              now={now}
              onToggle={() => toggle(selected.id)}
              onDelete={async () => {
                await remove(selected.id);
                navigate(`/deadlines${suffix}`, { replace: true });
              }}
            >
              <DeadlineForm
                initial={toInput(selected)}
                projects={projects}
                submitLabel="Guardar cambios"
                onSubmit={async (input) => void (await update(selected.id, input))}
              />
            </DeadlineDetail>
          ) : (
            <EmptyState icon={FileX} title="Esta entrega ya no existe" />
          )}
        </Sheet>
      )}
    </>
  );
}

function DeadlineDetail({
  deadline,
  now,
  onToggle,
  onDelete,
  children,
}: {
  deadline: Deadline;
  now: Date;
  onToggle: () => void;
  onDelete: () => Promise<void>;
  children: ReactNode;
}) {
  const { icon: Icon, tint, label } = KIND_META[deadline.kind];
  const group = groupOf(deadline, now);
  const done = group === "done";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-[13px] text-white shadow-card" style={{ backgroundColor: tint }}>
            <Icon className="size-6" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge>{label}</Badge>
              {done ? (
                <Badge tone="success">Hecha</Badge>
              ) : (
                <Badge tone={group === "overdue" ? "danger" : group === "today" ? "warning" : "accent"}>{countdown(deadline.due_at, now)}</Badge>
              )}
              {deadline.weight != null && <Badge>{deadline.weight}% de la nota</Badge>}
              {deadline.grade != null && <Badge tone="success">Nota: {deadline.grade}</Badge>}
            </div>
            <p className="text-[13px] text-ink-muted first-letter:uppercase">{formatDue(deadline.due_at)}</p>
          </div>
        </div>
        {done ? (
          <Button variant="secondary" onClick={onToggle}>
            <RotateCcw className="size-4" /> Marcar como pendiente
          </Button>
        ) : (
          <Button onClick={onToggle}>
            <CalendarCheck className="size-4" /> Marcar como hecha
          </Button>
        )}
      </header>

      {children}

      <footer className="flex justify-end border-t border-line pt-4">
        <ConfirmDelete label="Eliminar entrega" question="¿Eliminar esta entrega?" onConfirm={onDelete} />
      </footer>
    </div>
  );
}
