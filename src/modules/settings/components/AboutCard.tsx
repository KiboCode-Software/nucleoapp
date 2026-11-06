import { ArrowUpRight } from "lucide-react";
import { AppIcon } from "@/components/shell/AppIcon";
import { KiboCodeLogo } from "@/components/shell/KiboCodeLogo";
import { Card } from "@/components/ui/Card";
import { BRAND, openExternal } from "@/brand";

/** Acerca de: versión, web de descarga y la firma de KiboCode. */
export function AboutCard() {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <AppIcon size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold tracking-[-0.02em]">{BRAND.app}</p>
          <p className="text-[13px] text-ink-muted">Versión {BRAND.version}</p>
        </div>
        <button
          type="button"
          onClick={() => void openExternal(BRAND.website)}
          className="pressable inline-flex items-center gap-1 rounded-full bg-fill px-3 py-1.5 text-[13px] font-medium text-accent"
        >
          Sitio web <ArrowUpRight className="size-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => void openExternal(BRAND.maker.url)}
        aria-label={`Diseñado por ${BRAND.maker.name}: abrir ${BRAND.maker.url}`}
        className="pressable mt-4 flex w-full items-center gap-3 rounded-2xl bg-fill/60 px-3.5 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-ink-muted">Diseñado y desarrollado por</span>
          <KiboCodeLogo size={26} className="mt-0.5 text-[18px]" />
        </span>
        <span className="text-[12.5px] text-ink-muted">{new URL(BRAND.maker.url).host}</span>
      </button>
    </Card>
  );
}
