// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createReportsRepository, type ReportsRepository } from "@/database/repositories/reports.repository";
import { formatPeriod, periodContaining, reportFileName, shiftPeriod } from "@/services/reports/period";
import { buildReportJson, buildSummary, generateMarkdown, toItems } from "@/services/reports/template";
import { createTestDatabase } from "./helpers/sqlite";

let sqlite: ReturnType<typeof createTestDatabase>;
let repo: ReportsRepository;

// Mediodía local → ISO UTC, para que el día local sea el esperado en cualquier zona horaria.
const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).toISOString();

beforeEach(() => {
  sqlite = createTestDatabase();
  repo = createReportsRepository(async () => sqlite.executor);
});

describe("periodos", () => {
  it("calcula el día y la semana (lunes a domingo) que contienen una fecha", () => {
    expect(periodContaining("daily", new Date(2026, 10, 1))).toEqual({ period: "daily", start: "2026-11-01", end: "2026-11-01" });
    expect(periodContaining("weekly", new Date(2026, 10, 1))).toEqual({ period: "weekly", start: "2026-10-26", end: "2026-11-01" });
  });

  it("avanza y retrocede periodos", () => {
    const week = periodContaining("weekly", new Date(2026, 10, 1));
    expect(shiftPeriod(week, 1).start).toBe("2026-11-02");
    expect(shiftPeriod(periodContaining("daily", new Date(2026, 10, 1)), -1).start).toBe("2026-10-31");
  });

  it("formatea etiquetas y nombres de archivo", () => {
    expect(formatPeriod({ period: "weekly", start: "2026-10-26", end: "2026-11-01" })).toBe("26 oct – 1 nov 2026");
    expect(formatPeriod({ period: "daily", start: "2026-11-01", end: "2026-11-01" })).toBe("domingo, 1 de noviembre de 2026");
    expect(reportFileName({ period: "weekly", start: "2026-10-26" })).toBe("reporte-semanal-2026-10-26");
  });
});

describe("plantillas", () => {
  it("convierte respuestas libres en elementos sin viñetas", () => {
    expect(toItems("- Login\n* Registro\n\n1. Tests\n• Docs ")).toEqual(["Login", "Registro", "Tests", "Docs"]);
  });

  it("genera el resumen de una jornada como en el documento maestro", async () => {
    sqlite.db.exec("INSERT INTO projects (id, name) VALUES (1, 'API REST')");
    sqlite.db.exec(`INSERT INTO daily_logs (project_id, log_date, today, learnings) VALUES
      (1, '2026-11-01', 'Implementación de autenticación
Corrección de un error en JWT', 'Middlewares para la gestión de solicitudes')`);

    const range = periodContaining("daily", new Date(2026, 10, 1));
    const summary = buildSummary(range, await repo.collectPeriod(range), new Date(2026, 10, 1, 18));

    expect(summary).toBe(
      "La jornada del proyecto API REST se centró en implementación de autenticación y corrección de un error en JWT. " +
        "Se registró un aprendizaje: middlewares para la gestión de solicitudes. No hay bloqueos pendientes.",
    );
  });

  it("resume una semana con varias tareas y bloqueos", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (log_date, yesterday, today) VALUES
      ('2026-10-26', '', 'API de usuarios
Tests de integración'),
      ('2026-10-28', 'Terminé la API', 'CI con GitHub Actions
Docker
Documentación')`);
    sqlite.db.exec(`INSERT INTO blockers (title, status, opened_at, resolved_at) VALUES
      ('Docker no compila', 'resolved', '${at("2026-10-27")}', '${at("2026-10-28")}'),
      ('Permisos AWS', 'pending', '${at("2026-10-29")}', NULL),
      ('Futuro', 'pending', '${at("2026-11-05")}', NULL)`);

    const range = periodContaining("weekly", new Date(2026, 9, 28));
    const data = await repo.collectPeriod(range);

    expect(data.logs).toHaveLength(2);
    expect(data.blockersResolved.map((b) => b.title)).toEqual(["Docker no compila"]);
    expect(data.blockersPending.map((b) => b.title)).toEqual(["Permisos AWS"]);
    expect(buildSummary(range, data, new Date(2026, 10, 10))).toBe(
      "Durante la semana se registraron 2 check-ins diarios. " +
        "El trabajo se centró en API de usuarios, tests de integración, CI con GitHub Actions y 2 tareas más. " +
        "Como avances se reportaron terminé la API. Se resolvió 1 bloqueo y queda 1 pendiente.",
    );
  });

  it("indica cuando no hay registros", async () => {
    const range = periodContaining("daily", new Date(2026, 10, 1));
    expect(buildSummary(range, await repo.collectPeriod(range))).toBe("No hay registro diario para esta jornada.");
  });

  it("genera el Markdown completo con actividades y bloqueos", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (log_date, yesterday, today, learnings) VALUES
      ('2026-11-01', '- Configuré Tauri', '- Pantalla de reportes', 'Intl.ListFormat')`);
    sqlite.db.exec(`INSERT INTO blockers (title, opened_at) VALUES ('Firma de código en Windows', '${at("2026-11-01", 9)}')`);

    const range = periodContaining("daily", new Date(2026, 10, 1));
    const markdown = generateMarkdown(range, await repo.collectPeriod(range), new Date(2026, 10, 1, 18));

    expect(markdown).toContain("# Reporte diario\n\n**domingo, 1 de noviembre de 2026**");
    expect(markdown).toContain("**Avances**\n\n- Configuré Tauri");
    expect(markdown).toContain("**Plan del día**\n\n- Pantalla de reportes");
    expect(markdown).toContain("### Pendientes\n\n- **Firma de código en Windows** — abierto hace 9 h");
    expect(markdown).toMatch(/Generado localmente con Núcleo/);
  });

  it("construye el JSON estructurado del reporte", async () => {
    sqlite.db.exec("INSERT INTO daily_logs (log_date, today) VALUES ('2026-11-01', 'Exportar a JSON')");
    const range = periodContaining("daily", new Date(2026, 10, 1));
    const json = buildReportJson(range, await repo.collectPeriod(range), "# md");

    expect(json.report).toMatchObject({ type: "daily", period_start: "2026-11-01", generator: "template" });
    expect(json.daily_logs).toEqual([
      { date: "2026-11-01", project: null, yesterday: "", today: "Exportar a JSON", blockers_note: "", learnings: "" },
    ]);
    expect(json.markdown).toBe("# md");
  });
});

describe("reportes guardados y exportación", () => {
  it("guarda un reporte vinculado a sus registros y lo elimina", async () => {
    sqlite.db.exec("INSERT INTO daily_logs (id, log_date, today) VALUES (1, '2026-11-01', 'a'), (2, '2026-11-01', 'b')");
    const range = periodContaining("daily", new Date(2026, 10, 1));

    const report = await repo.save(range, "# Reporte", [1, 2]);

    expect(report).toMatchObject({ period: "daily", period_start: "2026-11-01", content: "# Reporte", generator: "template" });
    expect(sqlite.db.prepare("SELECT COUNT(*) AS n FROM report_daily_logs").get()).toEqual({ n: 2 });
    expect(await repo.list()).toHaveLength(1);

    await repo.remove(report.id);
    expect(await repo.list()).toHaveLength(0);
    expect(sqlite.db.prepare("SELECT COUNT(*) AS n FROM report_daily_logs").get()).toEqual({ n: 0 });
  });

  it("exporta todas las tablas del usuario", async () => {
    sqlite.db.exec("INSERT INTO projects (name) VALUES ('Portafolio')");
    const all = await repo.exportAll();

    expect(Object.keys(all)).toContain("daily_logs");
    expect(all.projects).toEqual([expect.objectContaining({ name: "Portafolio" })]);
    expect(all.settings).toHaveLength(3);
  });
});
