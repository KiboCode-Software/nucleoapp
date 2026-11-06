import { useEffect, useState } from "react";
import { getDatabase, isDemo, isTauri } from "@/database/client";

export type DatabaseStatus = "connecting" | "ready" | "browser" | "error";

/** Estado de la conexión a SQLite, para mostrarlo en la interfaz. */
export function useDatabaseStatus(): DatabaseStatus {
  const [status, setStatus] = useState<DatabaseStatus>(() => (isTauri() ? "connecting" : isDemo() ? "ready" : "browser"));

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    getDatabase()
      .then(() => !cancelled && setStatus("ready"))
      .catch((error: unknown) => {
        console.error("No se pudo abrir la base de datos local", error);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
