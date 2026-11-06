import { cn } from "@/utils/cn";

const SPOKES = 12;

/**
 * Indicador de actividad de iOS (UIActivityIndicatorView): doce radios que se
 * iluminan en cadena y dan la sensación de girar.
 */
export function ActivityIndicator({ size = 28, className, label = "Cargando" }: { size?: number; className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("relative inline-block text-ink-muted", className)} style={{ width: size, height: size }}>
      {Array.from({ length: SPOKES }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="animate-spinner absolute top-0 left-1/2 rounded-full bg-current"
          style={{
            width: size * 0.09,
            height: size * 0.28,
            marginLeft: -(size * 0.045),
            transformOrigin: `50% ${size / 2}px`,
            transform: `rotate(${(360 / SPOKES) * i}deg)`,
            // Retrasos negativos: cada radio empieza ya a mitad de su ciclo.
            animationDelay: `${-1 + i / SPOKES}s`,
          }}
        />
      ))}
    </span>
  );
}
