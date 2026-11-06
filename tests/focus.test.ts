// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFocusRepository } from "@/database/repositories/focus.repository";
import { breakMinutesFor, createFocusStore, formatClock, remainingMs } from "@/stores/focus.store";
import { buildSummary } from "@/services/reports/template";
import type { PeriodData } from "@/database/repositories/reports.repository";
import { createTestDatabase } from "./helpers/sqlite";

const T0 = new Date(2026, 10, 2, 9, 0).getTime();
const MIN = 60_000;

describe("temporizador de enfoque", () => {
  let sqlite: ReturnType<typeof createTestDatabase>;
  let repo: ReturnType<typeof createFocusRepository>;
  let notify: ReturnType<typeof vi.fn<(title: string, body: string) => Promise<boolean>>>;
  let store: ReturnType<typeof createFocusStore>;

  beforeEach(() => {
    sqlite = createTestDatabase();
    repo = createFocusRepository(async () => sqlite.executor);
    notify = vi.fn(async (_title: string, _body: string) => true);
    store = createFocusStore(repo, notify, () => true);
  });

  it("un bloque completo se guarda y empieza el descanso proporcional", async () => {
    store.getState().setPlan({ focusMinutes: 25, label: "Repasar derivadas" });
    store.getState().start(T0);
    expect(formatClock(remainingMs(store.getState(), T0 + 90_000))).toBe("23:30");

    expect(await store.getState().tick(T0 + 24 * MIN)).toBeNull();
    expect(await store.getState().tick(T0 + 25 * MIN)).toBe("focus");
    expect(store.getState()).toMatchObject({ phase: "break", durationMs: 5 * MIN, savedCount: 1 });
    expect(notify).toHaveBeenCalledWith("¡Bloque de enfoque terminado!", "Tómate 5 minutos de descanso.");

    const [session] = await repo.listOn("2026-11-02");
    expect(session).toMatchObject({ label: "Repasar derivadas", minutes: 25, completed: true });

    expect(await store.getState().tick(T0 + 30 * MIN)).toBe("break");
    expect(store.getState().phase).toBe("idle");
  });

  it("la pausa congela el tiempo restante", async () => {
    store.getState().start(T0);
    store.getState().pause(T0 + 10 * MIN);
    expect(remainingMs(store.getState(), T0 + 60 * MIN)).toBe(15 * MIN);
    expect(await store.getState().tick(T0 + 60 * MIN)).toBeNull();
    store.getState().resume(T0 + 60 * MIN);
    expect(store.getState().endsAt).toBe(T0 + 75 * MIN);
  });

  it("cancelar guarda lo enfocado como interrumpido (si pasó al menos un minuto)", async () => {
    store.getState().start(T0);
    await store.getState().stop(T0 + 12.5 * MIN);
    expect(store.getState().phase).toBe("idle");
    expect((await repo.listOn("2026-11-02"))[0]).toMatchObject({ minutes: 12, completed: false });

    store.getState().start(T0 + 20 * MIN);
    await store.getState().stop(T0 + 20 * MIN + 30_000);
    expect(await repo.summary("2026-11-02", "2026-11-02")).toEqual({ minutes: 12, sessions: 1 });
  });

  it("el descanso es una quinta parte, con un mínimo de 3 minutos", () => {
    expect([15, 25, 45, 50].map(breakMinutesFor)).toEqual([3, 5, 9, 10]);
  });
});

describe("enfoque en los reportes", () => {
  it("el resumen menciona el tiempo de enfoque", () => {
    const data = { logs: [], blockersOpened: [], blockersResolved: [], blockersPending: [], learnings: [], focus: { minutes: 135, sessions: 4 } } as PeriodData;
    expect(buildSummary({ period: "weekly", start: "2026-11-02", end: "2026-11-08" }, data)).toContain(
      "Se dedicaron 2 h 15 min de enfoque en 4 bloques.",
    );
  });
});
