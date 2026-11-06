import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { PROJECT_COLORS, projectInputSchema, type ProjectInput } from "@/types/entities";
import { cn } from "@/utils/cn";
import { useVocab } from "@/modes/vocabulary";

interface ProjectFormProps {
  initial: ProjectInput;
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit: (input: ProjectInput) => Promise<void>;
}

export function ProjectForm({ initial, submitLabel, autoFocus, onSubmit }: ProjectFormProps) {
  const v = useVocab();
  const [form, setForm] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const update = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!dirty || saving) return;
    const parsed = projectInputSchema.safeParse(form);
    if (!parsed.success) return setError(v.project.needsName);

    setSaving(true);
    try {
      await onSubmit(parsed.data);
      setBaseline(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : `No se pudo guardar: ${v.project.one}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-label={v.project.data}>
      <TextField
        id="project-name"
        label="Nombre"
        placeholder={v.project.placeholder}
        value={form.name}
        maxLength={80}
        autoFocus={autoFocus}
        onChange={(e) => update("name", e.target.value)}
      />
      <TextArea
        id="project-description"
        label="Descripción"
        placeholder={v.mode === "student" ? "Profesor, horario, aula, bibliografía…" : "De qué trata, tecnologías, enlaces…"}
        value={form.description ?? ""}
        maxLength={500}
        onChange={(e) => update("description", e.target.value)}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13.5px] font-medium">Color</legend>
        <div role="radiogroup" aria-label={v.project.color} className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((color) => {
            const selected = form.color === color;
            return (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={color}
                onClick={() => update("color", selected ? null : color)}
                className={cn(
                  "grid size-7 place-items-center rounded-full transition-transform hover:scale-110",
                  selected && "ring-2 ring-offset-2 ring-offset-surface",
                )}
                style={{ backgroundColor: color, ["--tw-ring-color" as string]: color }}
              >
                {selected && <Check className="size-3.5 text-white" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </fieldset>
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
