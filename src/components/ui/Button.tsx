import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Estilos de botón de iOS: relleno del acento (filled), gris con texto del acento
 * (bordered/tinted) y solo texto (plain).
 */
const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:brightness-110",
  danger: "bg-danger text-white hover:brightness-110",
  secondary: "bg-fill text-accent hover:bg-accent-soft",
  ghost: "text-accent hover:bg-accent-soft",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "pressable inline-flex h-9 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold tracking-[-0.01em] disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
