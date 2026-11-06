import { NavLink } from "react-router";
import type { LearningEntry } from "@/database/repositories/learnings.repository";
import { cn } from "@/utils/cn";
import { useKindMeta } from "../kinds";
import { useVocab } from "@/modes/vocabulary";

export function LearningList({ learnings, selectedId, emptyText }: {
  learnings: LearningEntry[];
  selectedId: number | null;
  emptyText: string;
}) {
  const v = useVocab();
  const kindMeta = useKindMeta();
  if (learnings.length === 0) return <p className="px-2 py-6 text-center text-[13px] text-ink-muted">{emptyText}</p>;

  return (
    <ul aria-label={`Lista de ${v.learning.many}`} className="-mx-1 flex flex-col gap-0.5 overflow-y-auto px-1">
      {learnings.map((learning) => {
        const { icon: Icon, label } = kindMeta[learning.kind];
        const selected = learning.id === selectedId;
        return (
          <li key={learning.id}>
            <NavLink
              to={`/learning/${learning.id}`}
              className={cn("flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors", selected ? "bg-accent-soft" : "hover:bg-fill")}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", selected ? "text-accent" : "text-ink-muted")} strokeWidth={1.75} aria-label={label} />
              <div className="min-w-0 flex-1">
                <p className={cn("line-clamp-2 text-[13.5px] font-medium", selected && "text-accent")}>{learning.title}</p>
                {(learning.tags.length > 0 || learning.project_name) && (
                  <p className="mt-0.5 truncate text-[12px] text-ink-muted">
                    {[learning.tags.map((t) => `#${t}`).join(" "), learning.project_name].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
