import { FileX, Layers, Monitor, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { fieldClass } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/Sheet";
import { isTauri } from "@/database/client";
import { reviewRepository } from "@/database/repositories/review.repository";
import type { LearningEntry } from "@/database/repositories/learnings.repository";
import { useProjects } from "@/hooks/useProjects";
import { useModule } from "@/modules/registry";
import { ensureLearningsLoaded, useLearningsStore } from "@/stores/learnings.store";
import type { LearningKind } from "@/types/entities";
import { cn } from "@/utils/cn";
import { toISODate } from "@/utils/date";
import { LearningEditor } from "./components/LearningEditor";
import { LearningList } from "./components/LearningList";
import { ReviewCardsEditor, ReviewSession } from "./components/ReviewCards";
import { KINDS, useKindMeta } from "./kinds";
import { useVocab } from "@/modes/vocabulary";

const NEW = "nuevo";
const TOP_TAGS = 8;

function matches(learning: LearningEntry, query: string): boolean {
  const haystack = [learning.title, learning.content, learning.project_name ?? "", ...learning.tags].join("\n").toLocaleLowerCase("es");
  return haystack.includes(query.toLocaleLowerCase("es"));
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-[12.5px] font-medium transition-colors",
        active ? "bg-accent text-white" : "bg-line/60 text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function LearningPage() {
  const v = useVocab();
  const kindMeta = useKindMeta();
  const { label, description } = useModule("learning");
  const { learningId } = useParams();
  const navigate = useNavigate();
  const projects = useProjects();
  const { learnings, status, save, remove } = useLearningsStore();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<LearningKind | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  // Repaso de tarjetas en una hoja (?repaso en la URL, para abrirlo desde la búsqueda).
  const [params, setParams] = useSearchParams();
  const reviewing = params.has("repaso");
  const [dueCards, setDueCards] = useState(0);
  const refreshDue = () => {
    if (isTauri()) reviewRepository.countDue(toISODate(new Date())).then(setDueCards, console.error);
  };
  useEffect(refreshDue, [reviewing]);

  useEffect(ensureLearningsLoaded, []);

  // Etiquetas por uso, calculadas de lo cargado (incluye las recién creadas).
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of learnings) for (const t of l.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).map(([name]) => name);
  }, [learnings]);

  const visible = learnings.filter(
    (l) => (!kind || l.kind === kind) && (!tag || l.tags.includes(tag)) && (!query.trim() || matches(l, query.trim())),
  );
  const selected = learningId && learningId !== NEW ? (learnings.find((l) => l.id === Number(learningId)) ?? null) : null;
  const missing = learningId && learningId !== NEW && !selected;
  const filtering = Boolean(kind || tag || query.trim());

  const header = (
    <PageHeader
      title={label}
      subtitle={description}
      actions={
        status === "ready" && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setParams({ repaso: "" })}>
              <Layers className="size-4" /> Repasar
              {dueCards > 0 && <span className="rounded-full bg-danger px-1.5 text-[12px] leading-5 text-white tabular-nums">{dueCards}</span>}
            </Button>
            {learningId && (
              <Button onClick={() => navigate(`/learning/${NEW}`)}>
                <Plus className="size-4" /> {v.learning.newLabel}
              </Button>
            )}
          </div>
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
              description={`Tus ${v.learning.many} se guardan en SQLite local. Abre la app con npm run tauri dev.`}
            />
          ) : (
            <p className="text-[14px] text-danger">No se pudieron cargar los {v.learning.many}.</p>
          )}
        </Card>
      </>
    );
  }

  if (status !== "ready") return header;

  return (
    <>
      {header}
      <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-180px)] lg:overflow-hidden">
          <label className="relative">
            <span className="sr-only">Buscar {v.learning.many}</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar"
              className={fieldClass + " w-full pl-9"}
            />
          </label>

          <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1.5">
            <Pill active={kind === null} onClick={() => setKind(null)}>
              Todos
            </Pill>
            {KINDS.map((k) => (
              <Pill key={k} active={kind === k} onClick={() => setKind(kind === k ? null : k)}>
                {kindMeta[k].plural}
              </Pill>
            ))}
          </div>

          {tagCounts.length > 0 && (
            <div role="group" aria-label="Filtrar por etiqueta" className="flex flex-wrap gap-1.5">
              {tagCounts.slice(0, TOP_TAGS).map((t) => (
                <Pill key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                  #{t}
                </Pill>
              ))}
            </div>
          )}

          <LearningList
            learnings={visible}
            selectedId={selected?.id ?? null}
            emptyText={learnings.length === 0 ? v.learning.empty : filtering ? "Sin resultados." : ""}
          />
        </aside>

        <Card>
          {missing ? (
            <EmptyState icon={FileX} title={v.learning.missing} />
          ) : (
            <>
              {!selected && <h2 className="mb-4 text-[15px] font-semibold">{v.learning.newLabel}</h2>}
              <LearningEditor
                key={selected?.id ?? NEW}
                learning={selected}
                projects={projects}
                tagSuggestions={tagCounts}
                onSave={async (input, id) => {
                  const saved = await save(input, id);
                  if (id == null) navigate(`/learning/${saved.id}`, { replace: true });
                  return saved;
                }}
                onDelete={async (id) => {
                  await remove(id);
                  navigate("/learning", { replace: true });
                }}
              />
              {selected && <ReviewCardsEditor key={`cards-${selected.id}`} learningId={selected.id} onChange={refreshDue} />}
            </>
          )}
        </Card>
      </div>

      {reviewing && (
        <Sheet title="Repaso" onClose={() => setParams({})}>
          <ReviewSession onDone={() => setParams({})} />
        </Sheet>
      )}
    </>
  );
}
