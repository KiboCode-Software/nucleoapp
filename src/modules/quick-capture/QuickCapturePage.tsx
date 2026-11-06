import { CircleAlert, Inbox, Lightbulb, Monitor, NotebookPen, PanelTop, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Capture, CaptureTarget } from "@/database/repositories/captures.repository";
import { useNow } from "@/hooks/useNow";
import { useModule } from "@/modules/registry";
import { QUICK_CAPTURE_SHORTCUT, showQuickCapture } from "@/services/quick-capture";
import { useBlockersStore } from "@/stores/blockers.store";
import { ensureCapturesLoaded, useCapturesStore } from "@/stores/captures.store";
import { ensureDailyLogsLoaded, useDailyLogsStore } from "@/stores/daily-logs.store";
import { useLearningsStore } from "@/stores/learnings.store";
import { elapsedBetween, toISODate } from "@/utils/date";
import { parseTasks, serializeTasks } from "@/modules/daily-log/tasks";
import { CaptureInput } from "./components/CaptureInput";
import { useVocab } from "@/modes/vocabulary";

/** Primera línea como título (máx. 140) y el resto como detalle. */
function split(content: string) {
  const [title, ...rest] = content.trim().split("\n");
  return { title: title.slice(0, 140), rest: rest.join("\n").trim() };
}

function ActionButton({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-fill hover:text-ink"
    >
      {icon}
      {children}
    </button>
  );
}

export function QuickCapturePage() {
  const v = useVocab();
  const { label, description } = useModule("quick-capture");
  const now = useNow();
  const { pending, status, add, process } = useCapturesStore();
  const createBlocker = useBlockersStore((s) => s.create);
  const saveLearning = useLearningsStore((s) => s.save);
  const saveLog = useDailyLogsStore((s) => s.save);
  const [notice, setNotice] = useState<{ text: string; to: string } | null>(null);

  useEffect(() => {
    ensureCapturesLoaded();
    ensureDailyLogsLoaded();
  }, []);

  async function convert(capture: Capture, target: CaptureTarget) {
    const { title, rest } = split(capture.content);
    let result: { text: string; to: string } | null = null;

    if (target === "blocker") {
      const blocker = await createBlocker({ title, description: rest });
      result = { text: `Convertido en ${v.blocker.one}.`, to: `/blockers/${blocker.id}` };
    } else if (target === "learning") {
      const learning = await saveLearning({ kind: "note", title, content: rest });
      result = { text: `Guardado en ${v.modules.learning.label}.`, to: `/learning/${learning.id}` };
    } else if (target === "daily_log") {
      // Se añade a "¿Qué haré hoy?" del check-in de hoy (o crea uno).
      const today = toISODate(new Date());
      const log = useDailyLogsStore.getState().logs.find((l) => l.log_date === today);
      // Cada línea de la captura es una tarea pendiente del plan de hoy.
      const plan = serializeTasks([...parseTasks(log?.today ?? ""), ...parseTasks(capture.content).map((t) => ({ ...t, done: false }))]);
      await saveLog(
        log
          ? { ...log, today: plan }
          : { project_id: null, log_date: today, yesterday: "", today: plan, blockers_note: "", learnings: "" },
        log?.id,
      );
      result = { text: "Añadido al plan de hoy.", to: "/daily-log" };
    }

    await process(capture.id, target);
    setNotice(result);
  }

  const header = (
    <PageHeader
      title={label}
      subtitle={description}
      actions={
        status === "ready" && (
          <Button variant="secondary" onClick={() => void showQuickCapture()}>
            <PanelTop className="size-4" /> Abrir ventana flotante
          </Button>
        )
      }
    />
  );

  if (status === "unavailable" || status === "error") {
    return (
      <>
        {header}
        <Card>
          {status === "unavailable" ? (
            <EmptyState
              icon={Monitor}
              title="Disponible en la app de escritorio"
              description="La captura rápida usa un atajo global y SQLite local. Abre la app con npm run tauri dev."
            />
          ) : (
            <p className="text-[14px] text-danger">No se pudo cargar la bandeja.</p>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      {header}

      <Card className="mb-6">
        <CaptureInput className="min-h-24" onSave={async (content) => void (await add(content))} />
      </Card>

      <p className="mb-6 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-muted">
        Desde cualquier aplicación:
        {QUICK_CAPTURE_SHORTCUT.map((key) => (
          <kbd key={key} className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-[12px] font-medium text-ink shadow-card">
            {key}
          </kbd>
        ))}
      </p>

      {notice && (
        <p role="status" className="mb-4 text-[13px] text-success">
          {notice.text}{" "}
          <Link to={notice.to} className="font-medium text-accent hover:underline">
            Ver
          </Link>
        </p>
      )}

      <Card title={`Bandeja${pending.length ? ` · ${pending.length}` : ""}`}>
        {pending.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Bandeja vacía"
            description={`Lo que captures aparecerá aquí para clasificarlo: ${v.blocker.one}, ${v.learning.one} o ${v.day.planTitle.toLowerCase()}.`}
          />
        ) : (
          <ul aria-label="Bandeja de capturas" className="flex flex-col divide-y divide-line">
            {pending.map((capture) => (
              <li key={capture.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{capture.content}</p>
                  <span className="shrink-0 text-xs text-ink-muted">hace {elapsedBetween(capture.created_at, null, now)}</span>
                </div>
                <div className="-ml-2.5 flex flex-wrap items-center gap-0.5" aria-label="Clasificar">
                  <ActionButton onClick={() => void convert(capture, "daily_log")} icon={<NotebookPen className="size-3.5" />}>
                    Al plan de hoy
                  </ActionButton>
                  <ActionButton onClick={() => void convert(capture, "blocker")} icon={<CircleAlert className="size-3.5" />}>
                    {v.blocker.badge}
                  </ActionButton>
                  <ActionButton onClick={() => void convert(capture, "learning")} icon={<Lightbulb className="size-3.5" />}>
                    {v.learning.badge}
                  </ActionButton>
                  <span className="ml-auto">
                    <ActionButton onClick={() => void convert(capture, "discarded")} icon={<X className="size-3.5" />}>
                      Descartar
                    </ActionButton>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
