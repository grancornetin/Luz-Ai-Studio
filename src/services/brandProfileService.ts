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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { BrandProfile, BrandProfileDraft, BrandStatus } from '../modules/brandProfiles/types';

function brandsCol(userId: string) {
  return collection(db, 'users', userId, 'brandProfiles');
}

function brandDoc(userId: string, brandId: string) {
  return doc(db, 'users', userId, 'brandProfiles', brandId);
}

export function calculateCompletionScore(profile: Partial<BrandProfile>): number {
  let score = 0;

  // Identidad básica — 20 pts
  if (profile.brandName)        score += 5;
  if (profile.country)          score += 3;
  if (profile.businessModel)    score += 3;
  if (profile.mainCategory)     score += 4;
  if (profile.shortDescription && profile.shortDescription.length > 10) score += 5;

  // Cliente ideal — 20 pts
  const tc = profile.targetCustomer;
  if (tc?.genderFocus)                    score += 4;
  if (tc?.ageRange)                       score += 4;
  if (tc?.buyingMotivation?.length)       score += 4;
  if (tc?.freeDescription?.length > 10)   score += 8;

  // Posicionamiento — 15 pts
  const pos = profile.positioning;
  if (pos?.perceivedLevel)                score += 5;
  if (pos?.mainDifferentiators?.length)   score += 5;
  if (pos?.brandPromise?.length > 5)      score += 5;

  // Voz — 15 pts
  const v = profile.voice;
  if (v?.toneKeywords?.length)            score += 5;
  if (v?.formality)                       score += 5;
  if (v?.emojiLevel)                      score += 5;

  // Visual — 15 pts
  const vi = profile.visualIdentity;
  if (vi?.visualStyle?.length)            score += 5;
  if (vi?.colors?.length > 1)             score += 5;
  if (vi?.assets?.length)                 score += 5;

  // Reglas comerciales — 15 pts
  const cr = profile.commercialRules;
  if (cr?.mainSalesChannels?.length)      score += 5;
  if (cr?.preferredCTA?.length)           score += 5;
  if (cr?.businessStage?.key && cr.businessStage.key !== 'unknown') score += 5;

  return Math.min(100, score);
}

export function resolveBrandStatus(profile: Partial<BrandProfile>): BrandStatus {
  const score = calculateCompletionScore(profile);
  const hasSummary = !!(profile.aiSummary?.brandEssence);
  if (score >= 80 && hasSummary) return 'advanced';
  if (score >= 60)               return 'complete';
  if (score >= 30)               return 'basic';
  return 'incomplete';
}

export const brandProfileService = {
  async getBrandProfiles(userId: string): Promise<BrandProfile[]> {
    try {
      const q = query(brandsCol(userId), orderBy('updatedAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as BrandProfile));
    } catch (err) {
      console.error('[brandProfileService] getBrandProfiles error:', err);
      throw new Error('No se pudieron cargar las marcas. Verifica tu conexión.');
    }
  },

  async getBrandProfile(userId: string, brandId: string): Promise<BrandProfile | null> {
    try {
      const snap = await getDoc(brandDoc(userId, brandId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as BrandProfile;
    } catch (err) {
      console.error('[brandProfileService] getBrandProfile error:', err);
      throw new Error('No se pudo cargar la marca.');
    }
  },

  async createBrandProfile(userId: string, data: Omit<BrandProfileDraft, 'id'>): Promise<string> {
    try {
      const now = Date.now();
      const score = calculateCompletionScore(data);
      const status = resolveBrandStatus(data);
      const payload = {
        ...data,
        userId,
        createdAt: now,
        updatedAt: now,
        completionScore: score,
        status,
        isDefault: false,
      };
      const ref = await addDoc(brandsCol(userId), payload);
      return ref.id;
    } catch (err) {
      console.error('[brandProfileService] createBrandProfile error:', err);
      throw new Error('No se pudo crear la marca. Verifica los permisos de Firestore.');
    }
  },

  async updateBrandProfile(userId: string, brandId: string, data: Partial<BrandProfile>): Promise<void> {
    try {
      const score = calculateCompletionScore(data);
      const status = resolveBrandStatus(data);
      await updateDoc(brandDoc(userId, brandId), {
        ...data,
        updatedAt: Date.now(),
        completionScore: score,
        status,
      });
    } catch (err) {
      console.error('[brandProfileService] updateBrandProfile error:', err);
      throw new Error('No se pudo guardar la marca.');
    }
  },

  async updateBrandSocialInsights(
    userId: string,
    brandId: string,
    socialInsights: NonNullable<BrandProfile['socialInsights']>,
  ): Promise<void> {
    try {
      await updateDoc(brandDoc(userId, brandId), {
        socialInsights,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error('[brandProfileService] updateBrandSocialInsights error:', err);
      throw new Error('No se pudieron guardar las metricas de redes.');
    }
  },

  async deleteBrandProfile(userId: string, brandId: string): Promise<void> {
    try {
      await deleteDoc(brandDoc(userId, brandId));
    } catch (err) {
      console.error('[brandProfileService] deleteBrandProfile error:', err);
      throw new Error('No se pudo eliminar la marca.');
    }
  },

  async setDefaultBrandProfile(userId: string, brandId: string): Promise<void> {
    try {
      const snap = await getDocs(brandsCol(userId));
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.update(d.ref, { isDefault: d.id === brandId, updatedAt: Date.now() });
      });
      await batch.commit();
    } catch (err) {
      console.error('[brandProfileService] setDefaultBrandProfile error:', err);
      throw new Error('No se pudo marcar la marca como predeterminada.');
    }
  },

  calculateCompletionScore,
  resolveBrandStatus,
};
