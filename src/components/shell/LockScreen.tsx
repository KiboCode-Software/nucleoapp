import { Lock, ScanFace } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PasscodePad } from "@/components/security/PasscodePad";
import { useLockStore } from "@/stores/lock.store";
import { useProfileStore } from "@/stores/profile.store";
import { cn } from "@/utils/cn";
import { GlassBackdrop } from "./GlassBackdrop";

const LEAVE_MS = import.meta.env.MODE === "test" ? 0 : 420;

/**
 * Pantalla de bloqueo al estilo de iOS: fondo difuminado y oscuro, candado,
 * puntos del código y teclado numérico. Con Windows Hello activado, lo pide al aparecer.
 */
export function LockScreen() {
  const security = useLockStore((s) => s.security);
  const verify = useLockStore((s) => s.verify);
  const helloVerify = useLockStore((s) => s.helloVerify);
  const unlock = useLockStore((s) => s.unlock);
  const profile = useProfileStore((s) => s.active.name);
  const [leaving, setLeaving] = useState(false);
  const [helloBusy, setHelloBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const asked = useRef(false);

  // Se desvanece y después deja ver la app.
  const leave = () => {
    setLeaving(true);
    window.setTimeout(unlock, LEAVE_MS);
  };

  const hello = async () => {
    setHelloBusy(true);
    setMessage(null);
    try {
      const ok = await helloVerify();
      if (ok) leave();
      else setMessage("No se pudo verificar con Windows Hello. Usa tu código.");
    } catch (error) {
      console.error("Windows Hello falló", error);
      setMessage("Windows Hello no respondió. Usa tu código.");
    } finally {
      setHelloBusy(false);
    }
  };

  // Como Face ID: al aparecer la pantalla, Windows Hello se pide solo una vez.
  useEffect(() => {
    if (security?.hello && !asked.current) {
      asked.current = true;
      void hello();
    }
  });

  if (!security) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App bloqueada"
      className={cn("fixed inset-0 z-[96] grid place-items-center overflow-y-auto", leaving && "animate-launch pointer-events-none")}
    >
      <GlassBackdrop />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/65" aria-hidden="true" />

      <div className="animate-rise relative flex flex-col items-center py-10">
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
          <Lock className="size-5" strokeWidth={2.25} />
        </span>
        <PasscodePad
          tone="glass"
          length={security.length}
          title="Introduce el código"
          subtitle={message ?? (security.failed > 0 ? `${security.failed} ${security.failed === 1 ? "intento fallido" : "intentos fallidos"}` : `Perfil: ${profile}`)}
          disabledUntil={security.locked_until}
          onSubmit={async (code) => {
            const attempt = await verify(code);
            if (attempt.ok) leave();
            return attempt.ok;
          }}
          leftAction={
            security.hello && (
              <button
                type="button"
                onClick={() => void hello()}
                disabled={helloBusy}
                aria-label="Usar Windows Hello"
                className="pressable grid h-[76px] place-items-center text-white disabled:opacity-50"
              >
                <ScanFace className="size-8" strokeWidth={1.5} />
              </button>
            )
          }
        />
      </div>
    </div>
  );
}
