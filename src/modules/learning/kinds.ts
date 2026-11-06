import { BookOpen, Bug, PencilRuler, Sigma, StickyNote, Terminal, type LucideIcon } from "lucide-react";
import { useVocab } from "@/modes/vocabulary";
import { LEARNING_KIND_LABELS, type LearningKind } from "@/types/entities";

type KindMeta = Record<LearningKind, { label: string; plural: string; icon: LucideIcon }>;

export const KIND_META: KindMeta = {
  concept: { label: LEARNING_KIND_LABELS.concept, plural: "Conceptos", icon: BookOpen },
  error_fix: { label: LEARNING_KIND_LABELS.error_fix, plural: "Errores", icon: Bug },
  command: { label: LEARNING_KIND_LABELS.command, plural: "Comandos", icon: Terminal },
  note: { label: LEARNING_KIND_LABELS.note, plural: "Notas", icon: StickyNote },
};

const STUDENT_ICONS: Partial<Record<LearningKind, LucideIcon>> = { error_fix: PencilRuler, command: Sigma };

export const KINDS = Object.keys(KIND_META) as LearningKind[];

/** Tipos con los nombres e iconos del modo activo (fórmulas y ejercicios en modo estudiante). */
export function useKindMeta(): KindMeta {
  const vocab = useVocab();
  const student = vocab.mode === "student";
  return Object.fromEntries(
    KINDS.map((kind) => [
      kind,
      { ...vocab.learning.kinds[kind], icon: (student && STUDENT_ICONS[kind]) || KIND_META[kind].icon },
    ]),
  ) as KindMeta;
}
