import { CalendarClock, CircleAlert, FolderKanban, Layers, Lightbulb, Lock, Moon, NotebookPen, Plus, Search, Sun, Timer, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { create } from "zustand";
import { useFocusSheet } from "@/components/focus/FocusTimer";
import { isTauri } from "@/database/client";
import { fold, searchRepository, type SearchHit, type SearchKind } from "@/database/repositories/search.repository";
import { useVocab } from "@/modes/vocabulary";
import { useModules } from "@/modules/registry";
import { useLockStore } from "@/stores/lock.store";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/utils/cn";
import { formatDayLabel } from "@/utils/date";

/** Abre la búsqueda desde cualquier sitio (barra lateral, atajo). */
export const useCommandPalette = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

interface Item {
  key: string;
  group: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  tint: string;
  run: () => void;
}


const KIND_ICON: Record<SearchKind, { icon: LucideIcon; tint: string }> = {
  deadline: { icon: CalendarClock, tint: "#FF2D55" },
  blocker: { icon: CircleAlert, tint: "#FF3B30" },
  learning: { icon: Lightbulb, tint: "#34C759" },
  project: { icon: FolderKanban, tint: "#5856D6" },
  "daily-log": { icon: NotebookPen, tint: "#FF9500" },
};

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const v = useVocab();
  const modules = useModules();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const lockEnabled = useLockStore((s) => s.security?.enabled ?? false);
  const lock = useLockStore((s) => s.lock);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const student = v.mode === "student";

  const go = (to: string) => () => navigate(to);

  const actions: Array<Omit<Item, "group">> = [
    { key: "today", title: "Registro de hoy", icon: NotebookPen, tint: "#FF9500", run: go("/daily-log") },
    ...(student ? [{ key: "new-deadline", title: "Nueva entrega", icon: Plus, tint: "#FF2D55", run: go("/deadlines/nuevo") }] : []),
    { key: "new-blocker", title: v.blocker.newLabel, icon: Plus, tint: "#FF3B30", run: go("/blockers/nuevo") },
    { key: "new-learning", title: v.learning.newLabel, icon: Plus, tint: "#34C759", run: go("/learning/nuevo") },
    { key: "new-project", title: v.project.newLabel, icon: Plus, tint: "#5856D6", run: go("/projects/nuevo") },
    { key: "focus", title: "Empezar enfoque", subtitle: "Temporizador Pomodoro", icon: Timer, tint: "#FF9500", run: () => useFocusSheet.getState().setOpen(true) },
    { key: "review", title: "Repasar tarjetas", subtitle: "Repaso espaciado", icon: Layers, tint: "#34C759", run: go("/learning?repaso") },
    { key: "capture", title: "Captura rápida", icon: Zap, tint: "#AF52DE", run: go("/quick-capture") },
    {
      key: "theme",
      title: theme === "light" ? "Activar modo oscuro" : "Activar modo claro",
      icon: theme === "light" ? Moon : Sun,
      tint: "#8E8E93",
      run: toggleTheme,
    },
    ...(lockEnabled ? [{ key: "lock", title: "Bloquear la app", subtitle: "Ctrl + L", icon: Lock, tint: "#8E8E93", run: lock }] : []),
  ];
  const commands: Item[] = [
    ...actions.map((a) => ({ ...a, group: "Acciones" })),
    ...modules.map((m) => ({ key: `go-${m.id}`, group: "Ir a", title: m.label, subtitle: m.description, icon: m.icon, tint: "#007AFF", run: go(m.path) })),
  ];

  // Búsqueda en la base de datos, con una pequeña espera mientras se escribe.
  useEffect(() => {
    if (!isTauri() || query.trim().length < 2) return setHits([]);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchRepository.search(query, { deadlines: student }).then(
        (found) => !cancelled && setHits(found),
        (error: unknown) => console.error("Falló la búsqueda", error),
      );
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, student]);

  const groupFor: Record<SearchKind, string> = {
    deadline: "Entregas",
    blocker: v.modules.blockers.label,
    learning: v.modules.learning.label,
    project: v.modules.projects.label,
    "daily-log": "Registro diario",
  };

  const needle = fold(query.trim());
  const items: Item[] = [
    ...commands.filter((c) => !needle || fold(c.title).includes(needle)),
    ...hits.map((hit) => ({
      key: `${hit.kind}-${hit.id}`,
      group: groupFor[hit.kind],
      title: hit.kind === "daily-log" ? formatDayLabel(hit.title) : hit.title,
      subtitle: hit.snippet,
      ...KIND_ICON[hit.kind],
      run: go(hit.to),
    })),
  ];
  const current = Math.min(active, Math.max(0, items.length - 1));

  const choose = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  useEffect(() => setActive(0), [query, hits.length]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(items[current]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  let lastGroup = "";

  return createPortal(
    <div className="fixed inset-0 z-[85] flex justify-center px-4 pt-[14vh]" onKeyDown={onKeyDown}>
      <div className="animate-fade absolute inset-0 bg-black/20 dark:bg-black/45" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        className="material animate-sheet relative flex max-h-[62vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[20px] border border-separator/60 bg-surface/85 shadow-float"
      >
        <label className="flex items-center gap-3 border-b border-separator/60 px-5">
          <Search className="size-5 shrink-0 text-ink-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar o ir a…"
            aria-label="Buscar"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={items[current] ? `command-${items[current].key}` : undefined}
            className="h-14 flex-1 bg-transparent text-[18px] tracking-[-0.01em] outline-none placeholder:text-ink-muted"
          />
          <kbd className="rounded-md bg-fill px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">Esc</kbd>
        </label>

        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-ink-muted">Sin resultados para «{query.trim()}».</p>
        ) : (
          <ul ref={list} id="command-results" role="listbox" aria-label="Resultados" className="overflow-y-auto p-2">
            {items.map((item, index) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              const Icon = item.icon;
              return (
                <li key={item.key} role="presentation">
                  {header && <p className="px-3 pt-2.5 pb-1 text-[11.5px] font-semibold tracking-[0.02em] text-ink-muted uppercase">{header}</p>}
                  <div
                    id={`command-${item.key}`}
                    role="option"
                    aria-selected={index === current}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={() => choose(item)}
                    className={cn(
                      "flex cursor-default items-center gap-3 rounded-[11px] px-3 py-2",
                      index === current ? "bg-accent text-white" : "text-ink",
                    )}
                  >
                    <span
                      className="grid size-7 shrink-0 place-items-center rounded-[7px] text-white"
                      style={{ backgroundColor: index === current ? "rgb(255 255 255 / 0.22)" : item.tint }}
                    >
                      <Icon className="size-4" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{item.title}</span>
                      {item.subtitle && (
                        <span className={cn("block truncate text-[12.5px]", index === current ? "text-white/80" : "text-ink-muted")}>{item.subtitle}</span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Búsqueda global al estilo de Spotlight: Ctrl + K desde cualquier pantalla. */
export function CommandPalette() {
  const open = useCommandPalette((s) => s.open);
  const setOpen = useCommandPalette((s) => s.setOpen);
  const locked = useLockStore((s) => s.locked);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!useLockStore.getState().locked) setOpen(!useCommandPalette.getState().open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // Al bloquear la app, se cierra.
  useEffect(() => {
    if (locked) setOpen(false);
  }, [locked, setOpen]);

  return open ? <Palette onClose={() => setOpen(false)} /> : null;
}
