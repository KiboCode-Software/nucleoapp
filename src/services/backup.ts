import { isTauri } from "@/database/client";
import { activeProfile } from "@/database/profiles";
import { backupsRepository, type BackupsRepository } from "@/database/repositories/backups.repository";
import type { BackupSettings } from "@/database/repositories/settings.repository";

export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Operaciones de disco que hace Rust (la interfaz no tiene acceso directo al sistema de archivos). */
export interface BackupNative {
  backupDir(custom: string | null): Promise<string>;
  join(dir: string, file: string): Promise<string>;
  fileSize(path: string): Promise<number>;
  /** Borra los respaldos más antiguos y devuelve las rutas eliminadas. */
  prune(dir: string, keep: number): Promise<string[]>;
}

/** "nucleo-2026-11-01-153012.db": ordenable; Rust también reconoce respaldos anteriores. */
export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `nucleo-${date}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.db`;
}

export function isBackupDue(lastBackupIso: string | null, now = new Date(), intervalMs = BACKUP_INTERVAL_MS): boolean {
  return lastBackupIso == null || now.getTime() - new Date(lastBackupIso).getTime() >= intervalMs;
}

export function createBackupService(repo: BackupsRepository, native: BackupNative) {
  // Un respaldo cada vez: dos a la vez (el automático y "Respaldar ahora", o los
  // efectos dobles de React en desarrollo) escribirían el mismo archivo en el mismo
  // segundo y el segundo VACUUM INTO fallaría ("table … already exists").
  let running: Promise<string> | null = null;

  return {
    /** Crea un respaldo, lo registra y aplica la rotación. Devuelve la ruta creada. */
    run(settings: Pick<BackupSettings, "directory" | "keep">, now = new Date()): Promise<string> {
      running ??= (async () => {
        const dir = await native.backupDir(settings.directory);
        const path = await native.join(dir, backupFileName(now));
        await repo.vacuumInto(path);
        await repo.record(path, await native.fileSize(path));
        await repo.forget(await native.prune(dir, settings.keep));
        return path;
      })().finally(() => {
        running = null;
      });
      return running;
    },

    /** Respaldo automático si está activado y el último tiene más de un día. */
    async runIfDue(settings: BackupSettings, now = new Date()): Promise<string | null> {
      if (!settings.auto) return null;
      if (running) return running;
      const [last] = await repo.listRecent(1);
      return isBackupDue(last?.created_at ?? null, now) ? this.run(settings, now) : null;
    },
  };
}

const tauriNative: BackupNative = {
  async backupDir(custom) {
    const { invoke } = await import("@tauri-apps/api/core");
    // Cada perfil guarda sus copias en su propia subcarpeta.
    const profile = (await activeProfile()).id;
    return invoke<string>("backup_dir", { custom, profile });
  },
  async join(dir, file) {
    const { join } = await import("@tauri-apps/api/path");
    return join(dir, file);
  },
  async fileSize(path) {
    const { invoke } = await import("@tauri-apps/api/core");
    return (await invoke<{ size_bytes: number }>("backup_file_info", { path })).size_bytes;
  },
  async prune(dir, keep) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string[]>("prune_backups", { dir, keep });
  },
};

export const backupService = createBackupService(backupsRepository, tauriNative);

/** Abre el Explorador de Windows con el archivo seleccionado. */
export async function revealInFolder(path: string): Promise<void> {
  if (!isTauri()) return;
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}

export async function chooseBackupDir(): Promise<string | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string | null>("choose_backup_dir");
}
