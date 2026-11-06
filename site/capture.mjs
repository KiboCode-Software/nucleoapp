// Capturas reales de la app para la web de descarga, con el modo demostración
// (demo.html: datos de ejemplo en memoria) y Microsoft Edge sin ventana.
//   1. npm run dev            (deja la app en http://localhost:1420)
//   2. node site/capture.mjs  (PNG en site/.shots-raw → WebP en site/src/assets/shots)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// Las PNG originales no se suben al repositorio: solo las WebP optimizadas.
const out = join(here, ".shots-raw");
const base = "http://localhost:1420/demo.html";

const browsers = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];
const browser = browsers.find(existsSync);
if (!browser) throw new Error("No se encontró Microsoft Edge ni Google Chrome.");

try {
  await fetch(base);
} catch {
  throw new Error("La app no responde en http://localhost:1420: ejecuta antes «npm run dev».");
}

/** nombre → [consulta, ruta]: la consulta va antes del # (modo, tema…), la ruta después. */
const SHOTS = {
  entregas: ["modo=estudiante", "/deadlines"],
  notas: ["modo=estudiante", "/deadlines?vista=notas"],
  registro: ["modo=estudiante", "/daily-log"],
  tablero: ["", "/blockers"],
  enfoque: ["tema=oscuro&enfoque", "/daily-log"],
  buscar: ["buscar", "/blockers"],
  bloqueo: ["bloqueo=1234", "/"],
};

mkdirSync(out, { recursive: true });
for (const [name, [query, route]] of Object.entries(SHOTS)) {
  const file = join(out, `${name}.png`);
  execFileSync(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--force-device-scale-factor=1.5",
      "--window-size=1440,900",
      // Deja terminar el splash y las animaciones de entrada antes de capturar.
      "--virtual-time-budget=7000",
      `--screenshot=${file}`,
      `${base}?${query}#${route}`,
    ],
    { stdio: "ignore" },
  );
  console.log(`✓ ${name}.png`);
}

// WebP en dos tamaños (site/optimize_images.py, con Pillow).
execFileSync("python", [join(here, "optimize_images.py")], { stdio: "inherit" });
