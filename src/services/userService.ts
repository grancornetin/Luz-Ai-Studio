import { AvatarProfile, ProductProfile, GenerationSet } from '../types';
import { PLAN_CREDITS } from './creditConfig';

// ──────────────────────────────────────────
// userService - MOCKED FOR LOCAL TESTING
// ──────────────────────────────────────────

export interface UserStats {
  totalGenerations: number;
  totalAvatars: number;
  totalProducts: number;
  creditsUsed: number;
  lastActiveAt: string;
}

export interface UserCredits {
  available: number;
  used: number;
  plan: 'free' | 'starter' | 'pro' | 'studio' | 'admin';
  resetAt?: string;
}

export { PLAN_CREDITS };

const getLocal = (key: string) => {
  try { return JSON.parse(localStorage.getItem(`luz_${key}`) || 'null'); } catch { return null; }
};
const setLocal = (key: string, data: any) => {
  localStorage.setItem(`luz_${key}`, JSON.stringify(data));
};

export const userService = {

  async initializeUser(uid: string, email: string, displayName: string): Promise<void> {
    // Mocked
  },

  async getCredits(uid: string): Promise<UserCredits> {
    return { available: 9999, used: 0, plan: 'admin' };
  },

  async deductCredits(uid: string, amount: number = 1): Promise<boolean> {
    return true;
  },

  async deductCredit(uid: string): Promise<boolean> {
    return true;
  },

  async hasEnoughCredits(uid: string, required: number = 1): Promise<boolean> {
    return true;
  },

  async updateCredits(uid: string, credits: UserCredits): Promise<void> {
    // Mocked
  },

  async getStats(uid: string): Promise<UserStats> {
    return { totalGenerations: 0, totalAvatars: 0, totalProducts: 0, creditsUsed: 0, lastActiveAt: '' };
  },

  // ── AVATARS ──────────────────────────────────────────────────────────

  async getAvatars(uid: string): Promise<AvatarProfile[]> {
    return getLocal(`avatars_${uid}`) || [];
  },

  async saveAvatar(uid: string, avatar: AvatarProfile): Promise<void> {
    const avatars = await this.getAvatars(uid);
    const index = avatars.findIndex(a => a.id === avatar.id);
    if (index >= 0) avatars[index] = avatar;
    else avatars.push(avatar);
    setLocal(`avatars_${uid}`, avatars);
  },

  async deleteAvatar(uid: string, avatarId: string): Promise<void> {
    const avatars = await this.getAvatars(uid);
    setLocal(`avatars_${uid}`, avatars.filter(a => a.id !== avatarId));
  },

  // ── PRODUCTS ─────────────────────────────────────────────────────────

  async getProducts(uid: string): Promise<ProductProfile[]> {
    return getLocal(`products_${uid}`) || [];
  },

  async saveProduct(uid: string, product: ProductProfile): Promise<void> {
    const products = await this.getProducts(uid);
    const index = products.findIndex(p => p.id === product.id);
    if (index >= 0) products[index] = product;
    else products.push(product);
    setLocal(`products_${uid}`, products);
  },

  async deleteProduct(uid: string, productId: string): Promise<void> {
    const products = await this.getProducts(uid);
    setLocal(`products_${uid}`, products.filter(p => p.id !== productId));
  },

  // ── GENERATION SETS ──────────────────────────────────────────────────

  async getSets(uid: string): Promise<GenerationSet[]> {
    return getLocal(`sets_${uid}`) || [];
  },

  async saveSet(uid: string, set: GenerationSet): Promise<void> {
    const sets = await this.getSets(uid);
    const index = sets.findIndex(s => s.id === set.id);
    if (index >= 0) sets[index] = set;
    else sets.push(set);
    setLocal(`sets_${uid}`, sets);
  },

  async deleteSet(uid: string, setId: string): Promise<void> {
    const sets = await this.getSets(uid);
    setLocal(`sets_${uid}`, sets.filter(s => s.id !== setId));
  }

};

