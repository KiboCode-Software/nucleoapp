import { getDatabase, type SqlExecutor } from "@/database/client";

export type SearchKind = "daily-log" | "blocker" | "learning" | "project" | "deadline";

export interface SearchHit {
  kind: SearchKind;
  id: number;
  title: string;
  /** Fragmento del texto donde aparece la búsqueda. */
  snippet: string;
  to: string;
}

const PER_KIND = 6;
/** Candidatos por tipo antes de filtrar sin tildes (LIKE no las ignora). */
const CANDIDATES = 40;

/** Sin mayúsculas ni tildes: "Migración" y "migracion" son lo mismo. */
export const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * "%texto%" para LIKE, con los comodines del usuario escapados y las vocales y la n
 * como comodín de un carácter: así "migracion" también trae "Migración". Luego se
 * filtra de verdad con `fold`.
 */
export function likePattern(query: string): string {
  const escaped = query.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped.replace(/[aeiounáéíóúüñ]/gi, "_")}%`;
}

/** Un trozo de ~90 caracteres alrededor de la primera coincidencia. */
export function snippetAround(text: string, query: string, width = 90): string {
  const flat = text.replace(/\s+/g, " ").replace(/- \[[ x]\] /g, "").trim();
  // fold() conserva la longitud de las letras españolas, así que los índices coinciden.
  const at = fold(flat).indexOf(fold(query.trim()));
  if (at < 0) return flat.slice(0, width) + (flat.length > width ? "…" : "");
  const start = Math.max(0, at - Math.floor(width / 3));
  const end = Math.min(flat.length, start + width);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

export function createSearchRepository(getDb: () => Promise<SqlExecutor>) {
  return {
    /** Busca en registros, bloqueos, aprendizajes, proyectos y (si se pide) entregas. */
    async search(query: string, options: { deadlines: boolean }): Promise<SearchHit[]> {
      if (query.trim().length < 2) return [];
      const db = await getDb();
      const like = likePattern(query);
      const q = query.trim();
      const needle = fold(q);
      // Solo los que contienen la búsqueda de verdad (sin tildes), hasta PER_KIND por tipo.
      const keep = <T,>(rows: T[], text: (row: T) => string) => rows.filter((row) => fold(text(row)).includes(needle)).slice(0, PER_KIND);
      const esc = "ESCAPE '\\'";

      const [logs, blockers, learnings, projects, deadlines] = await Promise.all([
        db.select<Array<{ id: number; log_date: string; text: string }>>(
          `SELECT id, log_date, today || ' ' || blockers_note || ' ' || learnings || ' ' || yesterday AS text FROM daily_logs
           WHERE today LIKE $1 ${esc} OR blockers_note LIKE $1 ${esc} OR learnings LIKE $1 ${esc} OR yesterday LIKE $1 ${esc}
           ORDER BY log_date DESC LIMIT ${CANDIDATES}`,
          [like],
        ),
        db.select<Array<{ id: number; title: string; description: string }>>(
          `SELECT id, title, description FROM blockers WHERE title LIKE $1 ${esc} OR description LIKE $1 ${esc}
           ORDER BY opened_at DESC LIMIT ${CANDIDATES}`,
          [like],
        ),
        db.select<Array<{ id: number; title: string; content: string }>>(
          `SELECT id, title, content FROM learnings WHERE title LIKE $1 ${esc} OR content LIKE $1 ${esc}
           ORDER BY created_at DESC LIMIT ${CANDIDATES}`,
          [like],
        ),
        db.select<Array<{ id: number; name: string; description: string }>>(
          `SELECT id, name, description FROM projects WHERE name LIKE $1 ${esc} OR description LIKE $1 ${esc}
           ORDER BY archived, name LIMIT ${CANDIDATES}`,
          [like],
        ),
        options.deadlines
          ? db.select<Array<{ id: number; title: string; notes: string; due_at: string }>>(
              `SELECT id, title, notes, due_at FROM deadlines WHERE title LIKE $1 ${esc} OR notes LIKE $1 ${esc}
               ORDER BY done_at IS NOT NULL, due_at LIMIT ${CANDIDATES}`,
              [like],
            )
          : Promise.resolve([]),
      ]);

      return [
        ...keep(deadlines, (d) => `${d.title} ${d.notes}`).map((d) => ({ kind: "deadline" as const, id: d.id, title: d.title, snippet: snippetAround(d.notes || d.title, q), to: `/deadlines/${d.id}` })),
        ...keep(blockers, (b) => `${b.title} ${b.description}`).map((b) => ({ kind: "blocker" as const, id: b.id, title: b.title, snippet: snippetAround(`${b.title} ${b.description}`, q), to: `/blockers/${b.id}` })),
        ...keep(learnings, (l) => `${l.title} ${l.content}`).map((l) => ({ kind: "learning" as const, id: l.id, title: l.title, snippet: snippetAround(`${l.title} ${l.content}`, q), to: `/learning/${l.id}` })),
        ...keep(projects, (p) => `${p.name} ${p.description}`).map((p) => ({ kind: "project" as const, id: p.id, title: p.name, snippet: snippetAround(`${p.name} ${p.description}`, q), to: `/projects/${p.id}` })),
        ...keep(logs, (l) => l.text).map((l) => ({ kind: "daily-log" as const, id: l.id, title: l.log_date, snippet: snippetAround(l.text, q), to: `/daily-log/dia/${l.log_date}` })),
      ];
    },
  };
}

export const searchRepository = createSearchRepository(getDatabase);
