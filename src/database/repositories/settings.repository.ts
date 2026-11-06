import { getDatabase, NOW_SQL, type SqlExecutor } from "@/database/client";
import { z } from "zod";
import { DEFAULT_DASHBOARD, normalizeDashboard, panelLayoutSchema } from "@/types/dashboard";

export const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Hora local "HH:MM" a partir de la cual se avisa si no hay check-in. */
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const backupSettingsSchema = z.object({
  auto: z.boolean(),
  /** Carpeta elegida por el usuario; null = carpeta de datos de la app. */
  directory: z.string().nullable(),
  keep: z.number().int().min(1).max(100),
});

export const aiSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Modelo de Ollama elegido (p. ej. "llama3.2:3b"). */
  model: z.string().min(1).nullable(),
});

/** Antelaciones (minutos) con que se puede avisar de una entrega. */
export const DEADLINE_REMINDER_OFFSETS = [10080, 1440, 180, 60] as const;

export const deadlineRemindersSchema = z.object({
  enabled: z.boolean(),
  offsets: z.array(z.number().int().refine((n) => (DEADLINE_REMINDER_OFFSETS as readonly number[]).includes(n))).max(4),
});

/** Escala de notas del modo estudio (0–5 con 3 para aprobar, como en muchas universidades). */
export const gradingSchema = z
  .object({ scale: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(100)]), pass: z.number().positive() })
  .refine((g) => g.pass <= g.scale, "La nota para aprobar no puede superar la máxima");

export const dashboardSettingsSchema = z.array(panelLayoutSchema).transform(normalizeDashboard);

export const appSettingsSchema = z.object({
  dashboard: dashboardSettingsSchema.catch(DEFAULT_DASHBOARD),
  ai: aiSettingsSchema.catch({ enabled: false, model: null }),
  reminder: reminderSettingsSchema.catch({ enabled: false, time: "17:30" }),
  backup: backupSettingsSchema.catch({ auto: true, directory: null, keep: 10 }),
  /** Último día (YYYY-MM-DD) en que se envió el recordatorio. */
  last_reminder_date: z.string().nullable().catch(null),
  /** Se completó (o saltó) el onboarding del primer inicio. */
  onboarding_completed: z.boolean().catch(false),
  deadline_reminders: deadlineRemindersSchema.catch({ enabled: true, offsets: [1440, 60] }),
  /** Avisos de entregas ya enviados ("id@minutos"), para no repetirlos. */
  deadline_notified: z.array(z.string()).catch([]),
  grading: gradingSchema.catch({ scale: 5, pass: 3 }),
  /** Repositorios de Git locales cuyos commits se muestran en el registro del día (modo dev). */
  git_repos: z.array(z.string()).max(20).catch([]),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;
export type BackupSettings = z.infer<typeof backupSettingsSchema>;
export type DeadlineReminderSettings = z.infer<typeof deadlineRemindersSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type SettingKey = keyof AppSettings;

export const DEFAULT_SETTINGS: AppSettings = appSettingsSchema.parse({});

/** Validación estricta al guardar (al leer, `.catch` cae a los valores por defecto). */
const STRICT: { [K in SettingKey]: z.ZodType<AppSettings[K], unknown> } = {
  dashboard: dashboardSettingsSchema,
  ai: aiSettingsSchema,
  reminder: reminderSettingsSchema,
  backup: backupSettingsSchema,
  last_reminder_date: z.string().nullable(),
  onboarding_completed: z.boolean(),
  deadline_reminders: deadlineRemindersSchema,
  deadline_notified: z.array(z.string()).max(1000),
  grading: gradingSchema,
  git_repos: z.array(z.string().min(1)).max(20),
};

export function createSettingsRepository(getDb: () => Promise<SqlExecutor>) {
  return {
    /** Preferencias guardadas, completadas con los valores por defecto (los inválidos se ignoran). */
    async load(): Promise<AppSettings> {
      const db = await getDb();
      const rows = await db.select<Array<{ key: string; value: string }>>("SELECT key, value FROM settings");
      const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value) as unknown]));
      return appSettingsSchema.parse(stored);
    },

    async save<K extends SettingKey>(key: K, value: AppSettings[K]): Promise<void> {
      const parsed = STRICT[key].parse(value);
      const db = await getDb();
      await db.execute(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = ${NOW_SQL}`,
        [key, JSON.stringify(parsed)],
      );
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;

export const settingsRepository = createSettingsRepository(getDatabase);
