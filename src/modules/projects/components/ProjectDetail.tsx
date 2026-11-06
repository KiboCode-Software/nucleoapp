import { Archive, ArchiveRestore, ChevronLeft, CircleAlert, CircleCheck, Lightbulb, NotebookPen } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import { ConfirmDelete } from "@/components/shared/ConfirmDelete";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import type { ProjectSummary } from "@/database/repositories/projects.repository";
import { logSummary } from "@/modules/daily-log/summary";
import { ensureBlockersLoaded, isOpen, useBlockersStore } from "@/stores/blockers.store";
import { ensureDailyLogsLoaded, useDailyLogsStore } from "@/stores/daily-logs.store";
import { ensureLearningsLoaded, useLearningsStore } from "@/stores/learnings.store";
import type { ProjectInput } from "@/types/entities";
import { elapsedBetween, formatDayLabel } from "@/utils/date";
import { ProjectDot } from "./ProjectCard";
import { ProjectForm } from "./ProjectForm";
import { useVocab } from "@/modes/vocabulary";

const LIST_LIMIT = 5;

interface ProjectDetailProps {
  project: ProjectSummary;
  now: Date;
  onUpdate: (input: ProjectInput) => Promise<void>;
  onArchive: (archived: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
}

function LinkList({ empty, children }: { empty: string; children: ReactNode[] }) {
  if (children.length === 0) return <p className="text-[13px] text-ink-muted">{empty}</p>;
  return <ul className="-mx-2 flex flex-col">{children}</ul>;
}

function Row({ to, children, meta }: { to: string; children: ReactNode; meta?: ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-muted">
        <span className="min-w-0 flex-1 truncate text-[13.5px]">{children}</span>
        {meta && <span className="shrink-0 text-xs text-ink-muted">{meta}</span>}
      </Link>
    </li>
  );
}

export function ProjectDetail({ project, now, onUpdate, onArchive, onDelete }: ProjectDetailProps) {
  const v = useVocab();
  const logs = useDailyLogsStore((s) => s.logs).filter((l) => l.project_id === project.id);
  const blockers = useBlockersStore((s) => s.blockers).filter((b) => b.project_id === project.id && isOpen(b));
  const learnings = useLearningsStore((s) => s.learnings).filter((l) => l.project_id === project.id);

  useEffect(() => {
    ensureDailyLogsLoaded();
    ensureBlockersLoaded();
    ensureLearningsLoaded();
  }, []);

  return (
    <>
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
        <ChevronLeft className="size-4" /> {v.modules.projects.label}
      </Link>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <ProjectDot color={project.color} size="size-3.5" />
          <h1 className="truncate text-[28px] leading-tight font-semibold tracking-tight">{project.name}</h1>
          {project.archived && <Badge>Archivado</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => void onArchive(!project.archived)}>
            {project.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {project.archived ? "Reactivar" : "Archivar"}
          </Button>
          <ConfirmDelete
            label={v.project.deleteLabel}
            question={v.project.deleteQuestion}
            onConfirm={onDelete}
          />
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Registros" value={project.logs_count} icon={NotebookPen} />
        <StatCard label={v.blocker.open} value={project.open_blockers} icon={CircleAlert} tone="warning" />
        <StatCard label={v.blocker.resolved} value={project.resolved_blockers} icon={CircleCheck} tone="success" />
        <StatCard label={v.modules.learning.label} value={project.learnings_count} icon={Lightbulb} tone="success" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card title="Registros recientes">
            <LinkList empty={v.project.noLogs}>
              {logs.slice(0, LIST_LIMIT).map((log) => (
                <Row key={log.id} to={`/daily-log/${log.id}`} meta={formatDayLabel(log.log_date, now)}>
                  {logSummary(log)}
                </Row>
              ))}
            </LinkList>
          </Card>
          <Card title={v.blocker.open}>
            <LinkList empty={`${v.blocker.noneOpen}.`}>
              {blockers.map((b) => (
                <Row key={b.id} to={`/blockers/${b.id}`} meta={elapsedBetween(b.opened_at, null, now)}>
                  {b.title}
                </Row>
              ))}
            </LinkList>
          </Card>
          <Card title={v.modules.learning.label}>
            <LinkList empty={v.project.noLearnings}>
              {learnings.slice(0, LIST_LIMIT).map((l) => (
                <Row key={l.id} to={`/learning/${l.id}`}>
                  {l.title}
                </Row>
              ))}
            </LinkList>
          </Card>
        </div>

        <Card title={v.project.data}>
          <ProjectForm
            key={project.id}
            initial={{ name: project.name, description: project.description, color: project.color }}
            submitLabel="Guardar cambios"
            onSubmit={onUpdate}
          />
        </Card>
      </div>
    </>
  );
}
