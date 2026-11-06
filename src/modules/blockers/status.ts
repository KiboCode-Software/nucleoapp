import { useVocab } from "@/modes/vocabulary";
import { BLOCKER_STATUS_LABELS, type BlockerStatus } from "@/types/entities";

type StatusMeta = Record<BlockerStatus, { label: string; tone: "warning" | "danger" | "success" }>;

export const STATUS_META: StatusMeta = {
  pending: { label: BLOCKER_STATUS_LABELS.pending, tone: "warning" },
  escalated: { label: BLOCKER_STATUS_LABELS.escalated, tone: "danger" },
  resolved: { label: BLOCKER_STATUS_LABELS.resolved, tone: "success" },
};

/** Estados con los nombres del modo activo ("Consultada" en lugar de "Escalado"…). */
export function useStatusMeta(): StatusMeta {
  const { status } = useVocab().blocker;
  return {
    pending: { ...STATUS_META.pending, label: status.pending },
    escalated: { ...STATUS_META.escalated, label: status.escalated },
    resolved: { ...STATUS_META.resolved, label: status.resolved },
  };
}
