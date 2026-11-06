import { FolderGit2, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { gitService } from "@/services/git";
import { useSettingsStore } from "@/stores/settings.store";

/** Repositorios de Git locales cuyos commits aparecen en el registro del día (modo dev). */
export function GitReposCard() {
  const repos = useSettingsStore((s) => s.settings.git_repos);
  const update = useSettingsStore((s) => s.update);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    try {
      const repo = await gitService.chooseRepo();
      if (repo && !repos.includes(repo)) await update("git_repos", [...repos, repo]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Card title="Repositorios de Git" action={<FolderGit2 className="size-4 text-ink-muted" />}>
      <p className="mb-3 text-[12.5px] text-ink-muted">
        Tus commits de cada día (por el email de <code className="font-mono">git config</code>) aparecen en el registro diario para pasarlos al plan. Solo se leen, nada sale del equipo.
      </p>
      {repos.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1.5" aria-label="Repositorios conectados">
          {repos.map((repo) => (
            <li key={repo} className="flex items-center gap-2 rounded-lg bg-fill/60 px-3 py-1.5 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-mono" title={repo}>
                {repo}
              </span>
              <button
                type="button"
                onClick={() => void update("git_repos", repos.filter((r) => r !== repo))}
                aria-label={`Quitar ${repo}`}
                className="pressable rounded-md p-1 text-ink-muted hover:text-danger"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => void add()} disabled={repos.length >= 20}>
          <Plus className="size-4" /> Añadir repositorio
        </Button>
        {error && <span className="text-[13px] text-danger">{error}</span>}
      </div>
    </Card>
  );
}
