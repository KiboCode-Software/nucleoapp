import { useEffect, useState } from "react";
import { isTauri } from "@/database/client";
import { EMPTY_OVERVIEW_STATS, getOverviewStats, type OverviewStats } from "@/database/repositories/overview.repository";

export function useOverviewStats(): { stats: OverviewStats; loading: boolean } {
  const [stats, setStats] = useState(EMPTY_OVERVIEW_STATS);
  const [loading, setLoading] = useState(isTauri);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    getOverviewStats()
      .then((result) => !cancelled && setStats(result))
      .catch((error: unknown) => console.error("No se pudieron cargar las estadísticas", error))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loading };
}
