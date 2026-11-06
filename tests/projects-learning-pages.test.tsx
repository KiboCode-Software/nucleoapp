import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { createTestDatabase } from "./helpers/sqlite";
import { resetStores } from "./helpers/stores";

let sqlite: ReturnType<typeof createTestDatabase>;
vi.mock("@/database/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/database/client")>();
  return { ...actual, isTauri: () => true, getDatabase: async () => sqlite.executor };
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const row = <T,>(sql: string) => sqlite.db.prepare(sql).get() as T;

beforeEach(() => {
  sqlite = createTestDatabase();
  resetStores();
});

afterEach(cleanup);

describe("módulo Proyectos", () => {
  it("invita a crear el primer proyecto y lo crea con color", async () => {
    renderAt("/projects");
    expect(await screen.findByText("Crea tu primer proyecto")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Nuevo proyecto" })[0]);

    fireEvent.change(await screen.findByLabelText("Nombre"), { target: { value: "API de pagos" } });
    fireEvent.click(screen.getByRole("radio", { name: "#AF52DE" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));

    expect(await screen.findByRole("heading", { level: 1, name: "API de pagos" })).toBeInTheDocument();
    expect(row("SELECT name, color FROM projects")).toEqual({ name: "API de pagos", color: "#AF52DE" });
  });

  it("muestra un error comprensible si el nombre ya existe", async () => {
    sqlite.db.exec("INSERT INTO projects (name) VALUES ('Portafolio')");
    renderAt("/projects/nuevo");

    fireEvent.change(await screen.findByLabelText("Nombre"), { target: { value: "portafolio" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));

    expect(await screen.findByText("Ya existe un proyecto con ese nombre.")).toBeInTheDocument();
  });

  it("lista tarjetas con métricas y abre el detalle con su actividad", async () => {
    sqlite.db.exec("INSERT INTO projects (id, name, description) VALUES (1, 'App móvil', 'Flutter')");
    sqlite.db.exec("INSERT INTO daily_logs (project_id, log_date, today) VALUES (1, '2026-10-20', 'Pantalla de login')");
    sqlite.db.exec("INSERT INTO blockers (project_id, title) VALUES (1, 'El emulador no arranca')");
    renderAt("/projects");

    const card = await screen.findByRole("link", { name: /App móvil/ });
    expect(card).toHaveTextContent("1 registro · 0 aprendizajes");
    expect(card).toHaveTextContent("1 bloqueo");

    fireEvent.click(card);
    expect(await screen.findByRole("link", { name: /Pantalla de login/ })).toHaveAttribute("href", "/daily-log/1");
    expect(screen.getByRole("link", { name: /El emulador no arranca/ })).toBeInTheDocument();
  });

  it("archiva y reactiva un proyecto", async () => {
    sqlite.db.exec("INSERT INTO projects (id, name) VALUES (1, 'Viejo'), (2, 'Actual')");
    renderAt("/projects/1");

    fireEvent.click(await screen.findByRole("button", { name: "Archivar" }));
    expect(await screen.findByText("Archivado")).toBeInTheDocument();
    expect(row("SELECT archived FROM projects WHERE id = 1")).toEqual({ archived: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));
    await waitFor(() => expect(row("SELECT archived FROM projects WHERE id = 1")).toEqual({ archived: 0 }));
  });

  it("separa los archivados en su propia pestaña", async () => {
    sqlite.db.exec("INSERT INTO projects (name, archived) VALUES ('Activo', 0), ('Archivado', 1)");
    renderAt("/projects");

    expect(await screen.findByRole("link", { name: /Activo/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Archivado/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Archivados/ }));
    expect(screen.getByRole("link", { name: /Archivado/ })).toBeInTheDocument();
  });

  it("elimina un proyecto conservando sus registros", async () => {
    sqlite.db.exec("INSERT INTO projects (id, name) VALUES (1, 'Temporal')");
    sqlite.db.exec("INSERT INTO daily_logs (project_id, log_date, today) VALUES (1, '2026-10-20', 'algo')");
    renderAt("/projects/1");

    fireEvent.click(await screen.findByRole("button", { name: "Eliminar proyecto" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByText("Crea tu primer proyecto")).toBeInTheDocument();
    expect(row("SELECT project_id FROM daily_logs")).toEqual({ project_id: null });
  });

  it("los proyectos aparecen en el selector del registro diario", async () => {
    sqlite.db.exec("INSERT INTO projects (name) VALUES ('Backend')");
    renderAt("/daily-log/nuevo");
    const select = await screen.findByRole("combobox");
    expect(within(select).getByRole("option", { name: "Backend" })).toBeInTheDocument();
  });
});

describe("módulo Aprendizajes", () => {
  it("guarda un comando con etiquetas", async () => {
    renderAt("/learning");

    fireEvent.click(await screen.findByRole("radio", { name: "Comando" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Deshacer el último commit" } });
    fireEvent.change(screen.getByLabelText("Comando"), { target: { value: "git reset --soft HEAD~1" } });
    const tags = screen.getByLabelText("Etiquetas");
    fireEvent.change(tags, { target: { value: "Git" } });
    fireEvent.keyDown(tags, { key: "Enter" });
    fireEvent.change(tags, { target: { value: "git" } });
    fireEvent.keyDown(tags, { key: "," });
    fireEvent.click(screen.getByRole("button", { name: "Guardar aprendizaje" }));

    const list = await screen.findByRole("list", { name: "Lista de aprendizajes" });
    expect(within(list).getByText("Deshacer el último commit")).toBeInTheDocument();
    expect(within(list).getByText("#Git")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    expect(row("SELECT kind, content FROM learnings")).toEqual({ kind: "command", content: "git reset --soft HEAD~1" });
    expect(row("SELECT COUNT(*) AS n FROM tags")).toEqual({ n: 1 });
  });

  it("exige un título", async () => {
    renderAt("/learning");
    fireEvent.change(await screen.findByLabelText("Contenido"), { target: { value: "algo" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar aprendizaje" }));
    expect(await screen.findByText("Ponle un título.")).toBeInTheDocument();
  });

  it("filtra por tipo, etiqueta y texto", async () => {
    sqlite.db.exec(`INSERT INTO learnings (id, kind, title, content) VALUES
      (1, 'concept', 'Closures', 'Funciones que recuerdan su entorno'),
      (2, 'error_fix', 'CORS bloqueado', 'Faltaba el header'),
      (3, 'command', 'Listar puertos', 'netstat -ano')`);
    sqlite.db.exec("INSERT INTO tags (id, name) VALUES (1, 'JavaScript')");
    sqlite.db.exec("INSERT INTO learning_tags (learning_id, tag_id) VALUES (1, 1)");
    renderAt("/learning");

    const list = await screen.findByRole("list", { name: "Lista de aprendizajes" });
    expect(within(list).getAllByRole("link")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Errores" }));
    expect(within(list).getAllByRole("link").map((l) => l.textContent)).toEqual(["CORS bloqueado"]);
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));

    fireEvent.click(screen.getByRole("button", { name: "#JavaScript" }));
    expect(within(list).getAllByRole("link")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "#JavaScript" }));

    fireEvent.change(screen.getByPlaceholderText("Buscar"), { target: { value: "netstat" } });
    expect(within(list).getAllByRole("link").map((l) => l.textContent)).toEqual(["Listar puertos"]);
  });

  it("edita y elimina un aprendizaje", async () => {
    sqlite.db.exec("INSERT INTO learnings (id, title) VALUES (5, 'Promesas')");
    renderAt("/learning/5");

    fireEvent.change(await screen.findByLabelText("Título"), { target: { value: "Promesas y async/await" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(row("SELECT title FROM learnings")).toEqual({ title: "Promesas y async/await" }));

    fireEvent.click(screen.getByRole("button", { name: "Eliminar aprendizaje" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(row("SELECT COUNT(*) AS n FROM learnings")).toEqual({ n: 0 }));
  });

  it("guarda en Aprendizajes la respuesta del registro diario", async () => {
    sqlite.db.exec(`INSERT INTO daily_logs (id, log_date, learnings) VALUES (2, '2026-10-20', 'Índices en SQLite
Aceleran búsquedas por columna')`);
    renderAt("/daily-log/2");

    fireEvent.click(await screen.findByRole("button", { name: "Guardar en Aprendizajes" }));

    expect(await screen.findByDisplayValue("Índices en SQLite")).toBeInTheDocument();
    expect(row("SELECT title, content, daily_log_id FROM learnings")).toEqual({
      title: "Índices en SQLite",
      content: "Aceleran búsquedas por columna",
      daily_log_id: 2,
    });

    fireEvent.click(screen.getByRole("link", { name: /registro diario/ }));
    expect(await screen.findByRole("link", { name: "Ver en Aprendizajes" })).toBeInTheDocument();
  });
});
