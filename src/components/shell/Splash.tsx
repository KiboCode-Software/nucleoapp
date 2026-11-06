import { ActivityIndicator } from "@/components/ui/ActivityIndicator";
import { cn } from "@/utils/cn";
import { AppIcon } from "./AppIcon";
import { KiboCodeLogo } from "./KiboCodeLogo";
import { GlassBackdrop } from "./GlassBackdrop";
import { useVocab } from "@/modes/vocabulary";

/**
 * Pantalla de inicio: icono, nombre y el indicador de actividad de iOS sobre el
 * fondo de cristal. `leaving` lanza la animación de salida (zoom y desvanecido).
 */
export function Splash({ leaving }: { leaving: boolean }) {
  const { tagline } = useVocab();
  return (
    <div
      className={cn("fixed inset-0 z-[100] grid place-items-center", leaving && "animate-launch pointer-events-none")}
      aria-busy={!leaving}
    >
      <GlassBackdrop />
      <div className="animate-rise relative flex flex-col items-center gap-5">
        <AppIcon size={104} />
        <div className="text-center">
          <p className="text-[28px] font-bold tracking-[-0.03em]">Núcleo</p>
          <p className="mt-1 text-[14px] text-ink-muted">{tagline}</p>
        </div>
        <ActivityIndicator size={26} className="mt-6" label="Cargando Núcleo" />
      </div>
      {/* Firma al pie, como el «from Meta» de las apps de Meta. */}
      <p className="animate-rise absolute bottom-10 flex flex-col items-center gap-1.5 text-[12px] text-ink-muted">
        de
        <KiboCodeLogo size={22} className="text-[16px] text-ink" />
      </p>
    </div>
  );
}
