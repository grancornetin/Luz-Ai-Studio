// ─────────────────────────────────────────────────────────────────
// PLANNER V3 — Servicio de Firestore
//
// Guarda y lee los planes en /users/{uid}/contentPlans/{planId}.
// Sigue el mismo patrón que src/services/brandProfileService.ts.
//
// IMPORTANTE: requiere agregar esta regla en firestore.rules
// (dentro del match /users/{userId}, junto a brandProfiles):
//
//   // Planes de contenido (Planner V3)
//   match /contentPlans/{planId} {
//     allow read, write: if isOwner(userId) || isAdmin();
//   }
// ─────────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import type {
  ContentPlan,
  PlanTask,
  PostMetrics,
  TaskStatus,
  WeeklyReport,
  WeekHistorySummary,
} from './plannerV3Types';

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('No autenticado');
  return uid;
}

function plansCol(uid: string) {
  return collection(db, 'users', uid, 'contentPlans');
}

function planDoc(uid: string, planId: string) {
  return doc(db, 'users', uid, 'contentPlans', planId);
}

/** Firestore no acepta undefined: los limpia recursivamente. */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const contentPlanService = {
  async listPlans(): Promise<ContentPlan[]> {
    const uid = requireUid();
    const snap = await getDocs(query(plansCol(uid), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ ...(d.data() as Omit<ContentPlan, 'id'>), id: d.id }));
  },

  async getPlan(planId: string): Promise<ContentPlan | null> {
    const uid = requireUid();
    const snap = await getDoc(planDoc(uid, planId));
    if (!snap.exists()) return null;
    return { ...(snap.data() as Omit<ContentPlan, 'id'>), id: snap.id };
  },

  /** El plan activo más reciente (para la pantalla de inicio del módulo). */
  async getActivePlan(): Promise<ContentPlan | null> {
    const uid = requireUid();
    const snap = await getDocs(query(plansCol(uid), orderBy('createdAt', 'desc'), limit(10)));
    const plans = snap.docs.map(d => ({ ...(d.data() as Omit<ContentPlan, 'id'>), id: d.id }));
    return plans.find(p => p.status === 'active') ?? null;
  },

  async createPlan(plan: Omit<ContentPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const uid = requireUid();
    const now = Date.now();
    const ref = await addDoc(plansCol(uid), stripUndefined({ ...plan, createdAt: now, updatedAt: now }));
    return ref.id;
  },

  async updateTaskStatus(planId: string, taskId: string, status: TaskStatus): Promise<void> {
    const uid = requireUid();
    const ref = planDoc(uid, planId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Plan no encontrado');
    const tasks: PlanTask[] = (snap.data().tasks || []).map((t: PlanTask) =>
      t.id === taskId ? { ...t, status } : t,
    );
    await updateDoc(ref, { tasks: stripUndefined(tasks), updatedAt: Date.now() });
  },

  async saveTaskMetrics(planId: string, taskId: string, metrics: PostMetrics): Promise<void> {
    const uid = requireUid();
    const ref = planDoc(uid, planId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Plan no encontrado');
    const tasks: PlanTask[] = (snap.data().tasks || []).map((t: PlanTask) =>
      t.id === taskId ? { ...t, metrics } : t,
    );
    await updateDoc(ref, { tasks: stripUndefined(tasks), updatedAt: Date.now() });
  },

  async closePlan(
    planId: string,
    report: WeeklyReport,
    historySummary: WeekHistorySummary,
  ): Promise<void> {
    const uid = requireUid();
    await updateDoc(planDoc(uid, planId), stripUndefined({
      status: 'closed',
      weeklyReport: report,
      historySummary,
      updatedAt: Date.now(),
    }));
  },

  async deletePlan(planId: string): Promise<void> {
    const uid = requireUid();
    await deleteDoc(planDoc(uid, planId));
  },

  /**
   * Historial para alimentar la generación de una semana nueva.
   * Devuelve los resúmenes de las últimas semanas cerradas de esta marca
   * (máximo 3, de la más antigua a la más reciente).
   */
  async getHistoryForBrand(brandId: string): Promise<WeekHistorySummary[]> {
    const uid = requireUid();
    const snap = await getDocs(query(plansCol(uid), orderBy('createdAt', 'desc'), limit(12)));
    const summaries = snap.docs
      .map(d => d.data() as Omit<ContentPlan, 'id'>)
      .filter(p => p.brandId === brandId && p.status === 'closed' && p.historySummary)
      .slice(0, 3)
      .map(p => p.historySummary as WeekHistorySummary);
    return summaries.reverse();
  },
};
