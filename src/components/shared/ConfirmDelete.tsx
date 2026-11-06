import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface ConfirmDeleteProps {
  /** Pregunta de confirmación, p. ej. "¿Eliminar este registro?". */
  question: string;
  /** Nombre accesible del botón inicial (solo icono). */
  label: string;
  onConfirm: () => void | Promise<void>;
}

/** Botón de papelera que pide confirmación en línea antes de eliminar. */
export function ConfirmDelete({ question, label, onConfirm }: ConfirmDeleteProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)} aria-label={label} className="px-2.5">
        <Trash2 className="size-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] text-ink-muted">{question}</span>
      <Button variant="secondary" onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
      <Button variant="danger" onClick={() => void onConfirm()}>
        Eliminar
      </Button>
    </div>
  );
}
