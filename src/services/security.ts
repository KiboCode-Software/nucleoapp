/**
 * Bloqueo de la app con código y Windows Hello. El código se guarda como hash y se
 * verifica en Rust (src-tauri/src/security.rs), que también impone las esperas.
 */
export interface SecurityStatus {
  enabled: boolean;
  /** Dígitos del código (4 o 6). */
  length: number;
  hello: boolean;
  hello_available: boolean;
  /** Minutos sin usar la app antes de bloquearla; null = solo al abrir. */
  auto_lock_minutes: number | null;
  failed: number;
  /** Hasta cuándo (ms) no se admiten intentos tras varios fallos. */
  locked_until: number;
}

export interface Attempt {
  ok: boolean;
  failed: number;
  locked_until: number;
}

export const AUTO_LOCK_OPTIONS = [null, 1, 5, 15] as const;

const DISABLED: SecurityStatus = {
  enabled: false,
  length: 6,
  hello: false,
  hello_available: false,
  auto_lock_minutes: null,
  failed: 0,
  locked_until: 0,
};

export interface SecurityApi {
  status(): Promise<SecurityStatus>;
  setPin(current: string | null, pin: string): Promise<void>;
  disablePin(current: string): Promise<void>;
  verifyPin(pin: string): Promise<Attempt>;
  setOptions(hello: boolean, autoLockMinutes: number | null): Promise<void>;
  helloVerify(reason: string): Promise<boolean>;
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

const tauriApi: SecurityApi = {
  status: () => invoke("security_status"),
  setPin: (current, pin) => invoke("set_pin", { current, pin }),
  disablePin: (current) => invoke("disable_pin", { current }),
  verifyPin: (pin) => invoke("verify_pin", { pin }),
  setOptions: (hello, autoLockMinutes) => invoke("set_security_options", { hello, autoLockMinutes }),
  helloVerify: (reason) => invoke("hello_verify", { reason }),
};

/**
 * Versión en memoria para el navegador y las pruebas (sin hash ni esperas).
 * `?bloqueo=1234` en la URL arranca con ese código para revisar la pantalla de bloqueo.
 */
export function createMemorySecurityApi(initialPin: string | null = null): SecurityApi {
  let pin = initialPin;
  let options = { hello: false, auto_lock_minutes: null as number | null };
  return {
    status: async () => ({ ...DISABLED, ...options, hello: false, enabled: pin != null, length: pin?.length ?? 6 }),
    setPin: async (current, next) => {
      if (pin != null && current !== pin) throw new Error("El código actual no es correcto.");
      pin = next;
    },
    disablePin: async (current) => {
      if (current !== pin) throw new Error("El código actual no es correcto.");
      pin = null;
    },
    verifyPin: async (attempt) => ({ ok: attempt === pin, failed: attempt === pin ? 0 : 1, locked_until: 0 }),
    setOptions: async (hello, autoLockMinutes) => {
      options = { hello, auto_lock_minutes: autoLockMinutes };
    },
    helloVerify: async () => false,
  };
}

const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const previewPin = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("bloqueo"));

export const securityApi: SecurityApi = inTauri() ? tauriApi : createMemorySecurityApi(previewPin());
