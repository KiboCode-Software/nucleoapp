import { isTauri } from "@/database/client";
import type { Mode } from "@/database/profiles";

/**
 * IA local opcional con Ollama. Las llamadas las hace Rust contra 127.0.0.1:11434
 * (dirección fija): los registros nunca salen del equipo. Si Ollama no está
 * instalado, la app sigue funcionando igual con las plantillas.
 */

export interface OllamaStatus {
  running: boolean;
  models: string[];
}

export const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";

const MAX_SUMMARY_CHARS = 1200;

export async function getOllamaStatus(): Promise<OllamaStatus> {
  if (!isTauri()) return { running: false, models: [] };
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<OllamaStatus>("ollama_status");
}

async function generate(model: string, prompt: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("ollama_generate", { model, prompt });
}

/** Instrucciones para el modelo: reescribir el reporte como un párrafo de resumen. */
export function buildSummaryPrompt(markdown: string, mode: Mode = "dev"): string {
  return [
    mode === "student"
      ? "Eres un asistente que redacta resúmenes de estudio para un estudiante universitario."
      : "Eres un asistente que redacta reportes de trabajo para un desarrollador de software en prácticas.",
    "A partir del reporte en Markdown que aparece entre las marcas <reporte>, escribe un único párrafo de resumen en español,",
    "en tercera persona impersonal (\"se trabajó en…\", \"se resolvió…\"), de 2 a 4 frases, con tono profesional y claro.",
    "Usa solo la información del reporte: no inventes tareas, cifras ni nombres. No uses listas, títulos ni Markdown.",
    "Responde únicamente con el párrafo.",
    "",
    "<reporte>",
    markdown.trim(),
    "</reporte>",
  ].join("\n");
}

/** Limpia la respuesta: sin comillas envolventes, títulos, viñetas ni saltos; longitud acotada. */
export function cleanSummary(raw: string): string {
  let text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "") // modelos que "piensan" en voz alta
    .split("\n")
    .filter((line) => !/^\s*#{1,6}\s/.test(line)) // los títulos sobran en un párrafo
    .map((line) => line.replace(/^\s*([-*•]\s+|\d+[.)]\s+)/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^["“«']+|["”»']+$/g, "")
    .replace(/^(resumen|aquí tienes[^:]*)\s*:\s*/i, "")
    .trim();
  if (text.length > MAX_SUMMARY_CHARS) {
    const cut = text.slice(0, MAX_SUMMARY_CHARS);
    text = cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, 0)) || `${cut}…`;
  }
  return text;
}

/** Sustituye el párrafo bajo "## Resumen" del reporte por `summary`. */
export function replaceSummary(markdown: string, summary: string): string {
  return markdown.replace(/(## Resumen\n\n)([\s\S]*?)(\n\n(?:## |---))/, (_, head: string, _old: string, tail: string) => `${head}${summary}${tail}`);
}

/** Resumen redactado por el modelo local a partir del reporte generado con plantillas. */
export async function summarizeWithLocalAi(model: string, markdown: string, mode: Mode = "dev"): Promise<string> {
  const summary = cleanSummary(await generate(model, buildSummaryPrompt(markdown, mode)));
  if (!summary) throw new Error("El modelo devolvió una respuesta vacía.");
  return summary;
}
