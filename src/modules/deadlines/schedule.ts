import { BookCheck, ClipboardList, Presentation, Shapes, type LucideIcon } from "lucide-react";
import type { Deadline, DeadlineKind } from "@/database/repositories/deadlines.repository";
import { startOfWeek, toISODate } from "@/utils/date";

export const KIND_META: Record<DeadlineKind, { label: string; plural: string; icon: LucideIcon; tint: string }> = {
  assignment: { label: "Trabajo", plural: "Trabajos", icon: ClipboardList, tint: "#007AFF" },
  exam: { label: "Examen", plural: "Exámenes", icon: BookCheck, tint: "#FF3B30" },
  presentation: { label: "Exposición", plural: "Exposiciones", icon: Presentation, tint: "#FF9500" },
  other: { label: "Otro", plural: "Otros", icon: Shapes, tint: "#8E8E93" },
};

export type DeadlineGroup = "overdue" | "today" | "week" | "later" | "done";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-11-03T14:00" (hora local) → Date. */
export function parseDue(due: string): Date {
  const [date, time] = due.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** Días naturales entre hoy y la fecha de entrega (0 = hoy, 1 = mañana, -1 = ayer). */
export function daysUntil(due: string, now = new Date()): number {
  const [y, m, d] = due.slice(0, 10).split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

export function groupOf(deadline: Deadline, now = new Date()): DeadlineGroup {
  if (deadline.done_at) return "done";
  if (parseDue(deadline.due_at) < now) return "overdue";
  const days = daysUntil(deadline.due_at, now);
  if (days === 0) return "today";
  return days <= 7 ? "week" : "later";
}

const time = (due: string) => due.slice(11, 16);

/** Cuenta regresiva legible: "Hoy a las 14:00", "Mañana", "En 5 días", "Venció hace 2 días". */
export function countdown(due: string, now = new Date()): string {
  const days = daysUntil(due, now);
  const passed = parseDue(due) < now;
  if (days === 0) return passed ? `Venció hoy a las ${time(due)}` : `Hoy a las ${time(due)}`;
  if (days === 1) return `Mañana a las ${time(due)}`;
  if (days === -1) return "Venció ayer";
  if (days < 0) return `Venció hace ${-days} días`;
  if (days < 14) return `En ${days} días`;
  const weeks = Math.round(days / 7);
  return weeks < 8 ? `En ${weeks} semanas` : `En ${Math.round(days / 30)} meses`;
}

/** Fecha completa: "lunes, 3 de noviembre · 14:00". */
export function formatDue(due: string, locale = "es"): string {
  const date = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(parseDue(due));
  return `${date} · ${time(due)}`;
}

/** Valor por defecto del campo de fecha: dentro de una semana a las 23:59. */
export function defaultDue(now = new Date()): string {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  return `${toISODate(next)}T23:59`;
}

/** Pendientes que vencen en los próximos `days` días (incluidas las vencidas). */
export function upcoming(list: Deadline[], now = new Date(), days = 14): Deadline[] {
  return list
    .filter((d) => !d.done_at && daysUntil(d.due_at, now) <= days)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
}

/** Cuenta regresiva precisa para la entrega destacada: "1 d 14 h 32 min", "45 min", "Vencida hace 3 h". */
export function preciseCountdown(due: string, now = new Date()): string {
  const diff = parseDue(due).getTime() - now.getTime();
  const minutes = Math.floor(Math.abs(diff) / 60_000);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const parts = d > 0 ? [`${d} d`, `${h} h`, ...(d < 3 ? [`${m} min`] : [])] : h > 0 ? [`${h} h`, `${m} min`] : [`${m} min`];
  return diff < 0 ? `Vencida hace ${parts.slice(0, 2).join(" ")}` : parts.join(" ");
}

export interface TimelineWeek {
  key: string;
  label: string;
  items: Deadline[];
}

const weekLabel = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

/**
 * Pendientes agrupadas por semana (de lunes a domingo), con las vencidas primero:
 * "Vencidas", "Esta semana", "Próxima semana", "Semana del 16 nov.".
 */
export function timelineWeeks(list: Deadline[], now = new Date()): TimelineWeek[] {
  const pending = list.filter((d) => !d.done_at).sort((a, b) => a.due_at.localeCompare(b.due_at) || a.id - b.id);
  const thisWeek = toISODate(startOfWeek(now));
  const nextWeek = toISODate(startOfWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)));
  const weeks = new Map<string, TimelineWeek>();

  for (const deadline of pending) {
    const overdue = parseDue(deadline.due_at) < now;
    const start = toISODate(startOfWeek(parseDue(deadline.due_at)));
    const key = overdue ? "overdue" : start;
    if (!weeks.has(key)) {
      const label = overdue
        ? "Vencidas"
        : start === thisWeek
          ? "Esta semana"
          : start === nextWeek
            ? "Próxima semana"
            : `Semana del ${weekLabel.format(startOfWeek(parseDue(deadline.due_at)))}`;
      weeks.set(key, { key, label, items: [] });
    }
    weeks.get(key)!.items.push(deadline);
  }
  // Las vencidas siempre arriba aunque su semana sea anterior.
  return [...weeks.values()].sort((a, b) => (a.key === "overdue" ? -1 : b.key === "overdue" ? 1 : a.key.localeCompare(b.key)));
}

/** La más urgente: la primera pendiente por fecha (vencida o no). */
export function nextDeadline(list: Deadline[]): Deadline | null {
  return list.filter((d) => !d.done_at).sort((a, b) => a.due_at.localeCompare(b.due_at) || a.id - b.id)[0] ?? null;
}

export interface DeadlineReminder {
  deadline: Deadline;
  /** Antelación del aviso, en minutos. */
  offset: number;
  /** Claves "id@minutos" que quedan avisadas (las antelaciones más largas ya pasadas incluidas). */
  keys: string[];
}

export const reminderKey = (id: number, offset: number) => `${id}@${offset}`;

/**
 * Avisos que tocan ahora: entregas pendientes y no vencidas cuyo momento de aviso
 * ya llegó. Si pasaron varias antelaciones (p. ej. la app estuvo cerrada), solo se
 * avisa una vez, con la más cercana, y las demás se dan por avisadas.
 */
export function dueReminders(list: Deadline[], offsets: number[], notified: string[], now = new Date()): DeadlineReminder[] {
  const sent = new Set(notified);
  const result: DeadlineReminder[] = [];
  for (const deadline of list) {
    if (deadline.done_at) continue;
    const due = parseDue(deadline.due_at).getTime();
    if (due <= now.getTime()) continue;
    const reached = offsets.filter((offset) => due - offset * 60_000 <= now.getTime()).sort((a, b) => a - b);
    const pending = reached.filter((offset) => !sent.has(reminderKey(deadline.id, offset)));
    if (pending.length === 0) continue;
    // La más cercana entre las alcanzadas; si ya se avisó con ella, no se repite con otras más lejanas.
    if (sent.has(reminderKey(deadline.id, reached[0]))) continue;
    result.push({ deadline, offset: reached[0], keys: reached.map((offset) => reminderKey(deadline.id, offset)) });
  }
  return result;
}

export function formatOffset(minutes: number): string {
  if (minutes >= 10080) return "1 semana antes";
  if (minutes >= 1440) return "1 día antes";
  return minutes >= 120 ? `${minutes / 60} horas antes` : "1 hora antes";
}
