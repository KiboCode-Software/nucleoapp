import type { Deadline } from "@/database/repositories/deadlines.repository";

export interface GradingScale {
  /** Nota máxima (5, 10, 20 o 100). */
  scale: number;
  /** Nota mínima para aprobar. */
  pass: number;
}

export const SCALES = [5, 10, 20, 100] as const;

export interface SubjectGrades {
  projectId: number | null;
  name: string;
  color: string | null;
  /** Entregas con nota y ponderación, las que cuentan para la media. */
  graded: Deadline[];
  /** Entregas con ponderación pero aún sin nota. */
  pending: Deadline[];
  /** Entregas sin ponderación: no se pueden tener en cuenta. */
  unweighted: Deadline[];
  /** Porcentaje de la nota final ya evaluado (0–100). */
  evaluatedWeight: number;
  /** Media de lo evaluado, en la escala (null si no hay nada evaluado). */
  average: number | null;
  /** Lo acumulado sobre la nota final (como si lo no evaluado fuera 0). */
  accumulated: number;
  /** Nota media necesaria en lo que falta para aprobar; null si ya no falta nada. */
  needed: number | null;
  status: "passed" | "failed" | "on-track" | "at-risk" | "impossible" | "no-data";
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Calcula, por materia, la media ponderada y lo que hace falta para aprobar. */
export function subjectGrades(deadlines: Deadline[], { scale, pass }: GradingScale): SubjectGrades[] {
  const groups = new Map<string, Deadline[]>();
  for (const d of deadlines) {
    const key = d.project_id == null ? "none" : String(d.project_id);
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  return [...groups.values()]
    .map((items) => {
      const first = items[0];
      const graded = items.filter((d) => d.weight != null && d.grade != null);
      const pending = items.filter((d) => d.weight != null && d.grade == null);
      const unweighted = items.filter((d) => d.weight == null);

      const evaluatedWeight = Math.min(100, graded.reduce((sum, d) => sum + (d.weight ?? 0), 0));
      // Puntos porcentuales ganados de la nota final (0–100).
      const earned = graded.reduce((sum, d) => sum + (Math.min(d.grade ?? 0, scale) / scale) * (d.weight ?? 0), 0);
      const remaining = Math.max(0, 100 - evaluatedWeight);
      const target = (pass / scale) * 100;

      const average = evaluatedWeight > 0 ? round((earned / evaluatedWeight) * scale) : null;
      const accumulated = round((earned / 100) * scale);
      const needed = remaining > 0 ? round(((target - earned) / remaining) * scale) : null;

      let status: SubjectGrades["status"];
      if (evaluatedWeight === 0) status = "no-data";
      else if (earned >= target - 1e-9) status = "passed";
      else if (remaining === 0) status = "failed";
      else if ((needed ?? 0) > scale) status = "impossible";
      else status = (average ?? 0) >= pass ? "on-track" : "at-risk";

      return {
        projectId: first.project_id,
        name: first.project_name ?? "Sin materia",
        color: first.project_color,
        graded,
        pending,
        unweighted,
        evaluatedWeight: round(evaluatedWeight),
        average,
        accumulated,
        needed: needed == null ? null : Math.max(0, needed),
        status,
      };
    })
    .sort((a, b) => (a.projectId == null ? 1 : b.projectId == null ? -1 : a.name.localeCompare(b.name, "es")));
}

/** Nota con coma decimal: 3.456 → "3,46"; 4 → "4". */
export function formatGrade(value: number): string {
  return new Intl.NumberFormat("es", { maximumFractionDigits: 2 }).format(value);
}
