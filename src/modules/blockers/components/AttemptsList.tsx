import { X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/fields";
import { blockersRepository } from "@/database/repositories/blockers.repository";
import type { BlockerAttempt } from "@/types/entities";
import { elapsedBetween } from "@/utils/date";
import { useVocab } from "@/modes/vocabulary";

interface AttemptsListProps {
  blockerId: number;
  now: Date;
  /** Se llama tras añadir o quitar un intento (para refrescar el contador). */
  onChange: () => void;
}

/** Línea de tiempo de intentos de solución de un bloqueo. */
export function AttemptsList({ blockerId, now, onChange }: AttemptsListProps) {
  const v = useVocab();
  const [attempts, setAttempts] = useState<BlockerAttempt[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    blockersRepository.listAttempts(blockerId).then((list) => !cancelled && setAttempts(list), console.error);
    return () => {
      cancelled = true;
    };
  }, [blockerId]);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const attempt = await blockersRepository.addAttempt(blockerId, draft);
      setAttempts((list) => [...list, attempt]);
      setDraft("");
      onChange();
    } catch (error) {
      console.error("No se pudo guardar el intento", error);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    await blockersRepository.removeAttempt(id);
    setAttempts((list) => list.filter((a) => a.id !== id));
    onChange();
  }

  return (
    <section aria-labelledby="attempts-title">
      <h3 id="attempts-title" className="mb-3 text-[13.5px] font-medium">
        {v.blocker.attempts}
      </h3>

      {attempts.length > 0 && (
        <ol className="mb-4 flex flex-col">
          {attempts.map((attempt, i) => (
            <li key={attempt.id} className="group relative flex gap-3 pb-4 last:pb-0">
              {/* Línea vertical que une los intentos */}
              {i < attempts.length - 1 && <span className="absolute top-5 bottom-0 left-[5px] w-px bg-line" />}
              <span className="mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-accent bg-surface" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{attempt.description}</p>
                <p className="text-xs text-ink-muted">hace {elapsedBetween(attempt.created_at, null, now)}</p>
              </div>
              <button
                type="button"
                onClick={() => void remove(attempt.id)}
                aria-label="Quitar intento"
                className="size-6 shrink-0 rounded-md text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-fill focus:opacity-100"
              >
                <X className="mx-auto size-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={add} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          placeholder={attempts.length ? v.blocker.attemptsMore : v.blocker.attemptsFirst}
          aria-label="Nuevo intento de solución"
          className={fieldClass + " h-10 flex-1 text-[14px]"}
        />
        <Button type="submit" variant="secondary" className="h-10" disabled={!draft.trim() || busy}>
          Añadir
        </Button>
      </form>
    </section>
  );
}
