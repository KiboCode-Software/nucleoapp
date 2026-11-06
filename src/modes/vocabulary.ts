import type { Mode } from "@/database/profiles";
import { useMode } from "@/stores/profile.store";
import type { BlockerStatus, LearningKind } from "@/types/entities";

/**
 * Vocabulario de la interfaz según el modo del perfil. Los datos son los mismos
 * (proyectos, bloqueos, aprendizajes…); lo que cambia es cómo se llaman.
 * En modo "dev" los textos son los de siempre.
 */
export interface Vocabulary {
  mode: Mode;
  tagline: string;
  modules: Record<string, { label: string; description: string }>;
  project: {
    /** Género gramatical del sustantivo (para los artículos de los reportes). */
    feminine: boolean;
    /** Etiqueta de campo: "Proyecto" / "Materia". */
    title: string;
    one: string;
    many: string;
    none: string;
    newLabel: string;
    createLabel: string;
    firstTitle: string;
    firstDescription: string;
    placeholder: string;
    active: string;
    ofDay: string;
    all: string;
    noneActive: string;
    missing: string;
    data: string;
    color: string;
    needsName: string;
    deleteLabel: string;
    deleteQuestion: string;
    noLogs: string;
    noLearnings: string;
    yourFirst: string;
  };
  blocker: {
    feminine: boolean;
    one: string;
    many: string;
    newLabel: string;
    registerLabel: string;
    titleField: string;
    titlePlaceholder: string;
    contextPlaceholder: string;
    escalate: string;
    status: Record<BlockerStatus, string>;
    attempts: string;
    attemptsFirst: string;
    attemptsMore: string;
    open: string;
    resolved: string;
    pending: string;
    noneOpen: string;
    noneOpenHint: string;
    registerFromDay: string;
    viewFromDay: string;
    missingTitle: string;
    openSince: string;
    resolvedIn: string;
    markResolved: string;
    filterOpen: string;
    filterResolved: string;
    emptyResolved: string;
    emptyAll: string;
    allClear: string;
    missing: string;
    deleteLabel: string;
    deleteQuestion: string;
    formLabel: string;
    badge: string;
    withBadge: string;
  };
  learning: {
    one: string;
    many: string;
    newLabel: string;
    saveLabel: string;
    saveFromDay: string;
    viewFromDay: string;
    kinds: Record<LearningKind, { label: string; plural: string }>;
    kindLabel: string;
    empty: string;
    missing: string;
    deleteLabel: string;
    deleteQuestion: string;
    badge: string;
    withBadge: string;
  };
  day: {
    planTitle: string;
    planQuestion: string;
    planEmpty: string;
    blockersTitle: string;
    blockersQuestion: string;
    blockersPlaceholder: string;
    learningsTitle: string;
    learningsQuestion: string;
    learningsPlaceholder: string;
  };
  reports: { daily: string; weekly: string; checkIns: [string, string] };
}

const dev: Vocabulary = {
  mode: "dev",
  tagline: "Tu jornada de desarrollo, en tu equipo.",
  modules: {
    dashboard: { label: "Resumen", description: "Tu jornada de un vistazo." },
    "daily-log": { label: "Registro diario", description: "Planifica tu día, anota bloqueos y lo que aprendes, cada cosa en su momento." },
    deadlines: { label: "Entregas", description: "Fechas límite, entregas y exámenes." },
    blockers: { label: "Bloqueos", description: "Problemas técnicos y cómo se resolvieron." },
    learning: { label: "Aprendizajes", description: "Conceptos, comandos y errores solucionados." },
    projects: { label: "Proyectos", description: "Avances, problemas e historial por proyecto." },
    reports: { label: "Reportes", description: "Reportes diarios y semanales generados localmente." },
    "quick-capture": { label: "Captura rápida", description: "Anota una idea sin salir de lo que estás haciendo." },
    settings: { label: "Ajustes", description: "Apariencia, respaldos y privacidad." },
  },
  project: {
    feminine: false,
    title: "Proyecto",
    one: "proyecto",
    many: "proyectos",
    none: "Sin proyecto",
    newLabel: "Nuevo proyecto",
    createLabel: "Crear proyecto",
    firstTitle: "Crea tu primer proyecto",
    firstDescription: "Agrupa registros, bloqueos y aprendizajes por proyecto para ver su avance.",
    placeholder: "p. ej. API de autenticación",
    active: "Proyectos activos",
    ofDay: "Proyecto del día",
    all: "Todos los proyectos",
    noneActive: "No hay proyectos activos.",
    missing: "Este proyecto ya no existe",
    data: "Datos del proyecto",
    color: "Color del proyecto",
    needsName: "El proyecto necesita un nombre.",
    deleteLabel: "Eliminar proyecto",
    deleteQuestion: "¿Eliminarlo? Sus registros se conservan sin proyecto.",
    noLogs: "Aún no hay registros de este proyecto.",
    noLearnings: "Aún no hay aprendizajes de este proyecto.",
    yourFirst: "Tu primer proyecto",
  },
  blocker: {
    feminine: false,
    one: "bloqueo",
    many: "bloqueos",
    newLabel: "Nuevo bloqueo",
    registerLabel: "Registrar bloqueo",
    titleField: "Problema",
    titlePlaceholder: "p. ej. El token JWT expira antes de tiempo",
    contextPlaceholder: "Qué intentabas hacer, mensajes de error, enlaces…",
    escalate: "Escalar",
    status: { pending: "Pendiente", escalated: "Escalado", resolved: "Resuelto" },
    attempts: "Intentos de solución",
    attemptsFirst: "¿Qué probaste para resolverlo?",
    attemptsMore: "¿Qué más probaste?",
    open: "Bloqueos abiertos",
    resolved: "Bloqueos resueltos",
    pending: "Bloqueos pendientes",
    noneOpen: "Sin bloqueos abiertos",
    noneOpenHint: "Cuando registres uno, aparecerá aquí con el tiempo que lleva abierto.",
    registerFromDay: "Registrar en Bloqueos",
    viewFromDay: "Ver en Bloqueos",
    missingTitle: "El bloqueo necesita un título.",
    openSince: "Abierto hace",
    resolvedIn: "Resuelto en",
    markResolved: "Marcar como resuelto",
    filterOpen: "Abiertos",
    filterResolved: "Resueltos",
    emptyResolved: "Aún no has resuelto bloqueos.",
    emptyAll: "Aún no hay bloqueos.",
    allClear: "No tienes bloqueos abiertos. Consulta los resueltos o registra uno nuevo.",
    missing: "Este bloqueo ya no existe",
    deleteLabel: "Eliminar bloqueo",
    deleteQuestion: "¿Eliminar este bloqueo y sus intentos?",
    formLabel: "Datos del bloqueo",
    badge: "Bloqueo",
    withBadge: "Con bloqueo",
  },
  learning: {
    one: "aprendizaje",
    many: "aprendizajes",
    newLabel: "Nuevo aprendizaje",
    saveLabel: "Guardar aprendizaje",
    saveFromDay: "Guardar en Aprendizajes",
    viewFromDay: "Ver en Aprendizajes",
    kinds: {
      concept: { label: "Concepto", plural: "Conceptos" },
      error_fix: { label: "Error resuelto", plural: "Errores" },
      command: { label: "Comando", plural: "Comandos" },
      note: { label: "Nota", plural: "Notas" },
    },
    kindLabel: "Tipo de aprendizaje",
    empty: "Aún no hay aprendizajes.",
    missing: "Este aprendizaje ya no existe",
    deleteLabel: "Eliminar aprendizaje",
    deleteQuestion: "¿Eliminar este aprendizaje?",
    badge: "Aprendizaje",
    withBadge: "Con aprendizaje",
  },
  day: {
    planTitle: "Plan del día",
    planQuestion: "¿Qué vas a hacer hoy? Márcalo a medida que avances.",
    planEmpty: "Empieza el día anotando lo que quieres sacar adelante.",
    blockersTitle: "Bloqueos",
    blockersQuestion: "¿Algo te impide avanzar? Anótalo cuando pase.",
    blockersPlaceholder: "Describe el problema; la primera línea servirá de título si lo registras en Bloqueos.",
    learningsTitle: "Aprendizajes",
    learningsQuestion: "¿Qué aprendiste hoy? Un concepto, un comando, un error resuelto.",
    learningsPlaceholder: "Escribe lo que quieras recordar.",
  },
  reports: { daily: "Reporte diario", weekly: "Reporte semanal", checkIns: ["check-in", "check-ins"] },
};

const student: Vocabulary = {
  mode: "student",
  tagline: "Tu jornada de estudio, en tu equipo.",
  modules: {
    dashboard: { label: "Resumen", description: "Tu día de estudio de un vistazo." },
    "daily-log": { label: "Registro diario", description: "Planifica tu estudio, anota tus dudas y lo que aprendes." },
    deadlines: { label: "Entregas", description: "Trabajos, exámenes y exposiciones con su fecha límite." },
    blockers: { label: "Dudas", description: "Lo que no entendiste y cómo lo resolviste." },
    learning: { label: "Apuntes", description: "Conceptos, fórmulas y ejercicios resueltos." },
    projects: { label: "Materias", description: "Tus asignaturas con su avance, dudas y apuntes." },
    reports: { label: "Resúmenes", description: "Resúmenes de estudio diarios y semanales." },
    "quick-capture": { label: "Captura rápida", description: "Anota una idea o una tarea sin perder el hilo." },
    settings: { label: "Ajustes", description: "Apariencia, respaldos y privacidad." },
  },
  project: {
    feminine: true,
    title: "Materia",
    one: "materia",
    many: "materias",
    none: "Sin materia",
    newLabel: "Nueva materia",
    createLabel: "Crear materia",
    firstTitle: "Añade tu primera materia",
    firstDescription: "Agrupa tu estudio, dudas, apuntes y entregas por materia.",
    placeholder: "p. ej. Cálculo diferencial",
    active: "Materias activas",
    ofDay: "Materia del día",
    all: "Todas las materias",
    noneActive: "No hay materias activas.",
    missing: "Esta materia ya no existe",
    data: "Datos de la materia",
    color: "Color de la materia",
    needsName: "La materia necesita un nombre.",
    deleteLabel: "Eliminar materia",
    deleteQuestion: "¿Eliminarla? Sus registros se conservan sin materia.",
    noLogs: "Aún no hay registros de esta materia.",
    noLearnings: "Aún no hay apuntes de esta materia.",
    yourFirst: "Tu primera materia",
  },
  blocker: {
    feminine: true,
    one: "duda",
    many: "dudas",
    newLabel: "Nueva duda",
    registerLabel: "Registrar duda",
    titleField: "Duda",
    titlePlaceholder: "p. ej. No entiendo la regla de la cadena",
    contextPlaceholder: "Tema, ejercicio, página del libro, lo que ya revisaste…",
    escalate: "Consultar al profesor",
    status: { pending: "Pendiente", escalated: "Consultada", resolved: "Resuelta" },
    attempts: "Qué intenté para resolverla",
    attemptsFirst: "¿Qué revisaste o intentaste?",
    attemptsMore: "¿Qué más intentaste?",
    open: "Dudas abiertas",
    resolved: "Dudas resueltas",
    pending: "Dudas pendientes",
    noneOpen: "Sin dudas abiertas",
    noneOpenHint: "Cuando anotes una, aparecerá aquí con el tiempo que lleva sin resolver.",
    registerFromDay: "Registrar en Dudas",
    viewFromDay: "Ver en Dudas",
    missingTitle: "La duda necesita un título.",
    openSince: "Abierta hace",
    resolvedIn: "Resuelta en",
    markResolved: "Marcar como resuelta",
    filterOpen: "Abiertas",
    filterResolved: "Resueltas",
    emptyResolved: "Aún no has resuelto dudas.",
    emptyAll: "Aún no hay dudas.",
    allClear: "No tienes dudas abiertas. Consulta las resueltas o anota una nueva.",
    missing: "Esta duda ya no existe",
    deleteLabel: "Eliminar duda",
    deleteQuestion: "¿Eliminar esta duda y lo que intentaste?",
    formLabel: "Datos de la duda",
    badge: "Duda",
    withBadge: "Con duda",
  },
  learning: {
    one: "apunte",
    many: "apuntes",
    newLabel: "Nuevo apunte",
    saveLabel: "Guardar apunte",
    saveFromDay: "Guardar en Apuntes",
    viewFromDay: "Ver en Apuntes",
    kinds: {
      concept: { label: "Concepto", plural: "Conceptos" },
      error_fix: { label: "Ejercicio resuelto", plural: "Ejercicios" },
      command: { label: "Fórmula", plural: "Fórmulas" },
      note: { label: "Nota", plural: "Notas" },
    },
    kindLabel: "Tipo de apunte",
    empty: "Aún no hay apuntes.",
    missing: "Este apunte ya no existe",
    deleteLabel: "Eliminar apunte",
    deleteQuestion: "¿Eliminar este apunte?",
    badge: "Apunte",
    withBadge: "Con apunte",
  },
  day: {
    planTitle: "Plan de estudio",
    planQuestion: "¿Qué vas a estudiar hoy? Márcalo a medida que avances.",
    planEmpty: "Empieza anotando qué temas, tareas o repasos quieres sacar adelante.",
    blockersTitle: "Dudas",
    blockersQuestion: "¿Algo no te quedó claro? Anótalo para resolverlo.",
    blockersPlaceholder: "Describe la duda; la primera línea servirá de título si la registras en Dudas.",
    learningsTitle: "Lo que aprendí",
    learningsQuestion: "¿Qué aprendiste hoy? Un concepto, una fórmula, un ejercicio.",
    learningsPlaceholder: "Escribe lo que quieras recordar para el examen.",
  },
  reports: { daily: "Resumen de estudio diario", weekly: "Resumen de estudio semanal", checkIns: ["día de estudio", "días de estudio"] },
};

export const VOCABULARIES: Record<Mode, Vocabulary> = { dev, student };

export const vocabularyFor = (mode: Mode): Vocabulary => VOCABULARIES[mode];

/** Vocabulario del perfil activo. */
export const useVocab = (): Vocabulary => VOCABULARIES[useMode()];

/**
 * Frases sueltas del modo dev con su equivalente de estudiante (paneles del
 * Resumen, estadísticas…). Lo que no está en la tabla se muestra igual.
 */
const STUDENT_PHRASES: Record<string, string> = {
  "Bloqueos abiertos": "Dudas abiertas",
  "Bloqueos pendientes": "Dudas pendientes",
  "Bloqueos nuevos": "Dudas nuevas",
  "Bloqueos resueltos": "Dudas resueltas",
  "Sin bloqueos abiertos": "Sin dudas abiertas",
  "Cuando registres uno, aparecerá aquí con el tiempo que lleva abierto.":
    "Cuando anotes una, aparecerá aquí con el tiempo que lleva sin resolver.",
  Bloqueos: "Dudas",
  Aprendizajes: "Apuntes",
  "Proyectos activos": "Materias activas",
  "Plan del día": "Plan de estudio",
  "Registrar bloqueo": "Registrar duda",
  "Guardar aprendizaje": "Guardar apunte",
  "Nuevo proyecto": "Nueva materia",
  "Generar reporte": "Generar resumen",
  "Ver reporte": "Ver resumen",
  "Check-in de hoy": "Estudio de hoy",
  "Preguntas del check-in": "Momentos del día de estudio",
  "Días con check-in": "Días de estudio",
  "sin check-in": "sin registro",
  "laborables seguidos con check-in": "seguidos estudiando",
  "Registros semanales": "Días de estudio esta semana",
};

/** Traductor de frases del modo dev al modo del perfil activo. */
export function useTr(): (phrase: string) => string {
  const student = useMode() === "student";
  return (phrase) => (student ? (STUDENT_PHRASES[phrase] ?? phrase) : phrase);
}
