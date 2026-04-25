// src/services/creditsService.ts
// Servicio central de créditos — fuente única de verdad para Firestore.
//
// Estructura en users/{uid}:
//   plan:                 'free' | 'explorer' | 'starter' | 'pro' | 'studio' | 'admin'
//   planValidUntil:       Timestamp  — fin del período de suscripción
//   creditsUsedThisPeriod: number   — gasto en el período actual
//   topUpCredits:         number    — créditos adicionales, no expiran
//   lastPeriodReset:      Timestamp — último reinicio del período
//   credits.available:    number    — campo legacy que usaban las misiones

import {
  doc, getDoc, updateDoc, runTransaction,
  serverTimestamp, increment, Timestamp, setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type PlanId = 'free' | 'explorer' | 'starter' | 'pro' | 'studio' | 'admin';

export interface UserCreditsDoc {
  plan:                  PlanId;
  planValidUntil?:       Timestamp;
  creditsUsedThisPeriod: number;
  topUpCredits:          number;
  lastPeriodReset?:      Timestamp;
}

// ── Límites por plan ──────────────────────────────────────────────────────────

const PLAN_PERIOD_CREDITS: Record<PlanId, number> = {
  free:    10,     // única vez — gestionado aparte
  explorer: 60,   // por semana
  starter:  200,   // por mes
  pro:      500,   // por mes
  studio:   1200,  // por mes
  admin:    999999,
};

const PLAN_PERIOD_DAYS: Record<PlanId, number> = {
  free:    36500, // nunca expira por período
  explorer: 7,
  starter:  30,
  pro:      30,
  studio:   30,
  admin:    36500,
};

export function getPeriodLimit(plan: PlanId): number {
  return PLAN_PERIOD_CREDITS[plan] ?? 0;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

async function getUserCreditsDoc(uid: string): Promise<UserCreditsDoc> {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { plan: 'free', creditsUsedThisPeriod: 0, topUpCredits: 0 };
  }
  const d = snap.data();
  return {
    plan:                  (d.plan as PlanId) || 'free',
    planValidUntil:        d.planValidUntil,
    creditsUsedThisPeriod: d.creditsUsedThisPeriod || 0,
    topUpCredits:          d.topUpCredits || 0,
    lastPeriodReset:       d.lastPeriodReset,
  };
}

// ── resetPeriodIfNeeded ───────────────────────────────────────────────────────
// Compara lastPeriodReset con hoy. Si pasó el período, reinicia el contador.
// Se llama antes de cada generación y al cargar el perfil.

export async function resetPeriodIfNeeded(uid: string): Promise<void> {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const d    = snap.data();
  const plan = (d.plan as PlanId) || 'free';
  if (plan === 'free' || plan === 'admin') return; // no tiene períodos

  const lastReset: Timestamp | undefined = d.lastPeriodReset;
  const periodDays = PLAN_PERIOD_DAYS[plan];
  const now        = Date.now();
  const resetMs    = lastReset ? lastReset.toMillis() : 0;
  const elapsed    = (now - resetMs) / (1000 * 60 * 60 * 24);

  if (elapsed >= periodDays) {
    await updateDoc(ref, {
      creditsUsedThisPeriod: 0,
      lastPeriodReset:       serverTimestamp(),
    });
  }
}

// ── canGenerate ───────────────────────────────────────────────────────────────

export function canGenerate(user: UserCreditsDoc, cost: number): boolean {
  if (user.plan === 'admin') return true;
  if (user.topUpCredits >= cost) return true;
  const remaining = getPeriodLimit(user.plan) - user.creditsUsedThisPeriod;
  return remaining >= cost;
}

// ── deductCredits ─────────────────────────────────────────────────────────────
// Descuenta créditos en transacción atómica.
// Prioridad: topUpCredits primero, luego créditos del período.

export async function deductCredits(uid: string, cost: number): Promise<boolean> {
  if (cost <= 0) return true;

  try {
    let ok = false;
    await runTransaction(db, async (tx) => {
      const ref  = doc(db, 'users', uid);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('User not found');

      const d    = snap.data();
      const plan = (d.plan as PlanId) || 'free';
      if (plan === 'admin') { ok = true; return; }

      const topUp  = d.topUpCredits            || 0;
      const used   = d.creditsUsedThisPeriod   || 0;
      const limit  = getPeriodLimit(plan);
      const remaining = limit - used;

      let topUpDeduct = 0;
      let periodDeduct = 0;

      if (topUp >= cost) {
        topUpDeduct = cost;
      } else if (topUp > 0 && (topUp + remaining) >= cost) {
        topUpDeduct  = topUp;
        periodDeduct = cost - topUp;
      } else if (remaining >= cost) {
        periodDeduct = cost;
      } else {
        throw new Error('Insufficient credits');
      }

      const updates: Record<string, any> = {};
      if (topUpDeduct  > 0) updates.topUpCredits            = topUp  - topUpDeduct;
      if (periodDeduct > 0) updates.creditsUsedThisPeriod   = used   + periodDeduct;
      // Mantener campo legacy sincronizado
      updates['credits.available'] = Math.max(0, (d.credits?.available || 0) - cost);

      tx.update(ref, updates);
      ok = true;
    });
    return ok;
  } catch {
    return false;
  }
}

// ── addTopUpCredits ───────────────────────────────────────────────────────────

export async function addTopUpCredits(uid: string, amount: number, note: string): Promise<void> {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, {
    topUpCredits:        increment(amount),
    'credits.available': increment(amount),
  });

  // Log de transacción
  const txRef = doc(db, 'users', uid, 'creditTransactions', `topup_${Date.now()}`);
  await setDoc(txRef, {
    type:      'topup',
    amount,
    createdAt: serverTimestamp(),
    note,
  });
}

// ── getEffectiveCredits ───────────────────────────────────────────────────────
// Devuelve los créditos disponibles efectivos para mostrar en UI.

export async function getEffectiveCredits(uid: string): Promise<{
  available: number;
  topUp: number;
  period: number;
  periodUsed: number;
  plan: PlanId;
}> {
  const u      = await getUserCreditsDoc(uid);
  const limit  = getPeriodLimit(u.plan);
  const period = Math.max(0, limit - u.creditsUsedThisPeriod);

  return {
    available:  u.topUpCredits + period,
    topUp:      u.topUpCredits,
    period,
    periodUsed: u.creditsUsedThisPeriod,
    plan:       u.plan,
  };
}

// ── activatePlan ─────────────────────────────────────────────────────────────
// Llamada desde el webhook cuando se activa/renueva una suscripción.

export async function activatePlan(
  uid: string,
  plan: PlanId,
  validUntil: Date,
): Promise<void> {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, {
    plan,
    planValidUntil:        Timestamp.fromDate(validUntil),
    creditsUsedThisPeriod: 0,
    lastPeriodReset:       serverTimestamp(),
  });

  // Log
  const txRef = doc(db, 'users', uid, 'creditTransactions', `plan_${plan}_${Date.now()}`);
  await setDoc(txRef, {
    type:      'subscription',
    plan,
    validUntil: Timestamp.fromDate(validUntil),
    createdAt:  serverTimestamp(),
    note:       `Plan ${plan} activado`,
  });
}

// ── cancelPlan ────────────────────────────────────────────────────────────────

export async function cancelPlan(uid: string): Promise<void> {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, {
    plan:                  'free',
    planValidUntil:        null,
    creditsUsedThisPeriod: 0,
    lastPeriodReset:       serverTimestamp(),
  });
}
