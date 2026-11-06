import type { BlockerEntry } from "@/database/repositories/blockers.repository";
import type { PeriodData } from "@/database/repositories/reports.repository";
import { vocabularyFor, type Vocabulary } from "@/modes/vocabulary";
import { toISODate } from "@/utils/date";
import { parseTasks } from "@/modules/daily-log/tasks";

/**
 * CSV según RFC 4180: separador coma, comillas dobles cuando hace falta, CRLF.
 * Empieza con BOM para que Excel detecte UTF-8 (tildes y ñ).
 */
export function toCsv(rows: Array<Array<string | number | null>>): string {
  const cell = (value: string | number | null) => {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}


const localDay = (iso: string) => toISODate(new Date(iso));

/** Una fila por elemento del periodo: registros, bloqueos y aprendizajes, por fecha. */
export function buildReportCsv(data: PeriodData, vocab: Vocabulary = vocabularyFor("dev")): string {
  const rows: string[][] = [];
  const types = ["registro", vocab.blocker.one, vocab.learning.one];

  for (const log of data.logs) {
    const detail = [
      ["Avances", log.yesterday],
      [vocab.day.planTitle, parseTasks(log.today).map((t) => (t.done ? `✓ ${t.text}` : t.text)).join("\n")],
      [vocab.day.blockersTitle, log.blockers_note],
      [vocab.day.learningsTitle, log.learnings],
    ]
      .filter(([, text]) => text.trim())
      .map(([label, text]) => `${label}: ${text.trim()}`)
      .join("\n");
    const title = parseTasks(log.today)[0]?.text ?? (log.yesterday || log.learnings || log.blockers_note).trim().split("\n")[0];
    rows.push([types[0], log.log_date, log.project_name ?? "", title, detail, ""]);
  }

  const blockers = new Map<number, BlockerEntry>();
  for (const b of [...data.blockersOpened, ...data.blockersResolved, ...data.blockersPending]) blockers.set(b.id, b);
  for (const b of blockers.values()) {
    const status = b.resolved_at ? `${vocab.blocker.status.resolved} (${localDay(b.resolved_at)})` : vocab.blocker.status[b.status];
    rows.push([types[1], localDay(b.opened_at), b.project_name ?? "", b.title, b.description, status]);
  }

  for (const l of data.learnings) {
    rows.push([types[2], localDay(l.created_at), l.project_name ?? "", l.title, l.content, vocab.learning.kinds[l.kind].label]);
  }

  rows.sort((a, b) => a[1].localeCompare(b[1]) || types.indexOf(a[0]) - types.indexOf(b[0]));
  return toCsv([["tipo", "fecha", vocab.project.one, "titulo", "detalle", "estado"], ...rows]);
}
