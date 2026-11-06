import { EXPORT_APP, importRepository, parseExportFile, type ExportFile } from "@/database/repositories/import.repository";
import { reportsRepository } from "@/database/repositories/reports.repository";
import type { BackupSettings } from "@/database/repositories/settings.repository";
import { toISODate } from "@/utils/date";
import { backupService } from "./backup";
import { decryptJson, encryptJson, isEncryptedEnvelope } from "./crypto";
import { exportFile } from "./export";

/**
 * Copia completa de los datos en JSON, opcionalmente cifrada con contraseña.
 * Devuelve la ruta guardada o null si se canceló.
 */
export async function exportAllData(password?: string): Promise<string | null> {
  const tables = await reportsRepository.exportAll();
  const payload = { app: EXPORT_APP, format_version: 1, exported_at: new Date().toISOString(), tables };
  const contents = JSON.stringify(password ? await encryptJson(payload, password) : payload, null, 2);
  const suffix = password ? "-cifrado" : "";
  return exportFile(`nucleo-datos-${toISODate(new Date())}${suffix}`, contents, "json");
}

/** Abre el diálogo para elegir un archivo y lo interpreta como JSON. null si se canceló. */
export async function pickImportFile(): Promise<unknown | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  const text = await invoke<string | null>("import_file");
  if (text == null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("El archivo no contiene JSON válido.");
  }
}

export const needsPassword = isEncryptedEnvelope;

/** Descifra si hace falta y valida el contenido. */
export async function readExport(raw: unknown, password?: string): Promise<ExportFile> {
  if (isEncryptedEnvelope(raw)) {
    if (!password) throw new Error("Este archivo está cifrado: escribe su contraseña.");
    return parseExportFile(await decryptJson(raw, password));
  }
  return parseExportFile(raw);
}

/**
 * Sustituye los datos actuales por los del archivo, creando antes un respaldo.
 * Devuelve la ruta del respaldo previo (para poder volver atrás).
 */
export async function importData(file: ExportFile, backup: Pick<BackupSettings, "directory" | "keep">): Promise<string> {
  const backupPath = await backupService.run(backup);
  await importRepository.replaceAll(file);
  return backupPath;
}
