import { ArrowUpRight, Check, Copy } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { ConfirmDelete } from "@/components/shared/ConfirmDelete";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/fields";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TagInput } from "@/components/ui/TagInput";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { LearningEntry } from "@/database/repositories/learnings.repository";
import type { ProjectOption } from "@/database/repositories/projects.repository";
import { learningInputSchema, type LearningInput, type LearningKind } from "@/types/entities";
import { formatDayLabel, toISODate } from "@/utils/date";
import { KINDS, useKindMeta } from "../kinds";
import { useVocab } from "@/modes/vocabulary";

const PLACEHOLDERS: Record<LearningKind, string> = {
  concept: "Explícalo con tus palabras, como si se lo contaras a alguien.",
  error_fix: "El error, la causa y cómo lo solucionaste.",
  command: "git rebase -i HEAD~3",
  note: "Lo que quieras recordar.",
};

const STUDENT_PLACEHOLDERS: Record<LearningKind, string> = {
  concept: "Explícalo con tus palabras, como si se lo contaras a un compañero.",
  error_fix: "El enunciado, los pasos y el resultado.",
  command: "a² + b² = c²",
  note: "Lo que quieras recordar para el examen.",
};

interface LearningEditorProps {
  learning: LearningEntry | null;
  projects: ProjectOption[];
  tagSuggestions: string[];
  onSave: (input: LearningInput, id?: number) => Promise<LearningEntry>;
  onDelete: (id: number) => Promise<void>;
}

function toForm(learning: LearningEntry | null): LearningInput {
  return {
    kind: learning?.kind ?? "concept",
    title: learning?.title ?? "",
    content: learning?.content ?? "",
    project_id: learning?.project_id ?? null,
    daily_log_id: learning?.daily_log_id ?? null,
    tags: learning?.tags ?? [],
  };
}

export function LearningEditor({ learning, projects, tagSuggestions, onSave, onDelete }: LearningEditorProps) {
  const v = useVocab();
  const kindMeta = useKindMeta();
  const student = v.mode === "student";
  const [form, setForm] = useState(() => toForm(learning));
  const [baseline, setBaseline] = useState(form);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const isCommand = form.kind === "command";
  const update = <K extends keyof LearningInput>(key: K, value: LearningInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!dirty || saving) return;
    const parsed = learningInputSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0]?.path[0] === "title" ? "Ponle un título." : parsed.error.issues[0].message);

    setSaving(true);
    try {
      const saved = await onSave(parsed.data, learning?.id);
      setBaseline(toForm(saved));
      setForm(toForm(saved));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(form.content ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("No se pudo copiar", e);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form onSubmit={submit} onKeyDown={onKeyDown} className="flex flex-col gap-5" aria-label={v.learning.badge}>
      <SegmentedControl<LearningKind>
        label={v.learning.kindLabel}
        value={form.kind ?? "note"}
        onChange={(kind) => update("kind", kind)}
        segments={KINDS.map((kind) => ({ value: kind, label: kindMeta[kind].label }))}
      />

      <TextField
        id="learning-title"
        label="Título"
        placeholder={student ? (isCommand ? "Qué calcula la fórmula" : "p. ej. Teorema de Pitágoras") : isCommand ? "Qué hace el comando" : "p. ej. Cómo funcionan los middlewares"}
        value={form.title}
        maxLength={140}
        autoFocus={!learning}
        onChange={(e) => update("title", e.target.value)}
      />

      <div className="relative">
        <TextArea
          id="learning-content"
          label={isCommand ? kindMeta.command.label : "Contenido"}
          placeholder={(student ? STUDENT_PLACEHOLDERS : PLACEHOLDERS)[form.kind ?? "note"]}
          value={form.content ?? ""}
          maxLength={20000}
          spellCheck={!isCommand}
          className={isCommand ? "font-mono text-[13px]" : undefined}
          onChange={(e) => update("content", e.target.value)}
        />
        {isCommand && form.content && (
          <button
            type="button"
            onClick={() => void copyContent()}
            className="absolute top-0 right-0 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        )}
      </div>

      <TagInput label="Etiquetas" value={form.tags ?? []} onChange={(tags) => update("tags", tags)} suggestions={tagSuggestions} />

      {projects.length > 0 && (
        <label className="flex flex-col gap-1.5 text-[13.5px] font-medium">
          {v.project.title}
          <select
            value={form.project_id ?? ""}
            onChange={(e) => update("project_id", e.target.value ? Number(e.target.value) : null)}
            className={fieldClass + " h-10 font-normal"}
          >
            <option value="">{v.project.none}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {learning?.daily_log_id && (
        <p className="text-[13px] text-ink-muted">
          Guardado desde el{" "}
          <Link to={`/daily-log/${learning.daily_log_id}`} className="inline-flex items-center text-accent hover:underline">
            registro diario <ArrowUpRight className="size-3" />
          </Link>{" "}
          · {formatDayLabel(toISODate(new Date(learning.created_at)))}
        </p>
      )}

      <footer className="flex items-center gap-3 border-t border-line pt-4">
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? "Guardando…" : learning ? "Guardar cambios" : v.learning.saveLabel}
        </Button>
        <span role="status" className="text-[13px]">
          {error ? <span className="text-danger">{error}</span> : dirty && <span className="text-ink-muted">Cambios sin guardar · Ctrl+S</span>}
        </span>
        {learning && (
          <div className="ml-auto">
            <ConfirmDelete label={v.learning.deleteLabel} question={v.learning.deleteQuestion} onConfirm={() => onDelete(learning.id)} />
          </div>
        )}
      </footer>
    </form>
  );
}
