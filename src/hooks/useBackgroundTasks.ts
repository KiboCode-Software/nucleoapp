import { useEffect } from "react";
import { isTauri } from "@/database/client";
import { dailyLogsRepository } from "@/database/repositories/daily-logs.repository";
import { deadlinesRepository } from "@/database/repositories/deadlines.repository";
import { countdown, dueReminders, KIND_META } from "@/modules/deadlines/schedule";
import { backupService } from "@/services/backup";
import { CAPTURE_SAVED_EVENT, onTauriEvent } from "@/services/quick-capture";
import { notify, shouldRemind } from "@/services/reminder";
import { useCapturesStore } from "@/stores/captures.store";
import { useProfileStore } from "@/stores/profile.store";
import { ensureSettingsLoaded, useSettingsStore } from "@/stores/settings.store";
import { toISODate } from "@/utils/date";

const BACKUP_CHECK_MS = 30 * 60_000;
const REMINDER_CHECK_MS = 60_000;

async function backupIfDue() {
  try {
    await backupService.runIfDue(useSettingsStore.getState().settings.backup);
  } catch (error) {
    console.error("Falló el respaldo automático", error);
  }
}

async function remindIfDue() {
  const { settings, update } = useSettingsStore.getState();
  const now = new Date();
  const today = toISODate(now);
  try {
    const hasTodayLog = await dailyLogsRepository.hasLogOn(today);
    if (!shouldRemind({ now, reminder: settings.reminder, hasTodayLog, lastReminderDate: settings.last_reminder_date })) return;
    await notify("Núcleo", "Aún no has anotado nada hoy. ¿Qué tal un repaso rápido del día?");
    await update("last_reminder_date", today);
  } catch (error) {
    console.error("Falló el recordatorio", error);
  }
}

/** Avisa de las entregas próximas (solo en perfiles de estudio, que tienen Entregas). */
async function remindDeadlines() {
  const { settings, update } = useSettingsStore.getState();
  const { enabled, offsets } = settings.deadline_reminders;
  if (!enabled || offsets.length === 0 || useProfileStore.getState().active.mode !== "student") return;
  try {
    const now = new Date();
    const due = dueReminders(await deadlinesRepository.list(), offsets, settings.deadline_notified, now);
    if (due.length === 0) return;
    for (const { deadline } of due) {
      const subject = deadline.project_name ? ` · ${deadline.project_name}` : "";
      await notify(`${KIND_META[deadline.kind].label}: ${deadline.title}${subject}`, countdown(deadline.due_at, now));
    }
    // Se guardan los últimos avisos (los de entregas viejas ya no hacen falta).
    const keys = [...settings.deadline_notified, ...due.flatMap((r) => r.keys)].slice(-500);
    await update("deadline_notified", keys);
  } catch (error) {
    console.error("Falló el aviso de entregas", error);
  }
}

/**
 * Tareas de la ventana principal mientras la app está abierta: respaldo automático,
 * recordatorios (check-in y entregas) y recarga de la bandeja cuando la ventana flotante guarda.
 */
export function useBackgroundTasks() {
  useEffect(() => {
    if (!isTauri()) return;

    void ensureSettingsLoaded().then(() => {
      void backupIfDue();
      void remindIfDue();
      void remindDeadlines();
    });
    const backupTimer = setInterval(() => void backupIfDue(), BACKUP_CHECK_MS);
    const reminderTimer = setInterval(() => {
      void remindIfDue();
      void remindDeadlines();
    }, REMINDER_CHECK_MS);
    const unlisten = onTauriEvent(CAPTURE_SAVED_EVENT, () => void useCapturesStore.getState().load());

    return () => {
      clearInterval(backupTimer);
      clearInterval(reminderTimer);
      void unlisten.then((stop) => stop());
    };
  }, []);
}
