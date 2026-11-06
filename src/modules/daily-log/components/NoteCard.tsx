import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TextArea } from "@/components/ui/TextArea";
import type { SaveState } from "../useDayLog";
import { MomentCard, type Moment } from "./MomentCard";

const AUTOSAVE_MS = 800;

interface NoteCardProps {
  moment: Moment;
  icon: LucideIcon;
  title: string;
  question: string;
  placeholder: string;
  value: string;
  current: boolean;
  saveState?: SaveState;
  onSave: (value: string) => void;
  /** Contenido extra bajo el texto (enlaces al módulo correspondiente, listas…). */
  footer?: ReactNode;
}

/** Tarjeta de texto libre que se guarda sola al dejar de escribir o al salir del campo. */
export function NoteCard({ moment, icon, title, question, placeholder, value, current, saveState, onSave, footer }: NoteCardProps) {
  const [draft, setDraft] = useState(value);
  const lastSaved = useRef(value);
  const timer = useRef<number | undefined>(undefined);

  // Si el valor cambia desde fuera (otro día, otra ventana), se refleja aquí.
  useEffect(() => {
    if (value !== lastSaved.current) {
      lastSaved.current = value;
      setDraft(value);
    }
  }, [value]);

  const flush = (text: string) => {
    window.clearTimeout(timer.current);
    if (text === lastSaved.current) return;
    lastSaved.current = text;
    onSave(text);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <MomentCard moment={moment} icon={icon} title={title} question={question} current={current} saveState={saveState}>
      <TextArea
        id={`note-${moment}`}
        label={title}
        hideLabel
        className="min-h-[110px]"
        placeholder={placeholder}
        value={draft}
        maxLength={5000}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => flush(text), AUTOSAVE_MS);
        }}
        onBlur={() => flush(draft)}
      />
      {footer}
    </MomentCard>
  );
}
