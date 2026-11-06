import { z } from "zod";

/**
 * Esquemas de validación de las entidades. Reflejan las tablas de
 * src/database/migrations/0001_initial_schema.sql; los repositorios validan
 * con ellos todo lo que entra a la base de datos.
 */

const id = z.number().int().positive();
const timestamp = z.iso.datetime();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)");
const requiredText = (max: number) => z.string().trim().min(1, "Campo obligatorio").max(max);

export const projectSchema = z.object({
  id,
  name: requiredText(80),
  description: z.string().max(500).default(""),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().default(null),
  archived: z.boolean().default(false),
  created_at: timestamp,
  updated_at: timestamp,
});

export const PROJECT_COLORS = ["#007AFF", "#34C759", "#FF9F0A", "#FF3B30", "#AF52DE", "#FF2D55", "#5AC8FA", "#8E8E93"] as const;

export const projectInputSchema = z.object({
  name: requiredText(80),
  description: z.string().trim().max(500).default(""),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().default(null),
});

export const dailyLogSchema = z.object({
  id,
  project_id: id.nullable(),
  log_date: isoDate,
  yesterday: z.string().max(5000).default(""),
  today: z.string().max(5000).default(""),
  blockers_note: z.string().max(5000).default(""),
  learnings: z.string().max(5000).default(""),
  created_at: timestamp,
  updated_at: timestamp,
});

export const blockerStatusSchema = z.enum(["pending", "resolved", "escalated"]);

export const blockerSchema = z
  .object({
    id,
    daily_log_id: id.nullable(),
    project_id: id.nullable(),
    title: requiredText(140),
    description: z.string().max(5000).default(""),
    status: blockerStatusSchema,
    opened_at: timestamp,
    resolved_at: timestamp.nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .refine((b) => (b.status === "resolved") === (b.resolved_at !== null), {
    message: "Un bloqueo resuelto debe tener fecha de resolución (y solo él)",
    path: ["resolved_at"],
  });

/** Datos editables de un bloqueo (el estado se cambia aparte, con su fecha de resolución). */
export const blockerInputSchema = z.object({
  title: requiredText(140),
  description: z.string().max(5000).default(""),
  project_id: id.nullable().default(null),
  daily_log_id: id.nullable().default(null),
});

export const blockerAttemptSchema = z.object({
  id,
  blocker_id: id,
  description: requiredText(2000),
  created_at: timestamp,
});

export const learningKindSchema = z.enum(["note", "concept", "error_fix", "command"]);

export const LEARNING_KIND_LABELS: Record<z.infer<typeof learningKindSchema>, string> = {
  concept: "Concepto",
  error_fix: "Error resuelto",
  command: "Comando",
  note: "Nota",
};

export const BLOCKER_STATUS_LABELS: Record<z.infer<typeof blockerStatusSchema>, string> = {
  pending: "Pendiente",
  escalated: "Escalado",
  resolved: "Resuelto",
};

export const learningSchema = z.object({
  id,
  daily_log_id: id.nullable(),
  project_id: id.nullable(),
  kind: learningKindSchema,
  title: requiredText(140),
  content: z.string().max(20000).default(""),
  created_at: timestamp,
  updated_at: timestamp,
});

export const tagSchema = z.string().trim().min(1).max(30);

export const learningInputSchema = z.object({
  kind: learningKindSchema.default("note"),
  title: requiredText(140),
  content: z.string().max(20000).default(""),
  project_id: id.nullable().default(null),
  daily_log_id: id.nullable().default(null),
  tags: z
    .array(tagSchema)
    .max(10, "Máximo 10 etiquetas")
    .default([])
    // Sin duplicados (sin distinguir mayúsculas), conservando la primera forma escrita.
    .transform((tags) => tags.filter((t, i) => tags.findIndex((o) => o.toLowerCase() === t.toLowerCase()) === i)),
});

export const reportSchema = z.object({
  id,
  period: z.enum(["daily", "weekly"]),
  period_start: isoDate,
  period_end: isoDate,
  content: z.string(),
  generator: z.enum(["template", "local_ai"]),
  created_at: timestamp,
});

/** Datos de entrada del formulario de check-in (sin campos generados por la BD). */
export const dailyLogInputSchema = dailyLogSchema
  .pick({
    project_id: true,
    log_date: true,
    yesterday: true,
    today: true,
    blockers_note: true,
    learnings: true,
  })
  .refine((log) => [log.yesterday, log.today, log.blockers_note, log.learnings].some((answer) => answer.trim()), {
    message: "Escribe al menos una tarea, un bloqueo o un aprendizaje",
  });

export type Project = z.infer<typeof projectSchema>;
export type ProjectInput = z.input<typeof projectInputSchema>;
export type LearningInput = z.input<typeof learningInputSchema>;
export type DailyLog = z.infer<typeof dailyLogSchema>;
export type DailyLogInput = z.infer<typeof dailyLogInputSchema>;
export type BlockerStatus = z.infer<typeof blockerStatusSchema>;
export type Blocker = z.infer<typeof blockerSchema>;
export type BlockerInput = z.input<typeof blockerInputSchema>;
export type BlockerAttempt = z.infer<typeof blockerAttemptSchema>;
export type LearningKind = z.infer<typeof learningKindSchema>;
export type Learning = z.infer<typeof learningSchema>;
export type Report = z.infer<typeof reportSchema>;
