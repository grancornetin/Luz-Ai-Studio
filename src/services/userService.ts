// src/services/userService.ts
// Servicio de usuario — lee y escribe en Firestore (reemplaza el mock anterior).

import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, collection,
  serverTimestamp, increment, Timestamp,
} from 'firebase/firestore';
import { PLAN_CREDITS } from './creditConfig';
import { resetPeriodIfNeeded, getEffectiveCredits } from './creditsService';
import type { PlanId } from './creditsService';
import { generateReferralCode } from './referralService';
import { getItems, saveItem, deleteItem } from './userLibraryStore';

// ── Interfaces exportadas ─────────────────────────────────────────────────────

export interface UserStats {
  totalGenerations: number;
  totalAvatars:     number;
  totalProducts:    number;
  creditsUsed:      number;
  lastActiveAt:     string;
}

export interface UserCredits {
  available: number;
  used:      number;
  plan:      'free' | 'starter' | 'pro' | 'studio' | 'admin' | 'explorer' | 'weekly';
  resetAt?:  string;
}

export { PLAN_CREDITS };

// ── Inicializar usuario (primer login) ────────────────────────────────────────

export const userService = {

  async initializeUser(uid: string, email: string, displayName: string): Promise<void> {
    const ref  = doc(db, 'users', uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      // Si el doc ya existe pero no tiene créditos iniciales (ej: registro con Google
      // que crea el doc antes de que se llame initializeUser), los asignamos.
      const needsCredits = (data.topUpCredits === undefined || data.topUpCredits === null)
        && (!data.credits?.available || data.credits.available === 0);

      if (!needsCredits) return;

      // Los créditos iniciales los suma el servidor para que las Firestore rules
      // no los bloqueen. Solo actualizamos el referralCode si falta (campo no protegido).
      await updateDoc(ref, {
        plan:          data.plan || 'free',
        referralCode:  data.referralCode || generateReferralCode(uid),
        referralCount: data.referralCount ?? 0,
        updatedAt:     serverTimestamp(),
      });

      // Suma los créditos de bienvenida vía servidor
      const { addTopUpCredits } = await import('./creditsService');
      await addTopUpCredits(uid, 20, 'welcome_credits').catch(console.warn);
      return;
    }

    // Usuario completamente nuevo
    await setDoc(ref, {
      uid,
      email,
      displayName,
      plan:                  'free',
      planValidUntil:        null,
      creditsUsedThisPeriod: 0,
      topUpCredits:          20,
      lastPeriodReset:       serverTimestamp(),
      referralCode:          generateReferralCode(uid),
      referralCount:         0,
      referredBy:            null,
      credits: {
        available: 20,
        used:      0,
        plan:      'free',
      },
      interests:   { categories: [], tags: [], preferredModules: [] },
      socials:     {},
      preferences: { emailNotifications: true, feedSortBy: 'recent', theme: 'light' },
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
    }, { merge: true });
  },

  async getCredits(uid: string): Promise<UserCredits> {
    try {
      await resetPeriodIfNeeded(uid);
      const eff = await getEffectiveCredits(uid);
      return {
        available: eff.available,
        used:      eff.periodUsed,
        plan:      eff.plan as UserCredits['plan'],
      };
    } catch {
      return { available: 0, used: 0, plan: 'free' };
    }
  },

  async deductCredits(uid: string, amount: number = 1): Promise<boolean> {
    const { deductCredits: deduct } = await import('./creditsService');
    return deduct(uid, amount);
  },

  async deductCredit(uid: string): Promise<boolean> {
    return this.deductCredits(uid, 1);
  },

  async hasEnoughCredits(uid: string, required: number = 1): Promise<boolean> {
    const c = await this.getCredits(uid);
    if (c.plan === 'admin') return true;
    return c.available >= required;
  },

  async updateCredits(uid: string, credits: UserCredits): Promise<void> {
    // No-op: los créditos se gestionan a través de deductCredits/addTopUpCredits
  },

  async getStats(uid: string): Promise<UserStats> {
    try {
      const ref  = doc(db, 'users', uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return defaultStats();
      const d = snap.data();
      return {
        totalGenerations: d.totalGenerations || 0,
        totalAvatars:     d.totalAvatars     || 0,
        totalProducts:    d.totalProducts    || 0,
        creditsUsed:      d.creditsUsedThisPeriod || 0,
        lastActiveAt:     d.lastActiveAt?.toDate?.()?.toISOString() || '',
      };
    } catch {
      return defaultStats();
    }
  },

  // ── Avatars / Products / Sets (Firestore + Storage, ver userLibraryStore) ──
  // Los saves lanzan error si algo falla: la UI no debe mostrar "Guardado" en falso.

  async getAvatars(uid: string) {
    return getItems(uid, 'avatars');
  },

  async saveAvatar(uid: string, avatar: any): Promise<void> {
    await saveItem(uid, 'avatars', avatar);
  },

  async deleteAvatar(uid: string, avatarId: string): Promise<void> {
    await deleteItem(uid, 'avatars', avatarId);
  },

  async getProducts(uid: string) {
    return getItems(uid, 'products');
  },

  async saveProduct(uid: string, product: any): Promise<void> {
    await saveItem(uid, 'products', product);
  },

  async deleteProduct(uid: string, productId: string): Promise<void> {
    await deleteItem(uid, 'products', productId);
  },

  async getSets(uid: string) {
    return getItems(uid, 'sets');
  },

  async saveSet(uid: string, set: any): Promise<void> {
    await saveItem(uid, 'sets', set);
  },

  async deleteSet(uid: string, setId: string): Promise<void> {
    await deleteItem(uid, 'sets', setId);
  },
};

// ── Helpers privados ──────────────────────────────────────────────────────────

function defaultStats(): UserStats {
  return { totalGenerations: 0, totalAvatars: 0, totalProducts: 0, creditsUsed: 0, lastActiveAt: '' };
}
