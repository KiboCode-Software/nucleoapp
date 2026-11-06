import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { vi } from "vitest";

// Las pruebas de páginas encadenan varias consultas a SQLite; con todos los
// archivos en paralelo, 1 s (el valor por defecto) se queda corto: la primera carga de cada pantalla diferida tarda con todos los archivos en paralelo.
configure({ asyncUtilTimeout: 10000 });

// Respaldos y notificaciones necesitan Tauri de verdad; su lógica se prueba en phase5.test.ts.
vi.mock("@/hooks/useBackgroundTasks", () => ({ useBackgroundTasks: () => {} }));

// jsdom no implementa scrollIntoView (lo usa la búsqueda global para seguir la selección).
if (typeof Element !== "undefined") Element.prototype.scrollIntoView = () => {};
