/**
 * El plan del día se guarda como texto en `daily_logs.today`, una tarea por línea
 * con formato de lista de tareas de Markdown: "- [ ] pendiente" / "- [x] hecha".
 * Así sigue siendo legible en exportaciones y compatible con registros antiguos
 * (una línea sin casilla es una tarea pendiente).
 */

export interface Task {
  text: string;
  done: boolean;
}

const TASK_LINE = /^\s*(?:[-*•]|\d+[.)])?\s*\[( |x|X)\]\s+(.*)$/;
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function parseTasks(text: string): Task[] {
  return text
    .split("\n")
    .map((line) => {
      const match = TASK_LINE.exec(line);
      if (match) return { text: match[2].trim(), done: match[1].toLowerCase() === "x" };
      return { text: line.replace(BULLET, "").trim(), done: false };
    })
    .filter((task) => task.text);
}

export function serializeTasks(tasks: Task[]): string {
  return tasks
    .filter((t) => t.text.trim())
    .map((t) => `- [${t.done ? "x" : " "}] ${t.text.trim()}`)
    .join("\n");
}

export function taskProgress(text: string): { done: number; total: number } {
  const tasks = parseTasks(text);
  return { done: tasks.filter((t) => t.done).length, total: tasks.length };
}
