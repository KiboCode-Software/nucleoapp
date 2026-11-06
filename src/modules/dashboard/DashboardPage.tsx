import { Check, Eye, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ensureBlockersLoaded } from "@/stores/blockers.store";
import { ensureDailyLogsLoaded } from "@/stores/daily-logs.store";
import { ensureSettingsLoaded, useSettingsStore } from "@/stores/settings.store";
import { DEFAULT_DASHBOARD, layoutForMode, updatePanel, type PanelLayout } from "@/types/dashboard";
import { formatLongDate, greetingFor } from "@/utils/date";
import { PanelGrid } from "./components/PanelGrid";
import { PANELS, usePanelAvailable } from "./panels";
import { useTr } from "@/modes/vocabulary";

export function DashboardPage() {
  const tr = useTr();
  const available = usePanelAvailable();
  const now = new Date();
  const status = useSettingsStore((s) => s.status);
  const saved = useSettingsStore((s) => s.settings.dashboard);
  const update = useSettingsStore((s) => s.update);
  const [editing, setEditing] = useState(false);
  // Fuera de la app de escritorio no hay dónde guardar: los cambios viven en memoria.
  const [local, setLocal] = useState<PanelLayout[] | null>(null);

  useEffect(() => {
    ensureDailyLogsLoaded();
    ensureBlockersLoaded();
  }, []);

  // Depende de `status` (no solo del montaje): si el store vuelve a "idle" —p. ej. tras
  // una recarga en caliente— se vuelve a pedir, en vez de quedarse esperando para siempre.
  useEffect(() => {
    if (status === "idle") void ensureSettingsLoaded();
  }, [status]);

  // Sin base de datos (navegador) o si falló la lectura, el diseño vive en memoria.
  const persistent = status === "ready";
  const layout = layoutForMode(persistent ? saved : (local ?? DEFAULT_DASHBOARD), available);
  const setLayout = (next: PanelLayout[]) => (persistent ? void update("dashboard", next).catch(console.error) : setLocal(next));

  // Solo mientras se lee el diseño guardado (milisegundos), para que no parpadee el de por defecto.
  if (status === "idle" || status === "loading") return <PageHeader title={greetingFor(now)} subtitle={formatLongDate(now)} />;

  const visible = layout.filter((p) => p.visible && available(p.id));
  const hidden = layout.filter((p) => !p.visible && available(p.id));

  return (
    <>
      <PageHeader
        title={greetingFor(now)}
        subtitle={formatLongDate(now)}
        actions={
          editing ? (
            <>
              <Button variant="ghost" onClick={() => setLayout(DEFAULT_DASHBOARD)}>
                <RotateCcw className="size-4" /> Restablecer
              </Button>
              <Button onClick={() => setEditing(false)}>
                <Check className="size-4" /> Listo
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <SlidersHorizontal className="size-4" /> Personalizar
            </Button>
          )
        }
      />

      {editing && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-[13px] text-ink-muted">
            Arrastra los paneles con el ratón para ordenarlos (o usa las flechas). Cambia su ancho u ocúltalos; los cambios se guardan solos.
          </p>
          {hidden.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" aria-label="Paneles ocultos">
              <span className="text-[12.5px] font-medium text-ink-muted">Ocultos:</span>
              {hidden.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  onClick={() => setLayout(updatePanel(layout, panel.id, { visible: true }))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-line/60 px-3 py-1 text-[12.5px] font-medium hover:bg-accent-soft hover:text-accent"
                >
                  <Eye className="size-3.5" /> Mostrar {tr(PANELS[panel.id].title)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-ink-muted">
          Ocultaste todos los paneles. Pulsa «Personalizar» para mostrar alguno.
        </p>
      ) : (
        <PanelGrid layout={layout} editing={editing} onChange={setLayout} />
      )}
    </>
  );
}
