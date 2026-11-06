import { isTauri } from "@/database/client";

export type ExportFormat = "markdown" | "json" | "csv";

const FORMATS: Record<ExportFormat, { extension: string; filterName: string; mime: string }> = {
  markdown: { extension: "md", filterName: "Markdown", mime: "text/markdown" },
  json: { extension: "json", filterName: "JSON", mime: "application/json" },
  csv: { extension: "csv", filterName: "CSV", mime: "text/csv" },
};

/**
 * Guarda un archivo de texto donde elija el usuario.
 * En la app de escritorio usa el diálogo nativo (comando `export_file` en Rust);
 * en el navegador, una descarga. Devuelve la ruta guardada o null si se canceló.
 */
export async function exportFile(baseName: string, contents: string, format: ExportFormat): Promise<string | null> {
  const { extension, filterName, mime } = FORMATS[format];
  const fileName = `${baseName}.${extension}`;

  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string | null>("export_file", { defaultName: fileName, contents, filterName, extension });
  }

  const url = URL.createObjectURL(new Blob([contents], { type: `${mime};charset=utf-8` }));
  const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
  link.click();
  URL.revokeObjectURL(url);
  return fileName;
}
