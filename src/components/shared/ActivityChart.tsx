import { useState } from "react";
import type { DayActivity } from "@/services/stats";
import { cn } from "@/utils/cn";
import { fromISODate, toISODate } from "@/utils/date";
import { useMode } from "@/stores/profile.store";

const CHART_HEIGHT = 112;

const weekday = new Intl.DateTimeFormat("es", { weekday: "narrow" });
const longDay = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "short" });

function describe(day: DayActivity, student: boolean): string {
  if (day.logs === 0) return student ? "sin registro" : "sin check-in";
  const items = `${day.items} ${day.items === 1 ? "elemento" : "elementos"}`;
  return day.logs === 1 ? items : `${items} en ${day.logs} ${student ? "registros" : "check-ins"}`;
}

/**
 * Barras de actividad por día (una serie: elementos registrados).
 * Barras finas ancladas a la base con esquinas de 4 px, tooltip al pasar el
 * cursor y una tabla equivalente para lectores de pantalla.
 */
export function ActivityChart({ days, title = "Elementos registrados por día" }: { days: DayActivity[]; title?: string }) {
  const student = useMode() === "student";
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.items));
  const today = toISODate(new Date());

  return (
    // `relative`: la tabla sr-only (absoluta) debe quedar dentro de la figura; si no,
    // se posiciona respecto a la página y crea una segunda barra de desplazamiento.
    <figure className="relative flex flex-col gap-2">
      <figcaption className="text-[12.5px] text-ink-muted">{title}</figcaption>

      <div className="relative" style={{ height: CHART_HEIGHT }} aria-hidden="true">
        {/* Línea base */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-line" />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {days.map((day, i) => {
            const height = day.items > 0 ? Math.max(4, (day.items / max) * (CHART_HEIGHT - 20)) : 0;
            return (
              <div
                key={day.date}
                className="relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {height > 0 ? (
                  <div
                    className={cn(
                      "w-full max-w-7 rounded-t-[4px] bg-accent transition-opacity duration-150",
                      hovered !== null && hovered !== i && "opacity-40",
                    )}
                    style={{ height }}
                  />
                ) : (
                  day.logs > 0 && <div className="mb-px size-1.5 rounded-full bg-accent" />
                )}
                {hovered === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-center whitespace-nowrap shadow-card">
                    <p className="text-[12px] font-medium first-letter:uppercase">{longDay.format(fromISODate(day.date))}</p>
                    <p className="text-[11.5px] text-ink-muted">{describe(day, student)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-[2px]" aria-hidden="true">
        {days.map((day) => (
          <span
            key={day.date}
            className={cn("flex-1 text-center text-[11px] text-ink-muted uppercase", day.date === today && "font-semibold text-ink")}
          >
            {weekday.format(fromISODate(day.date))}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Elementos</th>
            <th scope="col">Check-ins</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <th scope="row">{longDay.format(fromISODate(day.date))}</th>
              <td>{day.items}</td>
              <td>{day.logs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
