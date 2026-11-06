import { X } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  /** Etiquetas existentes para autocompletar. */
  suggestions?: string[];
  max?: number;
}

/** Etiquetas como chips: Enter o coma añade, Retroceso en vacío quita la última. */
export function TagInput({ label, value, onChange, suggestions = [], max = 10 }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const inputId = useId();

  function add(raw: string) {
    const tag = raw.trim().replace(/,$/, "").slice(0, 30);
    if (!tag || value.length >= max || value.some((t) => t.toLowerCase() === tag.toLowerCase())) return setDraft("");
    onChange([...value, tag]);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13.5px] font-medium">
        {label}
      </label>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-transparent bg-fill px-2 py-1.5 transition-[background-color,box-shadow] duration-200 focus-within:border-accent/50 focus-within:bg-surface focus-within:shadow-[0_0_0_3.5px_var(--accent-soft)]">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-1 pl-2.5 text-[12.5px] font-medium text-accent">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Quitar etiqueta ${tag}`}
              className="grid size-4 place-items-center rounded-full hover:bg-accent/15"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          list={listId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          disabled={value.length >= max}
          placeholder={value.length ? "" : "React, SQL, Git…"}
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-[14px] placeholder:text-ink-muted/70 focus:outline-none"
        />
        <datalist id={listId}>
          {suggestions
            .filter((s) => !value.some((t) => t.toLowerCase() === s.toLowerCase()))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      </div>
      <p className="text-xs text-ink-muted">Pulsa Enter o coma para añadir. Tecnologías, temas o lo que te ayude a encontrarlo.</p>
    </div>
  );
}
