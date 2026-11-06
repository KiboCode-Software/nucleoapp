import { describe, expect, it } from "vitest";
import { elapsedBetween, formatDayLabel, formatElapsed, greetingFor, startOfWeek, toISODate } from "@/utils/date";

describe("utilidades de fecha", () => {
  it("formatea fechas locales como YYYY-MM-DD", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("calcula el lunes de la semana, también desde un domingo", () => {
    expect(toISODate(startOfWeek(new Date(2026, 10, 1)))).toBe("2026-10-26"); // domingo
    expect(toISODate(startOfWeek(new Date(2026, 10, 4)))).toBe("2026-11-02"); // miércoles
    expect(toISODate(startOfWeek(new Date(2026, 10, 2)))).toBe("2026-11-02"); // lunes
  });

  it("formatea el tiempo transcurrido de forma compacta", () => {
    const min = 60_000;
    expect(formatElapsed(20_000)).toBe("menos de 1 min");
    expect(formatElapsed(25 * min)).toBe("25 min");
    expect(formatElapsed(3 * 60 * min + 59 * min)).toBe("3 h");
    expect(formatElapsed(24 * 60 * min)).toBe("1 día");
    expect(formatElapsed(12 * 24 * 60 * min)).toBe("12 días");
    expect(elapsedBetween("2026-11-01T10:00:00.000Z", "2026-11-01T12:30:00.000Z")).toBe("2 h");
  });

  it("etiqueta los días relativos al actual", () => {
    const now = new Date(2026, 10, 1, 12);
    expect(formatDayLabel("2026-11-01", now)).toBe("Hoy");
    expect(formatDayLabel("2026-10-31", now)).toBe("Ayer");
    expect(formatDayLabel("2025-10-27", now)).toMatch(/2025/);
  });

  it("saluda según la hora del día", () => {
    expect(greetingFor(new Date(2026, 10, 1, 8))).toBe("Buenos días");
    expect(greetingFor(new Date(2026, 10, 1, 15))).toBe("Buenas tardes");
    expect(greetingFor(new Date(2026, 10, 1, 21))).toBe("Buenas noches");
  });
});
