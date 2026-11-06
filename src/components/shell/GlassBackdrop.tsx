import { cn } from "@/utils/cn";

/**
 * Fondo para el cristal esmerilado: manchas de color muy difuminadas que se mueven
 * despacio. Encima, cualquier superficie con la clase `glass` se ve translúcida.
 */
export function GlassBackdrop({ className }: { className?: string }) {
  const blob = "animate-float absolute rounded-full blur-[90px] opacity-70 dark:opacity-45";
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-canvas", className)}>
      <div className={cn(blob, "-top-[10%] -left-[5%] size-[55vmax] bg-[#007AFF]")} />
      <div className={cn(blob, "top-[20%] -right-[15%] size-[50vmax] bg-[#AF52DE]")} style={{ animationDelay: "-6s" }} />
      <div className={cn(blob, "-bottom-[25%] left-[20%] size-[45vmax] bg-[#FF9500]")} style={{ animationDelay: "-12s" }} />
      <div className={cn(blob, "bottom-[5%] -left-[15%] size-[30vmax] bg-[#34C759] opacity-40")} style={{ animationDelay: "-3s" }} />
      {/* Velo que suaviza los colores para que el texto se lea bien. */}
      <div className="absolute inset-0 bg-canvas/35" />
    </div>
  );
}
