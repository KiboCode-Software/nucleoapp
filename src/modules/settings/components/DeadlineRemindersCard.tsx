import { CalendarClock, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { DEADLINE_REMINDER_OFFSETS } from "@/database/repositories/settings.repository";
import { formatOffset } from "@/modules/deadlines/schedule";
import { notify } from "@/services/reminder";
import { useSettingsStore } from "@/stores/settings.store";
import { cn } from "@/utils/cn";

/** Avisos de Windows antes de cada entrega o examen (modo estudio). */
export function DeadlineRemindersCard() {
  const reminders = useSettingsStore((s) => s.settings.deadline_reminders);
  const patch = useSettingsStore((s) => s.patch);

  const toggleOffset = (offset: number) => {
    const offsets = reminders.offsets.includes(offset) ? reminders.offsets.filter((o) => o !== offset) : [...reminders.offsets, offset];
    void patch("deadline_reminders", { offsets: offsets.sort((a, b) => b - a) });
  };

  return (
    <Card title="Avisos de entregas" action={<CalendarClock className="size-4 text-ink-muted" />}>
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Avisarme antes de cada entrega</p>
          <p className="text-[12.5px] text-ink-muted">Una notificación de Windows con lo que falta, mientras la app está abierta.</p>
        </div>
        <Switch
          label="Avisarme antes de cada entrega"
          checked={reminders.enabled}
          onChange={(enabled) =>
            void (async () => {
              // Al activarlo se pide el permiso de notificaciones de Windows.
              if (enabled) await notify("Núcleo", "Te avisaré antes de tus entregas y exámenes.").catch(() => false);
              await patch("deadline_reminders", { enabled });
            })()
          }
        />
      </div>
      <div role="group" aria-label="Antelación de los avisos" className="mt-4 flex flex-wrap gap-2">
        {DEADLINE_REMINDER_OFFSETS.map((offset) => {
          const on = reminders.offsets.includes(offset);
          return (
            <button
              key={offset}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={!reminders.enabled}
              onClick={() => toggleOffset(offset)}
              className={cn(
                "pressable inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors disabled:opacity-40",
                on ? "bg-accent text-white" : "bg-fill text-ink",
              )}
            >
              {on && <Check className="size-3.5" strokeWidth={3} />}
              {formatOffset(offset)}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
