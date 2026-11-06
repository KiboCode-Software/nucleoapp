import { Delete } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNow } from "@/hooks/useNow";
import { useLockStore } from "@/stores/lock.store";
import { cn } from "@/utils/cn";

const KEYS: Array<[string, string]> = [
  ["1", ""],
  ["2", "ABC"],
  ["3", "DEF"],
  ["4", "GHI"],
  ["5", "JKL"],
  ["6", "MNO"],
  ["7", "PQRS"],
  ["8", "TUV"],
  ["9", "WXYZ"],
];

interface PasscodePadProps {
  length: number;
  title: string;
  subtitle?: ReactNode;
  /** "glass": sobre fondo oscuro difuminado (bloqueo) · "plain": dentro de una hoja. */
  tone?: "glass" | "plain";
  /** Hasta cuándo (ms) el teclado está desactivado por demasiados fallos. */
  disabledUntil?: number;
  /** Recibe el código completo; si devuelve false, tiembla y se borra. */
  onSubmit: (code: string) => Promise<boolean>;
  onCancel?: () => void;
  /** Botón de la esquina inferior izquierda (p. ej. Windows Hello). */
  leftAction?: ReactNode;
  /** Debajo de los puntos (p. ej. "Opciones de código"). */
  footer?: ReactNode;
}

function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  return minutes >= 60 ? "1 hora" : minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

/** Puntos y teclado numérico como la pantalla de código de iOS. También admite el teclado físico. */
export function PasscodePad({ length, title, subtitle, tone = "plain", disabledUntil = 0, onSubmit, onCancel, leftAction, footer }: PasscodePadProps) {
  const [code, setCode] = useState("");
  const [shaking, setShaking] = useState(false);
  const now = useNow(1000);
  const waiting = disabledUntil > now.getTime();
  const glass = tone === "glass";
  // El código en curso también en una ref: dos pulsaciones seguidas, antes de que
  // React vuelva a pintar, no deben pisarse.
  const typed = useRef("");
  const pending = useRef(false);
  const blocked = useRef(waiting);
  blocked.current = waiting;

  const write = (value: string) => {
    typed.current = value;
    setCode(value);
  };

  // Si cambia la longitud (4 ↔ 6), se empieza de nuevo.
  useEffect(() => write(""), [length]);

  const submit = async (full: string) => {
    pending.current = true;
    const ok = await onSubmit(full).catch(() => false);
    if (!ok) {
      setShaking(true);
      await new Promise((resolve) => window.setTimeout(resolve, 420));
      setShaking(false);
    }
    write("");
    pending.current = false;
  };

  const press = (digit: string) => {
    if (pending.current || blocked.current || typed.current.length >= length) return;
    const next = typed.current + digit;
    write(next);
    if (next.length === length) void submit(next);
  };

  const erase = () => {
    if (!pending.current) write(typed.current.slice(0, -1));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Con la app bloqueada, el teclado es solo para la pantalla de bloqueo.
      if (!glass && useLockStore.getState().locked) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        press(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        erase();
      } else if (event.key === "Escape" && onCancel) {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const keyClass = cn(
    "pressable grid size-[76px] place-items-center rounded-full transition-colors duration-150 disabled:opacity-40",
    glass ? "bg-white/15 text-white active:bg-white/45" : "bg-fill text-ink active:bg-ink/20",
  );
  const textButton = cn("pressable h-[76px] text-[16px] font-medium", glass ? "text-white" : "text-accent");

  return (
    <div className={cn("flex flex-col items-center", glass ? "text-white" : "text-ink")}>
      <p className="text-[20px] font-semibold tracking-[-0.01em]">{title}</p>
      <div className={cn("mt-1 min-h-5 text-center text-[13.5px]", glass ? "text-white/75" : "text-ink-muted")}>
        {waiting ? `Inténtalo de nuevo en ${formatWait(disabledUntil - now.getTime())}` : subtitle}
      </div>

      <div
        role="status"
        aria-label={`${code.length} de ${length} dígitos`}
        className={cn("my-7 flex gap-[18px]", shaking && "animate-shake")}
      >
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-[13px] rounded-full border-[1.5px] transition-colors duration-100",
              glass ? "border-white" : "border-ink",
              i < code.length && (glass ? "bg-white" : "bg-ink"),
            )}
          />
        ))}
      </div>

      {footer}

      <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-4" role="group" aria-label="Teclado numérico">
        {KEYS.map(([digit, letters]) => (
          <button key={digit} type="button" className={keyClass} disabled={waiting} onClick={() => press(digit)} aria-label={digit}>
            <span className="flex flex-col items-center leading-none">
              <span className="text-[32px] font-light">{digit}</span>
              {letters && <span className="mt-0.5 text-[9.5px] font-semibold tracking-[0.18em]">{letters}</span>}
            </span>
          </button>
        ))}
        <div className="grid place-items-center">{leftAction}</div>
        <button type="button" className={keyClass} disabled={waiting} onClick={() => press("0")} aria-label="0">
          <span className="text-[32px] leading-none font-light">0</span>
        </button>
        <div className="grid place-items-center">
          {code.length > 0 ? (
            <button type="button" className={textButton} onClick={erase} aria-label="Borrar">
              <Delete className="size-6" />
            </button>
          ) : (
            onCancel && (
              <button type="button" className={textButton} onClick={onCancel}>
                Cancelar
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
