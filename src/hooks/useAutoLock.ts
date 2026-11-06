import { useEffect } from "react";
import { useLockStore } from "@/stores/lock.store";

const ACTIVITY = ["pointerdown", "pointermove", "keydown", "wheel"] as const;

/**
 * Bloquea la app tras `auto_lock_minutes` sin usarla y con Ctrl+L.
 * Mide con el reloj: minimizada no hay actividad, así que al volver ya está bloqueada.
 */
export function useAutoLock() {
  const enabled = useLockStore((s) => s.security?.enabled ?? false);
  const minutes = useLockStore((s) => s.security?.auto_lock_minutes ?? null);
  const locked = useLockStore((s) => s.locked);
  const lock = useLockStore((s) => s.lock);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        lock();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, lock]);

  useEffect(() => {
    if (!enabled || locked || minutes == null) return;
    let last = Date.now();
    const touch = () => (last = Date.now());
    const check = () => {
      if (Date.now() - last >= minutes * 60_000) lock();
    };
    ACTIVITY.forEach((type) => window.addEventListener(type, touch, { passive: true }));
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 10_000);
    return () => {
      ACTIVITY.forEach((type) => window.removeEventListener(type, touch));
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, [enabled, locked, minutes, lock]);
}
