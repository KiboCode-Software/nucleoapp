import { FileX, FolderKanban, Monitor, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { isTauri } from "@/database/client";
import { projectsRepository, type ProjectSummary } from "@/database/repositories/projects.repository";
import { useModule } from "@/modules/registry";
import { useBlockersStore } from "@/stores/blockers.store";
import { useDailyLogsStore } from "@/stores/daily-logs.store";
import { useLearningsStore } from "@/stores/learnings.store";
import { ProjectCard } from "./components/ProjectCard";
import { ProjectDetail } from "./components/ProjectDetail";
import { ProjectForm } from "./components/ProjectForm";
import { useVocab } from "@/modes/vocabulary";

const NEW = "nuevo";

/** Los nombres de proyecto se muestran en registros, bloqueos y aprendizajes: hay que releerlos. */
function reloadDependentStores() {
  for (const store of [useDailyLogsStore, useBlockersStore, useLearningsStore]) {
    if (store.getState().status === "ready") void store.getState().load();
  }
}

export function ProjectsPage() {
  const v = useVocab();
  const { label, description } = useModule("projects");
  const { projectId } = useParams();
  const navigate = useNavigate();
  const available = isTauri();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const now = new Date();

  const reload = useCallback(async () => {
    try {
      setProjects(await projectsRepository.list());
    } catch (error) {
      console.error("No se pudieron cargar los proyectos", error);
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    if (available) void reload();
  }, [available, reload]);

  if (!available) {
    return (
      <>
        <PageHeader title={label} subtitle={description} />
        <Card>
          <EmptyState
            icon={Monitor}
            title="Disponible en la app de escritorio"
            description={`Tus ${v.project.many} se guardan en SQLite local. Abre la app con npm run tauri dev.`}
          />
        </Card>
      </>
    );
  }

  if (!projects) return <PageHeader title={label} subtitle={description} />;

  if (projectId === NEW) {
    return (
      <>
        <PageHeader title={v.project.newLabel} subtitle={description} />
        <Card className="max-w-xl">
          <ProjectForm
            initial={{ name: "", description: "", color: "#007AFF" }}
            submitLabel={v.project.createLabel}
            autoFocus
            onSubmit={async (input) => {
              const created = await projectsRepository.create(input);
              await reload();
              navigate(`/projects/${created.id}`, { replace: true });
            }}
          />
        </Card>
      </>
    );
  }

  if (projectId) {
    const project = projects.find((p) => p.id === Number(projectId));
    if (!project) {
      return (
        <Card>
          <EmptyState
            icon={FileX}
            title={v.project.missing}
            action={
              <Link to="/projects" className="text-[13px] font-medium text-accent hover:underline">
                Volver a {label}
              </Link>
            }
          />
        </Card>
      );
    }
    return (
      <ProjectDetail
        project={project}
        now={now}
        onUpdate={async (input) => {
          await projectsRepository.update(project.id, input);
          await reload();
          reloadDependentStores();
        }}
        onArchive={async (archived) => {
          await projectsRepository.setArchived(project.id, archived);
          await reload();
        }}
        onDelete={async () => {
          await projectsRepository.remove(project.id);
          await reload();
          reloadDependentStores();
          navigate("/projects", { replace: true });
        }}
      />
    );
  }

  const archivedCount = projects.filter((p) => p.archived).length;
  // Si se reactiva el último archivado, el filtro vuelve solo a "Activos".
  const showArchived = filter === "archived" && archivedCount > 0;
  const visible = projects.filter((p) => p.archived === showArchived);

  return (
    <>
      <PageHeader
        title={label}
        subtitle={description}
        actions={
          <Button onClick={() => navigate(`/projects/${NEW}`)}>
            <Plus className="size-4" /> {v.project.newLabel}
          </Button>
        }
      />

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title={v.project.firstTitle}
            description={v.project.firstDescription}
            action={<Button onClick={() => navigate(`/projects/${NEW}`)}>{v.project.newLabel}</Button>}
          />
        </Card>
      ) : (
        <>
          {archivedCount > 0 && (
            <div className="mb-5 w-64">
              <SegmentedControl
                label={`Filtrar ${v.project.many}`}
                value={showArchived ? "archived" : "active"}
                onChange={setFilter}
                segments={[
                  { value: "active", label: v.mode === "student" ? "Activas" : "Activos", count: projects.length - archivedCount },
                  { value: "archived", label: v.mode === "student" ? "Archivadas" : "Archivados", count: archivedCount },
                ]}
              />
            </div>
          )}
          {visible.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-muted">{v.project.noneActive}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((project) => (
                <ProjectCard key={project.id} project={project} now={now} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
