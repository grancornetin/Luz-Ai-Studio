// api/piloto/ledger.ts
// Libro de gasto en USD del "Piloto automatico para joyeria" (W8).
//
// OBJETIVO: que un bug, un bucle o un abuso no pueda quemar el saldo de Google
// Cloud. Solo aplica a los uids en modo privado (variable PILOT_UIDS); el resto
// de las cuentas no se ve afectado.
//
// FUNCIONAMIENTO (reservar antes, confirmar despues):
//   1. checkBudget(uid, tipo, USD estimados) suma el monto a los contadores en
//      Redis con INCRBY (atomico). Si algun tope se pasa, deshace la suma y
//      deniega. Dos llamadas simultaneas nunca pasan juntas el tope.
//   2. recordSpend(...) confirma el gasto real (ajusta la diferencia) y deja
//      una linea en Firestore users/{uid}/budgetLedger (solo el servidor escribe).
//   3. releaseReservation(...) devuelve la reserva si la tarea ni se alcanzo a cobrar.
//
// Contadores (en micro-USD enteros) por uid: total, diario, semanal por tipo,
// y diario de video. Si Redis falla, se DENIEGA (falla cerrado).
//
// Ademas expone un endpoint POST /api/piloto/ledger {action:'status'} para que
// la app muestre el gasto (y la alerta del 80 %) a la usuaria del piloto.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import type { BudgetKind, LedgerEntry } from '../../src/modules/piloto/budget/ledgerTypes.js';
import {
  capsFromEnv, isVideoEnabled, type BudgetCaps,
} from '../../src/modules/piloto/budget/pricing.js';

// ─── Tipos públicos ──────────────────────────────────────────────────────────
export type DenyCode =
  | 'DAILY_CAP' | 'WEEKLY_CAP' | 'TOTAL_CAP' | 'VIDEO_OFF' | 'KIND_OFF'
  | 'CLIP_CAP' | 'BAD_ESTIMATE' | 'LEDGER_ERROR';

export type BudgetDecision =
  | { allowed: true; reservationId: string; alert: boolean }
  | { allowed: false; code: DenyCode; reason: string };

export interface RecordSpendInput {
  uid: string;
  kind: BudgetKind;
  model: string;
  units: number;
  unit: LedgerEntry['unit'];
  costUSD: number;
  taskId?: string;
  /** Si viene, confirma esa reserva (ajustando la diferencia). */
  reservationId?: string;
}

// ─── Interfaces mínimas (permiten probar con un Redis falso) ────────────────
export interface LedgerMulti {
  incrby(key: string, n: number): LedgerMulti;
  decrby(key: string, n: number): LedgerMulti;
  expire(key: string, seconds: number): LedgerMulti;
  exec(): Promise<unknown[]>;
}
export interface LedgerRedis {
  get(key: string): Promise<unknown>;
  set(key: string, value: string | number, opts?: { nx?: boolean; ex?: number }): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  multi(): LedgerMulti;
}
export interface LedgerStore {
  /** Gasto total acumulado en micro-USD guardado en Firestore (para re-sembrar Redis). */
  readTotalMicros(uid: string): Promise<number | null>;
  writeEntry(entry: LedgerEntry, day: string, caps: BudgetCaps): Promise<void>;
  setAlert(uid: string, alert: { level: 'warn' | 'cut'; message: string; at: number }): Promise<void>;
}

export interface LedgerDeps {
  redis: LedgerRedis;
  store: LedgerStore;
  caps: BudgetCaps;
  now: () => number;
}

// ─── Utilidades ──────────────────────────────────────────────────────────────
const MICRO = 1_000_000;
const toMicros = (usd: number) => Math.round(usd * MICRO);
const toUSD = (micros: number) => Math.round(micros) / MICRO;
const fmt = (usd: number) => `USD ${usd.toFixed(2).replace('.', ',')}`;

const TZ = 'America/Santiago';

/** 'YYYY-MM-DD' en hora de Santiago. */
export function dayKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
}

/** Semana ISO 'YYYY-Www' calculada sobre la fecha de Santiago. */
export function weekKey(ms: number): string {
  const [y, m, d] = dayKey(ms).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const KIND_LABEL: Record<BudgetKind, string> = {
  image: 'imágenes', video: 'videos', text: 'textos', vision: 'análisis de fotos',
};

const k = (uid: string, rest: string) => `piloto:b:${uid}:${rest}`;
const resvKey = (id: string) => `piloto:resv:${id}`;

interface Resv {
  uid: string; kind: BudgetKind; micros: number; day: string; week: string; model: string; taskId?: string;
}

function keysFor(uid: string, kind: BudgetKind, day: string, week: string) {
  return {
    total: k(uid, 'total'),
    day: k(uid, `day:${day}`),
    week: k(uid, `wk:${week}:${kind}`),
    dayVideo: kind === 'video' ? k(uid, `dayv:${day}`) : null,
  };
}

// ─── Allowlist (modo privado) ────────────────────────────────────────────────
export function pilotUids(env: Record<string, string | undefined> = process.env): string[] {
  return (env.PILOT_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
}
export function isPilotUid(uid: string | undefined | null, env: Record<string, string | undefined> = process.env): boolean {
  if (!uid) return false;
  return pilotUids(env).includes(uid);
}
/** Modo "cerrado": si PILOT_LOCKDOWN=1, solo los uids del piloto pueden generar. Apagado por defecto. */
export function isLockdownOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.PILOT_LOCKDOWN === '1';
}

// ─── Núcleo ──────────────────────────────────────────────────────────────────
export function createLedger(deps: LedgerDeps) {
  const { redis, store, caps, now } = deps;

  async function seedTotal(uid: string): Promise<void> {
    const key = k(uid, 'total');
    const existing = await redis.get(key);
    if (existing !== null && existing !== undefined) return;
    // Redis perdió el contador: lo re-sembramos desde Firestore (nunca partir de 0 si hay historia).
    const fromStore = (await store.readTotalMicros(uid)) ?? 0;
    await redis.set(key, fromStore, { nx: true });
  }

  async function checkBudget(
    uid: string, kind: BudgetKind, estimatedUSD: number,
    meta: { model?: string; taskId?: string } = {},
  ): Promise<BudgetDecision> {
    if (!uid || !Number.isFinite(estimatedUSD) || estimatedUSD <= 0) {
      return { allowed: false, code: 'BAD_ESTIMATE', reason: 'No pude calcular cuánto costaría esto, así que por seguridad no lo hice.' };
    }
    if (kind === 'video' && !isVideoEnabled()) {
      return { allowed: false, code: 'VIDEO_OFF', reason: 'El video todavía no está activado en el piloto. Por ahora puedes crear imágenes y textos.' };
    }
    const weeklyCap = caps.weeklyCapByKind[kind];
    if (!(weeklyCap > 0)) {
      return { allowed: false, code: 'KIND_OFF', reason: `Los ${KIND_LABEL[kind]} están apagados en el piloto por ahora.` };
    }
    if (kind === 'video' && estimatedUSD > caps.videoPerClipCapUSD) {
      return { allowed: false, code: 'CLIP_CAP', reason: `Este video costaría ${fmt(estimatedUSD)} y el máximo por video es ${fmt(caps.videoPerClipCapUSD)}.` };
    }

    const ts = now();
    const day = dayKey(ts);
    const week = weekKey(ts);
    const micros = toMicros(estimatedUSD);
    const keys = keysFor(uid, kind, day, week);

    try {
      await seedTotal(uid);

      const m = redis.multi()
        .incrby(keys.total, micros)
        .incrby(keys.day, micros)
        .incrby(keys.week, micros);
      if (keys.dayVideo) m.incrby(keys.dayVideo, micros);
      m.expire(keys.day, 3 * 86_400).expire(keys.week, 10 * 86_400);
      if (keys.dayVideo) m.expire(keys.dayVideo, 3 * 86_400);
      const res = await m.exec();

      const newTotal = Number(res[0]);
      const newDay = Number(res[1]);
      const newWeek = Number(res[2]);
      const newDayVideo = keys.dayVideo ? Number(res[3]) : 0;

      let deny: { code: DenyCode; reason: string } | null = null;
      if (newTotal > toMicros(caps.totalCapUSD)) {
        deny = { code: 'TOTAL_CAP', reason: `Se alcanzó el tope total del piloto (${fmt(caps.totalCapUSD)}). Para seguir hay que revisar el presupuesto con el equipo.` };
      } else if (newDay > toMicros(caps.dailyCapUSD)) {
        deny = { code: 'DAILY_CAP', reason: `Llegaste al tope de gasto de hoy (${fmt(caps.dailyCapUSD)}). Mañana se reinicia solo; así cuidamos el saldo.` };
      } else if (newWeek > toMicros(weeklyCap)) {
        deny = { code: 'WEEKLY_CAP', reason: `Llegaste al tope semanal de ${KIND_LABEL[kind]} (${fmt(weeklyCap)}). Se reinicia el lunes.` };
      } else if (keys.dayVideo && newDayVideo > toMicros(caps.videoDailyCapUSD)) {
        deny = { code: 'DAILY_CAP', reason: `Llegaste al tope de videos de hoy (${fmt(caps.videoDailyCapUSD)}). Mañana se reinicia.` };
      }

      if (deny) {
        const rb = redis.multi()
          .decrby(keys.total, micros).decrby(keys.day, micros).decrby(keys.week, micros);
        if (keys.dayVideo) rb.decrby(keys.dayVideo, micros);
        await rb.exec();
        await store.setAlert(uid, { level: 'cut', message: deny.reason, at: ts }).catch(() => {});
        return { allowed: false, code: deny.code, reason: deny.reason };
      }

      const resvId = `rv_${ts}_${Math.random().toString(36).slice(2, 10)}`;
      const resv: Resv = { uid, kind, micros, day, week, model: meta.model || '', taskId: meta.taskId };
      await redis.set(resvKey(resvId), JSON.stringify(resv), { ex: 2 * 3600 });

      const alert =
        newTotal >= caps.alertAt * toMicros(caps.totalCapUSD) ||
        newDay >= caps.alertAt * toMicros(caps.dailyCapUSD) ||
        newWeek >= caps.alertAt * toMicros(weeklyCap);
      if (alert) {
        await store.setAlert(uid, {
          level: 'warn',
          message: `El gasto del piloto pasó el ${Math.round(caps.alertAt * 100)} % de un tope (total ${fmt(toUSD(newTotal))} de ${fmt(caps.totalCapUSD)}; hoy ${fmt(toUSD(newDay))} de ${fmt(caps.dailyCapUSD)}).`,
          at: ts,
        }).catch(() => {});
      }
      return { allowed: true, reservationId: resvId, alert };
    } catch (err: any) {
      console.error('[PilotLedger] checkBudget falló (se deniega por seguridad):', err?.message);
      return { allowed: false, code: 'LEDGER_ERROR', reason: 'No pude verificar el presupuesto en este momento, así que por seguridad no generé nada. Intenta de nuevo en un rato.' };
    }
  }

  async function takeReservation(id: string): Promise<Resv | null> {
    const raw = await redis.get(resvKey(id));
    if (!raw) return null;
    // del devuelve 1 solo para quien la toma primero: evita doble confirmación/devolución.
    const removed = await redis.del(resvKey(id));
    if (!removed) return null;
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as Resv;
  }

  async function releaseReservation(reservationId: string): Promise<void> {
    try {
      const r = await takeReservation(reservationId);
      if (!r) return;
      const keys = keysFor(r.uid, r.kind, r.day, r.week);
      const m = redis.multi()
        .decrby(keys.total, r.micros).decrby(keys.day, r.micros).decrby(keys.week, r.micros);
      if (keys.dayVideo) m.decrby(keys.dayVideo, r.micros);
      await m.exec();
    } catch (err: any) {
      console.error('[PilotLedger] releaseReservation falló:', err?.message);
    }
  }

  async function recordSpend(input: RecordSpendInput): Promise<void> {
    const ts = now();
    let day = dayKey(ts);
    try {
      const costMicros = toMicros(Math.max(0, input.costUSD));
      if (input.reservationId) {
        const r = await takeReservation(input.reservationId);
        if (r) {
          day = r.day;
          const delta = costMicros - r.micros; // real - reservado
          if (delta !== 0) {
            const keys = keysFor(r.uid, r.kind, r.day, r.week);
            const m = redis.multi();
            const op = delta > 0 ? 'incrby' : 'decrby';
            const a = Math.abs(delta);
            m[op](keys.total, a)[op](keys.day, a)[op](keys.week, a);
            if (keys.dayVideo) m[op](keys.dayVideo, a);
            await m.exec();
          }
        } else {
          return; // ya confirmada antes: idempotente, no duplicar la línea
        }
      } else if (costMicros > 0) {
        // Gasto sin reserva previa: se suma directo a los contadores.
        const keys = keysFor(input.uid, input.kind, day, weekKey(ts));
        const m = redis.multi().incrby(keys.total, costMicros).incrby(keys.day, costMicros).incrby(keys.week, costMicros);
        if (keys.dayVideo) m.incrby(keys.dayVideo, costMicros);
        await m.exec();
      }
      const entry: LedgerEntry = {
        id: `e_${ts}_${Math.random().toString(36).slice(2, 8)}`,
        uid: input.uid, kind: input.kind, model: input.model,
        units: input.units, unit: input.unit, costUSD: toUSD(costMicros),
        ...(input.taskId ? { taskId: input.taskId } : {}),
        createdAt: ts,
      };
      await store.writeEntry(entry, day, caps);
    } catch (err: any) {
      console.error('[PilotLedger] recordSpend falló:', err?.message);
    }
  }

  async function getStatus(uid: string) {
    const ts = now();
    const day = dayKey(ts);
    const week = weekKey(ts);
    const kinds: BudgetKind[] = ['image', 'video', 'text', 'vision'];
    const read = async (key: string) => Number((await redis.get(key)) ?? 0);
    const [total, today] = await Promise.all([read(k(uid, 'total')), read(k(uid, `day:${day}`))]);
    const weekly: Record<string, number> = {};
    for (const kd of kinds) weekly[kd] = toUSD(await read(k(uid, `wk:${week}:${kd}`)));
    return {
      pilot: true as const,
      day, week,
      spentTotalUSD: toUSD(total),
      spentTodayUSD: toUSD(today),
      weeklyByKindUSD: weekly,
      caps,
      alert: total >= caps.alertAt * toMicros(caps.totalCapUSD) || today >= caps.alertAt * toMicros(caps.dailyCapUSD),
      videoEnabled: isVideoEnabled(),
    };
  }

  return { checkBudget, recordSpend, releaseReservation, getStatus };
}

// ─── Implementaciones reales (Redis Upstash + Firestore Admin) ──────────────
let _redis: LedgerRedis | null = null;
function realRedis(): LedgerRedis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    }) as unknown as LedgerRedis;
  }
  return _redis;
}

async function adminDb(): Promise<{ db: any; FieldValue: any }> {
  const { initializeApp, getApps, cert } = await import('firebase-admin/app' as any);
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore' as any);
  if (getApps().length === 0) {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
    const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
    initializeApp({ credential: cert(JSON.parse(decoded)) });
  }
  return { db: getFirestore(process.env.FIRESTORE_DATABASE_ID || '(default)'), FieldValue };
}

const realStore: LedgerStore = {
  async readTotalMicros(uid) {
    const { db } = await adminDb();
    const snap = await db.collection('users').doc(uid).collection('budgetLedger').doc('_total').get();
    if (!snap.exists) return null;
    return toMicros(Number(snap.data()?.spentUSD) || 0);
  },
  async writeEntry(entry, day, caps) {
    const { db, FieldValue } = await adminDb();
    const col = db.collection('users').doc(entry.uid).collection('budgetLedger');
    const summary = (period: string) => ({
      period,
      spentUSD: FieldValue.increment(entry.costUSD),
      dailyCapUSD: caps.dailyCapUSD,
      totalCapUSD: caps.totalCapUSD,
      byKind: { [entry.kind]: FieldValue.increment(entry.costUSD) },
      updatedAt: entry.createdAt,
    });
    const batch = db.batch();
    batch.set(col.doc(entry.id), entry);
    batch.set(col.doc('_total'), summary('total'), { merge: true });
    batch.set(col.doc(`_day_${day}`), summary(day), { merge: true });
    await batch.commit();
  },
  async setAlert(uid, alert) {
    const { db } = await adminDb();
    await db.collection('users').doc(uid).collection('budgetLedger').doc('_total')
      .set({ period: 'total', alert }, { merge: true });
  },
};

let _real: ReturnType<typeof createLedger> | null = null;
function real() {
  if (!_real) {
    _real = createLedger({
      redis: realRedis(), store: realStore, caps: capsFromEnv(process.env), now: () => Date.now(),
    });
  }
  return _real;
}

export const checkBudget = (uid: string, kind: BudgetKind, estimatedUSD: number, meta?: { model?: string; taskId?: string }) =>
  real().checkBudget(uid, kind, estimatedUSD, meta);
export const recordSpend = (input: RecordSpendInput) => real().recordSpend(input);
export const releaseReservation = (id: string) => real().releaseReservation(id);

// ─── Estimación para content.ts (texto / visión) ────────────────────────────
/** Estima USD de una petición de content.ts (conservador: asume salida larga). */
export function estimateContentRequestUSD(body: any): { kind: BudgetKind; usd: number } {
  const promptChars = typeof body?.prompt === 'string' ? body.prompt.length : 0;
  const payloadChars = body?.payload ? JSON.stringify(body.payload).length : 0;
  const nImages = Array.isArray(body?.images) ? body.images.length : 0;
  const heavy = typeof body?.action === 'string' && /photodump|Director|Async/i.test(body.action);
  const inputTokens = Math.ceil((promptChars + payloadChars) / 3) + nImages * 1300;
  const outputTokens = heavy ? 12_000 : 4_000;
  // gemini-2.5-flash: entrada USD 0.30 / salida USD 2.50 por 1M (pricing.ts); margen 10 %.
  const usd = ((inputTokens * 0.30 + outputTokens * 2.50) / 1e6) * 1.1;
  return { kind: nImages > 0 ? 'vision' : 'text', usd: Math.max(0.0005, Math.round(usd * 1e6) / 1e6) };
}

// ─── Endpoint: estado del gasto para la app ─────────────────────────────────
// POST /api/piloto/ledger {action:'status'}  (requiere sesión)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { setCorsHeaders, setSecurityHeaders, verifyAuth } = await import('../../src/server/api/middleware.js');
  setSecurityHeaders(res);
  if (setCorsHeaders(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let uid: string;
  try { uid = await verifyAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }

  const action = req.body?.action;
  if (action !== 'status') return res.status(400).json({ error: 'Unknown action' });
  if (!isPilotUid(uid)) return res.status(200).json({ pilot: false });
  try {
    return res.status(200).json(await real().getStatus(uid));
  } catch (err: any) {
    console.error('[PilotLedger] status falló:', err?.message);
    return res.status(500).json({ error: 'No se pudo leer el gasto' });
  }
}
