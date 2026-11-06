import {
  BookOpen,
  CalendarClock,
  CircleAlert,
  CircleHelp,
  FileText,
  FolderKanban,
  LayoutGrid,
  Lightbulb,
  NotebookPen,
  NotebookText,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Mode } from "@/database/profiles";
import { useVocab, type Vocabulary } from "@/modes/vocabulary";

export type ModuleGroup = "general" | "tracking" | "output" | "system";

export interface AppModule {
  id: string;
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: ModuleGroup;
  /** Fase del roadmap (docs/especificacion.md §10) en la que se implementa. */
  phase: number;
  features: string[];
  /** Modos en los que aparece; sin indicar, en todos. */
  modes?: Mode[];
  /** Icono alternativo en modo estudiante. */
  studentIcon?: LucideIcon;
}

/** Los módulos de la aplicación, en el orden de la barra lateral. */
export const MODULES: AppModule[] = [
  {
    id: "dashboard",
    path: "/",
    label: "Resumen",
    description: "Tu jornada de un vistazo.",
    icon: LayoutGrid,
    group: "general",
    phase: 2,
    features: ["Resumen de la jornada", "Actividades recientes", "Bloqueos pendientes", "Estadísticas semanales", "Accesos rápidos"],
  },
  {
    id: "daily-log",
    path: "/daily-log",
    label: "Registro diario",
    description: "Planifica tu día, anota bloqueos y lo que aprendes, cada cosa en su momento.",
    icon: NotebookPen,
    group: "general",
    phase: 3,
    features: ["Plan del día con tareas", "Bloqueos durante el día", "Aprendizajes al cerrar", "Historial por meses"],
  },
  {
    id: "deadlines",
    path: "/deadlines",
    label: "Entregas",
    description: "Trabajos, exámenes y exposiciones con su fecha límite.",
    icon: CalendarClock,
    group: "general",
    phase: 8,
    features: ["Trabajos, exámenes y exposiciones", "Cuenta regresiva", "Ponderación y nota", "Por materia"],
    modes: ["student"],
  },
  {
    id: "blockers",
    path: "/blockers",
    label: "Bloqueos",
    description: "Problemas técnicos y cómo se resolvieron.",
    icon: CircleAlert,
    studentIcon: CircleHelp,
    group: "tracking",
    phase: 3,
    features: ["Documentar problemas técnicos", "Asociarlos a proyectos", "Registrar intentos de solución", "Tiempo abierto", "Estados: pendiente, resuelto y escalado"],
  },
  {
    id: "learning",
    path: "/learning",
    label: "Aprendizajes",
    description: "Conceptos, comandos y errores solucionados.",
    icon: Lightbulb,
    studentIcon: NotebookText,
    group: "tracking",
    phase: 3,
    features: ["Conocimientos nuevos", "Errores solucionados", "Comandos", "Conceptos técnicos", "Etiquetas y tecnologías"],
  },
  {
    id: "projects",
    path: "/projects",
    label: "Proyectos",
    description: "Avances, problemas e historial por proyecto.",
    icon: FolderKanban,
    studentIcon: BookOpen,
    group: "tracking",
    phase: 3,
    features: ["Crear proyectos", "Asociar registros diarios", "Consultar avances", "Problemas por proyecto", "Historial de trabajo"],
  },
  {
    id: "reports",
    path: "/reports",
    label: "Reportes",
    description: "Reportes diarios y semanales generados localmente.",
    icon: FileText,
    group: "output",
    phase: 4,
    features: ["Reportes diarios", "Reportes semanales", "Resumen de actividades", "Resumen de bloqueos", "Exportación en PDF, CSV y Markdown"],
  },
  {
    id: "quick-capture",
    path: "/quick-capture",
    label: "Captura rápida",
    description: "Anota una idea sin salir de lo que estás haciendo.",
    icon: Zap,
    group: "output",
    phase: 5,
    features: ["Ventana flotante", "Atajo de teclado global", "Registro rápido", "Clasificación posterior", "Guardado local inmediato"],
  },
  {
    id: "settings",
    path: "/settings",
    label: "Ajustes",
    description: "Apariencia, respaldos y privacidad.",
    icon: Settings,
    group: "system",
    phase: 5,
    features: ["Preferencias visuales", "Notificaciones", "Ubicación de respaldos", "Exportación e importación", "Privacidad"],
  },
];

export const GROUP_LABELS: Record<ModuleGroup, string | null> = {
  general: null,
  tracking: "Seguimiento",
  output: "Salidas",
  system: null,
};

export function getModule(id: string): AppModule {
  const module = MODULES.find((m) => m.id === id);
  if (!module) throw new Error(`Módulo desconocido: ${id}`);
  return module;
}

/** El módulo con los nombres e iconos del modo indicado. */
export function localizeModule(module: AppModule, vocab: Vocabulary): AppModule {
  const text = vocab.modules[module.id];
  return {
    ...module,
    ...text,
    icon: vocab.mode === "student" ? (module.studentIcon ?? module.icon) : module.icon,
  };
}

/** Módulos visibles en el modo del perfil activo, con su vocabulario. */
export function useModules(): AppModule[] {
  const vocab = useVocab();
  return MODULES.filter((m) => !m.modes || m.modes.includes(vocab.mode)).map((m) => localizeModule(m, vocab));
}

export function useModule(id: string): AppModule {
  return localizeModule(getModule(id), useVocab());
}
