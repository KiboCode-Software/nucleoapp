import { Check } from "lucide-react";
import { forwardRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/utils/cn";

interface CaptureInputProps {
  onSave: (content: string) => Promise<void>;
  onEscape?: () => void;
  autoFocus?: boolean;
  className?: string;
}

/** Campo de captura: Enter guarda, Shift+Enter añade una línea, Esc cierra. */
export const CaptureInput = forwardRef<HTMLTextAreaElement, CaptureInputProps>(function CaptureInput(
  { onSave, onEscape, autoFocus, className },
  ref,
) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    if (!text.trim() || status === "saving") return;
    setStatus("saving");
    try {
      await onSave(text);
      setText("");
      setStatus("saved");
    } catch (error) {
      console.error("No se pudo guardar la captura", error);
      setStatus("error");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onEscape?.();
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <textarea
        ref={ref}
        value={text}
        autoFocus={autoFocus}
        maxLength={5000}
        aria-label="Nueva captura"
        placeholder="¿Qué tienes en mente? Una idea, una tarea, algo que aprendiste…"
        onChange={(e) => {
          setText(e.target.value);
          if (status !== "saving") setStatus("idle");
        }}
        onKeyDown={onKeyDown}
        className="min-h-0 w-full flex-1 resize-none bg-transparent text-[16px] leading-relaxed placeholder:text-ink-muted/70 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3 text-[12px] text-ink-muted">
        <span>
          <kbd className="font-sans font-medium text-ink">Enter</kbd> guarda · <kbd className="font-sans font-medium text-ink">Shift+Enter</kbd> nueva
          línea{onEscape && <> · <kbd className="font-sans font-medium text-ink">Esc</kbd> cierra</>}
        </span>
        <span role="status">
          {status === "saved" && (
            <span className="inline-flex items-center gap-1 font-medium text-success">
              <Check className="size-3.5" /> Guardado en la bandeja
            </span>
          )}
          {status === "error" && <span className="text-danger">No se pudo guardar</span>}
        </span>
      </div>
    </div>
  );
});
