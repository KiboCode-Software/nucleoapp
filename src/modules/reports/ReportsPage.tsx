import { Database, FileX, Monitor, Plus, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDelete } from "@/components/shared/ConfirmDelete";
import { MarkdownView } from "@/components/shared/MarkdownView";
import { PeriodStatsPanel } from "@/components/shared/PeriodStatsPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { isTauri } from "@/database/client";
import { reportsRepository, type PeriodData, type SavedReport } from "@/database/repositories/reports.repository";
import { useModule } from "@/modules/registry";
import { ensureSettingsLoaded, useSettingsStore } from "@/stores/settings.store";
import { replaceSummary, summarizeWithLocalAi } from "@/services/ai";
import { exportAllData } from "@/services/data-export";
import { exportFile, type ExportFormat } from "@/services/export";
import { periodContaining, reportFileName, type PeriodRange } from "@/services/reports/period";
import { buildReportCsv } from "@/services/reports/csv";
import { buildReportJson, generateMarkdown } from "@/services/reports/template";
import { computePeriodStats } from "@/services/stats";
import { cn } from "@/utils/cn";
import { ExportButtons } from "./components/ExportButtons";
import { PeriodPicker } from "./components/PeriodPicker";
import { SavedReportsList } from "./components/SavedReportsList";
import { useVocab } from "@/modes/vocabulary";

interface Draft {
  range: PeriodRange;
  data: PeriodData;
  generated: string;
}

const toRange = (r: SavedReport): PeriodRange => ({ period: r.period, start: r.period_start, end: r.period_end });

export function ReportsPage() {
  const v = useVocab();
  const { label, description } = useModule("reports");
  const { reportId } = useParams();
  const navigate = useNavigate();
  const available = isTauri();

  const [range, setRange] = useState(() => periodContaining("daily", new Date()));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [saved, setSaved] = useState<SavedReport[] | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // Texto del resumen redactado por la IA local, si se usó (para guardar el reporte como 'local_ai').
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const ai = useSettingsStore((s) => s.settings.ai);
  const aiReady = ai.enabled && Boolean(ai.model);

  useEffect(() => {
    void ensureSettingsLoaded();
  }, []);

  useEffect(() => {
    if (!available) return;
    reportsRepository.list().then(setSaved, (error: unknown) => {
      console.error("No se pudieron cargar los reportes", error);
      setSaved([]);
    });
  }, [available]);

  // Regenera la vista previa cada vez que cambia el periodo (descarta ediciones).
  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    reportsRepository.collectPeriod(range).then((data) => {
      if (cancelled) return;
      const generated = generateMarkdown(range, data, new Date(), v);
      setDraft({ range, data, generated });
      setText(generated);
      setAiSummary(null);
      setMode("preview");
    }, console.error);
    return () => {
      cancelled = true;
    };
  }, [available, range]);

  const selected = reportId ? (saved?.find((r) => r.id === Number(reportId)) ?? null) : null;
  const draftStats = useMemo(() => (draft ? computePeriodStats(draft.range, draft.data) : null), [draft]);

  async function runExport(format: ExportFormat, reportRange: PeriodRange, markdown: string, data?: PeriodData) {
    setNotice(null);
    try {
      let contents = markdown;
      if (format !== "markdown") {
        const periodData = data ?? (await reportsRepository.collectPeriod(reportRange));
        contents =
          format === "csv" ? buildReportCsv(periodData, v) : JSON.stringify(buildReportJson(reportRange, periodData, markdown, new Date(), v), null, 2);
      }
      const path = await exportFile(reportFileName(reportRange), contents, format);
      if (path) setNotice({ tone: "ok", text: `Exportado: ${path}` });
    } catch (error) {
      console.error(error);
      setNotice({ tone: "error", text: "No se pudo exportar el reporte." });
    }
  }

  /** PDF mediante el diálogo de impresión del sistema ("Guardar como PDF" / "Microsoft Print to PDF"). */
  function printReport() {
    setNotice(null);
    setMode("preview");
    // Espera a que la vista previa sustituya al editor antes de imprimir.
    requestAnimationFrame(() => setTimeout(() => window.print(), 50));
  }

  async function exportAll() {
    setNotice(null);
    try {
      const path = await exportAllData();
      if (path) setNotice({ tone: "ok", text: `Datos exportados: ${path}` });
    } catch (error) {
      console.error(error);
      setNotice({ tone: "error", text: "No se pudieron exportar los datos." });
    }
  }

  async function summarizeWithAi() {
    if (!ai.model) return;
    setAiBusy(true);
    setNotice(null);
    try {
      const summary = await summarizeWithLocalAi(ai.model, text, v.mode);
      setText((current) => replaceSummary(current, summary));
      setAiSummary(summary);
      setNotice({ tone: "ok", text: `Resumen redactado con IA local (${ai.model}). Revísalo antes de compartirlo.` });
    } catch (error) {
      console.error(error);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "La IA local no pudo generar el resumen." });
    } finally {
      setAiBusy(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    // Solo cuenta como 'local_ai' si el resumen del modelo sigue en el texto.
    const generator = aiSummary && text.includes(aiSummary) ? "local_ai" : "template";
    const report = await reportsRepository.save(draft.range, text, draft.data.logs.map((l) => l.id), generator);
    setSaved((list) => [report, ...(list ?? [])]);
    setNotice({ tone: "ok", text: v.mode === "student" ? "Resumen guardado." : "Reporte guardado." });
    navigate(`/reports/${report.id}`);
  }

  const header = (
    <PageHeader
      title={label}
      subtitle={description}
      actions={
        available && (
          <Button variant="secondary" onClick={() => void exportAll()}>
            <Database className="size-4" /> Exportar todos los datos
          </Button>
        )
      }
    />
  );

  if (!available) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={Monitor}
            title="Disponible en la app de escritorio"
            description="Los reportes se generan a partir de tu base SQLite local. Abre la app con npm run tauri dev."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr] print:block">
        <aside className="flex flex-col gap-6 lg:sticky lg:top-6 print:hidden">
          {reportId ? (
            <Button variant="secondary" onClick={() => navigate("/reports")}>
              <Plus className="size-4" /> Nuevo reporte
            </Button>
          ) : (
            <PeriodPicker range={range} onChange={setRange} />
          )}
          <SavedReportsList reports={saved ?? []} selectedId={selected?.id ?? null} />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
        {!reportId && draftStats && (
          <Card title="Estadísticas del periodo" className="print:hidden">
            <PeriodStatsPanel stats={draftStats} />
          </Card>
        )}

        <Card className="print:border-0 print:p-0 print:shadow-none">
          <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-line pb-4 print:hidden">
            {reportId ? (
              selected && (
                <>
                  <ExportButtons
                    onExport={(format) => void runExport(format, toRange(selected), selected.content)}
                    onPdf={printReport}
                  />
                  <div className="ml-auto">
                    <ConfirmDelete
                      label="Eliminar reporte"
                      question="¿Eliminar este reporte?"
                      onConfirm={async () => {
                        await reportsRepository.remove(selected.id);
                        setSaved((list) => (list ?? []).filter((r) => r.id !== selected.id));
                        navigate("/reports", { replace: true });
                      }}
                    />
                  </div>
                </>
              )
            ) : (
              <>
                <div className="w-48">
                  <SegmentedControl
                    label="Modo"
                    value={mode}
                    onChange={setMode}
                    segments={[
                      { value: "preview", label: "Vista previa" },
                      { value: "edit", label: "Editar" },
                    ]}
                  />
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <ExportButtons
                    onExport={(format) => draft && void runExport(format, draft.range, text, draft.data)}
                    onPdf={printReport}
                  />
                  {aiReady && (
                    <Button variant="secondary" onClick={() => void summarizeWithAi()} disabled={!draft || aiBusy} className="px-3">
                      <Sparkles className="size-4" /> {aiBusy ? "Redactando…" : "Resumen con IA"}
                    </Button>
                  )}
                  <Button onClick={() => void saveDraft()} disabled={!draft}>
                    <Save className="size-4" /> Guardar
                  </Button>
                </div>
              </>
            )}
          </div>

          {notice && (
            <p role="status" className={cn("mb-4 text-[13px] print:hidden", notice.tone === "ok" ? "text-success" : "text-danger")}>
              {notice.text}
            </p>
          )}

          {reportId ? (
            selected ? (
              <MarkdownView source={selected.content} />
            ) : (
              saved && <EmptyState icon={FileX} title="Este reporte ya no existe" />
            )
          ) : mode === "edit" ? (
            <textarea
              aria-label="Contenido del reporte"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck
              className="min-h-[480px] w-full resize-y rounded-xl border border-line bg-surface-muted p-4 font-mono text-[13px] leading-relaxed focus:border-accent focus:outline-none"
            />
          ) : (
            draft && <MarkdownView source={text} />
          )}

          {!reportId && draft && text !== draft.generated && (
            <p className="mt-4 text-[12.5px] text-ink-muted print:hidden">
              Editaste el texto generado.{" "}
              <button type="button" onClick={() => setText(draft.generated)} className="font-medium text-accent hover:underline">
                Restaurar
              </button>
            </p>
          )}
        </Card>
        </div>
      </div>
    </>
  );
}
