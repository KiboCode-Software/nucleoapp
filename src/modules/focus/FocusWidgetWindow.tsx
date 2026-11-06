import { AppWindow, Droplet, Minus, Pause, Play, Square, X } from "lucide-react";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import {
  emitFocus,
  FOCUS_COMMAND_EVENT,
  FOCUS_ENDED_EVENT,
  FOCUS_HELLO_EVENT,
  FOCUS_STATE_EVENT,
  hideFocusWidget,
  onFocusEvent,
  type FocusCommand,
  type FocusSnapshot,
} from "@/services/focus-widget";
import { playChime } from "@/services/sounds";
import { formatClock, remainingMs, type FocusPhase } from "@/stores/focus.store";
import { cn } from "@/utils/cn";

const OPACITY_KEY = "nucleo-widget-opacity";
const MIN_OPACITY = 0.3;

function readOpacity(): number {
  try {
    const value = Number(localStorage.getItem(OPACITY_KEY));
    return value >= MIN_OPACITY && value <= 1 ? value : 1;
  } catch {
    return 1;
  }
}

const PHASE: Record<Exclude<FocusPhase, "idle">, { label: string; color: string }> = {
  focus: { label: "Enfoque", color: "#FF9500" },
  break: { label: "Descanso", color: "#34C759" },
};

const command = (name: FocusCommand) => void emitFocus(FOCUS_COMMAND_EVENT, name);

/** Acción sobre esta ventana; fuera de Tauri (modo demostración) no hace nada. */
function withWindow(action: (window: Window) => Promise<unknown>) {
  try {
    void action(getCurrentWindow()).catch(() => undefined);
  } catch {
    // Sin el puente de Tauri no hay ventana que controlar.
  }
}

/** Anillo de progreso: se vacía a medida que pasa el tiempo. */
function Ring({ fraction, color }: { fraction: number; color: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 52 52" className="size-[52px] shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="26" cy="26" r={r} fill="none" strokeWidth="5" stroke="rgb(255 255 255 / 0.14)" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        stroke={color}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - fraction)}
        className="transition-[stroke-dashoffset] duration-500 ease-linear"
      />
    </svg>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-7 place-items-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/20 hover:text-white active:bg-white/30"
    >
      {children}
    </button>
  );
}

/**
 * Widget flotante del enfoque (ventana "focus-widget"), como una Actividad en
 * Vivo de iOS: siempre encima, se arrastra desde cualquier parte, se puede hacer
 * transparente y minimizar a la barra de tareas (su título lleva el tiempo).
 */
export function FocusWidgetWindow({ initial = null }: { initial?: FocusSnapshot | null }) {
  // `initial` solo lo usa el modo demostración (capturas): en la app llega por eventos.
  const [state, setState] = useState<FocusSnapshot | null>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [opacity, setOpacity] = useState(readOpacity);
  const [tuning, setTuning] = useState(false);
  const askedTick = useRef<number | null>(null);
  const lastTitle = useRef("");

  // Ventana transparente: sin el fondo de la app.
  useEffect(() => {
    document.documentElement.classList.add("widget-window");
    return () => document.documentElement.classList.remove("widget-window");
  }, []);

  useEffect(() => {
    const listeners = [
      onFocusEvent<FocusSnapshot>(FOCUS_STATE_EVENT, setState),
      onFocusEvent<FocusPhase>(FOCUS_ENDED_EVENT, (ended) => void playChime(ended === "focus" ? "focus-end" : "break-end")),
    ];
    // Pide el estado actual a la ventana principal (por si se abrió a mitad de un bloque).
    void emitFocus(FOCUS_HELLO_EVENT);
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.clearInterval(timer);
      listeners.forEach((stop) => void stop.then((unlisten) => unlisten()));
    };
  }, []);

  const active = state && state.phase !== "idle" ? state : null;
  const left = active ? remainingMs(active, now) : 0;
  const clock = formatClock(left);
  const running = active?.endsAt != null;

  // Al llegar a cero, avisa a la ventana principal (que puede estar en segundo plano y tardar en enterarse).
  useEffect(() => {
    if (active && running && left === 0 && askedTick.current !== active.endsAt) {
      askedTick.current = active.endsAt;
      command("tick");
    }
  }, [active, running, left]);

  // El título de la ventana lleva el tiempo: así se ve en la barra de tareas al minimizar.
  useEffect(() => {
    const title = active ? `${clock} · ${PHASE[active.phase as "focus" | "break"].label}` : "Enfoque";
    if (title === lastTitle.current) return;
    lastTitle.current = title;
    withWindow((w) => w.setTitle(title));
  }, [active, clock]);

  const changeOpacity = (value: number) => {
    setOpacity(value);
    try {
      localStorage.setItem(OPACITY_KEY, String(value));
    } catch {
      // Sin almacenamiento: se aplica solo ahora.
    }
  };

  // Se arrastra desde cualquier punto que no sea un control.
  const drag = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, input")) return;
    withWindow((w) => w.startDragging());
  };

  if (!active) return null;
  const phase = PHASE[active.phase as "focus" | "break"];

  return (
    <div className="flex h-screen w-screen items-center justify-center p-2 select-none">
      <div
        onPointerDown={drag}
        style={{ "--widget-opacity": opacity } as CSSProperties}
        className={cn(
          "group relative flex h-full w-full cursor-grab items-center gap-3.5 rounded-[26px] bg-[#0b0b0c]/90 px-4 text-white shadow-[0_10px_30px_rgb(0_0_0/0.35)] ring-1 ring-white/10 backdrop-blur-xl active:cursor-grabbing",
          // Transparente mientras no se usa; opaco al pasar el ratón para leerlo y tocarlo.
          "opacity-[var(--widget-opacity)] transition-opacity duration-300 hover:opacity-100",
        )}
      >
        <div className="relative grid place-items-center">
          <Ring fraction={active.durationMs ? left / active.durationMs : 0} color={phase.color} />
          <span className="absolute size-2 rounded-full" style={{ backgroundColor: phase.color }} />
        </div>

        <div className="min-w-0 flex-1">
          {tuning ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.04em] text-white/60 uppercase">Transparencia</span>
              <input
                type="range"
                min={MIN_OPACITY}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => changeOpacity(Number(e.target.value))}
                aria-label="Opacidad del widget"
                className="w-full accent-[#FF9500]"
              />
            </label>
          ) : (
            <>
              <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: phase.color }}>
                {phase.label}
                {!running && " · en pausa"}
              </p>
              <p className="text-[34px] leading-[1.05] font-semibold tracking-[-0.02em] tabular-nums">{clock}</p>
              {active.label && <p className="truncate text-[12px] text-white/60">{active.label}</p>}
            </>
          )}
        </div>

        {/* Controles: aparecen al pasar el ratón, como en una Actividad en Vivo. */}
        <div className="grid grid-cols-2 gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          {running ? (
            <IconButton label="Pausar" onClick={() => command("pause")}>
              <Pause className="size-3.5" fill="currentColor" />
            </IconButton>
          ) : (
            <IconButton label="Reanudar" onClick={() => command("resume")}>
              <Play className="size-3.5" fill="currentColor" />
            </IconButton>
          )}
          <IconButton label="Detener" onClick={() => command("stop")}>
            <Square className="size-3" fill="currentColor" />
          </IconButton>
          <IconButton label="Transparencia" onClick={() => setTuning((t) => !t)}>
            <Droplet className="size-3.5" />
          </IconButton>
          <IconButton label="Minimizar a la barra de tareas" onClick={() => withWindow((w) => w.minimize())}>
            <Minus className="size-3.5" />
          </IconButton>
          <IconButton label="Abrir Núcleo" onClick={() => command("open-app")}>
            <AppWindow className="size-3.5" />
          </IconButton>
          <IconButton label="Ocultar el widget" onClick={() => void hideFocusWidget()}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
