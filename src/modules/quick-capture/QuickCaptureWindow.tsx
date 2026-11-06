import { Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { capturesRepository } from "@/database/repositories/captures.repository";
import { CAPTURE_OPENED_EVENT, emitCaptureSaved, hideQuickCapture, onTauriEvent } from "@/services/quick-capture";
import { CaptureInput } from "./components/CaptureInput";

const HIDE_DELAY_MS = 700;

/**
 * Contenido de la ventana flotante (Ctrl+Shift+Espacio). Vive en su propia
 * ventana de Tauri, sin la barra lateral: guarda en SQLite y avisa a la principal.
 */
export function QuickCaptureWindow() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Cambiar la clave reinicia el campo cada vez que se vuelve a abrir la ventana.
  const [session, setSession] = useState(0);

  useEffect(() => {
    const unlisten = onTauriEvent(CAPTURE_OPENED_EVENT, () => {
      setSession((n) => n + 1);
      requestAnimationFrame(() => inputRef.current?.focus());
    });
    return () => void unlisten.then((stop) => stop());
  }, []);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header data-tauri-drag-region className="flex items-center gap-2 px-5 pt-4 pb-2 select-none">
        <span className="grid size-6 place-items-center rounded-md bg-accent text-white" data-tauri-drag-region>
          <Zap className="size-3.5" strokeWidth={2.25} />
        </span>
        <span className="text-[13px] font-semibold" data-tauri-drag-region>
          Captura rápida
        </span>
      </header>
      <CaptureInput
        key={session}
        ref={inputRef}
        autoFocus
        className="flex-1 px-5 pb-4"
        onEscape={() => void hideQuickCapture()}
        onSave={async (content) => {
          await capturesRepository.create(content);
          await emitCaptureSaved();
          setTimeout(() => void hideQuickCapture(), HIDE_DELAY_MS);
        }}
      />
    </div>
  );
}
