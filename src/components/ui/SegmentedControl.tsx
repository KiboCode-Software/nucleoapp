import { cn } from "@/utils/cn";

interface Segment<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Control segmentado de iOS (UISegmentedControl): segmentos del mismo ancho y una
 * píldora blanca que se desliza hasta la opción elegida.
 */
export function SegmentedControl<T extends string>({ label, segments, value, onChange }: SegmentedControlProps<T>) {
  const index = Math.max(0, segments.findIndex((s) => s.value === value));

  return (
    <div role="radiogroup" aria-label={label} className="relative flex rounded-[9px] bg-fill p-[2px]">
      <span
        aria-hidden
        className="absolute top-[2px] bottom-[2px] left-[2px] rounded-[7px] bg-surface shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] transition-transform duration-300 ease-[var(--ease-ios)] dark:bg-[#636366]"
        style={{ width: `calc((100% - 4px) / ${segments.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {segments.map((segment, i) => {
        const active = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(segment.value)}
            className={cn(
              "relative z-10 flex h-7 min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 truncate px-3 text-[12.5px] transition-colors duration-200",
              active ? "font-semibold text-ink" : "font-medium text-ink hover:text-ink/70",
              // Separadores finos entre segmentos no seleccionados, como en iOS.
              i > 0 && i !== index && i - 1 !== index && "before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-px before:bg-separator",
            )}
          >
            {segment.label}
            {segment.count !== undefined && <span className="font-medium text-ink-muted tabular-nums">{segment.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
