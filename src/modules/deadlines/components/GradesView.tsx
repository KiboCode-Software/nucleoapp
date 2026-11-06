import { GraduationCap } from "lucide-react";
import { Link } from "react-router";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { fieldClass } from "@/components/ui/fields";
import type { Deadline } from "@/database/repositories/deadlines.repository";
import { useSettingsStore } from "@/stores/settings.store";
import { cn } from "@/utils/cn";
import { formatGrade, SCALES, subjectGrades, type SubjectGrades } from "../grades";

const STATUS: Record<SubjectGrades["status"], { label: string; tone: string }> = {
  passed: { label: "Aprobada", tone: "bg-success-soft text-success" },
  failed: { label: "No alcanza", tone: "bg-danger-soft text-danger" },
  "on-track": { label: "Vas bien", tone: "bg-accent-soft text-accent" },
  "at-risk": { label: "En riesgo", tone: "bg-warning-soft text-warning" },
  impossible: { label: "Ya no alcanza", tone: "bg-danger-soft text-danger" },
  "no-data": { label: "Sin notas", tone: "bg-line/70 text-ink-muted" },
};

function SubjectCard({ subject, scale, pass }: { subject: SubjectGrades; scale: number; pass: number }) {
  const status = STATUS[subject.status];
  const pendingWeight = subject.pending.reduce((sum, d) => sum + (d.weight ?? 0), 0);
  const message =
    subject.status === "passed"
      ? "Con lo acumulado ya apruebas, aunque saques 0 en lo que falta."
      : subject.status === "failed"
        ? `La nota final queda en ${formatGrade(subject.accumulated)}.`
        : subject.status === "impossible"
          ? `Necesitarías ${formatGrade(subject.needed ?? 0)} de media en lo que falta: más que la nota máxima.`
          : subject.needed != null && subject.evaluatedWeight > 0
            ? `Necesitas ${formatGrade(subject.needed)} de media en el ${formatGrade(100 - subject.evaluatedWeight)}% que falta para llegar a ${formatGrade(pass)}.`
            : "Añade la ponderación y la nota de cada entrega para ver tu media.";

  return (
    <section aria-label={subject.name} className="flex flex-col gap-4 rounded-[18px] border border-separator/50 bg-surface p-5 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 truncate text-[16px] font-semibold">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color ?? "var(--color-ink-muted)" }} />
            {subject.name}
          </h3>
          <p className="text-[12.5px] text-ink-muted">Evaluado {formatGrade(subject.evaluatedWeight)}% de la nota final</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold", status.tone)}>{status.label}</span>
      </header>

      <div className="flex items-end gap-6">
        <div>
          <p className="text-[12px] font-medium text-ink-muted">Media</p>
          <p
            className={cn(
              "text-[38px] leading-none font-bold tracking-[-0.03em] tabular-nums",
              subject.average == null ? "text-ink-muted" : subject.average >= pass ? "text-success" : "text-danger",
            )}
          >
            {subject.average == null ? "–" : formatGrade(subject.average)}
            <span className="text-[16px] font-medium text-ink-muted"> /{scale}</span>
          </p>
        </div>
        <div>
          <p className="text-[12px] font-medium text-ink-muted">Acumulado</p>
          <p className="text-[20px] font-semibold tabular-nums">{formatGrade(subject.accumulated)}</p>
        </div>
      </div>

      {/* Barra de la nota final: verde lo evaluado, gris lo pendiente con ponderación. */}
      <div className="flex h-2 overflow-hidden rounded-full bg-fill" aria-hidden="true">
        <span className="bg-success" style={{ width: `${subject.evaluatedWeight}%` }} />
        <span className="bg-ink/15" style={{ width: `${Math.min(100 - subject.evaluatedWeight, pendingWeight)}%` }} />
      </div>
      <p className="text-[13px] text-ink-muted">{message}</p>

      {subject.graded.length + subject.pending.length > 0 && (
        <ul className="flex flex-col divide-y divide-separator/50 text-[13.5px]">
          {[...subject.graded, ...subject.pending].map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-1.5">
              <Link to={`/deadlines/${d.id}?vista=notas`} className="min-w-0 flex-1 truncate hover:underline">
                {d.title}
              </Link>
              <span className="text-ink-muted tabular-nums">{formatGrade(d.weight ?? 0)}%</span>
              <span className={cn("w-12 text-right font-semibold tabular-nums", d.grade == null && "font-normal text-ink-muted")}>
                {d.grade == null ? "—" : formatGrade(d.grade)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {subject.unweighted.length > 0 && (
        <p className="text-[12px] text-ink-muted">
          {subject.unweighted.length} {subject.unweighted.length === 1 ? "entrega sin ponderación no cuenta" : "entregas sin ponderación no cuentan"} para la media.
        </p>
      )}
    </section>
  );
}

/** Notas por materia: media ponderada, acumulado y cuánto necesitas para aprobar. */
export function GradesView({ deadlines }: { deadlines: Deadline[] }) {
  const grading = useSettingsStore((s) => s.settings.grading);
  const patch = useSettingsStore((s) => s.patch);
  const subjects = subjectGrades(deadlines, grading);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-[13.5px] font-medium">
            Escala
            <select
              value={grading.scale}
              onChange={(e) => {
                const scale = Number(e.target.value) as (typeof SCALES)[number];
                // La nota para aprobar se ajusta proporcionalmente a la nueva escala.
                void patch("grading", { scale, pass: Math.round((grading.pass / grading.scale) * scale * 100) / 100 });
              }}
              className={fieldClass + " h-9 w-28 font-normal"}
            >
              {SCALES.map((s) => (
                <option key={s} value={s}>
                  0 – {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[13.5px] font-medium">
            Para aprobar
            <input
              type="number"
              min={0.1}
              max={grading.scale}
              step={grading.scale <= 10 ? 0.1 : 1}
              value={grading.pass}
              onChange={(e) => {
                const pass = Number(e.target.value);
                if (pass > 0 && pass <= grading.scale) void patch("grading", { pass });
              }}
              className={fieldClass + " h-9 w-24 font-normal"}
            />
          </label>
          <p className="text-[12.5px] text-ink-muted">Pon la ponderación (%) y la nota de cada entrega para calcular tu media.</p>
        </div>
      </Card>

      {subjects.length === 0 ? (
        <Card>
          <EmptyState icon={GraduationCap} title="Aún no hay notas" description="Cuando añadas entregas con su ponderación y nota, verás aquí la media de cada materia." />
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {subjects.map((subject) => (
            <SubjectCard key={subject.projectId ?? "none"} subject={subject} scale={grading.scale} pass={grading.pass} />
          ))}
        </div>
      )}
    </div>
  );
}
