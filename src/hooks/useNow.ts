import { useEffect, useState } from "react";

/** Fecha actual que se renueva cada `intervalMs`, para textos como "abierto hace 5 min". */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
