// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createImportRepository, parseExportFile } from "@/database/repositories/import.repository";
import { createReportsRepository } from "@/database/repositories/reports.repository";
import { buildSummaryPrompt, cleanSummary, replaceSummary } from "@/services/ai";
import { decryptJson, encryptJson, isEncryptedEnvelope, WrongPasswordError } from "@/services/crypto";
import { createTestDatabase } from "./helpers/sqlite";

// Pocas iteraciones en pruebas: PBKDF2 con 600 000 es deliberadamente lento.
const FAST = 1_000;

describe("cifrado de exportaciones", () => {
  it("cifra y descifra con la misma contraseña", async () => {
    const data = { tables: { projects: [{ id: 1, name: "Ñandú — prácticas" }] } };
    const envelope = await encryptJson(data, "contraseña-segura", FAST);

    expect(isEncryptedEnvelope(envelope)).toBe(true);
    expect(envelope.kdf).toMatchObject({ name: "PBKDF2", hash: "SHA-256", iterations: FAST });
    expect(JSON.stringify(envelope)).not.toContain("Ñandú");
    expect(await decryptJson(envelope, "contraseña-segura")).toEqual(data);
  });

  it("usa sal e IV aleatorios en cada cifrado", async () => {
    const a = await encryptJson({ x: 1 }, "12345678", FAST);
    const b = await encryptJson({ x: 1 }, "12345678", FAST);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.data).not.toBe(b.data);
  });

  it("rechaza contraseñas incorrectas, datos alterados y contraseñas cortas", async () => {
    const envelope = await encryptJson({ secreto: true }, "correcta-123", FAST);
    await expect(decryptJson(envelope, "incorrecta-123")).rejects.toBeInstanceOf(WrongPasswordError);

    const tampered = { ...envelope, data: envelope.data.slice(0, -4) + "AAAA" };
    await expect(decryptJson(tampered, "correcta-123")).rejects.toBeInstanceOf(WrongPasswordError);

    await expect(encryptJson({}, "corta")).rejects.toThrow("al menos 8");
  });
});

describe("importación de datos", () => {
  let source: ReturnType<typeof createTestDatabase>;
  let target: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    source = createTestDatabase();
    target = createTestDatabase();
  });

  const exportFrom = async (db: ReturnType<typeof createTestDatabase>) => ({
    app: "Núcleo",
    format_version: 1,
    tables: await createReportsRepository(async () => db.executor).exportAll(),
  });

  it("restaura una exportación completa conservando ids y relaciones", async () => {
    source.db.exec(`
      INSERT INTO projects (id, name, color) VALUES (3, 'API', '#007AFF');
      INSERT INTO daily_logs (id, project_id, log_date, today) VALUES (7, 3, '2026-10-30', 'Login');
      INSERT INTO blockers (id, daily_log_id, project_id, title) VALUES (2, 7, 3, 'CORS');
      INSERT INTO blocker_attempts (blocker_id, description) VALUES (2, 'Proxy');
      INSERT INTO learnings (id, title) VALUES (4, 'JWT');
      INSERT INTO tags (id, name) VALUES (1, 'Auth');
      INSERT INTO learning_tags VALUES (4, 1);
      INSERT INTO reports (id, period, period_start, period_end, content) VALUES (1, 'daily', '2026-10-30', '2026-10-30', '# R');
      INSERT INTO report_daily_logs VALUES (1, 7);
      INSERT INTO captures (content) VALUES ('Idea');`);
    target.db.exec("INSERT INTO projects (name) VALUES ('Se borrará')");

    const file = parseExportFile(await exportFrom(source));
    await createImportRepository(async () => target.executor).replaceAll(file);

    expect(await exportFrom(target)).toEqual(
      expect.objectContaining({
        tables: expect.objectContaining({
          projects: source.db.prepare("SELECT * FROM projects").all(),
          daily_logs: source.db.prepare("SELECT * FROM daily_logs").all(),
          learning_tags: [{ learning_id: 4, tag_id: 1 }],
          captures: source.db.prepare("SELECT * FROM captures").all(),
        }),
      }),
    );
    // Las claves foráneas siguen activas y válidas tras importar.
    expect(target.db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    // Los nuevos registros continúan después de los ids importados.
    target.db.exec("INSERT INTO projects (name) VALUES ('Nuevo')");
    expect(target.db.prepare("SELECT id FROM projects WHERE name = 'Nuevo'").get()).toEqual({ id: 4 });
  });

  it("no importa ajustes ni historial de respaldos de otro equipo", async () => {
    target.db.exec(`UPDATE settings SET value = '"dark"' WHERE key = 'theme'`);
    const file = parseExportFile(await exportFrom(source));
    await createImportRepository(async () => target.executor).replaceAll(file);
    expect(target.db.prepare("SELECT value FROM settings WHERE key = 'theme'").get()).toEqual({ value: '"dark"' });
  });

  it("acepta las exportaciones con el nombre nuevo y las de antes del cambio de nombre", () => {
    for (const app of ["Núcleo", "Daily Dev Log"]) {
      expect(parseExportFile({ app, format_version: 1, tables: { projects: [{ id: 1, name: "A" }] } }).tables.projects).toHaveLength(1);
    }
    expect(() => parseExportFile({ app: "Otra app", format_version: 1, tables: {} })).toThrow(/exportación válida de Núcleo/);
  });

  it("rechaza archivos que no son exportaciones o traen columnas desconocidas", () => {
    expect(() => parseExportFile({ hola: 1 })).toThrow("no es una exportación válida");
    expect(() =>
      parseExportFile({ app: "Núcleo", format_version: 1, tables: { projects: [{ id: 1, "name) VALUES (1); DROP TABLE x; --": "a" }] } }),
    ).toThrow('columna desconocida');
    expect(() =>
      parseExportFile({ app: "Núcleo", format_version: 1, tables: { projects: [{ id: 1, name: { objeto: true } }] } }),
    ).toThrow("no es una exportación válida");
  });

  it("acepta exportaciones antiguas sin la tabla de capturas", () => {
    const file = parseExportFile({ app: "Daily Dev Log", format_version: 1, tables: { projects: [{ id: 1, name: "Viejo" }] } });
    expect(file.tables.captures).toEqual([]);
  });
});

describe("IA local (Ollama)", () => {
  it("construye un prompt con el reporte delimitado y las reglas", () => {
    const prompt = buildSummaryPrompt("# Reporte diario\n\n- Login");
    expect(prompt).toContain("<reporte>\n# Reporte diario\n\n- Login\n</reporte>");
    expect(prompt).toMatch(/no inventes/i);
  });

  it("limpia la respuesta del modelo", () => {
    expect(cleanSummary('<think>razonando…</think>\n"Resumen: Se trabajó en **login**.\nSe resolvió CORS."')).toBe(
      "Se trabajó en login. Se resolvió CORS.",
    );
    expect(cleanSummary("## Resumen\n- Se avanzó en la API.")).toBe("Se avanzó en la API.");
    expect(cleanSummary("Frase. ".repeat(400)).length).toBeLessThanOrEqual(1200);
  });

  it("sustituye solo el párrafo de resumen del reporte", () => {
    const md = "# Reporte diario\n\n**fecha**\n\n## Resumen\n\nTexto de plantilla.\n\n## Actividades\n\n- A\n\n---\n\nPie";
    expect(replaceSummary(md, "Texto de la IA.")).toBe(
      "# Reporte diario\n\n**fecha**\n\n## Resumen\n\nTexto de la IA.\n\n## Actividades\n\n- A\n\n---\n\nPie",
    );
    const onlySummary = "## Resumen\n\nViejo.\n\n---\n\nPie";
    expect(replaceSummary(onlySummary, "Nuevo.")).toBe("## Resumen\n\nNuevo.\n\n---\n\nPie");
  });
});
