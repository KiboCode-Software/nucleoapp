import { FileX, Monitor, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { fieldClass } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/Sheet";
import { useNow } from "@/hooks/useNow";
import { useProjects } from "@/hooks/useProjects";
import { useVocab } from "@/modes/vocabulary";
import { useModule } from "@/modules/registry";
import { ensureBlockersLoaded, useBlockersStore } from "@/stores/blockers.store";
import { BlockerBoard } from "./components/BlockerBoard";
import { BlockerDetail } from "./components/BlockerDetail";
import { BlockerForm } from "./components/BlockerForm";

const NEW = "nuevo";

export function BlockersPage() {
  const { label, description } = useModule("blockers");
  const v = useVocab();
  const { blockerId } = useParams();
  const navigate = useNavigate();
  const projects = useProjects();
  const now = useNow();
  const { blockers, status, create, update, setStatus, remove, refresh } = useBlockersStore();
  const [query, setQuery] = useState("");

  useEffect(ensureBlockersLoaded, []);

  const close = () => navigate("/blockers");
  const move = (id: number, next: Parameters<typeof setStatus>[1]) =>
    void setStatus(id, next).catch((error: unknown) => console.error("No se pudo cambiar el estado", error));

  const text = query.trim().toLowerCase();
  const visible = text
    ? blockers.filter((b) => `${b.title} ${b.description} ${b.project_name ?? ""}`.toLowerCase().includes(text))
    : blockers;
  const selected = blockerId && blockerId !== NEW ? (blockers.find((b) => b.id === Number(blockerId)) ?? null) : null;

  const header = (
    <PageHeader
      title={label}
      subtitle={description}
      actions={
        status === "ready" && (
          <Button onClick={() => navigate(`/blockers/${NEW}`)}>
            <Plus className="size-4" /> {v.blocker.newLabel}
          </Button>
        )
      }
    />
  );

  if (status === "unavailable" || status === "error") {
    return (
      <>
        {header}
        <Card>
          {status === "unavailable" ? (
            <EmptyState
              icon={Monitor}
              title="Disponible en la app de escritorio"
              description={`Tus ${v.blocker.many} se guardan en SQLite local. Abre la app con npm run tauri dev.`}
            />
          ) : (
            <p className="text-[14px] text-danger">No se pudieron cargar los {v.blocker.many}. Revisa la consola para más detalles.</p>
          )}
        </Card>
      </>
    );
  }

  if (status !== "ready") return header;

  return (
    <>
      {header}

      {blockers.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative w-full max-w-xs">
            <span className="sr-only">Buscar {v.blocker.many}</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar"
              className={fieldClass + " h-9 w-full pl-9"}
            />
          </label>
          <p className="text-[12.5px] text-ink-muted">Arrastra las tarjetas entre columnas para cambiar su estado.</p>
        </div>
      )}

      <BlockerBoard blockers={visible} now={now} onMove={move} />

      {blockerId === NEW && (
        <Sheet title={v.blocker.newLabel} onClose={close}>
          <BlockerForm
            initial={{ title: "", description: "", project_id: null }}
            projects={projects}
            submitLabel={v.blocker.registerLabel}
            autoFocus
            onSubmit={async (input) => {
              const created = await create(input);
              navigate(`/blockers/${created.id}`, { replace: true });
            }}
          />
        </Sheet>
      )}

      {blockerId && blockerId !== NEW && (
        <Sheet title={selected?.title ?? v.blocker.missing} onClose={close}>
          {selected ? (
            <BlockerDetail
              blocker={selected}
              projects={projects}
              now={now}
              onUpdate={async (input) => void (await update(selected.id, input))}
              onSetStatus={async (next) => void (await setStatus(selected.id, next))}
              onAttemptsChange={() => void refresh(selected.id)}
              onDelete={async () => {
                await remove(selected.id);
                navigate("/blockers", { replace: true });
              }}
            />
          ) : (
            <EmptyState icon={FileX} title={v.blocker.missing} />
          )}
        </Sheet>
      )}
    </>
  );
}
