import { create } from "zustand";
import { securityApi, type Attempt, type SecurityApi, type SecurityStatus } from "@/services/security";

interface LockState {
  status: "idle" | "ready";
  security: SecurityStatus | null;
  /** La pantalla de bloqueo tapa la app. */
  locked: boolean;
  load: () => Promise<void>;
  lock: () => void;
  /** Quita la pantalla de bloqueo (tras verificar el código o Windows Hello). */
  unlock: () => void;
  /** Pide Windows Hello; si se verifica, también borra los fallos. */
  helloVerify: () => Promise<boolean>;
  /** Comprueba el código actual (cuenta como intento: respeta las esperas). */
  verify: (pin: string) => Promise<Attempt>;
  setPin: (current: string | null, pin: string) => Promise<void>;
  disable: (current: string) => Promise<void>;
  setOptions: (changes: { hello?: boolean; autoLockMinutes?: number | null }) => Promise<void>;
}

export function createLockStore(api: SecurityApi) {
  return create<LockState>()((set, get) => {
    const refresh = async () => set({ security: await api.status() });
    const record = (attempt: Attempt) => {
      const security = get().security;
      if (security) set({ security: { ...security, failed: attempt.failed, locked_until: attempt.locked_until } });
    };

    return {
      status: "idle",
      security: null,
      locked: false,

      load: async () => {
        try {
          const security = await api.status();
          // Con código, la app arranca bloqueada.
          set({ security, locked: security.enabled, status: "ready" });
        } catch (error) {
          console.error("No se pudo leer la configuración de bloqueo", error);
          set({ status: "ready" });
        }
      },

      lock: () => {
        if (get().security?.enabled) set({ locked: true });
      },

      unlock: () => set({ locked: false }),

      helloVerify: async () => {
        const verified = await api.helloVerify("Desbloquea Núcleo");
        if (verified) record({ ok: true, failed: 0, locked_until: 0 });
        return verified;
      },

      verify: async (pin) => {
        const attempt = await api.verifyPin(pin);
        record(attempt);
        return attempt;
      },

      setPin: async (current, pin) => {
        await api.setPin(current, pin);
        await refresh();
      },

      disable: async (current) => {
        await api.disablePin(current);
        await refresh();
      },

      setOptions: async ({ hello, autoLockMinutes }) => {
        const security = get().security;
        if (!security) return;
        await api.setOptions(hello ?? security.hello, autoLockMinutes === undefined ? security.auto_lock_minutes : autoLockMinutes);
        await refresh();
      },
    };
  });
}

export const useLockStore = createLockStore(securityApi);

export function ensureLockLoaded() {
  if (useLockStore.getState().status === "idle") void useLockStore.getState().load();
}
