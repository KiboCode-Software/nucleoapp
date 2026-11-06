import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import type { ProjectSummary } from "@/database/repositories/projects.repository";
import { formatDayLabel } from "@/utils/date";
import { useVocab } from "@/modes/vocabulary";

export function ProjectDot({ color, size = "size-2.5" }: { color: string | null; size?: string }) {
  return <span className={`${size} shrink-0 rounded-full`} style={{ backgroundColor: color ?? "var(--ink-muted)" }} />;
}

export function ProjectCard({ project, now }: { project: ProjectSummary; now: Date }) {
  const v = useVocab();
  const stats = [
    `${project.logs_count} ${project.logs_count === 1 ? "registro" : "registros"}`,
    `${project.learnings_count} ${project.learnings_count === 1 ? v.learning.one : v.learning.many}`,
  ];

  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-2.5">
        <ProjectDot color={project.color} />
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight">{project.name}</h2>
        {project.open_blockers > 0 && (
          <Badge tone="warning">
            {project.open_blockers} {project.open_blockers === 1 ? v.blocker.one : v.blocker.many}
          </Badge>
        )}
      </div>
      <p className="line-clamp-2 min-h-[2lh] text-[13px] text-ink-muted">{project.description || "Sin descripción"}</p>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-3 text-[12px] text-ink-muted">
        <span>{stats.join(" · ")}</span>
        <span>{project.last_log_date ? formatDayLabel(project.last_log_date, now) : "Sin actividad"}</span>
      </div>
    </Link>
  );
}
