import { Lock, ShieldCheck, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/fields";
import { Switch } from "@/components/ui/Switch";
import { countRows, type ExportFile } from "@/database/repositories/import.repository";
import { MIN_PASSWORD_LENGTH } from "@/services/crypto";
import { exportAllData, importData, needsPassword, pickImportFile, readExport } from "@/services/data-export";
import { useSettingsStore } from "@/stores/settings.store";
import { cn } from "@/utils/cn";
import { useVocab } from "@/modes/vocabulary";

type Notice = { tone: "ok" | "error"; text: string } | null;

const TABLE_LABELS: Partial<Record<keyof ExportFile["tables"], [string, string]>> = {
  projects: ["proyecto", "proyectos"],
  daily_logs: ["registro", "registros"],
  blockers: ["bloqueo", "bloqueos"],
  learnings: ["aprendizaje", "aprendizajes"],
  reports: ["reporte", "reportes"],
  captures: ["captura", "capturas"],
  deadlines: ["entrega", "entregas"],
};

function PasswordField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[13px] font-medium">
      {label}
      <input
        id={id}
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass + " h-10 font-normal"}
      />
    </label>
  );
}

export function DataSettingsCard() {
  const v = useVocab();
  const vocabLabels = {
    projects: [v.project.one, v.project.many],
    blockers: [v.blocker.one, v.blocker.many],
    learnings: [v.learning.one, v.learning.many],
  } satisfies typeof TABLE_LABELS;
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  // Importación en dos pasos: elegir archivo (y contraseña si está cifrado) → confirmar.
  const [pending, setPending] = useState<{ raw: unknown; file: ExportFile | null } | null>(null);
  const [importPassword, setImportPassword] = useState("");

  const passwordError =
    encrypt && password.length > 0 && password.length < MIN_PASSWORD_LENGTH
      ? `Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`
      : encrypt && confirm.length > 0 && confirm !== password
        ? "Las contraseñas no coinciden."
        : null;
  const canExport = !busy && (!encrypt || (password.length >= MIN_PASSWORD_LENGTH && password === confirm));

  async function guarded(action: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      console.error(error);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Algo salió mal." });
    } finally {
      setBusy(false);
    }
  }

  function onExport(event: FormEvent) {
    event.preventDefault();
    if (!canExport) return;
    void guarded(async () => {
      const path = await exportAllData(encrypt ? password : undefined);
      if (!path) return;
      setNotice({ tone: "ok", text: `${encrypt ? "Copia cifrada exportada" : "Datos exportados"}: ${path}` });
      setPassword("");
      setConfirm("");
    });
  }

  function onPick() {
    void guarded(async () => {
      const raw = await pickImportFile();
      if (raw == null) return;
      setImportPassword("");
      setPending({ raw, file: needsPassword(raw) ? null : await readExport(raw) });
    });
  }

  function onDecrypt(event: FormEvent) {
    event.preventDefault();
    if (!pending) return;
    void guarded(async () => setPending({ raw: pending.raw, file: await readExport(pending.raw, importPassword) }));
  }

  function onConfirmImport() {
    const file = pending?.file;
    if (!file) return;
    void guarded(async () => {
      const backupPath = await importData(file, useSettingsStore.getState().settings.backup);
      setPending(null);
      setNotice({ tone: "ok", text: `Datos importados. Copia previa en: ${backupPath}` });
      // Recarga para que todos los módulos lean los datos importados.
      setTimeout(() => window.location.reload(), 1500);
    });
  }

  const summary = pending?.file
    ? Object.entries(countRows(pending.file))
        .flatMap(([table, n]) => {
          const label = { ...TABLE_LABELS, ...vocabLabels }[table as keyof typeof TABLE_LABELS];
          return label && n > 0 ? [`${n} ${n === 1 ? label[0] : label[1]}`] : [];
        })
        .join(" · ")
    : "";

  return (
    <Card title="Datos y privacidad" action={<ShieldCheck className="size-4 text-ink-muted" />}>
      <ul className="mb-5 flex flex-col gap-1.5 text-[13px] text-ink-muted">
        <li>Todo se guarda en una base SQLite local en tu equipo.</li>
        <li>Sin cuenta, sin servidor y sin telemetría: la app no envía nada a internet.</li>
        <li>Los respaldos y exportaciones solo se escriben donde tú eliges.</li>
      </ul>

      {notice && (
        <p role="status" className={cn("mb-4 text-[13px] break-all", notice.tone === "ok" ? "text-success" : "text-danger")}>
          {notice.text}
        </p>
      )}

      <form onSubmit={onExport} className="flex flex-col gap-3 border-t border-line pt-4" aria-label="Exportar datos">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="flex items-center gap-1.5 text-[14px] font-medium">
              <Lock className="size-3.5" /> Cifrar con contraseña
            </p>
            <p className="text-[12.5px] text-ink-muted">AES-256. Si la olvidas, no hay forma de recuperar la copia.</p>
          </div>
          <Switch label="Cifrar con contraseña" checked={encrypt} onChange={setEncrypt} />
        </div>
        {encrypt && (
          <div className="grid gap-3 sm:grid-cols-2">
            <PasswordField id="export-password" label="Contraseña" value={password} onChange={setPassword} />
            <PasswordField id="export-confirm" label="Repetir contraseña" value={confirm} onChange={setConfirm} />
            {passwordError && <p className="text-[12.5px] text-danger sm:col-span-2">{passwordError}</p>}
          </div>
        )}
        <div>
          <Button type="submit" variant="secondary" disabled={!canExport}>
            Exportar todos los datos (JSON)
          </Button>
        </div>
      </form>

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
        <div>
          <p className="text-[14px] font-medium">Importar datos</p>
          <p className="text-[12.5px] text-ink-muted">
            Restaura una exportación (cifrada o no). Sustituye todos los datos actuales; antes se crea un respaldo automático.
          </p>
        </div>

        {!pending ? (
          <div>
            <Button variant="secondary" disabled={busy} onClick={onPick}>
              <Upload className="size-4" /> Elegir archivo…
            </Button>
          </div>
        ) : !pending.file ? (
          <form onSubmit={onDecrypt} className="flex flex-col gap-3" aria-label="Descifrar importación">
            <PasswordField id="import-password" label="Contraseña del archivo cifrado" value={importPassword} onChange={setImportPassword} />
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !importPassword}>
                Descifrar
              </Button>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft p-3.5">
            <p className="text-[13px]">
              El archivo contiene <strong className="font-semibold">{summary || "datos vacíos"}</strong>. Al importarlo se reemplazará
              todo lo que hay ahora en la app.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" disabled={busy} onClick={onConfirmImport}>
                {busy ? "Importando…" : "Reemplazar mis datos"}
              </Button>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
