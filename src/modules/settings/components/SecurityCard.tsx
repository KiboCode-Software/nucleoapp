import { Lock, ScanFace } from "lucide-react";
import { useEffect, useState } from "react";
import { PasscodePad } from "@/components/security/PasscodePad";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { AUTO_LOCK_OPTIONS } from "@/services/security";
import { ensureLockLoaded, useLockStore } from "@/stores/lock.store";

type Flow = "create" | "change" | "disable";

const AUTO_LOCK_LABELS: Record<string, string> = {
  null: "Solo al abrir la app",
  "1": "Tras 1 minuto sin usarla",
  "5": "Tras 5 minutos sin usarla",
  "15": "Tras 15 minutos sin usarla",
};

const FLOW_TITLES: Record<Flow, string> = { create: "Activar código", change: "Cambiar código", disable: "Desactivar código" };

/**
 * Pasos como en Ajustes de iOS: código actual (si lo hay) → código nuevo → repetirlo.
 * El actual se comprueba como un intento más, con sus esperas.
 */
function PasscodeFlow({ flow, length, onDone }: { flow: Flow; length: number; onDone: (message: string | null) => void }) {
  const { verify, setPin, disable } = useLockStore();
  const lockedUntil = useLockStore((s) => s.security?.locked_until ?? 0);
  const [step, setStep] = useState<"current" | "new" | "confirm">(flow === "create" ? "new" : "current");
  const [current, setCurrent] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newLength, setNewLength] = useState(flow === "create" ? 6 : length);
  const [hint, setHint] = useState<string | null>(null);

  const cancel = () => onDone(null);

  if (step === "current") {
    return (
      <PasscodePad
        key="current"
        length={length}
        title="Introduce tu código actual"
        subtitle={hint}
        disabledUntil={lockedUntil}
        onCancel={cancel}
        onSubmit={async (code) => {
          const attempt = await verify(code);
          if (!attempt.ok) {
            setHint("Código incorrecto");
            return false;
          }
          if (flow === "disable") {
            await disable(code);
            onDone("Código desactivado.");
          } else {
            setCurrent(code);
            setHint(null);
            setStep("new");
          }
          return true;
        }}
      />
    );
  }

  if (step === "new") {
    return (
      <PasscodePad
        key={`new-${newLength}`}
        length={newLength}
        title="Introduce un código nuevo"
        subtitle={hint ?? `${newLength} dígitos`}
        onCancel={cancel}
        footer={
          <button
            type="button"
            onClick={() => setNewLength((n) => (n === 6 ? 4 : 6))}
            className="-mt-3 mb-1 text-[14px] font-medium text-accent hover:underline"
          >
            Usar un código de {newLength === 6 ? 4 : 6} dígitos
          </button>
        }
        onSubmit={async (code) => {
          setDraft(code);
          setHint(null);
          setStep("confirm");
          return true;
        }}
      />
    );
  }

  return (
    <PasscodePad
      key="confirm"
      length={newLength}
      title="Vuelve a introducir el código"
      onCancel={cancel}
      onSubmit={async (code) => {
        if (code !== draft) {
          // Como en iOS: si no coinciden, se vuelve a elegir el código.
          setHint("Los códigos no coinciden. Inténtalo de nuevo.");
          setStep("new");
          return false;
        }
        await setPin(current, code);
        onDone(flow === "create" ? "Código activado. Se pedirá al abrir la app." : "Código cambiado.");
        return true;
      }}
    />
  );
}

/** Código de acceso, Windows Hello y bloqueo automático. */
export function SecurityCard() {
  const { security, setOptions, helloVerify, lock } = useLockStore();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(ensureLockLoaded, []);

  if (!security) return null;
  const { enabled } = security;

  const toggleHello = async (on: boolean) => {
    setNotice(null);
    try {
      // Activarlo exige verificarse una vez con Windows Hello.
      if (on && !(await helloVerify())) return setNotice({ tone: "error", text: "No se pudo verificar con Windows Hello." });
      await setOptions({ hello: on });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <Card title="Código y Windows Hello" action={<Lock className="size-4 text-ink-muted" />}>
      <div className="flex flex-col divide-y divide-separator/60">
        <div className="flex items-center justify-between gap-4 pb-3.5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[14px] font-medium">
              Código de acceso {enabled && <Badge tone="success">Activado · {security.length} dígitos</Badge>}
            </p>
            <p className="text-[12.5px] text-ink-muted">Pide un código para abrir la app y al volver tras un rato sin usarla.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {enabled ? (
              <>
                <Button variant="secondary" onClick={() => setFlow("change")}>
                  Cambiar
                </Button>
                <Button variant="ghost" onClick={() => setFlow("disable")}>
                  Desactivar
                </Button>
              </>
            ) : (
              <Button onClick={() => setFlow("create")}>Activar código</Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 py-3.5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[14px] font-medium">
              <ScanFace className="size-4 text-ink-muted" /> Desbloquear con Windows Hello
            </p>
            <p className="text-[12.5px] text-ink-muted">
              {!security.hello_available
                ? "No disponible en este equipo (necesita rostro, huella o PIN de Windows Hello)."
                : enabled
                  ? "Rostro, huella o PIN de Windows. El código sigue sirviendo de respaldo."
                  : "Activa primero el código de acceso."}
            </p>
          </div>
          <Switch
            label="Desbloquear con Windows Hello"
            checked={security.hello}
            disabled={!enabled || !security.hello_available}
            onChange={(on) => void toggleHello(on)}
          />
        </div>

        <div className="flex items-center justify-between gap-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[14px] font-medium">Bloqueo automático</p>
            <p className="text-[12.5px] text-ink-muted">Ctrl + L la bloquea al momento.</p>
          </div>
          <select
            aria-label="Bloqueo automático"
            value={String(security.auto_lock_minutes)}
            disabled={!enabled}
            onChange={(e) => void setOptions({ autoLockMinutes: e.target.value === "null" ? null : Number(e.target.value) })}
            className={fieldClass + " h-9 w-60"}
          >
            {AUTO_LOCK_OPTIONS.map((minutes) => (
              <option key={String(minutes)} value={String(minutes)}>
                {AUTO_LOCK_LABELS[String(minutes)]}
              </option>
            ))}
          </select>
        </div>

        {enabled && (
          <div className="flex items-center justify-between gap-4 pt-3.5">
            <p className="text-[14px] font-medium">Bloquear ahora</p>
            <Button variant="secondary" onClick={lock}>
              <Lock className="size-4" /> Bloquear
            </Button>
          </div>
        )}
      </div>

      {notice && (
        <p role="status" className={notice.tone === "ok" ? "mt-3 text-[13px] text-success" : "mt-3 text-[13px] text-danger"}>
          {notice.text}
        </p>
      )}

      <p className="mt-4 rounded-xl bg-fill/60 px-3 py-2.5 text-[12px] leading-relaxed text-ink-muted">
        El código impide que otra persona abra la app en tu sesión de Windows; los datos del disco no se cifran (para eso, BitLocker). Si lo
        olvidas y no tienes Windows Hello, cierra la app y borra <code className="font-mono">seguridad.json</code> en la carpeta de datos.
      </p>

      {flow && (
        <Sheet title={FLOW_TITLES[flow]} onClose={() => setFlow(null)}>
          <div className="py-2">
            <PasscodeFlow
              flow={flow}
              length={security.length}
              onDone={(message) => {
                setFlow(null);
                if (message) setNotice({ tone: "ok", text: message });
              }}
            />
          </div>
        </Sheet>
      )}
    </Card>
  );
}
