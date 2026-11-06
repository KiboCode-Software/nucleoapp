import { fromISODate, toISODate } from "@/utils/date";

/** Cómo te fue al recordar la respuesta. */
export type Rating = "again" | "hard" | "good" | "easy";

export const RATINGS: Array<{ value: Rating; label: string; key: string }> = [
  { value: "again", label: "Otra vez", key: "1" },
  { value: "hard", label: "Difícil", key: "2" },
  { value: "good", label: "Bien", key: "3" },
  { value: "easy", label: "Fácil", key: "4" },
];

export interface ReviewState {
  ease: number;
  interval_days: number;
  repetitions: number;
}

// Calidad de la respuesta en la escala de SM-2 (0–5).
const QUALITY: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };

const addDays = (day: string, days: number) => {
  const date = fromISODate(day);
  date.setDate(date.getDate() + days);
  return toISODate(date);
};

/**
 * Repaso espaciado SM-2 (el de Anki/SuperMemo, simplificado): cada acierto aleja
 * el siguiente repaso según la "facilidad" de la tarjeta; un fallo la reinicia y
 * vuelve a salir hoy mismo.
 */
export function schedule(card: ReviewState, rating: Rating, today: string): ReviewState & { due_on: string } {
  const quality = QUALITY[rating];
  const ease = Math.max(1.3, Math.round((card.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))) * 100) / 100);

  if (rating === "again") return { ease, interval_days: 0, repetitions: 0, due_on: today };

  const repetitions = card.repetitions + 1;
  let interval: number;
  if (repetitions === 1) interval = rating === "easy" ? 3 : 1;
  else if (repetitions === 2) interval = rating === "hard" ? 3 : rating === "easy" ? 8 : 6;
  else interval = Math.round(card.interval_days * ease * (rating === "hard" ? 0.8 : rating === "easy" ? 1.3 : 1));

  interval = Math.max(1, interval);
  return { ease, interval_days: interval, repetitions, due_on: addDays(today, interval) };
}

/** "hoy", "1 día", "6 días", "3 sem.", "2 meses": lo que se ve bajo cada botón. */
export function formatInterval(days: number): string {
  if (days <= 0) return "hoy";
  if (days === 1) return "1 día";
  if (days < 21) return `${days} días`;
  if (days < 60) return `${Math.round(days / 7)} sem.`;
  return `${Math.round(days / 30)} meses`;
}
