# Núcleo

> Hecha por [KiboCode](https://kibocode.lat) · [nucleo.kibocode.lat](https://nucleo.kibocode.lat)

Aplicación de escritorio **offline-first** para que los desarrolladores registren su jornada: check-ins diarios, bloqueos técnicos, aprendizajes, proyectos y reportes. Todos los datos se guardan en una base SQLite local; sin cuentas, sin servidor y sin telemetría.

> Estado: **MVP v0.1 completo** — registro diario, bloqueos, aprendizajes, proyectos, reportes con plantillas y estadísticas, exportación a Markdown, JSON, CSV y PDF, captura rápida con atajo global (Ctrl+Shift+Espacio), recordatorio diario, respaldos automáticos, exportaciones cifradas con importación y resumen opcional con IA local (Ollama). Ver el [documento maestro](docs/especificacion.md).

## Stack

Tauri 2 · React 19 · TypeScript · Tailwind CSS 4 · Rust · SQLite · Zustand · Zod · Vitest

## Requisitos (Windows)

1. [Node.js](https://nodejs.org) 22 o superior.
2. [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) con la carga de trabajo **Desarrollo para el escritorio con C++**.
3. [Rust](https://www.rust-lang.org/tools/install) (`rustup`, toolchain MSVC estable).
4. WebView2 (incluido en Windows 10/11).

Guía oficial: <https://v2.tauri.app/start/prerequisites/>

## Desarrollo

```bash
npm install
npm run tauri dev     # app de escritorio con recarga en caliente
npm run dev           # solo la interfaz en el navegador (sin SQLite)
npm run check         # tipos + pruebas
npm run tauri build   # instaladores en src-tauri/target/release/bundle
```

## Estructura

```text
src/
  components/   ui · layout · shared
  modules/      un directorio por módulo + registry.ts (navegación)
  database/     client.ts · migrations/ (SQL) · repositories/
  services/  stores/  hooks/  types/  utils/
src-tauri/      Rust: plugins, migraciones, permisos (capabilities)
tests/          Vitest
docs/           especificación y decisiones
```

## Documentación

- [Documento maestro](docs/especificacion.md): concepto, módulos, diseño, roadmap y decisiones.
- [Base de datos](docs/base-de-datos.md): esquema, migraciones e integridad.

## Privacidad

La base de datos vive en la carpeta local de datos de Núcleo. La app no hace peticiones de red: la CSP solo permite recursos propios y la ventana tiene únicamente los permisos que necesita.
