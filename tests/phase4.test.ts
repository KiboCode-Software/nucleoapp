// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createReportsRepository, type ReportsRepository } from "@/database/repositories/reports.repository";
import { buildReportCsv, toCsv } from "@/services/reports/csv";
import { periodContaining } from "@/services/reports/period";
import { buildReportJson, buildSummary, generateMarkdown } from "@/services/reports/template";
import { computePeriodStats, computeStreak } from "@/services/stats";
import { createTestDatabase } from "./helpers/sqlite";

let sqlite: ReturnType<typeof createTestDatabase>;
let repo: ReportsRepository;

// Hora local → ISO UTC, para que el día local sea el esperado en cualquier zona horaria.
const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).toISOString();

// Semana del lunes 26 oct al domingo 1 nov de 2026.
const week = periodContaining("weekly", new Date(2026, 9, 28));

beforeEach(() => {
  sqlite = createTestDatabase();
  repo = createReportsRepository(async () => sqlite.executor);
});

describe("aprendizajes del módulo en los reportes", () => {
  it("se incluyen en el periodo y en su propia sección", async () => {
    sqlite.db.exec(`INSERT INTO learnings (id, kind, title, created_at) VALUES
      (1, 'command', 'git bisect', '${at("2026-10-27")}'),
      (2, 'concept', 'Fuera del periodo', '${at("2026-11-05")}')`);
    sqlite.db.exec("INSERT INTO tags (id, name) VALUES (1, 'Git')");
    sqlite.db.exec("INSERT INTO learning_tags VALUES (1, 1)");

    const data = await repo.collectPeriod(week);
    expect(data.learnings.map((l) => l.title)).toEqual(["git bisect"]);

    const markdown = generateMarkdown(week, data, new Date(2026, 10, 2));
    expect(markdown).toContain("## Aprendizajes guardados\n\n- **git bisect** — comando · #Git");
    expect(buildReportJson(week, data, markdown).learnings).toEqual([
      expect.objectContaining({ title: "git bisect", kind: "command", tags: ["Git"] }),
    ]);
  });

  it("no cuenta dos veces un aprendizaje guardado desde un check-in del periodo", async () => {
    sqlite.db.exec("INSERT INTO daily_logs (id, log_date, today, learnings) VALUES (1, '2026-10-27', 'Tests', 'Índices en SQLite')");
    sqlite.db.exec(`INSERT INTO learnings (title, daily_log_id, created_at) VALUES
      ('Índices en SQLite', 1, '${at("2026-10-27")}'),
      ('Mocks en Vitest', NULL, '${at("2026-10-28")}')`);

    const data = await repo.collectPeriod(week);
    expect(buildSummary(week, data, new Date(2026, 10, 2))).toContain(
      "Se registraron 2 aprendizajes, entre ellos índices en SQLite y mocks en Vitest.",
    );
    expect(computePeriodStats(week, data).learnings).toBe(2);
  });
});

describe("estadísticas", () => {
  it("resume la actividad de la semana por día", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (log_date, yesterday, today) VALUES
      ('2026-10-26', '', 'A
B'),
      ('2026-10-28', 'Hecho', 'C')`);
    sqlite.db.exec(`INSERT INTO blockers (title, status, opened_at, resolved_at) VALUES
      ('uno', 'resolved', '${at("2026-10-26", 10)}', '${at("2026-10-26", 14)}'),
      ('dos', 'resolved', '${at("2026-10-27", 10)}', '${at("2026-10-27", 12)}'),
      ('tres', 'pending', '${at("2026-10-29")}', NULL)`);

    const stats = computePeriodStats(week, await repo.collectPeriod(week));

    expect(stats.days.map((d) => d.items)).toEqual([2, 0, 2, 0, 0, 0, 0]);
    expect(stats.days.map((d) => d.logs)).toEqual([1, 0, 1, 0, 0, 0, 0]);
    expect(stats).toMatchObject({
      daysWithLog: 2,
      workdays: 5,
      plannedTasks: 3,
      blockersOpened: 3,
      blockersResolved: 2,
      avgResolutionMs: 3 * 60 * 60 * 1000,
      learnings: 0,
    });
  });

  it("calcula la racha de días laborables sin que el fin de semana la rompa", () => {
    // Lunes 2 nov 2026; registros el lunes, el viernes 30 y el jueves 29 (fin de semana vacío).
    const monday = new Date(2026, 10, 2, 9);
    expect(computeStreak(["2026-11-02", "2026-10-30", "2026-10-29"], monday)).toBe(3);
    // Sin check-in hoy todavía: cuenta hasta ayer.
    expect(computeStreak(["2026-10-30", "2026-10-29"], monday)).toBe(2);
    // Un día laborable sin registro la corta.
    expect(computeStreak(["2026-11-02", "2026-10-29"], monday)).toBe(1);
    // Registrar en fin de semana suma.
    expect(computeStreak(["2026-11-02", "2026-11-01", "2026-10-30"], monday)).toBe(3);
    expect(computeStreak([], monday)).toBe(0);
  });
});

describe("exportación CSV", () => {
  it("escapa comas, comillas y saltos de línea y añade BOM", () => {
    expect(toCsv([["a", 'di "hola"', "x,y", "l1\nl2", null]])).toBe('﻿a,"di ""hola""","x,y","l1\nl2",\r\n');
  });

  it("genera una fila por registro, bloqueo y aprendizaje, ordenadas por fecha", async () => {
    sqlite.db.exec("INSERT INTO projects (id, name) VALUES (1, 'API')");
    sqlite.db.exec("INSERT INTO daily_logs (project_id, log_date, yesterday, today) VALUES (1, '2026-10-28', 'Login', 'Tests, muchos')");
    sqlite.db.exec(`INSERT INTO blockers (title, status, opened_at, resolved_at) VALUES
      ('CORS', 'resolved', '${at("2026-10-27")}', '${at("2026-10-29")}')`);
    sqlite.db.exec(`INSERT INTO learnings (kind, title, content, created_at) VALUES ('error_fix', 'CORS', 'Faltaba el header', '${at("2026-10-29")}')`);

    const lines = buildReportCsv(await repo.collectPeriod(week)).replace("﻿", "").split("\r\n");

    expect(lines[0]).toBe("tipo,fecha,proyecto,titulo,detalle,estado");
    expect(lines[1]).toBe("bloqueo,2026-10-27,,CORS,,Resuelto (2026-10-29)");
    // El salto de línea dentro de la celda es \n; solo los finales de fila son \r\n.
    expect(lines[2]).toBe('registro,2026-10-28,API,"Tests, muchos","Avances: Login\nPlan del día: Tests, muchos",');
    expect(lines[3]).toBe("aprendizaje,2026-10-29,,CORS,Faltaba el header,Error resuelto");
  });
});
