import { useBlockersStore } from "@/stores/blockers.store";
import { useDailyLogsStore } from "@/stores/daily-logs.store";
import { useLearningsStore } from "@/stores/learnings.store";
import { DEFAULT_SETTINGS } from "@/database/repositories/settings.repository";
import { useSettingsStore } from "@/stores/settings.store";
import { DEFAULT_PROFILE, type Mode } from "@/database/profiles";
import { useProfileStore } from "@/stores/profile.store";
import { useDeadlinesStore } from "@/stores/deadlines.store";

/** Vacía los stores globales para que cada prueba lea de su propia base de datos. */
export function resetStores(mode: Mode = "dev") {
  const profile = { ...DEFAULT_PROFILE, mode };
  useProfileStore.setState({ profiles: [profile], active: profile, status: "ready" });
  useDailyLogsStore.setState({ logs: [], status: "idle" });
  useBlockersStore.setState({ blockers: [], status: "idle" });
  useLearningsStore.setState({ learnings: [], status: "idle" });
  useDeadlinesStore.setState({ deadlines: [], status: "idle" });
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, status: "idle" });
}
