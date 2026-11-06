import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLockStore } from "@/stores/lock.store";

interface SheetProps {
  title: string;
  /** Texto pequeño sobre el título (p. ej. el estado). */
  eyebrow?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Hoja modal al estilo de iOS: sube desde abajo sobre un fondo atenuado.
 * Se cierra con Esc, con el botón o pulsando fuera.
 */
export function Sheet({ title, eyebrow, onClose, children }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const locked = useLockStore((s) => s.locked);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !useLockStore.getState().locked) close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center sm:p-8" inert={locked}>
      <div className="animate-fade absolute inset-0 bg-black/25 backdrop-blur-[3px] dark:bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="animate-sheet-up relative flex max-h-[88vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[22px] bg-surface shadow-float outline-none"
      >
        <header className="flex items-start gap-3 border-b border-separator/60 px-6 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="mb-1">{eyebrow}</div>}
            <h2 className="truncate text-[19px] font-bold tracking-[-0.02em]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="pressable grid size-8 shrink-0 place-items-center rounded-full bg-fill text-ink-muted hover:text-ink"
          >
            <X className="size-4" strokeWidth={2.5} />
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
