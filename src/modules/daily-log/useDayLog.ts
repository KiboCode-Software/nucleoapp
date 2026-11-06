import { useCallback, useRef, useState } from "react";
import type { DailyLogEntry } from "@/database/repositories/daily-logs.repository";
import { useDailyLogsStore } from "@/stores/daily-logs.store";
import type { DailyLogInput } from "@/types/entities";

export type SaveState = "idle" | "saving" | "saved" | "error";

type Changes = Partial<Pick<DailyLogInput, "today" | "blockers_note" | "learnings" | "project_id" | "yesterday">>;

const hasContent = (log: Pick<DailyLogInput, "yesterday" | "today" | "blockers_note" | "learnings">) =>
  [log.yesterday, log.today, log.blockers_note, log.learnings].some((answer) => answer.trim());

/**
 * Registro de un día con guardado automático por partes: cada tarjeta guarda solo
 * su campo. Los guardados se encadenan para que dos cambios seguidos no creen dos
 * registros del mismo día. Un registro que se queda sin contenido se elimina.
 */
export function useDayLog(date: string, logId?: number) {
  const find = useCallback(
    (logs: DailyLogEntry[]) => (logId != null ? logs.find((l) => l.id === logId) : logs.find((l) => l.log_date === date)),
    [date, logId],
  );
  const log = useDailyLogsStore((s) => find(s.logs)) ?? null;
  const [state, setState] = useState<SaveState>("idle");
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const save = useCallback(
    (changes: Changes) => {
      setState("saving");
      queue.current = queue.current
        .then(async () => {
          const { save: store, remove } = useDailyLogsStore.getState();
          const current = find(useDailyLogsStore.getState().logs);
          const next: DailyLogInput = {
            project_id: current?.project_id ?? null,
            log_date: current?.log_date ?? date,
            yesterday: current?.yesterday ?? "",
            today: current?.today ?? "",
            blockers_note: current?.blockers_note ?? "",
            learnings: current?.learnings ?? "",
            ...changes,
          };
          if (!hasContent(next)) {
            if (current) await remove(current.id);
          } else {
            await store(next, current?.id);
          }
          setState("saved");
        })
        .catch((error: unknown) => {
          console.error("No se pudo guardar el registro", error);
          setState("error");
        });
      return queue.current;
    },
    [date, find],
  );

  return { log, save, state };
}
