import { lazy } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { LaunchGate } from "@/components/shell/LaunchGate";
import { DailyLogPage } from "@/modules/daily-log/DailyLogPage";
import { DashboardPage } from "@/modules/dashboard/DashboardPage";
import { FocusWidgetWindow } from "@/modules/focus/FocusWidgetWindow";
import { QuickCaptureWindow } from "@/modules/quick-capture/QuickCaptureWindow";

// Resumen y Registro diario se usan a diario y van en el paquete inicial; el resto
// se carga al abrirlos (AppShell los envuelve en <Suspense>).
const BlockersPage = lazy(() => import("@/modules/blockers/BlockersPage").then((m) => ({ default: m.BlockersPage })));
const LearningPage = lazy(() => import("@/modules/learning/LearningPage").then((m) => ({ default: m.LearningPage })));
const ProjectsPage = lazy(() => import("@/modules/projects/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const ReportsPage = lazy(() => import("@/modules/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const QuickCapturePage = lazy(() =>
  import("@/modules/quick-capture/QuickCapturePage").then((m) => ({ default: m.QuickCapturePage })),
);
const DeadlinesPage = lazy(() => import("@/modules/deadlines/DeadlinesPage").then((m) => ({ default: m.DeadlinesPage })));
const SettingsPage = lazy(() => import("@/modules/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));

export function AppRoutes() {
  return (
    <Routes>
      {/* Ventana flotante de captura rápida: sin barra lateral. */}
      <Route path="capture" element={<QuickCaptureWindow />} />
      {/* Widget flotante del temporizador de enfoque. */}
      <Route path="widget" element={<FocusWidgetWindow />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="daily-log" element={<DailyLogPage />} />
        <Route path="daily-log/historial" element={<DailyLogPage view="history" />} />
        <Route path="daily-log/dia/:date" element={<DailyLogPage />} />
        <Route path="daily-log/:logId" element={<DailyLogPage />} />
        <Route path="deadlines/:deadlineId?" element={<DeadlinesPage />} />
        <Route path="blockers/:blockerId?" element={<BlockersPage />} />
        <Route path="learning/:learningId?" element={<LearningPage />} />
        <Route path="projects/:projectId?" element={<ProjectsPage />} />
        <Route path="reports/:reportId?" element={<ReportsPage />} />
        <Route path="quick-capture" element={<QuickCapturePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

// Las ventanas flotantes (captura rápida y widget de enfoque) no tienen splash, onboarding ni bloqueo.
const isFloatingWindow = () => /^#\/(capture|widget)/.test(window.location.hash);

// HashRouter: la app se sirve como archivos estáticos dentro de Tauri, sin servidor que resuelva rutas.
export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
      {!isFloatingWindow() && <LaunchGate />}
    </HashRouter>
  );
}
