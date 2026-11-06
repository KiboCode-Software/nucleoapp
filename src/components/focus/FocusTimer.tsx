import { AppWindow, Coffee, Target, Timer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { create } from "zustand";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { fieldClass } from "@/components/ui/fields";
import { isTauri } from "@/database/client";
import { focusRepository, type FocusSession } from "@/database/repositories/focus.repository";
import { useNow } from "@/hooks/useNow";
import { useProjects } from "@/hooks/useProjects";
import { useVocab } from "@/modes/vocabulary";
import {
  emitFocus,
  FOCUS_COMMAND_EVENT,
  FOCUS_ENDED_EVENT,
  FOCUS_HELLO_EVENT,
  FOCUS_STATE_EVENT,
  hideFocusWidget,
  onFocusEvent,
  showFocusWidget,
  useFocusPrefs,
  type FocusCommand,
  type FocusSnapshot,
} from "@/services/focus-widget";
import { playChime } from "@/services/sounds";
import { breakMinutesFor, FOCUS_PRESETS, formatClock, remainingMs, useFocusStore, type FocusPhase } from "@/stores/focus.store";
import { cn } from "@/utils/cn";
import { toISODate } from "@/utils/date";

export const useFocusSheet = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

function snapshot(): FocusSnapshot {
  const { phase, endsAt, remainingMs, durationMs, label } = useFocusStore.getState();
  return { phase, endsAt, remainingMs, durationMs, label, sound: useFocusPrefs.getState().sound };
}

/** Al terminar un bloque o un descanso: suena en el widget si está abierto o aquí si no. */
function announceEnd(ended: FocusPhase) {
  const prefs = useFocusPrefs.getState();
  if (!prefs.sound) return;
  if (prefs.showWidget && isTauri()) void emitFocus(FOCUS_ENDED_EVENT, ended);
  else void playChime(ended === "focus" ? "focus-end" : "break-end");
}

async function advance() {
  const ended = await useFocusStore.getState().tick();
  if (ended) announceEnd(ended);
}

/**
 * Lleva el reloj del enfoque (aunque la hoja esté cerrada) y lo comparte con el
 * widget flotante: le envía el estado, lo muestra al empezar un bloque, lo oculta
 * al terminar y obedece sus botones.
 */
export function useFocusTicker() {
  useEffect(() => {
    const timer = window.setInterval(() => void advance(), 1000);
    const sync = () => void emitFocus(FOCUS_STATE_EVENT, snapshot());

    const stopStore = useFocusStore.subscribe((state, prev) => {
      const changed = state.phase !== prev.phase || state.endsAt !== prev.endsAt || state.remainingMs !== prev.remainingMs || state.label !== prev.label;
      if (!changed) return;
      sync();
      if (state.phase === "idle") void hideFocusWidget();
      else if (prev.phase === "idle" && useFocusPrefs.getState().showWidget) void showFocusWidget();
    });
    const stopPrefs = useFocusPrefs.subscribe((prefs, prev) => {
      sync();
      if (prefs.showWidget === prev.showWidget) return;
      if (!prefs.showWidget) void hideFocusWidget();
      else if (useFocusStore.getState().phase !== "idle") void showFocusWidget();
    });

    const listeners = [
      onFocusEvent(FOCUS_HELLO_EVENT, sync),
      onFocusEvent<FocusCommand>(FOCUS_COMMAND_EVENT, (command) => {
        const focus = useFocusStore.getState();
        if (command === "pause") focus.pause();
        else if (command === "resume") focus.resume();
        else if (command === "stop") void focus.stop();
        else if (command === "tick") void advance();
        else if (command === "open-app") void bringToFront();
      }),
    ];

    return () => {
      window.clearInterval(timer);
      stopStore();
      stopPrefs();
      listeners.forEach((stop) => void stop.then((unlisten) => unlisten()));
    };
  }, []);
}

/** "Abrir Núcleo" desde el widget: trae la ventana principal al frente. */
async function bringToFront() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const window = getCurrentWindow();
  await window.unminimize();
  await window.show();
  await window.setFocus();
}

const RADIUS = 118;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Anillo de progreso como el Temporizador de iOS: se vacía a medida que pasa el tiempo. */
function Ring({ fraction, phase, children }: { fraction: number; phase: "idle" | "focus" | "break"; children: ReactNode }) {
  return (
    <div className="relative grid size-[264px] place-items-center">
      <svg viewBox="0 0 264 264" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="132" cy="132" r={RADIUS} fill="none" strokeWidth="8" className="stroke-fill" />
        <circle
          cx="132"
          cy="132"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          className={cn("transition-[stroke-dashoffset] duration-1000 ease-linear", phase === "break" ? "stroke-success" : "stroke-[#FF9500]")}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

function CircleButton({ tone, onClick, children, disabled }: { tone: "gray" | "green" | "orange"; onClick: () => void; children: string; disabled?: boolean }) {
  const tones = {
    gray: "bg-fill text-ink",
    green: "bg-success/20 text-success dark:bg-success/25",
    orange: "bg-[#FF9500]/20 text-[#FF9500]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn("pressable grid size-[78px] place-items-center rounded-full text-[15px] font-medium ring-2 ring-surface ring-offset-2 ring-offset-transparent disabled:opacity-40", tones[tone])}
    >
      {children}
    </button>
  );
}

function FocusPanel() {
  const v = useVocab();
  const projects = useProjects();
  const focus = useFocusStore();
  const now = useNow(1000);
  const [today, setToday] = useState<FocusSession[]>([]);
  const left = remainingMs(focus, now.getTime());
  const running = focus.endsAt != null;
  const paused = focus.phase !== "idle" && !running;

  useEffect(() => {
    if (!isTauri()) return;
    focusRepository.listOn(toISODate(new Date())).then(setToday, console.error);
  }, [focus.savedCount]);

  const minutesToday = today.reduce((sum, s) => sum + s.minutes, 0);

  return (
    <div className="flex flex-col items-center gap-6">
      <Ring fraction={focus.phase === "idle" ? 1 : left / focus.durationMs} phase={focus.phase}>
        <p className="text-[54px] leading-none font-light tracking-[-0.03em] tabular-nums" aria-live="off">
          {formatClock(left)}
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] text-ink-muted">
          {focus.phase === "break" ? <Coffee className="size-4" /> : <Target className="size-4" />}
          {focus.phase === "break" ? "Descanso" : focus.phase === "focus" ? (paused ? "En pausa" : "Enfoque") : `Descanso de ${breakMinutesFor(focus.focusMinutes)} min después`}
        </p>
      </Ring>

      <div className="flex w-full max-w-sm items-center justify-between">
        <CircleButton tone="gray" disabled={focus.phase === "idle"} onClick={() => void focus.stop()}>
          Cancelar
        </CircleButton>
        {focus.phase === "idle" ? (
          <CircleButton tone="green" onClick={() => focus.start()}>
            Iniciar
          </CircleButton>
        ) : running ? (
          <CircleButton tone="orange" onClick={() => focus.pause()}>
            Pausa
          </CircleButton>
        ) : (
          <CircleButton tone="green" onClick={() => focus.resume()}>
            Reanudar
          </CircleButton>
        )}
      </div>

      <div className="flex w-full flex-col gap-3">
        <div role="radiogroup" aria-label="Duración del bloque" className="grid grid-cols-4 gap-2">
          {FOCUS_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              role="radio"
              aria-checked={focus.focusMinutes === minutes}
              disabled={focus.phase !== "idle"}
              onClick={() => focus.setPlan({ focusMinutes: minutes })}
              className={cn(
                "pressable h-10 rounded-xl text-[14px] font-medium transition-colors disabled:opacity-50",
                focus.focusMinutes === minutes ? "bg-accent text-white" : "bg-fill text-ink",
              )}
            >
              {minutes} min
            </button>
          ))}
        </div>
        <input
          value={focus.label}
          onChange={(e) => focus.setPlan({ label: e.target.value })}
          maxLength={140}
          aria-label="En qué te vas a enfocar"
          placeholder={v.mode === "student" ? "¿Qué vas a estudiar? (opcional)" : "¿En qué te vas a enfocar? (opcional)"}
          className={fieldClass + " h-10"}
        />
        {projects.length > 0 && (
          <select
            aria-label={v.project.title}
            value={focus.projectId ?? ""}
            onChange={(e) => focus.setPlan({ projectId: e.target.value ? Number(e.target.value) : null })}
            className={fieldClass + " h-10"}
          >
            <option value="">{v.project.none}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <FocusPrefsRows running={focus.phase !== "idle"} />

      <section aria-label="Enfoque de hoy" className="w-full border-t border-separator/60 pt-4">
        <p className="mb-2 flex items-baseline justify-between text-[13.5px] font-semibold">
          Hoy
          <span className="text-[12.5px] font-normal text-ink-muted">
            {today.length === 0 ? "Aún sin bloques" : `${today.length} ${today.length === 1 ? "bloque" : "bloques"} · ${minutesToday} min`}
          </span>
        </p>
        <ul className="flex flex-col gap-1">
          {today.slice(0, 6).map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-[13px]">
              <span className={cn("size-1.5 rounded-full", s.completed ? "bg-success" : "bg-ink-muted/50")} />
              <span className="tabular-nums text-ink-muted">{new Date(s.started_at).toTimeString().slice(0, 5)}</span>
              <span className="min-w-0 flex-1 truncate">{s.label || s.project_name || "Enfoque"}</span>
              <span className="tabular-nums text-ink-muted">{s.minutes} min</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Widget flotante y sonido: se recuerdan en el equipo. */
function FocusPrefsRows({ running }: { running: boolean }) {
  const { showWidget, sound, set } = useFocusPrefs();
  const row = "flex items-center justify-between gap-4 py-2.5";
  return (
    <div className="w-full divide-y divide-separator/60 border-t border-separator/60">
      <div className={row}>
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Widget flotante</p>
          <p className="text-[12.5px] text-ink-muted">El tiempo siempre a la vista, encima de cualquier ventana. Muévelo, hazlo transparente o minimízalo.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showWidget && running && isTauri() && (
            <button
              type="button"
              onClick={() => void showFocusWidget()}
              aria-label="Mostrar el widget"
              title="Mostrar el widget"
              className="pressable grid size-8 place-items-center rounded-full bg-fill text-ink-muted hover:text-ink"
            >
              <AppWindow className="size-4" />
            </button>
          )}
          <Switch label="Widget flotante" checked={showWidget} onChange={(on) => set({ showWidget: on })} />
        </div>
      </div>
      <div className={row}>
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Sonido al terminar</p>
          <p className="text-[12.5px] text-ink-muted">Una campana al acabar el bloque y otra al acabar el descanso.</p>
        </div>
        <Switch
          label="Sonido al terminar"
          checked={sound}
          onChange={(on) => {
            set({ sound: on });
            // Así se oye cómo suena (y el sistema autoriza el audio con este clic).
            if (on) void playChime("break-end");
          }}
        />
      </div>
    </div>
  );
}

/** Hoja del temporizador de enfoque. */
export function FocusSheet() {
  const open = useFocusSheet((s) => s.open);
  const setOpen = useFocusSheet((s) => s.setOpen);
  if (!open) return null;
  return (
    <Sheet title="Enfoque" onClose={() => setOpen(false)}>
      <FocusPanel />
    </Sheet>
  );
}

/** Indicador en la barra lateral mientras hay un bloque o un descanso en marcha. */
export function FocusPill() {
  const focus = useFocusStore();
  const now = useNow(1000);
  if (focus.phase === "idle") return null;
  const paused = focus.endsAt == null;
  return (
    <div className="px-3 pb-3">
      <button
        type="button"
        onClick={() => useFocusSheet.getState().setOpen(true)}
        aria-label={`Enfoque: quedan ${formatClock(remainingMs(focus, now.getTime()))}`}
        className={cn(
          "pressable flex h-9 w-full items-center gap-2 rounded-[10px] px-2.5 text-[13.5px] font-medium",
          focus.phase === "break" ? "bg-success/15 text-success" : "bg-[#FF9500]/15 text-[#C93400] dark:text-[#FF9F0A]",
        )}
      >
        {focus.phase === "break" ? <Coffee className="size-4" /> : <Timer className="size-4" />}
        <span className="flex-1 text-left">{focus.phase === "break" ? "Descanso" : paused ? "Enfoque en pausa" : "Enfoque"}</span>
        <span className="tabular-nums">{formatClock(remainingMs(focus, now.getTime()))}</span>
      </button>
    </div>
  );
}
