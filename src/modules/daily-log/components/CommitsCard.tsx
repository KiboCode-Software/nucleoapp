import { GitCommitHorizontal, ListPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { isTauri } from "@/database/client";
import { commitsAsTasks, gitService, type Commit } from "@/services/git";
import { ensureSettingsLoaded, useSettingsStore } from "@/stores/settings.store";
import { parseTasks, serializeTasks } from "../tasks";

/** Commits del día en tus repositorios locales, para pasarlos al plan como tareas hechas. */
export function CommitsCard({ date, plan, onPlanChange }: { date: string; plan: string; onPlanChange: (plan: string) => void }) {
  const repos = useSettingsStore((s) => s.settings.git_repos);
  const [commits, setCommits] = useState<Commit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void ensureSettingsLoaded();
  }, []);

  useEffect(() => {
    if (!isTauri() || repos.length === 0) return;
    let cancelled = false;
    setCommits(null);
    setError(null);
    gitService.commits(repos, date, date).then(
      (found) => !cancelled && setCommits(found),
      (e: unknown) => !cancelled && setError(String(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [repos, date]);

  if (repos.length === 0) {
    return (
      <Card title="Commits del día" action={<GitCommitHorizontal className="size-4 text-ink-muted" />}>
        <p className="text-[13px] text-ink-muted">
          Conecta tus repositorios de Git en{" "}
          <Link to="/settings" className="font-medium text-accent hover:underline">
            Ajustes
          </Link>{" "}
          para ver aquí lo que subiste cada día.
        </p>
      </Card>
    );
  }

  const tasks = parseTasks(plan);
  const pending = commits ? commitsAsTasks(commits, tasks.map((t) => t.text)) : [];

  return (
    <Card
      title="Commits del día"
      action={
        pending.length > 0 && (
          <Button variant="secondary" onClick={() => onPlanChange(serializeTasks([...tasks, ...pending.map((text) => ({ text, done: true }))]))}>
            <ListPlus className="size-4" /> Añadir al plan ({pending.length})
          </Button>
        )
      }
    >
      {error ? (
        <p className="text-[13px] text-danger">{error}</p>
      ) : commits == null ? (
        <p className="text-[13px] text-ink-muted">Leyendo tus repositorios…</p>
      ) : commits.length === 0 ? (
        <p className="text-[13px] text-ink-muted">Sin commits este día.</p>
      ) : (
        <ul aria-label="Commits del día" className="flex flex-col gap-1.5">
          {commits.map((commit) => (
            <li key={`${commit.repo}-${commit.hash}`} className="flex items-baseline gap-2.5 text-[13.5px]">
              <span className="shrink-0 text-[12px] text-ink-muted tabular-nums">{new Date(commit.date).toTimeString().slice(0, 5)}</span>
              <span className="min-w-0 flex-1 truncate" title={commit.subject}>
                {commit.subject}
              </span>
              <span className="shrink-0 rounded-full bg-fill px-2 py-px font-mono text-[11.5px] text-ink-muted">{commit.repo}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
