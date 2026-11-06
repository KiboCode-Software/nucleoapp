/** Fecha local en formato YYYY-MM-DD (el formato de `daily_logs.log_date`). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Lunes de la semana de `date`, a las 00:00 locales. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (result.getDay() + 6) % 7; // getDay(): 0 = domingo
  result.setDate(result.getDate() - offset);
  return result;
}

/** Convierte "YYYY-MM-DD" en una fecha local (no UTC) a las 00:00. */
export function fromISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Hoy", "Ayer" o "lun, 27 oct" (con año si no es el actual). */
export function formatDayLabel(isoDate: string, now = new Date(), locale = "es"): string {
  const today = toISODate(now);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isoDate === today) return "Hoy";
  if (isoDate === toISODate(yesterday)) return "Ayer";

  const date = fromISODate(isoDate);
  const label = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Duración legible y compacta: "menos de 1 min", "25 min", "3 h", "1 día", "12 días". */
export function formatElapsed(ms: number): string {
  const minutes = Math.floor(Math.max(ms, 0) / 60_000);
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 día" : `${days} días`;
}

/** Tiempo transcurrido entre dos marcas ISO (la segunda, por defecto, es ahora). */
export function elapsedBetween(fromIso: string, toIso?: string | null, now = new Date()): string {
  const end = toIso ? new Date(toIso).getTime() : now.getTime();
  return formatElapsed(end - new Date(fromIso).getTime());
}

/** "sábado, 1 de noviembre" */
export function formatLongDate(date: Date, locale = "es"): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(date);
}

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}
