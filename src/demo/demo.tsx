/**
 * Modo demostración (demo.html, solo con `npm run dev`): la app con datos de
 * ejemplo en memoria, sin base de datos. Sirve para hacer las capturas de la web
 * de descarga (site/capture.mjs). Parámetros de la URL:
 *   ?modo=estudiante   perfil de estudio (si no, desarrollo)
 *   &tema=oscuro       modo oscuro
 *   &enfoque           temporizador de enfoque en marcha y su hoja abierta
 *   &buscar            búsqueda global (Ctrl + K) abierta
 *   &bloqueo=1234      pantalla de bloqueo con ese código
 *   ?widget            solo el widget flotante del enfoque, con un bloque en marcha
 */
import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "../index.css";
import App from "../App";
import { FocusWidgetWindow } from "@/modules/focus/FocusWidgetWindow";
import { useFocusSheet } from "@/components/focus/FocusTimer";
import { useCommandPalette } from "@/components/shell/CommandPalette";
import type { BlockerEntry } from "@/database/repositories/blockers.repository";
import type { DailyLogEntry } from "@/database/repositories/daily-logs.repository";
import type { Deadline } from "@/database/repositories/deadlines.repository";
import type { LearningEntry } from "@/database/repositories/learnings.repository";
import { DEFAULT_SETTINGS } from "@/database/repositories/settings.repository";
import { useBlockersStore } from "@/stores/blockers.store";
import { useCapturesStore } from "@/stores/captures.store";
import { useDailyLogsStore } from "@/stores/daily-logs.store";
import { useDeadlinesStore } from "@/stores/deadlines.store";
import { useFocusStore } from "@/stores/focus.store";
import { useLearningsStore } from "@/stores/learnings.store";
import { useSettingsStore } from "@/stores/settings.store";
import { useUiStore } from "@/stores/ui.store";
import { toISODate } from "@/utils/date";

const params = new URLSearchParams(location.search);
const student = params.get("modo") === "estudiante";
const now = Date.now();
const HOUR = 3_600_000;
const ago = (hours: number) => new Date(now - hours * HOUR).toISOString();
const pad = (n: number) => String(n).padStart(2, "0");
const due = (days: number, time: string) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}`;
};
const stamp = { created_at: ago(200), updated_at: ago(2) };

// ─── Entregas (modo estudio) ───────────────────────────────────────────────────
const subject = (id: number, name: string, color: string) => ({ project_id: id, project_name: name, project_color: color });
const algebra = subject(1, "Álgebra lineal", "#AF52DE");
const fisica = subject(2, "Física II", "#007AFF");
const ia = subject(3, "Inteligencia artificial", "#FF9F0A");
const deadline = (id: number, title: string, kind: Deadline["kind"], when: string, extra: Partial<Deadline> = {}): Deadline => ({
  id,
  ...algebra,
  title,
  kind,
  due_at: when,
  notes: "",
  weight: null,
  grade: null,
  done_at: null,
  ...stamp,
  ...extra,
});
const deadlines: Deadline[] = [
  deadline(1, "Parcial de Álgebra lineal", "exam", due(1, "09:00"), { weight: 30 }),
  deadline(2, "Informe de laboratorio 3", "assignment", due(3, "23:59"), { ...fisica, weight: 15 }),
  deadline(3, "Exposición: redes neuronales", "presentation", due(5, "14:00"), { ...ia, weight: 20 }),
  deadline(4, "Taller de matrices", "assignment", due(9, "23:59"), { weight: 10 }),
  deadline(5, "Proyecto final", "assignment", due(16, "18:00"), { ...ia, weight: 40 }),
  deadline(6, "Quiz 1", "exam", due(-20, "10:00"), { weight: 20, grade: 4.2, done_at: ago(480) }),
  deadline(7, "Parcial 1", "exam", due(-14, "10:00"), { ...fisica, weight: 30, grade: 3.6, done_at: ago(330) }),
  deadline(8, "Laboratorio 1 y 2", "assignment", due(-10, "23:59"), { ...fisica, weight: 20, grade: 4.5, done_at: ago(240) }),
  deadline(9, "Ensayo de ética en IA", "assignment", due(-7, "23:59"), { ...ia, weight: 15, grade: 4.8, done_at: ago(170) }),
];

// ─── Bloqueos / dudas ──────────────────────────────────────────────────────────
const blocker = (id: number, title: string, status: BlockerEntry["status"], openedHours: number, extra: Partial<BlockerEntry> = {}): BlockerEntry => ({
  id,
  daily_log_id: null,
  project_id: 1,
  project_name: student ? "Álgebra lineal" : "API de pagos",
  title,
  description: "",
  status,
  opened_at: ago(openedHours),
  resolved_at: status === "resolved" ? ago(openedHours - 3) : null,
  attempts_count: 0,
  ...stamp,
  ...extra,
});
const blockers: BlockerEntry[] = student
  ? [
      blocker(1, "No entiendo cómo diagonalizar una matriz", "pending", 26, { attempts_count: 2 }),
      blocker(2, "¿Por qué la regla de la cadena lleva ese factor?", "pending", 5, { project_name: "Cálculo" }),
      blocker(3, "Duda sobre el informe: ¿cuántas cifras significativas?", "escalated", 50, { project_name: "Física II", attempts_count: 1 }),
      blocker(4, "Determinante de matrices 4×4", "resolved", 30, { attempts_count: 3 }),
      blocker(5, "Backpropagation paso a paso", "resolved", 80, { project_name: "Inteligencia artificial" }),
    ]
  : [
      blocker(1, "CORS bloquea la API en producción", "pending", 50, { attempts_count: 3 }),
      blocker(2, "La migración 0004 falla en Windows", "pending", 6, { project_name: "Backend" }),
      blocker(3, "Token JWT expira antes de tiempo", "escalated", 120, { attempts_count: 1 }),
      blocker(4, "Build roto tras actualizar Vite", "resolved", 30, { project_name: "Web", attempts_count: 2 }),
      blocker(5, "Tests intermitentes en CI", "resolved", 80, { project_name: "Web" }),
      blocker(6, "Webhook de Stripe sin firma", "resolved", 140),
    ];

// ─── Registro del día ──────────────────────────────────────────────────────────
const today = toISODate(new Date());
const log = (id: number, daysAgo: number, todayText: string, extra: Partial<DailyLogEntry> = {}): DailyLogEntry => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id,
    project_id: 1,
    project_name: student ? "Álgebra lineal" : "API de pagos",
    log_date: daysAgo === 0 ? today : toISODate(d),
    yesterday: "",
    today: todayText,
    blockers_note: "",
    learnings: "",
    ...stamp,
    ...extra,
  };
};
const logs: DailyLogEntry[] = student
  ? [
      log(1, 0, "- [x] Repasar derivadas parciales\n- [x] Ejercicios 4.1 a 4.6\n- [ ] Leer el capítulo 5\n- [ ] Preparar la exposición", {
        blockers_note: "No entiendo cómo diagonalizar una matriz",
        learnings: "Los autovalores salen del polinomio característico.",
      }),
      log(2, 1, "- [x] Laboratorio de Física\n- [x] Resumen del tema 3"),
      log(3, 2, "- [x] Taller de matrices\n- [ ] Repasar para el quiz"),
    ]
  : [
      log(1, 0, "- [x] Revisar el PR de pagos\n- [x] Corregir el webhook de Stripe\n- [ ] Escribir los tests de integración\n- [ ] Desplegar en staging", {
        blockers_note: "CORS bloquea la API en producción",
        learnings: "Los preflight de CORS no envían cookies.",
      }),
      log(2, 1, "- [x] Migrar a la nueva versión de Vite\n- [x] Arreglar el build"),
      log(3, 2, "- [x] Endpoint de reembolsos\n- [ ] Documentar la API"),
    ];

const learning = (id: number, title: string, kind: LearningEntry["kind"], tags: string[]): LearningEntry => ({
  id,
  daily_log_id: null,
  project_id: 1,
  project_name: student ? "Álgebra lineal" : "API de pagos",
  kind,
  title,
  content: "",
  tags,
  ...stamp,
});
const learnings: LearningEntry[] = student
  ? [learning(1, "Autovalores y autovectores", "concept", ["álgebra"]), learning(2, "Regla de la cadena", "command", ["cálculo"])]
  : [learning(1, "Idempotencia en pagos", "concept", ["api"]), learning(2, "git rebase -i HEAD~3", "command", ["git"])];

// ─── Estado inicial de la app ──────────────────────────────────────────────────
useUiStore.getState().setTheme(params.get("tema") === "oscuro" ? "dark" : "light");
useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, onboarding_completed: true }, status: "ready" });
useDeadlinesStore.setState({ deadlines, status: "ready" });
useBlockersStore.setState({ blockers, status: "ready" });
useDailyLogsStore.setState({ logs, status: "ready" });
useLearningsStore.setState({ learnings, status: "ready" });
useCapturesStore.setState({ pending: [], status: "ready" });

if (params.has("enfoque")) {
  useFocusStore.setState({
    phase: "focus",
    focusMinutes: 25,
    durationMs: 25 * 60_000,
    endsAt: now + 18 * 60_000 + 42_000,
    startedAt: new Date(now - 6 * 60_000).toISOString(),
    label: student ? "Repasar derivadas" : "Tests de integración",
  });
  useFocusSheet.setState({ open: true });
}
if (params.has("buscar")) useCommandPalette.setState({ open: true });

const widgetDemo = {
  phase: "focus" as const,
  endsAt: now + 18 * 60_000 + 42_000,
  remainingMs: null,
  durationMs: 25 * 60_000,
  label: student ? "Repasar derivadas" : "Tests de integración",
  sound: true,
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{params.has("widget") ? <FocusWidgetWindow initial={widgetDemo} /> : <App />}</React.StrictMode>,
);
