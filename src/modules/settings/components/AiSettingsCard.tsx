import { RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/fields";
import { Switch } from "@/components/ui/Switch";
import { getOllamaStatus, OLLAMA_DOWNLOAD_URL, type OllamaStatus } from "@/services/ai";
import { useSettingsStore } from "@/stores/settings.store";

async function openDownloadPage() {
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(OLLAMA_DOWNLOAD_URL);
}

export function AiSettingsCard() {
  const ai = useSettingsStore((s) => s.settings.ai);
  const patch = useSettingsStore((s) => s.patch);
  const [status, setStatus] = useState<OllamaStatus | null>(null);

  const check = useCallback(async () => {
    setStatus(null);
    const result: OllamaStatus = await getOllamaStatus().catch(() => ({ running: false, models: [] }));
    setStatus(result);
    // Si no hay modelo elegido (o ya no existe), se toma el primero disponible.
    const current = useSettingsStore.getState().settings.ai.model;
    if (result.models.length && (!current || !result.models.includes(current))) {
      void patch("ai", { model: result.models[0] });
    }
  }, [patch]);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <Card
      title="IA local (opcional)"
      action={
        <button
          type="button"
          onClick={() => void check()}
          aria-label="Comprobar Ollama"
          title="Comprobar de nuevo"
          className="grid size-7 place-items-center rounded-lg text-ink-muted hover:bg-fill hover:text-ink"
        >
          <RefreshCw className="size-3.5" />
        </button>
      }
    >
      <p className="mb-4 text-[12.5px] text-ink-muted">
        Redacta el resumen de los reportes con un modelo de Ollama que corre en tu equipo. Solo se conecta a 127.0.0.1: tus registros
        no salen de tu computador. Sin IA, los reportes se generan igual con plantillas.
      </p>

      {!status ? (
        <p className="text-[13px] text-ink-muted">Buscando Ollama…</p>
      ) : !status.running ? (
        <div className="flex flex-col items-start gap-3 text-[13px]">
          <p>No se detectó Ollama en este equipo.</p>
          <ol className="list-decimal space-y-1 pl-5 text-ink-muted">
            <li>Instálalo desde ollama.com.</li>
            <li>
              Descarga un modelo, por ejemplo: <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[12px] text-ink">ollama pull llama3.2</code>
            </li>
            <li>Vuelve aquí y pulsa el botón de comprobar.</li>
          </ol>
          <Button variant="secondary" onClick={() => void openDownloadPage()}>
            Descargar Ollama
          </Button>
        </div>
      ) : status.models.length === 0 ? (
        <p className="text-[13px]">
          Ollama está en marcha, pero no tiene modelos. Ejecuta{" "}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[12px]">ollama pull llama3.2</code> y vuelve a comprobar.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-line">
          <div className="flex items-center justify-between gap-6 pb-3.5">
            <div>
              <p className="flex items-center gap-1.5 text-[14px] font-medium">
                <Sparkles className="size-3.5 text-accent" /> Resumen con IA en Reportes
              </p>
              <p className="text-[12.5px] text-ink-muted">Ollama detectado · {status.models.length} {status.models.length === 1 ? "modelo" : "modelos"}</p>
            </div>
            <Switch label="Usar IA local en los reportes" checked={ai.enabled} onChange={(enabled) => void patch("ai", { enabled })} />
          </div>
          <div className="flex items-center justify-between gap-6 pt-3.5">
            <p className="text-[14px] font-medium">Modelo</p>
            <select
              aria-label="Modelo de Ollama"
              value={ai.model ?? ""}
              onChange={(e) => void patch("ai", { model: e.target.value })}
              className={fieldClass + " max-w-56"}
            >
              {status.models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </Card>
  );
}
