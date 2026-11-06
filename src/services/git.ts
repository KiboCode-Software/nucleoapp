/** Commits de los repositorios de Git locales (los lee Rust con `git log`). */
export interface Commit {
  repo: string;
  hash: string;
  /** Fecha del autor, ISO 8601 con zona. */
  date: string;
  subject: string;
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export const gitService = {
  /** Commits propios entre dos días locales (YYYY-MM-DD), ambos incluidos. */
  commits: (repos: string[], from: string, to: string) => invoke<Commit[]>("git_commits", { repos, from, to }),
  /** Diálogo para elegir un repositorio; null si se cancela. */
  chooseRepo: () => invoke<string | null>("choose_git_repo"),
};

/** Tareas hechas para el plan a partir de los commits, sin repetir las que ya están. */
export function commitsAsTasks(commits: Commit[], existing: string[]): string[] {
  const seen = new Set(existing.map((t) => t.trim().toLowerCase()));
  const tasks: string[] = [];
  for (const commit of commits) {
    const text = `${commit.subject} · ${commit.repo}`;
    if (seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    tasks.push(text);
  }
  return tasks;
}
