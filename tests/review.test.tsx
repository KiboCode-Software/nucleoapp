import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { createReviewRepository } from "@/database/repositories/review.repository";
import { formatInterval, schedule } from "@/modules/learning/review";
import { toISODate } from "@/utils/date";
import { createTestDatabase } from "./helpers/sqlite";
import { resetStores } from "./helpers/stores";

let sqlite: ReturnType<typeof createTestDatabase>;
vi.mock("@/database/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/database/client")>();
  return { ...actual, isTauri: () => true, getDatabase: async () => sqlite.executor };
});

beforeEach(() => {
  sqlite = createTestDatabase();
  resetStores("student");
});

afterEach(cleanup);

const fresh = { ease: 2.5, interval_days: 0, repetitions: 0 };

describe("repaso espaciado (SM-2)", () => {
  it("cada acierto aleja el siguiente repaso", () => {
    const first = schedule(fresh, "good", "2026-11-02");
    expect(first).toMatchObject({ interval_days: 1, repetitions: 1, due_on: "2026-11-03", ease: 2.5 });
    const second = schedule(first, "good", "2026-11-03");
    expect(second).toMatchObject({ interval_days: 6, due_on: "2026-11-09" });
    const third = schedule(second, "good", "2026-11-09");
    expect(third.interval_days).toBe(15);
  });

  it("«Fácil» sube la facilidad y «Difícil» la baja; nunca por debajo de 1,3", () => {
    expect(schedule(fresh, "easy", "2026-11-02")).toMatchObject({ interval_days: 3, ease: 2.6 });
    expect(schedule(fresh, "hard", "2026-11-02").ease).toBe(2.36);
    let card = { ...fresh, ease: 1.35 };
    card = { ...card, ...schedule(card, "hard", "2026-11-02") };
    expect(card.ease).toBe(1.3);
  });

  it("«Otra vez» reinicia la tarjeta y la deja para hoy", () => {
    expect(schedule({ ease: 2.5, interval_days: 20, repetitions: 4 }, "again", "2026-11-02")).toEqual({
      ease: 1.96,
      interval_days: 0,
      repetitions: 0,
      due_on: "2026-11-02",
    });
  });

  it("muestra los intervalos de forma corta", () => {
    expect([0, 1, 6, 30, 90].map(formatInterval)).toEqual(["hoy", "1 día", "6 días", "4 sem.", "3 meses"]);
  });

  it("el repositorio guarda las tarjetas, las programa y las borra con su apunte", async () => {
    sqlite.db.exec("INSERT INTO learnings (id, kind, title) VALUES (1, 'concept', 'Derivadas')");
    const repo = createReviewRepository(async () => sqlite.executor);
    const card = await repo.create(1, { question: " ¿Derivada de x²? ", answer: "2x" }, "2026-11-02");
    expect(card).toMatchObject({ question: "¿Derivada de x²?", due_on: "2026-11-02" });
    expect(await repo.countDue("2026-11-02")).toBe(1);

    await repo.review(card.id, "good", "2026-11-02");
    expect(await repo.countDue("2026-11-02")).toBe(0);
    expect((await repo.due("2026-11-03"))[0]).toMatchObject({ learning_title: "Derivadas", interval_days: 1 });

    await expect(repo.create(1, { question: "", answer: "x" }, "2026-11-02")).rejects.toThrow();
    sqlite.db.exec("DELETE FROM learnings");
    expect(await repo.listForLearning(1)).toEqual([]);
  });
});

describe("tarjetas en Apuntes", () => {
  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    );

  it("crea una tarjeta en un apunte y la repasa girándola", async () => {
    sqlite.db.exec("INSERT INTO learnings (id, kind, title, content) VALUES (1, 'concept', 'Regla de la cadena', '')");
    renderAt("/learning/1");

    const section = await screen.findByRole("region", { name: "Tarjetas de repaso" });
    fireEvent.change(within(section).getByLabelText("Pregunta"), { target: { value: "¿Derivada de f(g(x))?" } });
    fireEvent.change(within(section).getByLabelText("Respuesta"), { target: { value: "f'(g(x))·g'(x)" } });
    fireEvent.click(within(section).getByRole("button", { name: "Añadir tarjeta" }));
    expect(await within(section).findByText("¿Derivada de f(g(x))?")).toBeInTheDocument();

    // El botón Repasar cuenta las pendientes de hoy.
    const repasar = await screen.findByRole("button", { name: /Repasar\s*1/ });
    fireEvent.click(repasar);
    const sheet = await screen.findByRole("dialog", { name: "Repaso" });
    fireEvent.click(await within(sheet).findByRole("button", { name: /Pregunta/ }));
    expect(within(sheet).getByRole("button", { name: "Respuesta" })).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: /^Bien/ }));
    expect(await within(sheet).findByText("¡Repaso terminado!")).toBeInTheDocument();
    await waitFor(() =>
      expect(sqlite.db.prepare("SELECT repetitions, due_on > ? AS later FROM review_cards").get(toISODate(new Date()))).toEqual({ repetitions: 1, later: 1 }),
    );
  });

  it("«Otra vez» vuelve a mostrar la tarjeta en la misma sesión (teclas 1–4)", async () => {
    sqlite.db.exec(`INSERT INTO learnings (id, kind, title) VALUES (1, 'concept', 'Integrales');
      INSERT INTO review_cards (learning_id, question, answer, due_on) VALUES (1, '∫ 2x dx', 'x² + C', '2020-01-01')`);
    renderAt("/learning?repaso");
    const sheet = await screen.findByRole("dialog", { name: "Repaso" });
    await within(sheet).findByText("∫ 2x dx");

    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "1" });
    await waitFor(() => expect(within(sheet).getByText(/Quedan 1/)).toBeInTheDocument());
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "4" });
    expect(await within(sheet).findByText("¡Repaso terminado!")).toBeInTheDocument();
  });
});
