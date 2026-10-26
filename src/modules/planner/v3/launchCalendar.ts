// ─────────────────────────────────────────────────────────────────
// PLANNER V3 — Calendario de lanzamiento de 6 semanas (joyería, Chile)
//
// Función pura (sin red, sin Firestore): dada la fecha de hoy arma las
// 6 semanas, sus huecos de publicación (fecha, red, formato, rol del
// embudo) y los eventos reales que caen en cada semana.
// Las fechas salen de src/data/jewelry-market/calendar-chile.json
// (verificadas el 22-oct-2026). Cada evento conserva su nivel de evidencia.
// ─────────────────────────────────────────────────────────────────

import calendarChile from '../../../data/jewelry-market/calendar-chile.json';
import type { FunnelRole, PlanFormat, PlanPlatform } from './plannerV3Types';
import type { LaunchEvent, LaunchOutlineWeek, LaunchSlot } from './launchTypes';

export const LAUNCH_WEEKS = 6;

// ── Fechas ───────────────────────────────────────────────────────

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Fecha de hoy en Chile como "YYYY-MM-DD" (no depende de la zona del equipo). */
export function todayInSantiago(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts; // en-CA => 2026-10-26
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export function dayLabel(iso: string): string {
  const d = parseISO(iso);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

/** "27 nov" */
export function shortDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

export function isValidISODate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISO(parseISO(s)) === s;
}

// ── Eventos reales (de calendar-chile.json) ──────────────────────

interface RawEvent {
  id: string;
  fechaISO: string;
  fechaFinISO?: string;
  evidence: 'OBSERVADO' | 'INFERIDO' | 'HIPOTESIS';
}

/** Textos para ella (con tildes). Las fechas se leen del JSON; aquí solo va el significado. */
const EVENT_TEXT: Record<string, { label: string; note: string }> = {
  'black-friday-2026': {
    label: 'Black Friday Chile (viernes 27 a lunes 30 de noviembre)',
    note: 'Gran fecha de compras online. Cada tienda define su horario. Solo hay oferta si tú la defines; si no, se comunica como "ideas de regalo con tiempo".',
  },
  'cyber-monday-internacional-2026': {
    label: 'Cierre del Black Friday (lunes 30 de noviembre)',
    note: 'Último día de las ofertas de noviembre.',
  },
  'corte-despacho-regiones': {
    label: 'Último día sugerido de pedido para regiones antes de Navidad',
    note: 'Es una sugerencia, no una fecha oficial: ajústala al courier que uses.',
  },
  'corte-despacho-rm': {
    label: 'Último día sugerido de pedido para la Región Metropolitana antes de Navidad',
    note: 'Es una sugerencia, no una fecha oficial: ajústala al courier que uses.',
  },
  'nochebuena-2026': { label: 'Nochebuena (jueves 24 de diciembre)', note: 'Entrega de regalos.' },
  'navidad-2026': { label: 'Navidad (viernes 25 de diciembre)', note: 'Feriado.' },
  'graduaciones-licenciaturas': {
    label: 'Temporada de graduaciones y licenciaturas',
    note: 'Posible idea de regalo. Es una hipótesis: confírmala con tus clientas.',
  },
};

/** Eventos considerados para el calendario de lanzamiento. */
const LAUNCH_EVENT_IDS = Object.keys(EVENT_TEXT);

export function getLaunchEvents(): LaunchEvent[] {
  const raw = (calendarChile as { eventos: RawEvent[] }).eventos;
  const out: LaunchEvent[] = [];
  for (const id of LAUNCH_EVENT_IDS) {
    const ev = raw.find(e => e.id === id);
    const txt = EVENT_TEXT[id];
    if (!ev || !txt) continue;
    out.push({
      id,
      label: txt.label,
      date: ev.fechaISO,
      endDate: ev.fechaFinISO,
      note: txt.note,
      evidence: ev.evidence,
    });
  }
  return out;
}

function eventOverlapsWeek(ev: LaunchEvent, start: string, end: string): boolean {
  const evEnd = ev.endDate || ev.date;
  return ev.date <= end && evEnd >= start;
}

// ── Estructura de las 6 semanas ──────────────────────────────────

interface WeekBlueprint {
  theme: string;
  objective: string;
  /** Rol del embudo por cada hueco (5 huecos por semana) */
  roles: FunnelRole[];
}

/**
 * Ruta de 6 semanas (INFERIDA del estudio de mercado, a validar con sus datos):
 * 1 base, 2 dudas de compra, 3 variedad y prueba, 4 calentar Black Friday,
 * 5 Black Friday, 6 cuenta regresiva de Navidad.
 * Para "arrancar de cero" el embudo carga atraer y generar deseo; convertir
 * sube solo en las semanas de Black Friday y Navidad.
 */
const BLUEPRINTS: WeekBlueprint[] = [
  {
    theme: 'Presentarte y mostrar tu mejor pieza',
    objective: 'Que quien te encuentre entienda en 5 segundos qué vendes y cómo pedir, y avisar a tu círculo cercano.',
    roles: ['atraer', 'generar_deseo', 'construir_confianza', 'atraer', 'convertir'],
  },
  {
    theme: 'Resolver las dudas antes de comprar',
    objective: 'Responder las dudas que frenan una compra online: tamaño real, material, cuidados y cómo llega.',
    roles: ['atraer', 'generar_deseo', 'construir_confianza', 'construir_confianza', 'convertir'],
  },
  {
    theme: 'Mostrar variedad y probar qué te funciona',
    objective: 'Probar distintos formatos y ver con tus números qué se guarda y qué se comparte.',
    roles: ['atraer', 'generar_deseo', 'generar_deseo', 'atraer', 'convertir'],
  },
  {
    theme: 'Calentar el Black Friday',
    objective: 'Avisar qué viene, mostrar tus piezas para regalo y dejar claro cómo pedir y cuándo despachas.',
    roles: ['atraer', 'generar_deseo', 'construir_confianza', 'generar_deseo', 'convertir'],
  },
  {
    theme: 'Black Friday',
    objective: 'Vender en la semana de más compras online: ofertas solo si tú las defines, y plazos claros.',
    roles: ['atraer', 'convertir', 'generar_deseo', 'construir_confianza', 'convertir'],
  },
  {
    theme: 'Cuenta regresiva de Navidad',
    objective: 'Guías de regalo por presupuesto y el último día de pedido para que llegue a tiempo.',
    roles: ['atraer', 'generar_deseo', 'generar_deseo', 'convertir', 'convertir'],
  },
];

/** Plantilla fija de huecos: día de la semana (desde el inicio), red, formato y hora. */
const SLOT_TEMPLATE: Array<{ offset: number; platform: PlanPlatform; format: PlanFormat; time: string }> = [
  { offset: 0, platform: 'Instagram Feed', format: 'Foto', time: '19:30' },
  { offset: 1, platform: 'Instagram Stories', format: 'Story', time: '13:00' },
  { offset: 3, platform: 'Instagram Feed', format: 'Carrusel', time: '20:00' },
  { offset: 4, platform: 'Instagram Feed', format: 'Foto', time: '19:30' },
  { offset: 6, platform: 'WhatsApp Estados', format: 'Story', time: '12:30' },
];

export function buildOutline(todayISO: string): LaunchOutlineWeek[] {
  const events = getLaunchEvents();
  const firstDay = addDays(todayISO, 1); // el plan empieza mañana
  const weeks: LaunchOutlineWeek[] = [];
  for (let i = 0; i < LAUNCH_WEEKS; i++) {
    const start = addDays(firstDay, i * 7);
    const end = addDays(start, 6);
    const bp = BLUEPRINTS[i];
    weeks.push({
      weekNumber: i + 1,
      startDate: start,
      endDate: end,
      theme: bp.theme,
      objective: bp.objective,
      events: events.filter(e => eventOverlapsWeek(e, start, end)),
      ideas: [],
      detailed: false,
    });
  }
  // Los cortes de despacho y Navidad quedan después de la semana 6: se avisan en ella como "lo que viene".
  const last = weeks[weeks.length - 1];
  for (const ev of events) {
    if (ev.date > last.endDate && !last.events.some(e => e.id === ev.id) && ev.date <= addDays(last.endDate, 21)) {
      last.events.push(ev);
    }
  }
  return weeks;
}

export function buildSlots(week: Pick<LaunchOutlineWeek, 'weekNumber' | 'startDate'>): LaunchSlot[] {
  const bp = BLUEPRINTS[Math.min(Math.max(week.weekNumber, 1), LAUNCH_WEEKS) - 1];
  return SLOT_TEMPLATE.map((t, index) => {
    const date = addDays(week.startDate, t.offset);
    return {
      index,
      date,
      dayLabel: dayLabel(date),
      platform: t.platform,
      format: t.format,
      funnelRole: bp.roles[index],
      suggestedTime: t.time,
    };
  });
}

export function funnelMix(weeks: number[] = [1, 2, 3, 4, 5, 6]): Record<FunnelRole, number> {
  const mix: Record<FunnelRole, number> = { atraer: 0, generar_deseo: 0, construir_confianza: 0, convertir: 0 };
  for (const w of weeks) for (const r of BLUEPRINTS[w - 1].roles) mix[r]++;
  return mix;
}
