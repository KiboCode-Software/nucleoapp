import type { ReminderSettings } from "@/database/repositories/settings.repository";
import { toISODate } from "@/utils/date";

interface ReminderState {
  now: Date;
  reminder: ReminderSettings;
  hasTodayLog: boolean;
  /** Día (YYYY-MM-DD) del último recordatorio enviado. */
  lastReminderDate: string | null;
}

/**
 * ¿Toca recordar el check-in? Solo en días laborables, a partir de la hora
 * configurada, si aún no hay registro hoy y no se ha avisado ya hoy.
 */
export function shouldRemind({ now, reminder, hasTodayLog, lastReminderDate }: ReminderState): boolean {
  if (!reminder.enabled || hasTodayLog) return false;
  if (now.getDay() === 0 || now.getDay() === 6) return false;
  if (lastReminderDate === toISODate(now)) return false;

  const [hours, minutes] = reminder.time.split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes;
}

/** Pide permiso (la primera vez) y envía una notificación del sistema. */
export async function notify(title: string, body: string): Promise<boolean> {
  const { isPermissionGranted, requestPermission, sendNotification } = await import("@tauri-apps/plugin-notification");
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === "granted";
  if (granted) sendNotification({ title, body });
  return granted;
}
