import { describe, expect, it } from "vitest";
import { blockerSchema, dailyLogInputSchema, projectSchema } from "@/types/entities";

const ts = "2026-11-01T10:00:00.000Z";

describe("esquemas de entidades", () => {
  it("valida la entrada de un check-in y completa los campos vacíos", () => {
    const parsed = dailyLogInputSchema.parse({ project_id: null, log_date: "2026-11-01", today: "Implementar login" });
    expect(parsed).toEqual({
      project_id: null,
      log_date: "2026-11-01",
      yesterday: "",
      today: "Implementar login",
      blockers_note: "",
      learnings: "",
    });
  });

  it("rechaza fechas con otro formato", () => {
    expect(dailyLogInputSchema.safeParse({ project_id: null, log_date: "01/11/2026" }).success).toBe(false);
  });

  it("rechaza nombres de proyecto vacíos", () => {
    const result = projectSchema.safeParse({ id: 1, name: "   ", created_at: ts, updated_at: ts });
    expect(result.success).toBe(false);
  });

  it("aplica la misma regla de resolución que la base de datos", () => {
    const base = { id: 1, daily_log_id: null, project_id: null, title: "CORS", opened_at: ts, created_at: ts, updated_at: ts };
    expect(blockerSchema.safeParse({ ...base, status: "resolved", resolved_at: null }).success).toBe(false);
    expect(blockerSchema.safeParse({ ...base, status: "pending", resolved_at: ts }).success).toBe(false);
    expect(blockerSchema.safeParse({ ...base, status: "resolved", resolved_at: ts }).success).toBe(true);
  });
});
