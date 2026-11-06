import { ArrowLeft, Bell, Check, CircleAlert, CircleHelp, Code, Database, EyeOff, GraduationCap, HardDrive, ListTodo, Lock, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { AppIcon } from "@/components/shell/AppIcon";
import { GlassBackdrop } from "@/components/shell/GlassBackdrop";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/fields";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { projectsRepository } from "@/database/repositories/projects.repository";
import { DEFAULT_PROFILE, type Mode } from "@/database/profiles";
import { useVocab } from "@/modes/vocabulary";
import { notify } from "@/services/reminder";
import { useProfileStore } from "@/stores/profile.store";
import { useSettingsStore } from "@/stores/settings.store";
import { useUiStore, type Theme } from "@/stores/ui.store";
import { cn } from "@/utils/cn";

const STEPS = ["welcome", "profile", "day", "privacy", "personalize", "ready"] as const;

/** Paso en el que se crea el perfil: no se puede avanzar (ni saltar) sin completarlo. */
const PROFILE_STEP = STEPS.indexOf("profile");

const MODE_CHOICES: Array<{ mode: Mode; icon: LucideIcon; tint: string; title: string; text: string }> = [
  { mode: "dev", icon: Code, tint: "#007AFF", title: "Desarrollo", text: "Tareas, bloqueos técnicos, comandos y proyectos." },
  { mode: "student", icon: GraduationCap, tint: "#FF9500", title: "Estudio", text: "Materias, dudas, apuntes, entregas y exámenes." },
];

function Feature({ icon: Icon, tint, title, children }: { icon: LucideIcon; tint: string; title: string; children: ReactNode }) {
  return (
    <li className="glass flex items-start gap-3.5 rounded-2xl p-3.5 shadow-none">
      <span className="grid size-10 shrink-0 place-items-center rounded-[11px] text-white" style={{ backgroundColor: tint }}>
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">{title}</p>
        <p className="text-[13px] leading-snug text-ink-muted">{children}</p>
      </div>
    </li>
  );
}

function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="text-center">
      <h2 className="text-[28px] leading-tight font-bold tracking-[-0.03em]">{title}</h2>
      {children && <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-ink-muted">{children}</p>}
    </div>
  );
}

/**
 * Bienvenida del primer inicio: seis pasos sobre una hoja de cristal esmerilado.
 * Se puede saltar en cualquier momento; al terminar no vuelve a aparecer.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [project, setProject] = useState("");
  const [reminder, setReminder] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const last = step === STEPS.length - 1;
  const v = useVocab();
  const configureActive = useProfileStore((s) => s.configureActive);
  const student = v.mode === "student";
  const [profileName, setProfileName] = useState("");
  const [chosenMode, setChosenMode] = useState<Mode | null>(null);
  // Un perfil creado desde Ajustes ya trae nombre y modo: se proponen tal cual.
  const activeProfile = useProfileStore((s) => (s.status === "ready" ? s.active : null));
  useEffect(() => {
    if (!activeProfile || activeProfile.id === DEFAULT_PROFILE.id) return;
    setProfileName((name) => name || activeProfile.name);
    setChosenMode((mode) => mode ?? activeProfile.mode);
  }, [activeProfile]);
  const [profileDone, setProfileDone] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const profileReady = profileName.trim().length > 0 && chosenMode !== null;
  // Más allá del perfil solo se llega después de crearlo.
  const locked = (target: number) => target > PROFILE_STEP && !profileDone;

  const chooseMode = (mode: Mode) => {
    setChosenMode(mode);
    // El vocabulario cambia al momento para que los pasos siguientes ya hablen el idioma del modo.
    void configureActive({ mode });
  };

  async function saveProfile() {
    if (!profileReady || savingProfile) return;
    setSavingProfile(true);
    await configureActive({ name: profileName.trim(), mode: chosenMode });
    setSavingProfile(false);
    setProfileDone(true);
    go(PROFILE_STEP + 1, true);
  }

  const next = () => (step === PROFILE_STEP ? void saveProfile() : go(step + 1));

  const go = (next: number, force = false) => {
    if (next < 0 || next >= STEPS.length) return;
    if (!force && locked(next)) return;
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  async function complete(applyChoices: boolean) {
    setFinishing(true);
    const { update, patch, status } = useSettingsStore.getState();
    try {
      if (applyChoices && status === "ready") {
        if (project.trim()) await projectsRepository.create({ name: project.trim() }).catch(() => undefined);
        if (reminder && (await notify("Núcleo", "Te recordaré tu registro del día a las 17:30.").catch(() => false))) {
          await patch("reminder", { enabled: true });
        }
      }
      if (status === "ready") await update("onboarding_completed", true);
    } catch (error) {
      console.error("No se pudo guardar la configuración inicial", error);
    }
    onDone();
    if (applyChoices) navigate("/daily-log");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.tagName === "INPUT") return;
      if (event.key === "ArrowRight" && !last && step !== PROFILE_STEP) go(step + 1);
      if (event.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const content: Record<(typeof STEPS)[number], ReactNode> = {
    welcome: (
      <div className="flex flex-col items-center gap-7 pt-6">
        <AppIcon size={112} className="animate-pop" />
        <Heading title="Te damos la bienvenida a Núcleo">
          Registra tu jornada: lo que planeas, lo que te frena y lo que aprendes.
        </Heading>
      </div>
    ),
    profile: (
      <div className="flex flex-col gap-5 px-1">
        <Heading title="Crea tu perfil">Elige para qué lo usarás: adaptamos los nombres y los módulos. Luego puedes crear más en Ajustes.</Heading>
        <input
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void saveProfile()}
          autoFocus
          maxLength={40}
          aria-label="Nombre del perfil"
          placeholder={chosenMode === "student" ? "Nombre del perfil · p. ej. Universidad" : chosenMode === "dev" ? "Nombre del perfil · p. ej. Trabajo" : "Nombre del perfil"}
          className={fieldClass + " h-11 text-[15px]"}
        />
        <div role="radiogroup" aria-label="Modo del perfil" className="flex flex-col gap-3">
          {MODE_CHOICES.map(({ mode, icon: Icon, tint, title, text }) => {
            const checked = chosenMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => chooseMode(mode)}
                className={cn(
                  // Anillo por dentro: el contenedor del paso recorta lo que sobresale.
                  "glass pressable flex items-center gap-4 rounded-2xl p-4 text-left shadow-none ring-2 ring-inset transition-[box-shadow]",
                  checked ? "ring-accent" : "ring-transparent",
                )}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-[13px] text-white" style={{ backgroundColor: tint }}>
                  <Icon className="size-6" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold tracking-[-0.01em]">{title}</span>
                  <span className="block text-[13px] leading-snug text-ink-muted">{text}</span>
                </span>
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border-2",
                    checked ? "border-accent bg-accent text-white" : "border-ink/20",
                  )}
                >
                  {checked && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
        {!profileReady && (
          <p className="text-center text-[13px] text-ink-muted">
            {!profileName.trim() ? "Escribe un nombre para tu perfil" : "Elige Desarrollo o Estudio"} para continuar.
          </p>
        )}
      </div>
    ),
    day: (
      <div className="flex flex-col gap-6">
        <Heading title="Tu día, en tres momentos">Cada cosa a su hora, sin formularios largos. Todo se guarda solo.</Heading>
        <ul className="flex flex-col gap-2.5">
          <Feature icon={ListTodo} tint="#FF9500" title={`Por la mañana · ${v.day.planTitle}`}>
            {student ? "Anota qué temas y tareas vas a estudiar y táchalos al terminar." : "Anota tus tareas y táchalas a medida que avanzas."}
          </Feature>
          <Feature icon={student ? CircleHelp : CircleAlert} tint="#007AFF" title={`Durante el día · ${v.day.blockersTitle}`}>
            {student ? "Lo que no entiendas, anótalo para resolverlo o preguntarlo en clase." : "Cuando algo te frene, déjalo escrito y conviértelo en un seguimiento."}
          </Feature>
          <Feature icon={GraduationCap} tint="#AF52DE" title={`Al cerrar · ${v.day.learningsTitle}`}>
            {student ? "Conceptos, fórmulas y ejercicios, listos para repasar antes del examen." : "Lo que descubriste hoy, para no tener que volver a buscarlo."}
          </Feature>
        </ul>
        <p className="text-center text-[13px] text-ink-muted">{student ? "Con eso se generan tus resúmenes de estudio." : "Con eso se generan tus reportes diarios y semanales."}</p>
      </div>
    ),
    privacy: (
      <div className="flex flex-col gap-6">
        <div className="flex justify-center">
          <span className="grid size-16 place-items-center rounded-[18px] bg-[#34C759] text-white shadow-[0_10px_30px_rgb(52_199_89/0.35)]">
            <Lock className="size-8" strokeWidth={2} />
          </span>
        </div>
        <Heading title="Tus datos son tuyos" />
        <ul className="flex flex-col gap-2.5">
          <Feature icon={Database} tint="#5856D6" title="Todo en tu equipo">
            Una base de datos local. Funciona sin internet.
          </Feature>
          <Feature icon={EyeOff} tint="#8E8E93" title="Sin cuenta ni telemetría">
            No hay servidor ni seguimiento. Nadie más ve lo que escribes.
          </Feature>
          <Feature icon={HardDrive} tint="#00C7BE" title="Respaldos automáticos">
            Una copia al día y exportaciones cifradas cuando las necesites.
          </Feature>
        </ul>
      </div>
    ),
    personalize: (
      <div className="flex flex-col gap-6">
        <Heading title="Hazla tuya">Puedes cambiar todo esto más tarde en Ajustes.</Heading>
        <div className="glass flex flex-col gap-5 rounded-2xl p-5 shadow-none">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[15px] font-medium">Apariencia</p>
            <div className="w-44">
              <SegmentedControl<Theme>
                label="Apariencia"
                value={theme}
                onChange={setTheme}
                segments={[
                  { value: "light", label: "Claro" },
                  { value: "dark", label: "Oscuro" },
                ]}
              />
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[15px] font-medium">{v.project.yourFirst}</span>
            <input
              value={project}
              onChange={(e) => setProject(e.target.value)}
              maxLength={80}
              placeholder={student ? "Opcional · p. ej. Cálculo diferencial" : "Opcional · p. ej. Prácticas en Acme"}
              className={fieldClass + " h-11 text-[15px]"}
            />
          </label>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-[15px] font-medium">
                <Bell className="size-4 text-ink-muted" /> Recordatorio diario
              </p>
              <p className="text-[13px] text-ink-muted">A las 17:30, si aún no anotaste nada.</p>
            </div>
            <Switch label="Recordatorio diario" checked={reminder} onChange={setReminder} />
          </div>
        </div>
      </div>
    ),
    ready: (
      <div className="flex flex-col items-center gap-7 pt-6">
        <span className="animate-pop grid size-24 place-items-center rounded-full bg-success text-white shadow-[0_14px_40px_rgb(52_199_89/0.4)]">
          <Check className="size-12" strokeWidth={3} />
        </span>
        <Heading title="Todo listo">Empieza anotando lo que quieres sacar adelante hoy.</Heading>
        <p className="glass flex items-center gap-2 rounded-full px-4 py-2 text-[13px] shadow-none">
          <Zap className="size-4 text-[#AF52DE]" />
          Captura una idea desde cualquier app con
          {["Ctrl", "Shift", "Espacio"].map((key) => (
            <kbd key={key} className="rounded-md bg-fill px-1.5 py-0.5 font-sans text-[12px] font-semibold">
              {key}
            </kbd>
          ))}
        </p>
      </div>
    ),
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Bienvenida a Núcleo" className="fixed inset-0 z-[90] grid place-items-center p-6">
      <GlassBackdrop />

      <div className="glass animate-sheet relative flex min-h-[560px] w-full max-w-[560px] flex-col rounded-[30px] px-8 pt-6 pb-7">
        <div className="flex h-8 items-center justify-between">
          {step > 0 ? (
            <button type="button" onClick={() => go(step - 1)} className="pressable inline-flex items-center gap-1 text-[15px] font-medium text-accent">
              <ArrowLeft className="size-4" /> Atrás
            </button>
          ) : (
            <span />
          )}
          {!last && profileDone && (
            <button type="button" onClick={() => void complete(false)} className="pressable text-[15px] text-ink-muted hover:text-ink">
              Saltar
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center overflow-hidden py-4">
          <div key={step} className={direction === 1 ? "animate-push" : "animate-push-back"} data-step={STEPS[step]}>
            {content[STEPS[step]]}
          </div>
        </div>

        <div className="flex flex-col items-center gap-5">
          <div role="tablist" aria-label="Pasos" className="flex items-center gap-2">
            {STEPS.map((id, i) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-label={`Paso ${i + 1} de ${STEPS.length}`}
                disabled={locked(i)}
                onClick={() => go(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300 ease-[var(--ease-ios)]",
                  i === step ? "w-6 bg-ink" : "w-2 bg-ink/20 hover:bg-ink/35",
                )}
              />
            ))}
          </div>
          <Button
            className="h-12 w-full rounded-[14px] text-[16px]"
            disabled={finishing || savingProfile || (step === PROFILE_STEP && !profileReady)}
            onClick={() => (last ? void complete(true) : next())}
          >
            {last ? "Empezar mi día" : step === PROFILE_STEP && !profileDone ? "Crear perfil" : "Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
