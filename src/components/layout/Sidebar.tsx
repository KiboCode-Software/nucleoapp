import { Lock, Moon, Search, Sun, Timer } from "lucide-react";
import { AppIcon } from "@/components/shell/AppIcon";
import { FocusPill, useFocusSheet } from "@/components/focus/FocusTimer";
import { useCommandPalette } from "@/components/shell/CommandPalette";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { useEffect } from "react";
import { NavLink } from "react-router";
import { ensureCapturesLoaded, useCapturesStore } from "@/stores/captures.store";
import { useDatabaseStatus, type DatabaseStatus } from "@/hooks/useDatabaseStatus";
import { GROUP_LABELS, useModules, type ModuleGroup } from "@/modules/registry";
import { useLockStore } from "@/stores/lock.store";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/utils/cn";

const GROUPS: ModuleGroup[] = ["general", "tracking", "output", "system"];

/** Ancho de la barra lateral (la barra de título lo usa para alinear su tramo izquierdo). */
export const SIDEBAR_WIDTH = "w-64";

/** Colores de los iconos, como los cuadritos de la app Ajustes de iOS. */
const MODULE_TINTS: Record<string, string> = {
  dashboard: "#007AFF",
  "daily-log": "#FF9500",
  deadlines: "#FF2D55",
  blockers: "#FF3B30",
  learning: "#34C759",
  projects: "#5856D6",
  reports: "#00C7BE",
  "quick-capture": "#AF52DE",
  settings: "#8E8E93",
};

const STATUS_LABEL: Record<DatabaseStatus, { text: string; dot: string }> = {
  connecting: { text: "Abriendo base de datos…", dot: "bg-ink-muted" },
  ready: { text: "Guardado en tu PC", dot: "bg-success" },
  browser: { text: "Vista previa sin SQLite", dot: "bg-warning" },
  error: { text: "Error en la base de datos", dot: "bg-danger" },
};

/** Barra lateral al estilo de iPadOS: título grande, filas con icono de color y selección rellena. */
export function Sidebar() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const status = STATUS_LABEL[useDatabaseStatus()];
  const pendingCaptures = useCapturesStore((s) => s.pending.length);
  const modules = useModules();
  const lockEnabled = useLockStore((s) => s.security?.enabled ?? false);
  const lock = useLockStore((s) => s.lock);

  useEffect(ensureCapturesLoaded, []);

  return (
    <aside className={cn("material flex shrink-0 flex-col border-r border-separator/60 bg-sidebar print:hidden", SIDEBAR_WIDTH)}>
      <div className="flex items-center gap-3 px-5 pt-4 pb-4">
        <AppIcon size={36} className="drop-shadow-[0_2px_6px_rgb(0_98_224/0.3)]" shadow={false} />
        <span className="text-[20px] font-bold tracking-[-0.025em]">Núcleo</span>
      </div>
      <ProfileSwitcher />
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => useCommandPalette.getState().setOpen(true)}
          className="pressable flex h-8 w-full items-center gap-2 rounded-[10px] bg-fill/70 px-2.5 text-[13.5px] text-ink-muted hover:bg-fill"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Buscar</span>
          <kbd className="rounded-[5px] bg-surface px-1.5 text-[11px] font-semibold">Ctrl K</kbd>
        </button>
      </div>
      <FocusPill />

      <nav aria-label="Módulos" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-3">
        {GROUPS.map((group) => (
          <div key={group} className={cn(group === "system" && "mt-auto")}>
            {GROUP_LABELS[group] && (
              <p className="px-3 pb-1.5 text-[12px] font-semibold tracking-[0.02em] text-ink-muted uppercase">{GROUP_LABELS[group]}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {modules.filter((m) => m.group === group).map(({ id, path, label, icon: Icon }) => (
                <li key={id}>
                  <NavLink
                    to={path}
                    end={path === "/"}
                    className={({ isActive }) =>
                      cn(
                        "pressable flex h-10 items-center gap-3 rounded-[10px] px-2 text-[15px] tracking-[-0.01em]",
                        isActive ? "bg-accent font-semibold text-white" : "text-ink hover:bg-fill",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            "grid size-[28px] shrink-0 place-items-center rounded-[7px] text-white",
                            isActive && "shadow-[0_0_0_1.5px_rgb(255_255_255/0.5)]",
                          )}
                          style={{ backgroundColor: MODULE_TINTS[id] }}
                        >
                          <Icon className="size-[16px]" strokeWidth={2} />
                        </span>
                        <span className="flex-1 truncate">{label}</span>
                        {id === "quick-capture" && pendingCaptures > 0 && (
                          <span
                            className={cn(
                              "min-w-5 rounded-full px-1.5 text-center text-[12px] leading-5 font-semibold tabular-nums",
                              isActive ? "bg-white/25 text-white" : "bg-danger text-white",
                            )}
                            aria-label={`${pendingCaptures} sin clasificar`}
                          >
                            {pendingCaptures}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <footer className="flex items-center justify-between gap-2 border-t border-separator/60 px-5 py-3.5">
        <span className="flex min-w-0 items-center gap-2 text-[12px] text-ink-muted" title={status.text}>
          <span className={cn("size-2 shrink-0 rounded-full", status.dot)} />
          <span className="truncate">{status.text}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => useFocusSheet.getState().setOpen(true)}
            aria-label="Enfoque"
            title="Temporizador de enfoque"
            className="pressable grid size-8 shrink-0 place-items-center rounded-full bg-fill text-ink"
          >
            <Timer className="size-4" />
          </button>
          {lockEnabled && (
            <button
              type="button"
              onClick={lock}
              aria-label="Bloquear la app"
              title="Bloquear (Ctrl + L)"
              className="pressable grid size-8 shrink-0 place-items-center rounded-full bg-fill text-ink"
            >
              <Lock className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
            className="pressable grid size-8 shrink-0 place-items-center rounded-full bg-fill text-ink"
          >
            {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </button>
        </div>
      </footer>
    </aside>
  );
}
