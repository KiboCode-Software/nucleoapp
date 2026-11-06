import { Check, ChevronsUpDown, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { MODE_META } from "@/modes/meta";
import { ensureProfileLoaded, useProfileStore } from "@/stores/profile.store";
import { cn } from "@/utils/cn";

/** Perfil en uso bajo el nombre de la app; al pulsarlo, menú para cambiar a otro. */
export function ProfileSwitcher() {
  const { profiles, active, switchTo } = useProfileStore();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { icon: Icon, tint, label } = MODE_META[active.mode];

  useEffect(ensureProfileLoaded, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative px-3 pb-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Perfil: ${active.name} (modo ${label.toLowerCase()})`}
        className="pressable flex w-full items-center gap-2.5 rounded-[10px] bg-fill/70 px-2.5 py-2 text-left hover:bg-fill"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-[6px] text-white" style={{ backgroundColor: tint }}>
          <Icon className="size-3.5" strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] leading-tight font-semibold">{active.name}</span>
          <span className="block text-[11.5px] leading-tight text-ink-muted">Modo {label.toLowerCase()}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-muted" />
      </button>

      {open && (
        <div role="menu" aria-label="Cambiar de perfil" className="material animate-pop absolute inset-x-3 top-full z-50 mt-1 rounded-xl border border-separator/60 bg-surface/95 p-1 shadow-card">
          {profiles.map((profile) => {
            const meta = MODE_META[profile.mode];
            const isActive = profile.id === active.id;
            return (
              <button
                key={profile.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                disabled={switching !== null}
                onClick={() => {
                  if (isActive) return setOpen(false);
                  setSwitching(profile.id);
                  void switchTo(profile.id).catch((error: unknown) => {
                    console.error("No se pudo cambiar de perfil", error);
                    setSwitching(null);
                  });
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13.5px] hover:bg-fill disabled:opacity-60"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-[5px] text-white" style={{ backgroundColor: meta.tint }}>
                  <meta.icon className="size-3" strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1 truncate">{switching === profile.id ? "Abriendo…" : profile.name}</span>
                {isActive && <Check className="size-4 text-accent" strokeWidth={2.5} />}
              </button>
            );
          })}
          <div className={cn("my-1 h-px bg-separator/60", profiles.length === 0 && "hidden")} />
          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] text-accent hover:bg-fill"
          >
            <Settings2 className="size-4" /> Gestionar perfiles…
          </Link>
        </div>
      )}
    </div>
  );
}
