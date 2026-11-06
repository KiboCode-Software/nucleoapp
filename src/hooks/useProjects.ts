import { useEffect, useState } from "react";
import { isTauri } from "@/database/client";
import { projectsRepository, type ProjectOption } from "@/database/repositories/projects.repository";

/** Proyectos activos para los selectores de los formularios. */
export function useProjects(): ProjectOption[] {
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    projectsRepository.listActive().then((list) => !cancelled && setProjects(list), console.error);
    return () => {
      cancelled = true;
    };
  }, []);

  return projects;
}
