/**
 * Sonidos del temporizador de enfoque, sintetizados con Web Audio (sin archivos):
 * campanas suaves, al estilo de las alarmas de iOS.
 */
export type Chime = "focus-end" | "break-end";

// Notas (Hz) de cada aviso: al terminar el bloque, un arpegio ascendente que se
// repite; al terminar el descanso, dos notas más tranquilas.
const MELODIES: Record<Chime, { notes: number[]; repeat: number; gap: number }> = {
  "focus-end": { notes: [1046.5, 1318.5, 1568], repeat: 3, gap: 0.16 },
  "break-end": { notes: [784, 1046.5], repeat: 2, gap: 0.22 },
};

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  context ??= new AudioContext();
  return context;
}

/** Una nota de campana: tono puro con un armónico y caída exponencial. */
function bell(ctx: AudioContext, frequency: number, at: number, volume: number) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
  gain.connect(ctx.destination);

  for (const [multiple, level] of [
    [1, 1],
    [2.76, 0.18],
  ] as const) {
    const tone = ctx.createOscillator();
    const partial = ctx.createGain();
    tone.type = "sine";
    tone.frequency.value = frequency * multiple;
    partial.gain.value = level;
    tone.connect(partial).connect(gain);
    tone.start(at);
    tone.stop(at + 1.5);
  }
}

/** Reproduce el aviso. Devuelve false si el sistema no permite sonido. */
export async function playChime(chime: Chime, volume = 0.22): Promise<boolean> {
  const ctx = audio();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") await ctx.resume();
  } catch {
    return false;
  }
  const { notes, repeat, gap } = MELODIES[chime];
  let at = ctx.currentTime + 0.05;
  for (let round = 0; round < repeat; round++) {
    for (const note of notes) {
      bell(ctx, note, at, volume);
      at += gap;
    }
    at += 0.45;
  }
  return true;
}
