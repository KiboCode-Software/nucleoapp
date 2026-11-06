// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Deadline } from "@/database/repositories/deadlines.repository";
import { formatGrade, subjectGrades } from "@/modules/deadlines/grades";

let next = 1;
const item = (project: [number, string] | null, weight: number | null, grade: number | null): Deadline => ({
  id: next++,
  project_id: project?.[0] ?? null,
  project_name: project?.[1] ?? null,
  project_color: null,
  title: `Entrega ${next}`,
  kind: "exam",
  due_at: "2026-11-10T10:00",
  notes: "",
  weight,
  grade,
  done_at: null,
  created_at: "",
  updated_at: "",
});

const calc: [number, string] = [1, "Cálculo"];
const fisica: [number, string] = [2, "Física"];
const SCALE = { scale: 5, pass: 3 };

describe("calculadora de notas", () => {
  it("media ponderada, acumulado y nota necesaria en lo que falta", () => {
    // 30 % con 4,0 y 20 % con 2,5 → media 3,4; acumulado 1,7; falta el 50 %.
    const [subject] = subjectGrades([item(calc, 30, 4), item(calc, 20, 2.5), item(calc, 50, null)], SCALE);
    expect(subject).toMatchObject({ name: "Cálculo", evaluatedWeight: 50, average: 3.4, accumulated: 1.7, needed: 2.6, status: "on-track" });
    expect(subject.pending).toHaveLength(1);
  });

  it("aprobada si lo acumulado ya llega, aunque falte evaluar", () => {
    const [subject] = subjectGrades([item(calc, 70, 5), item(calc, 30, null)], SCALE);
    expect(subject).toMatchObject({ accumulated: 3.5, status: "passed", needed: 0 });
  });

  it("ya no alcanza si haría falta más que la nota máxima", () => {
    const [subject] = subjectGrades([item(fisica, 80, 1), item(fisica, 20, null)], SCALE);
    expect(subject.status).toBe("impossible");
    expect(subject.needed).toBe(11);
  });

  it("con todo evaluado, la nota final es lo acumulado", () => {
    const [subject] = subjectGrades([item(fisica, 60, 2), item(fisica, 40, 3)], SCALE);
    expect(subject).toMatchObject({ average: 2.4, accumulated: 2.4, needed: null, status: "failed" });
  });

  it("agrupa por materia, deja «Sin materia» al final e ignora las que no tienen ponderación", () => {
    const subjects = subjectGrades([item(null, 50, 4), item(fisica, null, 5), item(calc, 40, 3)], { scale: 10, pass: 6 });
    expect(subjects.map((s) => [s.name, s.status])).toEqual([
      ["Cálculo", "at-risk"],
      ["Física", "no-data"],
      ["Sin materia", "at-risk"],
    ]);
    expect(subjects[1].unweighted).toHaveLength(1);
  });

  it("escribe las notas con coma decimal", () => {
    expect(formatGrade(3.456)).toBe("3,46");
    expect(formatGrade(4)).toBe("4");
  });
});
