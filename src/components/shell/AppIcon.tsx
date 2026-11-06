import { useId } from "react";
import { cn } from "@/utils/cn";

/**
 * Logo de Núcleo ("Bitácora": libreta con anillas y el símbolo de código).
 * Mismo dibujo que src-tauri/icons/app-icon.svg, de donde salen los iconos de Windows.
 */
export function AppIcon({ size = 96, className, shadow = true }: { size?: number; className?: string; shadow?: boolean }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      role="img"
      aria-label="Núcleo"
      className={cn("shrink-0", shadow && "drop-shadow-[0_10px_28px_rgb(0_98_224/0.35)]", className)}
    >
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4AA8FF" />
          <stop offset="1" stopColor="#0062E0" />
        </linearGradient>
        <linearGradient id={`${id}page`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EEF4FF" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="230" fill={`url(#${id}bg)`} />
      <rect x="300" y="232" width="460" height="600" rx="64" fill="#003C99" opacity="0.28" />
      <rect x="290" y="210" width="460" height="600" rx="64" fill={`url(#${id}page)`} />
      <g fill="#1A86FF">
        <circle cx="290" cy="340" r="34" />
        <circle cx="290" cy="510" r="34" />
        <circle cx="290" cy="680" r="34" />
      </g>
      <g fill="#FFFFFF" opacity="0.9">
        <circle cx="290" cy="340" r="13" />
        <circle cx="290" cy="510" r="13" />
        <circle cx="290" cy="680" r="13" />
      </g>
      <g fill="none" stroke="#1A86FF" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="466,432 390,510 466,588" />
        <line x1="563" y1="420" x2="529" y2="600" />
        <polyline points="626,432 702,510 626,588" />
      </g>
    </svg>
  );
}
