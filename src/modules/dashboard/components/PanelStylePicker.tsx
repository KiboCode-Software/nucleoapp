import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DEFAULT_PANEL_STYLE, type PanelStyle, type PanelVariant } from "@/types/dashboard";
import { PROJECT_COLORS } from "@/types/entities";
import { cn } from "@/utils/cn";
import { useTr } from "@/modes/vocabulary";

const VARIANTS: Array<{ value: PanelVariant; label: string }> = [
  { value: "card", label: "Tarjeta" },
  { value: "outline", label: "Contorno" },
  { value: "soft", label: "Suave" },
  { value: "plain", label: "Plano" },
];

interface Option {
  value: string;
  label: string;
}

interface PanelStylePickerProps {
  title: string;
  value: PanelStyle;
  /** Disposiciones que admite el panel (la primera es la predeterminada). */
  layouts: Option[];
  /** Elementos ordenables del panel, si los tiene. */
  items?: { all: Option[]; defaults: string[] };
  onChange: (style: PanelStyle) => void;
  onClose: () => void;
}

/** Casillas para mostrar u ocultar elementos y flechas para ordenar los visibles. */
function ItemsEditor({ all, visible, onChange }: { all: Option[]; visible: string[]; onChange: (ids: string[]) => void }) {
  const tr = useTr();
  const shown = visible.filter((id) => all.some((o) => o.value === id));
  const ordered = [...shown.map((id) => all.find((o) => o.value === id)!), ...all.filter((o) => !shown.includes(o.value))];

  const move = (id: string, delta: -1 | 1) => {
    const from = shown.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= shown.length) return;
    const next = [...shown];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12px] font-medium text-ink-muted">Elementos</p>
      <ul aria-label="Elementos del panel" className="flex flex-col rounded-xl border border-line">
        {ordered.map((option) => {
          const index = shown.indexOf(option.value);
          const checked = index >= 0;
          return (
            <li key={option.value} className="flex items-center gap-2 border-b border-line px-2.5 py-1.5 last:border-b-0">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(checked ? shown.filter((id) => id !== option.value) : [...shown, option.value])}
                  className="size-3.5 accent-[var(--accent)]"
                />
                <span className={cn("truncate", !checked && "text-ink-muted")}>{tr(option.label)}</span>
              </label>
              <button
                type="button"
                aria-label={`Subir ${option.label}`}
                disabled={!checked || index === 0}
                onClick={() => move(option.value, -1)}
                className="grid size-6 place-items-center rounded-md text-ink-muted hover:bg-fill disabled:opacity-25"
              >
                <ArrowUp className="size-3" />
              </button>
              <button
                type="button"
                aria-label={`Bajar ${option.label}`}
                disabled={!checked || index === shown.length - 1}
                onClick={() => move(option.value, 1)}
                className="grid size-6 place-items-center rounded-md text-ink-muted hover:bg-fill disabled:opacity-25"
              >
                <ArrowDown className="size-3" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Ventana flotante con la disposición, los elementos, la apariencia, el color y la densidad de un panel. */
export function PanelStylePicker({ title, value, layouts, items, onChange, onClose }: PanelStylePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const set = (changes: Partial<PanelStyle>) => onChange({ ...value, ...changes });

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Ajustes de ${title}`}
      // El panel se puede arrastrar: dentro del selector, no.
      draggable={false}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="material animate-sheet absolute top-5 right-2 z-20 flex max-h-[70vh] w-80 origin-top-right cursor-default flex-col gap-4 overflow-y-auto rounded-[14px] border border-separator/50 p-4 shadow-float"
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold">Ajustes del panel</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ajustes del panel"
          className="grid size-6 place-items-center rounded-md text-ink-muted hover:bg-fill hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {layouts.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] font-medium text-ink-muted">Disposición</p>
          <SegmentedControl
            label="Disposición"
            value={layouts.some((l) => l.value === value.layout) ? value.layout! : layouts[0].value}
            onChange={(layout) => set({ layout: layout === layouts[0].value ? null : layout })}
            segments={layouts}
          />
        </div>
      )}

      {items && <ItemsEditor all={items.all} visible={value.items ?? items.defaults} onChange={(ids) => set({ items: ids })} />}

      <div className="flex flex-col gap-1.5">
        <p className="text-[12px] font-medium text-ink-muted">Apariencia</p>
        <SegmentedControl<PanelVariant> label="Apariencia" value={value.variant} onChange={(variant) => set({ variant })} segments={VARIANTS} />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[12px] font-medium text-ink-muted">Color</p>
        <div role="radiogroup" aria-label="Color del panel" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={value.color === null}
            aria-label="Color de la app"
            title="Color de la app"
            onClick={() => set({ color: null })}
            className={cn(
              "grid size-6 place-items-center rounded-full border border-line bg-surface-muted text-ink-muted",
              value.color === null && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
            )}
          >
            {value.color === null && <Check className="size-3" strokeWidth={3} />}
          </button>
          {PROJECT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={value.color === color}
              aria-label={color}
              onClick={() => set({ color })}
              className={cn("grid size-6 place-items-center rounded-full", value.color === color && "ring-2 ring-offset-2 ring-offset-surface")}
              style={{ backgroundColor: color, ["--tw-ring-color" as string]: color }}
            >
              {value.color === color && <Check className="size-3 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[12px] font-medium text-ink-muted">Densidad</p>
        <SegmentedControl<PanelStyle["density"]>
          label="Densidad"
          value={value.density}
          onChange={(density) => set({ density })}
          segments={[
            { value: "normal", label: "Normal" },
            { value: "compact", label: "Compacta" },
          ]}
        />
      </div>

      <button
        type="button"
        onClick={() => onChange(DEFAULT_PANEL_STYLE)}
        className="self-start text-[12.5px] font-medium text-accent hover:underline"
      >
        Estilo por defecto
      </button>
    </div>
  );
}
