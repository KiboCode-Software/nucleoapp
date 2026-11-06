import { BellRing, Database, FolderOpen, HardDrive, Monitor } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { fieldClass } from "@/components/ui/fields";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { backupsRepository, type BackupRecord } from "@/database/repositories/backups.repository";
import { useModule } from "@/modules/registry";
import { backupService, chooseBackupDir, revealInFolder } from "@/services/backup";
import { QUICK_CAPTURE_SHORTCUT } from "@/services/quick-capture";
import { notify } from "@/services/reminder";
import { useMode } from "@/stores/profile.store";
import { ensureSettingsLoaded, useSettingsStore } from "@/stores/settings.store";
import { useUiStore, type Theme } from "@/stores/ui.store";
import { cn } from "@/utils/cn";
import { AboutCard } from "./components/AboutCard";
import { AiSettingsCard } from "./components/AiSettingsCard";
import { DataSettingsCard } from "./components/DataSettingsCard";
import { DeadlineRemindersCard } from "./components/DeadlineRemindersCard";
import { GitReposCard } from "./components/GitReposCard";
import { ProfilesCard } from "./components/ProfilesCard";
import { SecurityCard } from "./components/SecurityCard";

const KEEP_OPTIONS = [5, 10, 20, 50];

function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[14px] font-medium">{title}</p>
        {description && <p className="text-[12.5px] text-ink-muted">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const dateTime = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

export function SettingsPage() {
  const { label, description } = useModule("settings");
  const mode = useMode();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const { settings, status, patch } = useSettingsStore();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const loadBackups = useCallback(() => backupsRepository.listRecent(5).then(setBackups, console.error), []);

  useEffect(() => {
    void ensureSettingsLoaded();
  }, []);
  useEffect(() => {
    if (status === "ready") void loadBackups();
  }, [status, loadBackups]);

  async function run(action: () => Promise<string | null>, success: (result: string) => string, failure: string) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      if (result) setNotice({ tone: "ok", text: success(result) });
    } catch (error) {
      console.error(error);
      setNotice({ tone: "error", text: error instanceof Error && error.message ? `${failure}: ${error.message}` : failure });
    } finally {
      setBusy(false);
    }
  }

  const header = <PageHeader title={label} subtitle={description} />;

  const appearance = (
    <Card title="Apariencia">
      <Row title="Tema" description="El claro es el predeterminado.">
        <div className="w-44">
          <SegmentedControl<Theme>
            label="Tema"
            value={theme}
            onChange={setTheme}
            segments={[
              { value: "light", label: "Claro" },
              { value: "dark", label: "Oscuro" },
            ]}
          />
        </div>
      </Row>
    </Card>
  );

  if (status === "unavailable") {
    return (
      <>
        {header}
        <div className="flex flex-col gap-6">
          <ProfilesCard />
          <SecurityCard />
          {appearance}
          <Card>
            <EmptyState
              icon={Monitor}
              title="El resto de ajustes está en la app de escritorio"
              description="Recordatorios, respaldos y datos usan funciones nativas. Abre la app con npm run tauri dev."
            />
          </Card>
          <AboutCard />
        </div>
      </>
    );
  }

  if (status !== "ready") return header;

  const { reminder, backup } = settings;

  return (
    <>
      {header}

      {notice && (
        <p role="status" className={cn("mb-4 text-[13px]", notice.tone === "ok" ? "text-success" : "text-danger")}>
          {notice.text}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <ProfilesCard />
          <SecurityCard />
          {appearance}

          <Card title="Recordatorio diario" action={<BellRing className="size-4 text-ink-muted" />}>
            <div className="flex flex-col divide-y divide-line">
              <Row title="Recordarme el check-in" description="De lunes a viernes, si aún no lo has hecho.">
                <Switch
                  label="Recordarme el check-in"
                  checked={reminder.enabled}
                  onChange={(enabled) =>
                    void run(
                      async () => {
                        // Al activarlo se pide el permiso de notificaciones de Windows.
                        if (enabled && !(await notify("Núcleo", "Te recordaré el check-in a la hora elegida."))) {
                          throw new Error("Windows no permitió las notificaciones");
                        }
                        await patch("reminder", { enabled });
                        return enabled ? "Recordatorio activado." : "Recordatorio desactivado.";
                      },
                      (text) => text,
                      "No se pudo cambiar el recordatorio",
                    )
                  }
                />
              </Row>
              <Row title="Hora" description="A partir de esta hora local.">
                <input
                  type="time"
                  aria-label="Hora del recordatorio"
                  value={reminder.time}
                  disabled={!reminder.enabled}
                  onChange={(e) => e.target.value && void patch("reminder", { time: e.target.value })}
                  className={fieldClass + " w-28 disabled:opacity-50"}
                />
              </Row>
            </div>
          </Card>

          {mode === "student" ? <DeadlineRemindersCard /> : <GitReposCard />}

          <Card title="Captura rápida">
            <Row title="Atajo global" description="Abre la ventana flotante desde cualquier aplicación.">
              <span className="flex gap-1">
                {QUICK_CAPTURE_SHORTCUT.map((key) => (
                  <kbd key={key} className="rounded-md border border-line bg-surface-muted px-1.5 py-0.5 font-sans text-[12px] font-medium">
                    {key}
                  </kbd>
                ))}
              </span>
            </Row>
          </Card>

          <AiSettingsCard />
        </div>

        <div className="flex flex-col gap-6">
          <Card title="Respaldos" action={<HardDrive className="size-4 text-ink-muted" />}>
            <div className="flex flex-col divide-y divide-line">
              <Row title="Respaldo automático" description="Una copia al día mientras la app está abierta.">
                <Switch label="Respaldo automático" checked={backup.auto} onChange={(auto) => void patch("backup", { auto })} />
              </Row>
              <Row
                title="Ubicación"
                description={<span className="break-all">{backup.directory ?? "Carpeta de datos de la app"}</span>}
              >
                {backup.directory && (
                  <Button variant="ghost" className="px-2.5" onClick={() => void patch("backup", { directory: null })}>
                    Predeterminada
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() =>
                    void run(
                      async () => {
                        const directory = await chooseBackupDir();
                        if (directory) await patch("backup", { directory });
                        return directory;
                      },
                      (dir) => `Los respaldos se guardarán en ${dir}`,
                      "No se pudo cambiar la carpeta",
                    )
                  }
                >
                  Cambiar…
                </Button>
              </Row>
              <Row title="Conservar" description="Los más antiguos se borran solos.">
                <select
                  aria-label="Respaldos a conservar"
                  value={backup.keep}
                  onChange={(e) => void patch("backup", { keep: Number(e.target.value) })}
                  className={fieldClass + " w-28"}
                >
                  {KEEP_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} copias
                    </option>
                  ))}
                </select>
              </Row>
              <div className="pt-3.5">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(
                      async () => {
                        const path = await backupService.run(useSettingsStore.getState().settings.backup);
                        await loadBackups();
                        return path;
                      },
                      (path) => `Respaldo creado: ${path}`,
                      "No se pudo crear el respaldo",
                    )
                  }
                >
                  <Database className="size-4" /> Respaldar ahora
                </Button>
              </div>
            </div>

            {backups.length > 0 && (
              <ul aria-label="Últimos respaldos" className="mt-4 flex flex-col border-t border-line pt-3">
                {backups.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-1.5 text-[13px]">
                    <span className="flex-1">{dateTime.format(new Date(b.created_at))}</span>
                    <span className="text-ink-muted tabular-nums">{formatSize(b.size_bytes)}</span>
                    <button
                      type="button"
                      onClick={() => void revealInFolder(b.file_path)}
                      aria-label="Mostrar en la carpeta"
                      title="Mostrar en la carpeta"
                      className="grid size-7 place-items-center rounded-lg text-ink-muted hover:bg-fill hover:text-ink"
                    >
                      <FolderOpen className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <DataSettingsCard />
          <AboutCard />
        </div>
      </div>
    </>
  );
}
