import { Suspense } from "react";
import { Outlet, useLocation } from "react-router";
import { isTauri } from "@/database/client";
import { useBackgroundTasks } from "@/hooks/useBackgroundTasks";
import { FocusSheet, useFocusTicker } from "@/components/focus/FocusTimer";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { useLockStore } from "@/stores/lock.store";
import { ErrorBoundary } from "./ErrorBoundary";
import { NavBar } from "./NavBar";
import { Sidebar, SIDEBAR_WIDTH } from "./Sidebar";
import { TitleBar } from "./TitleBar";

export function AppShell() {
  useBackgroundTasks();
  useFocusTicker();
  const { pathname } = useLocation();
  // Cambiar de módulo anima la entrada ("push" de iOS); moverse dentro del mismo módulo, no.
  const moduleKey = pathname.split("/")[1] ?? "";
  // Bloqueada, nada de lo que hay bajo la pantalla de bloqueo se puede enfocar ni escribir.
  const locked = useLockStore((s) => s.locked);

  return (
    <div className="flex h-full flex-col print:block print:h-auto">
      {/* Barra de título propia (estilo macOS) solo en la app de escritorio, que no tiene la nativa. */}
      {isTauri() && <TitleBar sidebarWidth={SIDEBAR_WIDTH} />}
      <div className="flex min-h-0 flex-1 print:block" inert={locked}>
        <Sidebar />
        <main className="relative flex-1 overflow-y-auto print:overflow-visible">
          <NavBar />
          <div className="mx-auto w-full max-w-7xl px-10 py-9 print:max-w-none print:p-0">
            {/* Un fallo en un módulo no deja la ventana en blanco; al cambiar de módulo se reintenta. */}
            <ErrorBoundary resetKey={pathname}>
              <div key={moduleKey} className="animate-push print:animate-none">
                {/* Sin indicador: los módulos son locales y cargan en milisegundos. */}
                <Suspense fallback={null}>
                  <Outlet />
                </Suspense>
              </div>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <CommandPalette />
      <FocusSheet />
    </div>
  );
}
