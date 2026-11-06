import type { BlockerEntry } from "@/database/repositories/blockers.repository";
import type { DailyLogEntry } from "@/database/repositories/daily-logs.repository";
import type { LearningEntry } from "@/database/repositories/learnings.repository";
import type { PeriodData } from "@/database/repositories/reports.repository";
import { parseTasks } from "@/modules/daily-log/tasks";
import { vocabularyFor, type Vocabulary } from "@/modes/vocabulary";
import { elapsedBetween, formatDayLabel, fromISODate } from "@/utils/date";
import { formatPeriod, type PeriodRange } from "./period";

/**
 * Generación de reportes con plantillas y reglas, sin IA ni conexión.
 * Todo es determinista: los mismos datos producen siempre el mismo texto.
 */

const MAX_FOCUS_ITEMS = 3;

/** Convierte una respuesta libre en elementos: una línea = un elemento, sin viñetas. */
const DEV = vocabularyFor("dev");

export function toItems(text: string): string[] {
  return text
    .split("\n")
    // Viñetas y casillas de tarea ("- [x] ") no forman parte del texto.
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])?\s*\[[ xX]\]\s+/, "").replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

function joinList(items: string[]): string {
  return new Intl.ListFormat("es", { style: "long", type: "conjunction" }).format(items);
}

/** Minúscula inicial para insertar en una frase, salvo siglas ("JWT", "API"). */
function inSentence(item: string): string {
  const clean = item.replace(/[.;:,]+$/, "");
  return /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9]/.test(clean) ? clean : clean.charAt(0).toLowerCase() + clean.slice(1);
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Momento de referencia para "abierto hace…": el final del periodo, o ahora si aún no terminó. */
function referenceDate(range: PeriodRange, now: Date): Date {
  const end = fromISODate(range.end);
  const endOfPeriod = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
  return endOfPeriod < now ? endOfPeriod : now;
}

/**
 * Aprendizajes del periodo sin duplicados: los escritos en los check-ins más los
 * guardados en el módulo que no provienen de uno de esos check-ins.
 */
export function learningTitles({ logs, learnings }: Pick<PeriodData, "logs" | "learnings">): string[] {
  const logIds = new Set(logs.map((l) => l.id));
  const fromLogs = logs.flatMap((l) => toItems(l.learnings));
  const fromModule = learnings.filter((l) => l.daily_log_id == null || !logIds.has(l.daily_log_id)).map((l) => l.title);
  return [...fromLogs, ...fromModule];
}

export function reportTitle(range: PeriodRange, vocab: Vocabulary = DEV): string {
  return range.period === "daily" ? vocab.reports.daily : vocab.reports.weekly;
}

/** Concordancia según el género del sustantivo: "el proyecto", "las materias", "abierta"… */
function articles(feminine: boolean) {
  return feminine
    ? { the: "la", theMany: "las", of: "de la", ofMany: "de las", open: "abierta", openOldest: "la más antigua abierta", resolved: "resuelta" }
    : { the: "el", theMany: "los", of: "del", ofMany: "de los", open: "abierto", openOldest: "el más antiguo abierto", resolved: "resuelto" };
}

/** Párrafo de resumen construido con reglas a partir de los datos del periodo. */
export function buildSummary(range: PeriodRange, data: PeriodData, now = new Date(), vocab: Vocabulary = DEV): string {
  const p = vocab.project;
  const pa = articles(p.feminine);
  const b = vocab.blocker;
  const ba = articles(b.feminine);
  const student = vocab.mode === "student";
  const { logs, blockersResolved, blockersPending } = data;
  const daily = range.period === "daily";
  const sentences: string[] = [];

  if (logs.length === 0) {
    sentences.push(daily ? "No hay registro diario para esta jornada." : "No hay registros diarios en esta semana.");
  } else {
    if (!daily) sentences.push(`Durante la semana se registraron ${count(logs.length, ...vocab.reports.checkIns)}${student ? "" : " diarios"}.`);

    const projects = [...new Set(logs.map((l) => l.project_name).filter((p): p is string => Boolean(p)))];
    const plans = logs.flatMap((l) => toItems(l.today));
    const progress = logs.flatMap((l) => toItems(l.yesterday));

    if (plans.length > 0) {
      const focus = plans.slice(0, MAX_FOCUS_ITEMS).map(inSentence);
      const rest = plans.length - focus.length;
      const list = rest > 0 ? `${focus.join(", ")} y ${count(rest, "tarea más", "tareas más")}` : joinList(focus);
      const where =
        projects.length === 0 ? "" : ` ${projects.length === 1 ? `${pa.of} ${p.one}` : `${pa.ofMany} ${p.many}`} ${joinList(projects)}`;
      sentences.push(`${daily ? "La jornada" : student ? "El estudio" : "El trabajo"}${where} se centró en ${list}.`);
    } else if (projects.length) {
      sentences.push(`Se trabajó en ${projects.length === 1 ? `${pa.the} ${p.one}` : `${pa.theMany} ${p.many}`} ${joinList(projects)}.`);
    }

    const tasks = logs.flatMap((l) => parseTasks(l.today));
    const done = tasks.filter((t) => t.done).length;
    if (done > 0) sentences.push(`Se completaron ${done} de ${count(tasks.length, "tarea planificada", "tareas planificadas")}.`);

    if (progress.length > 0) {
      const shown = progress.slice(0, MAX_FOCUS_ITEMS).map(inSentence);
      const rest = progress.length - shown.length;
      sentences.push(`Como avances se reportaron ${rest > 0 ? `${shown.join(", ")}, entre otros` : joinList(shown)}.`);
    }
  }

  const learnings = learningTitles(data);
  if (learnings.length === 1) sentences.push(`Se registró un ${vocab.learning.one}: ${inSentence(learnings[0])}.`);
  if (learnings.length > 1) {
    sentences.push(`Se registraron ${learnings.length} ${vocab.learning.many}, entre ellos ${joinList(learnings.slice(0, 2).map(inSentence))}.`);
  }

  if (data.focus && data.focus.minutes > 0) {
    const { minutes, sessions } = data.focus;
    const time = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
    sentences.push(`Se dedicaron ${time} de enfoque en ${count(sessions, "bloque", "bloques")}.`);
  }

  const resolved = blockersResolved.length;
  const pending = blockersPending.length;
  if (resolved > 0 && pending > 0) {
    sentences.push(
      `Se ${resolved === 1 ? `resolvió 1 ${b.one}` : `resolvieron ${resolved} ${b.many}`} y ${pending === 1 ? "queda 1 pendiente" : `quedan ${pending} pendientes`}.`,
    );
  } else if (resolved > 0) {
    sentences.push(`Se ${resolved === 1 ? `resolvió 1 ${b.one}` : `resolvieron ${resolved} ${b.many}`} y no quedan pendientes.`);
  } else if (pending > 0) {
    const oldest = elapsedBetween(blockersPending[0].opened_at, null, referenceDate(range, now));
    sentences.push(
      `${pending === 1 ? `Queda 1 ${b.one} pendiente` : `Quedan ${pending} ${b.many} pendientes`}, ${pending === 1 ? ba.open : ba.openOldest} hace ${oldest}.`,
    );
  } else if (logs.length > 0) {
    sentences.push(`No hay ${b.many} pendientes.`);
  }

  return sentences.join(" ");
}

function bulletList(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

function logSection(log: DailyLogEntry, heading: string | null, now: Date, vocab: Vocabulary): string[] {
  const lines: string[] = [];
  if (heading) lines.push(`### ${heading}`, "");

  // El plan se muestra con ✓ en las tareas hechas.
  const plan = parseTasks(log.today).map((t) => (t.done ? `✓ ${t.text}` : t.text));
  const parts: Array<[string, string[]]> = [
    ["Avances", toItems(log.yesterday)],
    [vocab.day.planTitle, plan],
    [`${vocab.modules.blockers.label} mencionad${vocab.blocker.feminine ? "as" : "os"}`, toItems(log.blockers_note)],
    [vocab.day.learningsTitle, toItems(log.learnings)],
  ];
  for (const [label, items] of parts) {
    if (items.length === 0) continue;
    lines.push(`**${label}**`, "", ...bulletList(items), "");
  }
  if (heading === null && lines.length === 0) lines.push(`Sin contenido (${formatDayLabel(log.log_date, now)}).`, "");
  return lines;
}

function blockerLine(blocker: BlockerEntry, reference: Date, vocab: Vocabulary): string {
  const ba = articles(vocab.blocker.feminine);
  const attempts = blocker.attempts_count > 0 ? ` · ${count(blocker.attempts_count, "intento", "intentos")}` : "";
  const project = blocker.project_name ? ` · ${blocker.project_name}` : "";
  if (blocker.status === "resolved" && blocker.resolved_at) {
    return `- **${blocker.title}** — ${ba.resolved} en ${elapsedBetween(blocker.opened_at, blocker.resolved_at)}${attempts}${project}`;
  }
  const escalated = blocker.status === "escalated" ? ` · ${vocab.blocker.status.escalated.toLowerCase()}` : "";
  return `- **${blocker.title}** — ${ba.open} hace ${elapsedBetween(blocker.opened_at, null, reference)}${escalated}${attempts}${project}`;
}

function learningLine(learning: LearningEntry, vocab: Vocabulary): string {
  const tags = learning.tags.length ? ` · ${learning.tags.map((t) => `#${t}`).join(" ")}` : "";
  const project = learning.project_name ? ` · ${learning.project_name}` : "";
  return `- **${learning.title}** — ${vocab.learning.kinds[learning.kind].label.toLowerCase()}${tags}${project}`;
}

function dayHeading(log: DailyLogEntry): string {
  const label = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(fromISODate(log.log_date));
  const heading = label.charAt(0).toUpperCase() + label.slice(1);
  return log.project_name ? `${heading} · ${log.project_name}` : heading;
}

/** Reporte completo en Markdown. */
export function generateMarkdown(range: PeriodRange, data: PeriodData, now = new Date(), vocab: Vocabulary = DEV): string {
  const reference = referenceDate(range, now);
  const lines: string[] = [`# ${reportTitle(range, vocab)}`, "", `**${formatPeriod(range)}**`, "", "## Resumen", "", buildSummary(range, data, now, vocab), ""];

  if (data.logs.length > 0) {
    lines.push("## Actividades", "");
    const withHeadings = data.logs.length > 1 || range.period === "weekly";
    for (const log of data.logs) lines.push(...logSection(log, withHeadings ? dayHeading(log) : null, now, vocab));
  }

  if (data.blockersResolved.length > 0 || data.blockersPending.length > 0) {
    lines.push(`## ${vocab.modules.blockers.label}`, "");
    if (data.blockersResolved.length > 0) {
      lines.push(`### ${vocab.blocker.filterResolved}`, "", ...data.blockersResolved.map((b) => blockerLine(b, reference, vocab)), "");
    }
    if (data.blockersPending.length > 0) {
      lines.push("### Pendientes", "", ...data.blockersPending.map((b) => blockerLine(b, reference, vocab)), "");
    }
  }

  if (data.learnings.length > 0) {
    lines.push(`## ${vocab.modules.learning.label} guardados`, "", ...data.learnings.map((l) => learningLine(l, vocab)), "");
  }

  const generatedAt = new Intl.DateTimeFormat("es", { dateStyle: "long", timeStyle: "short" }).format(now);
  lines.push("---", "", `Generado localmente con Núcleo el ${generatedAt}.`, "");
  return lines.join("\n");
}

/** Versión estructurada del reporte para exportar como JSON. */
export function buildReportJson(range: PeriodRange, data: PeriodData, markdown: string, now = new Date(), vocab: Vocabulary = DEV) {
  const blocker = (b: BlockerEntry) => ({
    title: b.title,
    description: b.description,
    status: b.status,
    project: b.project_name,
    opened_at: b.opened_at,
    resolved_at: b.resolved_at,
    attempts: b.attempts_count,
  });

  return {
    app: "Núcleo",
    format_version: 1,
    report: {
      type: range.period,
      title: reportTitle(range, vocab),
      period_start: range.start,
      period_end: range.end,
      generator: "template",
      generated_at: now.toISOString(),
    },
    summary: buildSummary(range, data, now),
    daily_logs: data.logs.map((l) => ({
      date: l.log_date,
      project: l.project_name,
      yesterday: l.yesterday,
      today: l.today,
      blockers_note: l.blockers_note,
      learnings: l.learnings,
    })),
    blockers: {
      opened: data.blockersOpened.map(blocker),
      resolved: data.blockersResolved.map(blocker),
      pending: data.blockersPending.map(blocker),
    },
    learnings: data.learnings.map((l) => ({
      title: l.title,
      kind: l.kind,
      content: l.content,
      tags: l.tags,
      project: l.project_name,
      created_at: l.created_at,
    })),
    markdown,
  };
}
