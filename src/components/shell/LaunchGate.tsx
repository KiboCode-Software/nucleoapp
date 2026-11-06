import { useEffect, useRef, useState } from "react";
import { Onboarding } from "@/modules/onboarding/Onboarding";
import { ensureDailyLogsLoaded } from "@/stores/daily-logs.store";
import { useAutoLock } from "@/hooks/useAutoLock";
import { ensureLockLoaded, useLockStore } from "@/stores/lock.store";
import { ensureProfileLoaded } from "@/stores/profile.store";
import { LockScreen } from "./LockScreen";
import { ensureSettingsLoaded, useSettingsStore } from "@/stores/settings.store";
import { Splash } from "./Splash";
import { isDemo } from "@/database/client";

// En pruebas no hay que esperar: el splash solo se muestra mientras carga.
// En pruebas y en el modo demostración (capturas de la web) no hay splash que esperar.
const SKIP_SPLASH = import.meta.env.MODE === "test" || isDemo();
const MIN_SPLASH_MS = SKIP_SPLASH ? 0 : 1200;
const EXIT_MS = SKIP_SPLASH ? 0 : 520;

/** `?onboarding` en la URL fuerza la bienvenida (para revisarla en el navegador). */
const forceOnboarding = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("onboarding");

/**
 * Arranque de la ventana principal: splash mientras se abre la base de datos,
 * la pantalla de bloqueo si hay código y, la primera vez, el onboarding.
 */
export function LaunchGate() {
  const status = useSettingsStore((s) => s.status);
  const completed = useSettingsStore((s) => s.settings.onboarding_completed);
  const [phase, setPhase] = useState<"splash" | "leaving" | "done">("splash");
  const [onboardingClosed, setOnboardingClosed] = useState(false);
  const started = useRef(Date.now());
  const lockStatus = useLockStore((s) => s.status);
  const locked = useLockStore((s) => s.locked);
  useAutoLock();

  useEffect(() => {
    // El perfil decide el vocabulario: se lee a la vez que se abre su base de datos.
    ensureProfileLoaded();
    // Antes de quitar el splash hay que saber si la app arranca bloqueada.
    ensureLockLoaded();
    void ensureSettingsLoaded();
    ensureDailyLogsLoaded();
  }, []);

  const loaded = (status === "ready" || status === "unavailable" || status === "error") && lockStatus === "ready";

  useEffect(() => {
    if (!loaded || phase !== "splash") return;
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - started.current));
    const toLeaving = window.setTimeout(() => setPhase("leaving"), wait);
    const toDone = window.setTimeout(() => setPhase("done"), wait + EXIT_MS);
    return () => {
      window.clearTimeout(toLeaving);
      window.clearTimeout(toDone);
    };
  }, [loaded, phase]);

  const showOnboarding = phase !== "splash" && !onboardingClosed && ((status === "ready" && !completed) || forceOnboarding());

  return (
    <>
      {showOnboarding && <Onboarding onDone={() => setOnboardingClosed(true)} />}
      {/* Bajo el splash y sobre todo lo demás: la app nunca se ve sin desbloquear. */}
      {locked && <LockScreen />}
      {phase !== "done" && <Splash leaving={phase === "leaving"} />}
    </>
  );
}
