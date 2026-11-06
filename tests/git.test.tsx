import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { commitsAsTasks, type Commit } from "@/services/git";
import { createTestDatabase } from "./helpers/sqlite";
import { resetStores } from "./helpers/stores";

let sqlite: ReturnType<typeof createTestDatabase>;
vi.mock("@/database/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/database/client")>();
  return { ...actual, isTauri: () => true, getDatabase: async () => sqlite.executor };
});

const commits = vi.fn<(repos: string[], from: string, to: string) => Promise<Commit[]>>();
vi.mock("@/services/git", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/git")>();
  return { ...actual, gitService: { commits: (...args: [string[], string, string]) => commits(...args), chooseRepo: vi.fn() } };
});

const commit = (subject: string, repo = "api", time = "10:15"): Commit => ({ repo, hash: subject, date: `2026-10-28T${time}:00-05:00`, subject });

beforeEach(() => {
  sqlite = createTestDatabase();
  resetStores();
  commits.mockReset();
});

afterEach(cleanup);

describe("commits de Git en el registro diario", () => {
  it("convierte los commits en tareas sin repetir las del plan", () => {
    expect(commitsAsTasks([commit("feat: login"), commit("fix: token"), commit("feat: login")], ["fix: token · api"])).toEqual(["feat: login · api"]);
  });

  it("muestra los commits del día y los añade al plan como hechos", async () => {
    sqlite.db.exec(`INSERT INTO settings (key, value) VALUES ('git_repos', '["C:/dev/api"]')`);
    commits.mockResolvedValue([commit("feat: login con Google"), commit("fix: CORS en producción", "web", "17:40")]);
    render(
      <MemoryRouter initialEntries={["/daily-log/dia/2026-10-28"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    const list = await screen.findByRole("list", { name: "Commits del día" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("feat: login con Google"),
      expect.stringContaining("fix: CORS en producción"),
    ]);
    expect(commits).toHaveBeenCalledWith(["C:/dev/api"], "2026-10-28", "2026-10-28");

    fireEvent.click(screen.getByRole("button", { name: /Añadir al plan \(2\)/ }));
    await waitFor(() =>
      expect(sqlite.db.prepare("SELECT today FROM daily_logs WHERE log_date = '2026-10-28'").get()).toEqual({
        today: "- [x] feat: login con Google · api\n- [x] fix: CORS en producción · web",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: /Añadir al plan/ })).not.toBeInTheDocument());
  });

  it("sin repositorios invita a conectarlos en Ajustes; en modo estudio no aparece", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/daily-log"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Conecta tus repositorios de Git/)).toBeInTheDocument();
    unmount();

    resetStores("student");
    render(
      <MemoryRouter initialEntries={["/daily-log"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await screen.findByText("Plan de estudio");
    expect(screen.queryByText("Commits del día")).not.toBeInTheDocument();
  });
});
