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
  doc, getDoc,
  Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function callCreditsApi(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch('/api/credits', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body:    JSON.stringify({ action, payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Credits API error: ${res.status}`);
  }
  return res.json();
}

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
// Delega al servidor la decisión de si el período venció y el reset.
// El servidor usa Admin SDK, por lo que las Firestore rules no bloquean la escritura.

export async function resetPeriodIfNeeded(_uid: string): Promise<void> {
  try {
    await callCreditsApi('resetPeriod');
  } catch (err) {
    // No bloquear el flujo si falla — es solo una optimización de UI
    console.warn('[creditsService] resetPeriod failed (non-blocking):', err);
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
// Delega el descuento al servidor via /api/credits.
// El servidor usa Admin SDK + transacción atómica — las Firestore rules no
// pueden ser bypasseadas por el cliente para inflar su propio saldo.

export async function deductCredits(_uid: string, cost: number): Promise<boolean> {
  if (cost <= 0) return true;
  try {
    const data = await callCreditsApi('deduct', { cost });
    return data?.ok === true;
  } catch {
    return false;
  }
}

export async function refundCredits(_uid: string, cost: number): Promise<boolean> {
  if (cost <= 0) return true;
  try {
    const data = await callCreditsApi('refund', { cost });
    return data?.ok === true;
  } catch {
    return false;
  }
}

// ── addTopUpCredits ───────────────────────────────────────────────────────────
// Solo se llama para recompensas de misiones. Delega al servidor.
// Los top-ups reales de pago pasan por api/webhooks/dodopayments.ts.

export async function addTopUpCredits(_uid: string, amount: number, missionId: string): Promise<void> {
  await callCreditsApi('rewardMission', { missionId, credits: amount });
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

