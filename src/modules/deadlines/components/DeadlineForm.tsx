import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/fields";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { DEADLINE_KINDS, deadlineInputSchema, type DeadlineInput, type DeadlineKind } from "@/database/repositories/deadlines.repository";
import type { ProjectOption } from "@/database/repositories/projects.repository";
import { useVocab } from "@/modes/vocabulary";
import { KIND_META } from "../schedule";

interface DeadlineFormProps {
  initial: DeadlineInput;
  projects: ProjectOption[];
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit: (input: DeadlineInput) => Promise<void>;
}

/** Los números se editan como texto para permitir dejarlos vacíos. */
type FormState = Omit<DeadlineInput, "weight" | "grade"> & { weight: string; grade: string };

const toForm = (input: DeadlineInput): FormState => ({
  ...input,
  weight: input.weight == null ? "" : String(input.weight),
  grade: input.grade == null ? "" : String(input.grade),
});

const toNumber = (text: string) => (text.trim() === "" ? null : Number(text.replace(",", ".")));

/** Título, tipo, fecha, materia, ponderación y nota de una entrega. */
export function DeadlineForm({ initial, projects, submitLabel, autoFocus, onSubmit }: DeadlineFormProps) {
  const v = useVocab();
  const [form, setForm] = useState(() => toForm(initial));
  const [baseline, setBaseline] = useState(form);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!dirty || saving) return;
    const parsed = deadlineInputSchema.safeParse({ ...form, weight: toNumber(form.weight), grade: toNumber(form.grade) });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Revisa los datos de la entrega.");

    setSaving(true);
    try {
      await onSubmit(parsed.data);
      setBaseline(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la entrega");
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
    <form onSubmit={submit} onKeyDown={onKeyDown} className="flex flex-col gap-4" aria-label="Datos de la entrega">
      <SegmentedControl<DeadlineKind>
        label="Tipo de entrega"
        value={form.kind ?? "assignment"}
        onChange={(kind) => update("kind", kind)}
        segments={DEADLINE_KINDS.map((kind) => ({ value: kind, label: KIND_META[kind].label }))}
      />
      <TextField
        id="deadline-title"
        label="Título"
        placeholder={form.kind === "exam" ? "p. ej. Parcial 2" : "p. ej. Informe de laboratorio"}
        value={form.title}
        maxLength={140}
        autoFocus={autoFocus}
        onChange={(e) => update("title", e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13.5px] font-medium">
          Fecha límite
          <input
            type="datetime-local"
            value={form.due_at}
            onChange={(e) => update("due_at", e.target.value)}
            className={fieldClass + " h-10 font-normal"}
          />
        </label>
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
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="deadline-weight"
          label="Ponderación (%)"
          inputMode="decimal"
          placeholder="Opcional · p. ej. 30"
          value={form.weight}
          onChange={(e) => update("weight", e.target.value)}
        />
        <TextField
          id="deadline-grade"
          label="Nota obtenida"
          inputMode="decimal"
          placeholder="Opcional"
          value={form.grade}
          onChange={(e) => update("grade", e.target.value)}
        />
      </div>
      <TextArea
        id="deadline-notes"
        label="Notas"
        placeholder="Temas que entran, requisitos, formato de entrega…"
        value={form.notes ?? ""}
        maxLength={5000}
        onChange={(e) => update("notes", e.target.value)}
      />
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
