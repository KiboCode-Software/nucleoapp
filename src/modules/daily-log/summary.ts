import type { DailyLog } from "@/types/entities";

/** Primera línea de la respuesta más representativa de un registro. */
export function logSummary(log: Pick<DailyLog, "today" | "yesterday" | "learnings" | "blockers_note">): string {
  const text = log.today || log.yesterday || log.learnings || log.blockers_note;
  return text.trim().split("\n")[0];
}
