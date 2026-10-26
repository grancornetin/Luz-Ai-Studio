// ─────────────────────────────────────────────────────────────────
// PLANNER V3 — Tipos del calendario de lanzamiento (piloto joyería)
// Todo lo de este archivo es NUEVO y opcional: no cambia el contrato
// de PlanTask ni de ContentPlan existente.
// ─────────────────────────────────────────────────────────────────

import type { FunnelRole, PlanFormat, PlanPlatform } from './plannerV3Types';
import type { PilotPlanTask } from '../../piloto/types';

/** Un hueco del calendario: fecha, red, formato y rol ya decididos. */
export interface LaunchSlot {
  /** 0-based dentro de la semana */
  index: number;
  date: string; // ISO "2026-10-27"
  dayLabel: string; // "Martes 27 oct"
  platform: PlanPlatform;
  format: PlanFormat;
  funnelRole: FunnelRole;
  suggestedTime: string; // "19:30"
}

export interface LaunchEvent {
  id: string;
  label: string;
  /** ISO de inicio */
  date: string;
  /** ISO de término (si dura varios días) */
  endDate?: string;
  /** Qué significa para el contenido, en lenguaje simple */
  note: string;
  /** OBSERVADO = visto en fuente; INFERIDO = calculado; HIPOTESIS = a validar con ella */
  evidence: 'OBSERVADO' | 'INFERIDO' | 'HIPOTESIS';
}

/** Esquema de una semana del calendario (sin tareas completas). */
export interface LaunchOutlineWeek {
  weekNumber: number; // 1..6
  startDate: string;
  endDate: string;
  /** Título corto de la semana */
  theme: string;
  /** Qué buscamos esa semana, en una frase */
  objective: string;
  /** Eventos reales del calendario Chile que caen en la semana */
  events: LaunchEvent[];
  /** 2-4 ideas de contenido (las escribe Gemini; si falla, vienen del banco de ganchos) */
  ideas: string[];
  /** true cuando la semana ya tiene tareas completas */
  detailed: boolean;
}

export type IssueSeverity = 'error' | 'repaired';

export interface ValidationIssue {
  /** índice de tarea (0-based) o -1 si es del plan completo */
  taskIndex: number;
  field: string;
  code: string;
  message: string;
  severity: IssueSeverity;
}

export interface LaunchPlanResult {
  strategySummary: string;
  /** Tareas completas de la semana detallada (hoy: semana 1) */
  tasks: PilotPlanTask[];
  /** Esquema de las 6 semanas */
  outline: LaunchOutlineWeek[];
  /** Recordatorio de etiquetado de contenido hecho con inteligencia artificial */
  aiDisclosureReminder: string;
  /** Cómo se obtuvo: 'model' (pasó validación), 'model_repaired' (con arreglos), 'fallback' (determinista) */
  source: 'model' | 'model_repaired' | 'fallback';
  /** Qué arregló el validador (para registro; no se muestra a la usuaria) */
  repairs: ValidationIssue[];
  /** Cuántas llamadas al modelo se usaron */
  modelCalls: number;
}
