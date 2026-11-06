import "@fontsource-variable/archivo/standard.css";
import mark from "@/assets/kibocode-mark.svg";
import { cn } from "@/utils/cn";

/**
 * Marca de KiboCode tal como la usa su web (KiboCode-Software/kibocode-platform):
 * isotipo violeta + «KiboCode» en Archivo ensanchada, con el punto final en violeta.
 */
export function KiboCodeLogo({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <img src={mark} alt="" width={size} height={size} className="shrink-0" />
      <span className="font-semibold tracking-[-0.01em]" style={{ fontFamily: "'Archivo Variable', sans-serif", fontStretch: "112%" }}>
        KiboCode<span className="text-[#A855F7]">.</span>
      </span>
    </span>
  );
}
