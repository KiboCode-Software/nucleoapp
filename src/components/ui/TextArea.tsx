import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  /** La etiqueta solo para lectores de pantalla (cuando un título ya la muestra). */
  hideLabel?: boolean;
}

/** Área de texto con etiqueta que crece con su contenido. */
export function TextArea({ label, hint, hideLabel, id, className, value, ...rest }: TextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-[13.5px] font-medium"}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        value={value}
        rows={2}
        className={cn(
          "min-h-[72px] w-full resize-none overflow-hidden rounded-xl border border-transparent bg-fill px-3.5 py-2.5 text-[14px] leading-relaxed placeholder:text-ink-muted transition-[background-color,box-shadow,border-color] duration-200 focus:border-accent/50 focus:bg-surface focus:shadow-[0_0_0_3.5px_var(--accent-soft)] focus:outline-none",
          className,
        )}
        {...rest}
      />
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
