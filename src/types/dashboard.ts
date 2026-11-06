import { z } from "zod";

/** Paneles del Resumen. Añadir uno nuevo aquí lo incorpora a los diseños guardados. */
export const PANEL_IDS = ["stats", "deadlines", "checkin", "blockers", "week", "recent", "quick-links"] as const;
export type PanelId = (typeof PANEL_IDS)[number];

export type PanelWidth = "full" | "half";

export const PANEL_VARIANTS = ["card", "outline", "soft", "plain"] as const;
export type PanelVariant = (typeof PANEL_VARIANTS)[number];

export const panelStyleSchema = z.object({
  /** card: superficie con sombra · outline: solo borde · soft: fondo teñido · plain: sin marco. */
  variant: z.enum(PANEL_VARIANTS),
  /** Color de acento (hex) o null para usar el acento de la app. */
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  density: z.enum(["normal", "compact"]),
  /** Disposición del contenido ("list", "tiles", "buttons"…); null = la del panel por defecto. */
  layout: z.string().max(20).nullable().default(null),
  /** Elementos visibles y su orden (paneles con elementos fijos); null = los de por defecto. */
  items: z.array(z.string().max(30)).max(20).nullable().default(null),
});

export type PanelStyle = z.infer<typeof panelStyleSchema>;

export const DEFAULT_PANEL_STYLE: PanelStyle = { variant: "card", color: null, density: "normal", layout: null, items: null };

/** Disposición genérica del contenido de un panel. */
export type CollectionLayout = "list" | "tiles" | "buttons";

/**
 * Elementos visibles en orden: los guardados que sigan existiendo o, si no hay,
 * los de por defecto.
 */
export function resolveItems<T extends { id: string }>(all: T[], saved: string[] | null, defaults: string[]): T[] {
  const ids = saved ?? defaults;
  return ids.map((id) => all.find((item) => item.id === id)).filter((item): item is T => Boolean(item));
}

export const panelLayoutSchema = z.object({
  id: z.enum(PANEL_IDS),
  visible: z.boolean(),
  width: z.enum(["full", "half"]),
  // Los diseños guardados antes de existir los estilos no lo traen.
  style: panelStyleSchema.default(DEFAULT_PANEL_STYLE),
});

export type PanelLayout = z.infer<typeof panelLayoutSchema>;

const panel = (id: PanelId, visible: boolean, width: PanelWidth): PanelLayout => ({ id, visible, width, style: DEFAULT_PANEL_STYLE });

export const DEFAULT_DASHBOARD: PanelLayout[] = [
  panel("stats", true, "full"),
  // Solo existe en modo estudiante; en modo dev no se muestra aunque esté aquí.
  panel("deadlines", true, "full"),
  panel("checkin", true, "half"),
  panel("blockers", true, "half"),
  panel("week", true, "full"),
  panel("recent", true, "full"),
  // Duplica la barra lateral: disponible, pero oculto de inicio.
  panel("quick-links", false, "half"),
];

/**
 * Diseño válido a partir de uno guardado: descarta paneles desconocidos o
 * repetidos y añade al final (ocultos) los que falten, p. ej. paneles nuevos.
 */
export function normalizeDashboard(panels: PanelLayout[]): PanelLayout[] {
  const seen = new Set<PanelId>();
  const kept = panels.filter((p) => !seen.has(p.id) && seen.add(p.id));
  const missing = DEFAULT_DASHBOARD.filter((p) => !seen.has(p.id)).map((p) => ({ ...p, visible: false }));
  return [...kept, ...missing];
}

/**
 * Diseño para un modo: los paneles que no existen en él pasan al final, ocultos,
 * para que no ocupen hueco ni cuenten al reordenar.
 */
export function layoutForMode(panels: PanelLayout[], available: (id: PanelId) => boolean): PanelLayout[] {
  const kept = panels.filter((p) => available(p.id));
  const rest = panels.filter((p) => !available(p.id)).map((p) => ({ ...p, visible: false }));
  return [...kept, ...rest];
}

/** Mueve `id` para que quede en la posición que ocupa `targetId`. */
export function movePanelTo(panels: PanelLayout[], id: PanelId, targetId: PanelId): PanelLayout[] {
  const from = panels.findIndex((p) => p.id === id);
  const to = panels.findIndex((p) => p.id === targetId);
  if (from < 0 || to < 0 || from === to) return panels;
  const next = [...panels];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Mueve `id` una posición entre los paneles visibles (-1 arriba, +1 abajo). */
export function movePanelBy(panels: PanelLayout[], id: PanelId, delta: -1 | 1): PanelLayout[] {
  const visible = panels.filter((p) => p.visible);
  const index = visible.findIndex((p) => p.id === id);
  const neighbour = visible[index + delta];
  return neighbour ? movePanelTo(panels, id, neighbour.id) : panels;
}

/** Aplica un nuevo orden a los paneles visibles; los ocultos quedan al final, en su orden. */
export function reorderVisible(panels: PanelLayout[], visibleIds: PanelId[]): PanelLayout[] {
  const visible = visibleIds.map((id) => panels.find((p) => p.id === id && p.visible)).filter((p): p is PanelLayout => Boolean(p));
  const rest = panels.filter((p) => !visible.includes(p));
  return [...visible, ...rest];
}

export function updatePanel(panels: PanelLayout[], id: PanelId, changes: Partial<Omit<PanelLayout, "id">>): PanelLayout[] {
  return panels.map((p) => (p.id === id ? { ...p, ...changes } : p));
}
