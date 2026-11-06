import { ArrowUpRight, CircleCheck, RotateCcw } from "lucide-react";
import { Link } from "react-router";
import { ConfirmDelete } from "@/components/shared/ConfirmDelete";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { BlockerEntry } from "@/database/repositories/blockers.repository";
import type { ProjectOption } from "@/database/repositories/projects.repository";
import { isOpen } from "@/stores/blockers.store";
import type { BlockerInput, BlockerStatus } from "@/types/entities";
import { elapsedBetween } from "@/utils/date";
import { useStatusMeta } from "../status";
import { AttemptsList } from "./AttemptsList";
import { BlockerForm } from "./BlockerForm";
import { useVocab } from "@/modes/vocabulary";

interface BlockerDetailProps {
  blocker: BlockerEntry;
  projects: ProjectOption[];
  now: Date;
  onUpdate: (input: BlockerInput) => Promise<void>;
  onSetStatus: (status: BlockerStatus) => Promise<void>;
  onDelete: () => Promise<void>;
  onAttemptsChange: () => void;
}

export function BlockerDetail({ blocker, projects, now, onUpdate, onSetStatus, onDelete, onAttemptsChange }: BlockerDetailProps) {
  const v = useVocab();
  const status = useStatusMeta()[blocker.status];
  const open = isOpen(blocker);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {blocker.project_name && <Badge>{blocker.project_name}</Badge>}
          </div>
          <p className="text-[13px] text-ink-muted">
            {open
              ? `${v.blocker.openSince} ${elapsedBetween(blocker.opened_at, null, now)}`
              : `${v.blocker.resolvedIn} ${elapsedBetween(blocker.opened_at, blocker.resolved_at)}`}
            {blocker.daily_log_id && (
              <>
                {" · "}
                <Link to={`/daily-log/${blocker.daily_log_id}`} className="inline-flex items-center text-accent hover:underline">
                  Ver registro diario <ArrowUpRight className="size-3" />
                </Link>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {open ? (
            <>
              {blocker.status === "pending" && (
                <Button variant="secondary" onClick={() => void onSetStatus("escalated")}>
                  {v.blocker.escalate}
                </Button>
              )}
              <Button onClick={() => void onSetStatus("resolved")}>
                <CircleCheck className="size-4" /> {v.blocker.markResolved}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => void onSetStatus("pending")}>
              <RotateCcw className="size-4" /> Reabrir
            </Button>
          )}
        </div>
      </header>

      <BlockerForm
        key={blocker.id}
        initial={{ title: blocker.title, description: blocker.description, project_id: blocker.project_id }}
        projects={projects}
        submitLabel="Guardar cambios"
        onSubmit={onUpdate}
      />

      <div className="border-t border-line pt-5">
        <AttemptsList key={blocker.id} blockerId={blocker.id} now={now} onChange={onAttemptsChange} />
      </div>

      <footer className="flex justify-end border-t border-line pt-4">
        <ConfirmDelete label={v.blocker.deleteLabel} question={v.blocker.deleteQuestion} onConfirm={onDelete} />
      </footer>
    </div>
  );
}
