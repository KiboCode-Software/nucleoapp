// Genera la web de descarga en site/dist, lista para publicar como sitio estático.
//   node site/build.mjs
// Lee el nombre y los textos de site.config.json, la versión de tauri.conf.json y
// copia el instalador NSIS disponible o usa NUCLEO_INSTALLER_URL si el binario
// se aloja fuera del despliegue (por ejemplo, en los Releases de GitHub).
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = join(here, "src");
const dist = join(here, "dist");

const config = JSON.parse(readFileSync(join(here, "site.config.json"), "utf8"));
const tauri = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const version = tauri.version;

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "assets"), { recursive: true });
mkdirSync(join(dist, "descargar"), { recursive: true });

// Instalador de esta versión (el .exe de NSIS: se instala sin permisos de administrador).
const nsisDir = join(root, "src-tauri", "target", "release", "bundle", "nsis");
const installerFile = `${tauri.productName}_${version}_x64-setup.exe`;
const installer = existsSync(nsisDir) ? readdirSync(nsisDir).find((f) => f === installerFile) : undefined;
const externalInstallerUrl = process.env.NUCLEO_INSTALLER_URL?.trim();
const externalInstallerSha256 = process.env.NUCLEO_INSTALLER_SHA256?.trim().toLowerCase();

if (externalInstallerUrl && new URL(externalInstallerUrl).protocol !== "https:") {
  throw new Error("NUCLEO_INSTALLER_URL debe ser una URL HTTPS pública.");
}
if (externalInstallerSha256 && !/^[a-f\d]{64}$/.test(externalInstallerSha256)) {
  throw new Error("NUCLEO_INSTALLER_SHA256 debe contener exactamente 64 caracteres hexadecimales.");
}

let size = "—";
let sha256 = externalInstallerUrl
  ? externalInstallerSha256 || "Consulta el enlace de descarga para verificar su huella SHA-256."
  : "Se calcula al generar la web con el instalador.";
const download = externalInstallerUrl || `descargar/${config.installerName}`;

if (externalInstallerUrl) {
  console.log(`✓ Instalador externo configurado: ${externalInstallerUrl}`);
} else if (installer) {
  const from = join(nsisDir, installer);
  const bytes = readFileSync(from);
  copyFileSync(from, join(dist, download));
  size = `${(statSync(from).size / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  sha256 = createHash("sha256").update(bytes).digest("hex");
  console.log(`✓ Instalador ${installer} → ${download} (${size})`);
} else {
  console.warn(`⚠ No hay instalador para la versión ${version} en ${nsisDir}.`);
  if (process.env.VERCEL) {
    throw new Error("Configura NUCLEO_INSTALLER_URL en Vercel con la URL HTTPS pública del instalador.");
  }
  console.warn("  Genera uno con «npm run tauri build» o define NUCLEO_INSTALLER_URL.");
}

const values = {
  NAME: config.name,
  TAGLINE: config.tagline,
  DESCRIPTION: config.description,
  URL: config.url.replace(/\/$/, ""),
  URL_HOST: new URL(config.url).host,
  INSTALLER: config.installerName,
  REQUIREMENTS: config.requirements,
  VERSION: version,
  SIZE: size,
  SHA256: sha256,
  DOWNLOAD: download,
  DOWNLOAD_URL: new URL(download, `${config.url.replace(/\/$/, "")}/`).href,
  YEAR: String(new Date().getFullYear()),
  MAKER: config.maker.name,
  MAKER_URL: config.maker.url,
  MAKER_HOST: new URL(config.maker.url).host,
};

/**
 * {{ICON:nombre}} → el icono de Lucide (los mismos de la app) como SVG de línea,
 * al estilo de los SF Symbols de Apple.
 */
function icon(name) {
  const file = join(root, "node_modules", "lucide-react", "dist", "esm", "icons", `${name}.mjs`);
  if (!existsSync(file)) throw new Error(`Icono desconocido: ${name}`);
  const match = readFileSync(file, "utf8").match(/const __iconData = (\{[\s\S]*?\n\});/);
  if (!match) throw new Error(`No se pudo leer el icono ${name}`);
  const nodes = new Function(`return ${match[1]}`)().node;
  const body = nodes
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  return `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Capturas en WebP de 1200 y 2160 px (site/optimize_images.py): el navegador elige. */
const srcset = (name) => `assets/shots/${name}-1200.webp 1200w, assets/shots/${name}-2160.webp 2160w`;

const fill = (text) =>
  text
    // {{SHOT:nombre|sizes}} → src, srcset y sizes de una captura.
    .replace(/\{\{SHOT:([\w-]+)\|([^}]+)\}\}/g, (_, name, sizes) => `src="assets/shots/${name}-1200.webp" srcset="${srcset(name)}" sizes="${sizes}"`)
    .replace(/\{\{SRCSET:([\w-]+)\}\}/g, (_, name) => srcset(name))
    .replace(/\{\{ICON:([\w-]+)\}\}/g, (_, name) => icon(name))
    .replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (!(key in values)) throw new Error(`Marcador desconocido: ${match}`);
      return values[key];
    });

for (const file of ["index.html", "styles.css", "app.js"]) {
  writeFileSync(join(dist, file), fill(readFileSync(join(src, file), "utf8")));
}

// Capturas reales de la app (node site/capture.mjs).
const shots = join(src, "assets", "shots");
if (existsSync(shots)) cpSync(shots, join(dist, "assets", "shots"), { recursive: true });
else console.warn("⚠ Sin capturas: ejecuta «npm run dev» y «node site/capture.mjs».");

// Icono de la app y la fuente Inter (servida desde el propio VPS: sin Google Fonts).
copyFileSync(join(root, "src-tauri", "icons", "app-icon.svg"), join(dist, "assets", "icon.svg"));
copyFileSync(join(root, "node_modules", "@fontsource-variable", "inter", "files", "inter-latin-wght-normal.woff2"), join(dist, "assets", "inter.woff2"));
// Marca de KiboCode: isotipo oficial (KiboCode-Software/kibocode-platform) y su tipografía, Archivo.
copyFileSync(join(src, "assets", "kibocode-mark.svg"), join(dist, "assets", "kibocode-mark.svg"));
copyFileSync(join(root, "node_modules", "@fontsource-variable", "archivo", "files", "archivo-latin-standard-normal.woff2"), join(dist, "assets", "archivo.woff2"));

// Para comprobar desde fuera qué versión está publicada (y, en el futuro, avisar de actualizaciones).
writeFileSync(
  join(dist, "version.json"),
  JSON.stringify({
    name: config.name,
    version,
    download: values.DOWNLOAD_URL,
    sha256: (!externalInstallerUrl && installer) || externalInstallerSha256 ? sha256 : null,
  }, null, 2),
);

console.log(`✓ Web generada en site/dist (versión ${version})`);
