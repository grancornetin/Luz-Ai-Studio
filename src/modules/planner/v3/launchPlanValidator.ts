// ─────────────────────────────────────────────────────────────────
// PLANNER V3 — Validador de salida del plan de lanzamiento
//
// Función pura. Revisa lo que devolvió el modelo ANTES de que ella lo vea:
//   esquema · fechas · receta existe y está encendida · producto existe ·
//   rotación (sin repetir producto ni receta cercanos) · textos sin frases
//   prohibidas, promesas, claims no confirmados, testimonios ni métricas
//   inventadas · hashtags originales.
// No llama a ningún modelo. El motor (launchPlanEngine.ts) decide si
// reintenta o rellena de forma determinista con lo que este archivo detecta.
// ─────────────────────────────────────────────────────────────────

import type { CatalogItem, PilotPlanTask, PilotSeed, RecipeId } from '../../piloto/types';
import { RECIPES, isRecipeEnabled } from '../../piloto/recipes';
import type { LaunchEvent, LaunchSlot, ValidationIssue } from './launchTypes';
import { isValidISODate } from './launchCalendar';
import {
  CLAIM_RULES,
  COMPETITOR_TERMS,
  HASHTAG_CLAIM_GATES,
  INVENTED_SOCIAL_PROOF,
  JARGON_PATTERNS,
  PROMISE_PATTERNS,
  fold,
  hasEmoji,
  hasUnfilledPlaceholder,
} from './jewelryCopy';

export interface ValidationContext {
  slots: LaunchSlot[];
  catalog: CatalogItem[];
  confirmedClaims: PilotSeed['confirmedClaims'];
  /** Eventos reales del calendario (para validar fechas mencionadas en los textos) */
  events: LaunchEvent[];
  /** Producto y receta de las últimas tareas de la semana anterior (para la rotación entre semanas) */
  previousTasks?: Array<Pick<PilotPlanTask, 'recipeId' | 'catalogItemIds'>>;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Campos de texto que ella lee y que pasan por las reglas de lenguaje. */
export const TEXT_FIELDS = [
  'title',
  'contentType',
  'toolReason',
  'caption',
  'sceneBrief',
  'whyThisContent',
  'expectedResult',
  'howToMeasure',
  'engagementHook',
] as const;

export type TextField = (typeof TEXT_FIELDS)[number];

const MIN_LEN: Partial<Record<TextField, number>> = {
  title: 6,
  contentType: 3,
  toolReason: 8,
  caption: 60,
  sceneBrief: 25,
  whyThisContent: 15,
  expectedResult: 10,
  howToMeasure: 15,
  engagementHook: 8,
};

const MAX_LEN: Partial<Record<TextField, number>> = {
  title: 140,
  caption: 1500,
  sceneBrief: 900,
};

function issue(taskIndex: number, field: string, code: string, message: string): ValidationIssue {
  return { taskIndex, field, code, message, severity: 'error' };
}

/** Pares día-mes permitidos en los textos: eventos reales y fechas de los huecos de la semana. */
export function allowedDayMonths(ctx: ValidationContext): Set<string> {
  const set = new Set<string>();
  const add = (iso: string) => {
    if (!isValidISODate(iso)) return;
    const [, m, d] = iso.split('-').map(Number);
    set.add(`${d}-${m}`);
  };
  const addRange = (a: string, b?: string) => {
    add(a);
    if (b && isValidISODate(b) && isValidISODate(a)) {
      const [y1, m1, d1] = a.split('-').map(Number);
      const [y2, m2, d2] = b.split('-').map(Number);
      const cur = new Date(Date.UTC(y1, m1 - 1, d1));
      const end = new Date(Date.UTC(y2, m2 - 1, d2));
      while (cur <= end) {
        set.add(`${cur.getUTCDate()}-${cur.getUTCMonth() + 1}`);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
  };
  for (const e of ctx.events) addRange(e.date, e.endDate);
  for (const s of ctx.slots) add(s.date);
  return set;
}

function claimIssues(text: string, ctx: ValidationContext): Array<{ code: string; message: string }> {
  const f = fold(text);
  const out: Array<{ code: string; message: string }> = [];
  for (const rule of CLAIM_RULES) {
    if (!rule.pattern.test(f)) continue;
    if (rule.requires && ctx.confirmedClaims.includes(rule.requires)) continue;
    out.push({
      code: 'claim_no_confirmado',
      message: `Afirma "${rule.label}" sin que la dueña lo haya confirmado.`,
    });
  }
  return out;
}

function dateMentionIssues(text: string, ctx: ValidationContext): Array<{ code: string; message: string }> {
  const f = fold(text);
  const allowed = allowedDayMonths(ctx);
  const out: Array<{ code: string; message: string }> = [];
  const re = new RegExp(`\\b(\\d{1,2}) de (${MONTHS.map(fold).join('|')})\\b`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(f))) {
    const key = `${Number(m[1])}-${MONTHS.map(fold).indexOf(m[2]) + 1}`;
    if (!allowed.has(key)) {
      out.push({
        code: 'fecha_no_verificada',
        message: `Menciona "${m[0]}", que no es una fecha verificada del calendario ni de la semana.`,
      });
    }
  }
  return out;
}

/** Reglas de lenguaje que aplican a cualquier texto que ella lee. */
export function textIssues(text: string, ctx: ValidationContext): Array<{ code: string; message: string }> {
  const out: Array<{ code: string; message: string }> = [];
  if (hasEmoji(text)) out.push({ code: 'emoji', message: 'Tiene emojis.' });
  if (hasUnfilledPlaceholder(text)) out.push({ code: 'placeholder', message: 'Tiene datos sin rellenar entre llaves.' });
  for (const j of JARGON_PATTERNS) {
    if (j.pattern.test(text)) out.push({ code: 'jerga', message: `Usa la palabra ${j.label}, que no va en textos para ella.` });
  }
  out.push(...claimIssues(text, ctx));
  const f = fold(text);
  for (const p of PROMISE_PATTERNS) {
    if (p.pattern.test(f)) out.push({ code: 'promesa', message: `Contiene una ${p.label}.` });
  }
  for (const p of INVENTED_SOCIAL_PROOF) {
    if (p.pattern.test(f)) out.push({ code: 'prueba_social_inventada', message: `Contiene ${p.label} que no existe.` });
  }
  for (const c of COMPETITOR_TERMS) {
    if (f.includes(c)) out.push({ code: 'marca_ajena', message: `Nombra a otra marca ("${c}").` });
  }
  out.push(...dateMentionIssues(text, ctx));
  return out;
}

export function parseHashtags(raw: string): string[] {
  return (raw || '')
    .split(/[\s,;]+/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => (t.startsWith('#') ? t : `#${t}`));
}

export function hashtagIssues(raw: string, ctx: ValidationContext): Array<{ code: string; message: string }> {
  const out: Array<{ code: string; message: string }> = [];
  const tags = parseHashtags(raw);
  if (tags.length < 5 || tags.length > 8) {
    out.push({ code: 'hashtags_cantidad', message: `Trae ${tags.length} hashtags; deben ser entre 5 y 8.` });
  }
  const seen = new Set<string>();
  for (const t of tags) {
    const low = t.toLowerCase();
    if (!/^#[\p{L}\p{N}_]{3,40}$/u.test(t)) out.push({ code: 'hashtag_formato', message: `Hashtag mal formado: ${t}` });
    if (seen.has(low)) out.push({ code: 'hashtag_repetido', message: `Hashtag repetido: ${t}` });
    seen.add(low);
    const f = fold(t);
    for (const c of COMPETITOR_TERMS) {
      if (f.includes(c.replace(/\s+/g, ''))) out.push({ code: 'marca_ajena', message: `Hashtag de otra marca: ${t}` });
    }
    for (const gate of HASHTAG_CLAIM_GATES) {
      if (gate.pattern.test(f) && !(gate.requires && ctx.confirmedClaims.includes(gate.requires))) {
        out.push({ code: 'claim_no_confirmado', message: `Hashtag ${t} afirma algo que no está confirmado.` });
      }
    }
  }
  return out;
}

/** Valida una tarea ya normalizada. No muta nada. */
export function validateTask(task: PilotPlanTask, index: number, ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const slot = ctx.slots[index];

  // Esquema básico
  if (!slot) issues.push(issue(index, 'slot', 'slot_inexistente', 'La tarea no corresponde a ningún hueco del calendario.'));
  if (slot) {
    if (!isValidISODate(task.date) || task.date !== slot.date) {
      issues.push(issue(index, 'date', 'fecha', `La fecha debe ser ${slot.date}.`));
    }
    if (task.platform !== slot.platform) issues.push(issue(index, 'platform', 'plataforma', `La red debe ser ${slot.platform}.`));
    if (task.format !== slot.format) issues.push(issue(index, 'format', 'formato', `El formato debe ser ${slot.format}.`));
    if (task.funnelRole !== slot.funnelRole) issues.push(issue(index, 'funnelRole', 'rol', `El rol del embudo debe ser ${slot.funnelRole}.`));
  }
  for (const f of TEXT_FIELDS) {
    const v = (task as unknown as Record<string, unknown>)[f];
    if (typeof v !== 'string' || v.trim().length < (MIN_LEN[f] ?? 1)) {
      issues.push(issue(index, f, 'campo_vacio', `Falta "${f}" o es demasiado corto.`));
      continue;
    }
    const max = MAX_LEN[f];
    if (max && v.length > max) issues.push(issue(index, f, 'campo_largo', `"${f}" supera ${max} caracteres.`));
    for (const t of textIssues(v, ctx)) issues.push(issue(index, f, t.code, t.message));
  }
  // Fechas dentro de la propia tarea (title ya revisado). El dayLabel se regenera.
  for (const t of hashtagIssues(task.hashtags, ctx)) issues.push(issue(index, 'hashtags', t.code, t.message));

  // Receta
  const rid = task.recipeId;
  if (!rid || !isRecipeEnabled(rid)) {
    issues.push(issue(index, 'recipeId', 'receta_inexistente', `La receta "${rid ?? ''}" no existe o está apagada.`));
  } else if (slot && !RECIPES[rid].formats.includes(slot.format)) {
    issues.push(issue(index, 'recipeId', 'receta_formato', `La receta "${rid}" no sirve para el formato ${slot.format}.`));
  }

  // Producto
  const ids = task.catalogItemIds ?? [];
  const known = new Set(ctx.catalog.map(c => c.id));
  if (!ids.length) issues.push(issue(index, 'catalogItemIds', 'producto_faltante', 'La tarea no elige ninguna pieza del catálogo.'));
  for (const id of ids) {
    if (!known.has(id)) issues.push(issue(index, 'catalogItemIds', 'producto_inexistente', `La pieza "${id}" no existe en el catálogo.`));
  }
  if (new Set(ids).size !== ids.length) issues.push(issue(index, 'catalogItemIds', 'producto_duplicado', 'Repite la misma pieza dentro de la tarea.'));
  if (rid && isRecipeEnabled(rid) && ids.length > RECIPES[rid].maxProducts) {
    issues.push(issue(index, 'catalogItemIds', 'demasiados_productos', `La receta "${rid}" admite como máximo ${RECIPES[rid].maxProducts} pieza(s).`));
  }
  return issues;
}

/** Reglas entre tareas: rotación de producto y receta. */
export function validateRotation(tasks: PilotPlanTask[], ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const n = ctx.catalog.length;
  const seq: Array<Pick<PilotPlanTask, 'recipeId' | 'catalogItemIds'>> = [...(ctx.previousTasks ?? []), ...tasks];
  const offset = ctx.previousTasks?.length ?? 0;
  // Con 1 sola pieza no se puede rotar; con 2 solo se evita repetir seguida; con 3+ ventana de 2.
  const window = n >= 3 ? 2 : n === 2 ? 1 : 0;
  for (let i = offset; i < seq.length; i++) {
    const cur = seq[i];
    for (let back = 1; back <= window; back++) {
      const prev = seq[i - back];
      if (!prev) continue;
      const shared = (cur.catalogItemIds ?? []).filter(id => (prev.catalogItemIds ?? []).includes(id));
      if (shared.length) {
        issues.push(issue(i - offset, 'catalogItemIds', 'rotacion_producto', `Repite la misma pieza que una publicación muy cercana (${back} antes).`));
        break;
      }
    }
    const prev1 = seq[i - 1];
    if (prev1 && cur.recipeId && prev1.recipeId === cur.recipeId) {
      issues.push(issue(i - offset, 'recipeId', 'rotacion_receta', 'Repite la misma receta que la publicación anterior.'));
    }
  }
  return issues;
}

export function validateTasks(tasks: PilotPlanTask[], ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (tasks.length !== ctx.slots.length) {
    issues.push(issue(-1, 'tasks', 'cantidad', `Deben ser ${ctx.slots.length} tareas y llegaron ${tasks.length}.`));
  }
  tasks.forEach((t, i) => issues.push(...validateTask(t, i, ctx)));
  issues.push(...validateRotation(tasks, ctx));
  return issues;
}

/** Valida textos sueltos (resumen de estrategia, ideas de otras semanas). */
export function validateFreeText(text: string, ctx: ValidationContext, min = 10): boolean {
  if (typeof text !== 'string' || text.trim().length < min) return false;
  return textIssues(text, ctx).length === 0;
}

/** Resumen corto de los problemas, para repetirle al modelo en el reintento. */
export function summarizeIssues(issues: ValidationIssue[], max = 14): string {
  const lines = issues.slice(0, max).map(i => {
    const where = i.taskIndex >= 0 ? `tarea ${i.taskIndex + 1}` : 'plan';
    return `- ${where}, ${i.field}: ${i.message}`;
  });
  if (issues.length > max) lines.push(`- (y ${issues.length - max} problemas más del mismo tipo)`);
  return lines.join('\n');
}

export type { RecipeId };
