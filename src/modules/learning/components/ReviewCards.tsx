import { Layers, PartyPopper, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextArea } from "@/components/ui/TextArea";
import { reviewRepository, type DueCard, type ReviewCard } from "@/database/repositories/review.repository";
import { cn } from "@/utils/cn";
import { formatDayLabel, toISODate } from "@/utils/date";
import { formatInterval, RATINGS, schedule, type Rating } from "../review";

/** Tarjetas pregunta/respuesta de un aprendizaje (debajo de su editor). */
export function ReviewCardsEditor({ learningId, onChange }: { learningId: number; onChange?: () => void }) {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reviewRepository.listForLearning(learningId).then(setCards, console.error);
  }, [learningId]);

  async function add(event: FormEvent) {
    event.preventDefault();
    try {
      const card = await reviewRepository.create(learningId, { question, answer }, toISODate(new Date()));
      setCards((list) => [...list, card]);
      setQuestion("");
      setAnswer("");
      setError(null);
      onChange?.();
    } catch (e) {
      setError(e instanceof Error && "issues" in e ? "Escribe la pregunta y la respuesta." : String(e));
    }
  }

  async function remove(id: number) {
    await reviewRepository.remove(id);
    setCards((list) => list.filter((c) => c.id !== id));
    onChange?.();
  }

  return (
    <section aria-label="Tarjetas de repaso" className="mt-6 border-t border-line pt-5">
      <h3 className="mb-1 flex items-center gap-2 text-[14px] font-semibold">
        <Layers className="size-4 text-ink-muted" /> Tarjetas de repaso
        {cards.length > 0 && <span className="text-[12.5px] font-normal text-ink-muted">· {cards.length}</span>}
      </h3>
      <p className="mb-3 text-[12.5px] text-ink-muted">Preguntas para repasar este contenido con repaso espaciado: cada una vuelve cuando estás a punto de olvidarla.</p>

      {cards.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {cards.map((card) => (
            <li key={card.id} className="group flex items-start gap-3 rounded-xl bg-fill/60 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium">{card.question}</p>
                <p className="line-clamp-2 text-[13px] text-ink-muted">{card.answer}</p>
                <p className="mt-1 text-[11.5px] text-ink-muted">Próximo repaso: {formatDayLabel(card.due_on)}</p>
              </div>
              <button
                type="button"
                onClick={() => void remove(card.id)}
                aria-label={`Quitar la tarjeta «${card.question}»`}
                className="pressable rounded-lg p-1.5 text-ink-muted opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-col gap-2.5" aria-label="Nueva tarjeta">
        <TextArea id={`card-q-${learningId}`} label="Pregunta" placeholder="p. ej. ¿Qué dice la regla de la cadena?" value={question} rows={2} maxLength={1000} onChange={(e) => setQuestion(e.target.value)} />
        <TextArea id={`card-a-${learningId}`} label="Respuesta" placeholder="Lo que deberías recordar." value={answer} rows={2} maxLength={4000} onChange={(e) => setAnswer(e.target.value)} />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={!question.trim() || !answer.trim()}>
            Añadir tarjeta
          </Button>
          {error && <span className="text-[13px] text-danger">{error}</span>}
        </div>
      </form>
    </section>
  );
}

/** Sesión de repaso: la tarjeta se gira para ver la respuesta y se califica (teclas 1–4). */
export function ReviewSession({ onDone }: { onDone: () => void }) {
  const today = toISODate(new Date());
  const [queue, setQueue] = useState<DueCard[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const card = queue?.[0];

  useEffect(() => {
    reviewRepository.due(today).then(setQueue, (error: unknown) => {
      console.error("No se pudieron cargar las tarjetas", error);
      setQueue([]);
    });
  }, [today]);

  const rate = async (rating: Rating) => {
    if (!card || !flipped) return;
    const updated = await reviewRepository.review(card.id, rating, today);
    setReviewed((n) => n + 1);
    setFlipped(false);
    // "Otra vez" la deja para el final de la sesión de hoy.
    setQueue((list) => (list ? [...list.slice(1), ...(rating === "again" ? [{ ...card, ...updated }] : [])] : list));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setFlipped(true);
      }
      const rating = RATINGS.find((r) => r.key === event.key);
      if (rating) void rate(rating.value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (queue == null) return null;

  if (!card) {
    return (
      <EmptyState
        icon={PartyPopper}
        title={reviewed > 0 ? "¡Repaso terminado!" : "Nada que repasar hoy"}
        description={reviewed > 0 ? `Repasaste ${reviewed} ${reviewed === 1 ? "tarjeta" : "tarjetas"}. Las siguientes volverán cuando toque.` : "Crea tarjetas en tus apuntes y aparecerán aquí cuando toque repasarlas."}
        action={<Button onClick={onDone}>Cerrar</Button>}
      />
    );
  }

  const face = "absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[22px] border border-separator/50 p-8 text-center shadow-card [backface-visibility:hidden]";

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-[12.5px] text-ink-muted tabular-nums">
        Quedan {queue.length} · {card.learning_title}
        {card.project_name && ` · ${card.project_name}`}
      </p>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Respuesta" : "Pregunta: pulsa para ver la respuesta"}
        className="relative h-[260px] w-full max-w-[520px] [perspective:1200px]"
      >
        <div className={cn("relative size-full transition-transform duration-500 ease-[var(--ease-ios)] [transform-style:preserve-3d]", flipped && "[transform:rotateY(180deg)]")}>
          <div className={cn(face, "bg-surface")}>
            <span className="text-[11.5px] font-semibold tracking-[0.04em] text-ink-muted uppercase">Pregunta</span>
            <p className="text-[20px] leading-snug font-semibold whitespace-pre-wrap">{card.question}</p>
            <span className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              <RotateCw className="size-3.5" /> Pulsa o Espacio para girarla
            </span>
          </div>
          <div className={cn(face, "bg-accent-soft [transform:rotateY(180deg)]")}>
            <span className="text-[11.5px] font-semibold tracking-[0.04em] text-accent uppercase">Respuesta</span>
            <p className="text-[17px] leading-snug whitespace-pre-wrap">{card.answer}</p>
          </div>
        </div>
      </button>

      <div role="group" aria-label="¿Cómo te fue?" className={cn("grid w-full max-w-[520px] grid-cols-4 gap-2 transition-opacity", !flipped && "pointer-events-none opacity-0")}>
        {RATINGS.map(({ value, label, key }) => (
          <button
            key={value}
            type="button"
            onClick={() => void rate(value)}
            tabIndex={flipped ? 0 : -1}
            className={cn(
              "pressable flex flex-col items-center rounded-xl py-2 text-[14px] font-semibold",
              value === "again" ? "bg-danger-soft text-danger" : value === "hard" ? "bg-warning-soft text-warning" : value === "good" ? "bg-success-soft text-success" : "bg-accent-soft text-accent",
            )}
          >
            {label}
            <span className="text-[11.5px] font-medium opacity-75">
              {formatInterval(schedule(card, value, today).interval_days)} · {key}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
