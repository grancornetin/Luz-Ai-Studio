// src/services/userService.ts
// Servicio de usuario — lee y escribe en Firestore (reemplaza el mock anterior).

import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, collection,
  serverTimestamp, increment, Timestamp,
} from 'firebase/firestore';
import { PLAN_CREDITS } from './creditConfig';
import type { PlanId } from './creditsService';
import { resetPeriodIfNeeded, getEffectiveCredits } from './creditsService';
import { generateReferralCode } from './referralService';

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

      await updateDoc(ref, {
        topUpCredits:          20,
        creditsUsedThisPeriod: 0,
        plan:                  data.plan || 'free',
        referralCode:          data.referralCode || generateReferralCode(uid),
        referralCount:         data.referralCount ?? 0,
        'credits.available':   20,
        updatedAt:             serverTimestamp(),
      });
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

  // ── Avatars (localStorage — sin cambios) ──────────────────────────────────

  async getAvatars(uid: string) {
    return getLocal(`avatars_${uid}`) || [];
  },

  async saveAvatar(uid: string, avatar: any): Promise<void> {
    const avatars = await this.getAvatars(uid);
    const index   = avatars.findIndex((a: any) => a.id === avatar.id);
    if (index >= 0) avatars[index] = avatar; else avatars.push(avatar);
    setLocal(`avatars_${uid}`, avatars);
  },

  async deleteAvatar(uid: string, avatarId: string): Promise<void> {
    const avatars = await this.getAvatars(uid);
    setLocal(`avatars_${uid}`, avatars.filter((a: any) => a.id !== avatarId));
  },

  // ── Products (localStorage — sin cambios) ─────────────────────────────────

  async getProducts(uid: string) {
    return getLocal(`products_${uid}`) || [];
  },

  async saveProduct(uid: string, product: any): Promise<void> {
    const products = await this.getProducts(uid);
    const index    = products.findIndex((p: any) => p.id === product.id);
    if (index >= 0) products[index] = product; else products.push(product);
    setLocal(`products_${uid}`, products);
  },

  async deleteProduct(uid: string, productId: string): Promise<void> {
    const products = await this.getProducts(uid);
    setLocal(`products_${uid}`, products.filter((p: any) => p.id !== productId));
  },

  // ── Generation Sets (localStorage — sin cambios) ──────────────────────────

  async getSets(uid: string) {
    return getLocal(`sets_${uid}`) || [];
  },

  async saveSet(uid: string, set: any): Promise<void> {
    const sets  = await this.getSets(uid);
    const index = sets.findIndex((s: any) => s.id === set.id);
    if (index >= 0) sets[index] = set; else sets.push(set);
    setLocal(`sets_${uid}`, sets);
  },

  async deleteSet(uid: string, setId: string): Promise<void> {
    const sets = await this.getSets(uid);
    setLocal(`sets_${uid}`, sets.filter((s: any) => s.id !== setId));
  },
};

// ── Helpers privados ──────────────────────────────────────────────────────────

function defaultStats(): UserStats {
  return { totalGenerations: 0, totalAvatars: 0, totalProducts: 0, creditsUsed: 0, lastActiveAt: '' };
}

function getLocal(key: string) {
  try { return JSON.parse(localStorage.getItem(`luz_${key}`) || 'null'); } catch { return null; }
}

function setLocal(key: string, data: any) {
  try { localStorage.setItem(`luz_${key}`, JSON.stringify(data)); } catch { /* ignore */ }
}
