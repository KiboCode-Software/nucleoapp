import { ChevronLeft, ChevronRight } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { formatPeriod, periodContaining, shiftPeriod, type PeriodRange, type ReportPeriod } from "@/services/reports/period";
import { toISODate } from "@/utils/date";

interface PeriodPickerProps {
  range: PeriodRange;
  onChange: (range: PeriodRange) => void;
}

export function PeriodPicker({ range, onChange }: PeriodPickerProps) {
  const current = periodContaining(range.period, new Date());
  const isCurrent = range.start === current.start;
  const isFuture = shiftPeriod(range, 1).start > toISODate(new Date());

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl<ReportPeriod>
        label="Tipo de reporte"
        value={range.period}
        onChange={(period) => onChange(periodContaining(period, new Date()))}
        segments={[
          { value: "daily", label: "Diario" },
          { value: "weekly", label: "Semanal" },
        ]}
      />
      <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
        <button
          type="button"
          onClick={() => onChange(shiftPeriod(range, -1))}
          aria-label="Periodo anterior"
          className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-fill hover:text-ink"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="flex-1 text-center text-[13px] font-medium first-letter:uppercase" aria-live="polite">
          {formatPeriod(range)}
        </span>
        <button
          type="button"
          onClick={() => onChange(shiftPeriod(range, 1))}
          disabled={isFuture}
          aria-label="Periodo siguiente"
          className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-fill hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      {!isCurrent && (
        <button type="button" onClick={() => onChange(current)} className="self-center text-[12.5px] font-medium text-accent hover:underline">
          Ir a {range.period === "daily" ? "hoy" : "esta semana"}
        </button>
      )}
    </div>
  );
}
