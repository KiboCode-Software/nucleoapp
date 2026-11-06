import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/fields";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { ProjectOption } from "@/database/repositories/projects.repository";
import { blockerInputSchema, type BlockerInput } from "@/types/entities";
import { useVocab } from "@/modes/vocabulary";

interface BlockerFormProps {
  initial: BlockerInput;
  projects: ProjectOption[];
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit: (input: BlockerInput) => Promise<void>;
}

/** Título, descripción y proyecto de un bloqueo (para crear o editar). */
export function BlockerForm({ initial, projects, submitLabel, autoFocus, onSubmit }: BlockerFormProps) {
  const v = useVocab();
  const [form, setForm] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const update = <K extends keyof BlockerInput>(key: K, value: BlockerInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!dirty || saving) return;
    const parsed = blockerInputSchema.safeParse(form);
    if (!parsed.success) return setError(v.blocker.missingTitle);

    setSaving(true);
    try {
      await onSubmit(parsed.data);
      setBaseline(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : `No se pudo guardar: ${v.blocker.one}`);
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form onSubmit={submit} onKeyDown={onKeyDown} className="flex flex-col gap-4" aria-label={v.blocker.formLabel}>
      <TextField
        id="blocker-title"
        label={v.blocker.titleField}
        placeholder={v.blocker.titlePlaceholder}
        value={form.title}
        maxLength={140}
        autoFocus={autoFocus}
        onChange={(e) => update("title", e.target.value)}
      />
      <TextArea
        id="blocker-description"
        label="Contexto"
        placeholder={v.blocker.contextPlaceholder}
        value={form.description ?? ""}
        maxLength={5000}
        onChange={(e) => update("description", e.target.value)}
      />
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
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? "Guardando…" : submitLabel}
        </Button>
        <span role="status" className="text-[13px]">
          {error ? <span className="text-danger">{error}</span> : dirty && <span className="text-ink-muted">Cambios sin guardar</span>}
        </span>
      </div>
    </form>
  );
}
