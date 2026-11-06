import { createContext, useContext, type CSSProperties } from "react";
import type { PanelStyle } from "@/types/dashboard";

/**
 * Estilo del panel del Resumen que envuelve a una tarjeta. Fuera del Resumen no
 * hay proveedor y las tarjetas usan su aspecto normal.
 */
export const PanelStyleContext = createContext<PanelStyle | null>(null);

export const usePanelStyle = () => useContext(PanelStyleContext);

/** Color de acento del panel (o el de la app). */
export const panelColor = (style: PanelStyle | null) => style?.color ?? "var(--accent)";

/** Clases y estilos en línea del fondo/borde de una tarjeta según la apariencia elegida. */
export function surface(style: PanelStyle | null): { className: string; style?: CSSProperties } {
  const color = panelColor(style);
  switch (style?.variant) {
    case "outline":
      return {
        className: "border bg-transparent",
        style: { borderColor: style.color ? `color-mix(in srgb, ${color} 45%, transparent)` : "var(--line)" },
      };
    case "soft":
      return {
        className: "border",
        style: {
          backgroundColor: `color-mix(in srgb, ${color} 9%, var(--surface))`,
          borderColor: `color-mix(in srgb, ${color} 20%, transparent)`,
        },
      };
    case "plain":
      return { className: "border border-transparent bg-transparent" };
    default:
      return { className: "border border-line bg-surface shadow-card" };
  }
}
