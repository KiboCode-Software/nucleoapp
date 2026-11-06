import { Check, Pencil, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ConfirmDelete } from "@/components/shared/ConfirmDelete";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/fields";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { Mode, Profile } from "@/database/profiles";
import { MODE_META } from "@/modes/meta";
import { ensureProfileLoaded, useProfileStore } from "@/stores/profile.store";
import { cn } from "@/utils/cn";

const MODE_SEGMENTS = (Object.keys(MODE_META) as Mode[]).map((mode) => ({ value: mode, label: MODE_META[mode].label }));

const inTauri = () => "__TAURI_INTERNALS__" in window;

function ProfileEditor({
  initial,
  submitLabel,
  hint,
  onSubmit,
  onCancel,
}: {
  initial: { name: string; mode: Mode };
  submitLabel: string;
  hint?: string;
  onSubmit: (name: string, mode: Mode) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [mode, setMode] = useState(initial.mode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Ponle un nombre al perfil.");
    setBusy(true);
    try {
      await onSubmit(name.trim(), mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-fill/60 p-3.5" aria-label={submitLabel}>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          maxLength={40}
          autoFocus
          aria-label="Nombre del perfil"
          placeholder="p. ej. Universidad"
          className={fieldClass + " h-9 min-w-0 flex-1"}
        />
        <div className="w-52">
          <SegmentedControl<Mode> label="Modo del perfil" value={mode} onChange={setMode} segments={MODE_SEGMENTS} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Guardando…" : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <span role="status" className="text-[12.5px]">
          {error ? <span className="text-danger">{error}</span> : hint && <span className="text-ink-muted">{hint}</span>}
        </span>
      </div>
    </form>
  );
}

/**
 * Perfiles: cada uno con su propia base de datos y su modo (desarrollo o estudio).
 * Al cambiar de perfil las ventanas se recargan con la otra base de datos.
 */
export function ProfilesCard() {
  const { profiles, active, createAndSwitch, switchTo, update, remove, configureActive } = useProfileStore();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const desktop = inTauri();

  useEffect(ensureProfileLoaded, []);

  const save = async (profile: Profile, name: string, mode: Mode) => {
    if (profile.id === active.id) await configureActive({ name, mode });
    else await update(profile.id, name, mode);
    setEditing(null);
  };

  return (
    <Card title="Perfiles">
      <p className="mb-3 text-[12.5px] text-ink-muted">
        Cada perfil guarda sus datos por separado. El modo cambia los nombres y módulos: en Estudio aparecen materias, dudas, apuntes y entregas.
      </p>

      <ul className="flex flex-col gap-1.5" aria-label="Perfiles">
        {profiles.map((profile) => {
          const { icon: Icon, tint, label } = MODE_META[profile.mode];
          const isActive = profile.id === active.id;
          if (editing === profile.id) {
            return (
              <li key={profile.id}>
                <ProfileEditor
                  initial={profile}
                  submitLabel="Guardar perfil"
                  onSubmit={(name, mode) => save(profile, name, mode)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            );
          }
          return (
            <li key={profile.id} className={cn("flex items-center gap-3 rounded-xl px-2 py-2", isActive && "bg-accent-soft/60")}>
              <span className="grid size-9 shrink-0 place-items-center rounded-[9px] text-white" style={{ backgroundColor: tint }}>
                <Icon className="size-[18px]" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-[14px] font-medium">
                  {profile.name}
                  {isActive && (
                    <Badge tone="accent">
                      <Check className="mr-0.5 inline size-3" strokeWidth={3} />
                      En uso
                    </Badge>
                  )}
                </p>
                <p className="text-[12.5px] text-ink-muted">Modo {label.toLowerCase()}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(profile.id)}
                aria-label={`Editar ${profile.name}`}
                className="pressable grid size-8 place-items-center rounded-full text-ink-muted hover:bg-fill hover:text-ink"
              >
                <Pencil className="size-4" />
              </button>
              {!isActive && desktop && (
                <>
                  <Button
                    variant="secondary"
                    disabled={switching !== null}
                    onClick={() => {
                      setSwitching(profile.id);
                      void switchTo(profile.id).catch((error: unknown) => {
                        console.error("No se pudo cambiar de perfil", error);
                        setSwitching(null);
                      });
                    }}
                  >
                    {switching === profile.id ? "Abriendo…" : "Abrir"}
                  </Button>
                  <ConfirmDelete
                    label={`Quitar ${profile.name}`}
                    question="¿Quitar el perfil? Su base de datos se conserva en la carpeta de la app."
                    onConfirm={() => remove(profile.id)}
                  />
                </>
              )}
            </li>
          );
        })}
      </ul>

      {desktop && (
        <div className="mt-3">
          {editing === "new" ? (
            <ProfileEditor
              initial={{ name: "", mode: active.mode === "dev" ? "student" : "dev" }}
              submitLabel="Crear y abrir"
              hint="Se abrirá el perfil nuevo, vacío."
              onSubmit={(name, mode) => createAndSwitch(name, mode)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <Button variant="secondary" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Nuevo perfil
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
