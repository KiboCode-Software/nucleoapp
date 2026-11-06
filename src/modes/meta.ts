import { Code, GraduationCap, type LucideIcon } from "lucide-react";
import type { Mode } from "@/database/profiles";

/** Nombre, icono y color de cada modo (perfiles, barra lateral, onboarding). */
export const MODE_META: Record<Mode, { label: string; icon: LucideIcon; tint: string }> = {
  dev: { label: "Desarrollo", icon: Code, tint: "#007AFF" },
  student: { label: "Estudio", icon: GraduationCap, tint: "#FF9500" },
};
