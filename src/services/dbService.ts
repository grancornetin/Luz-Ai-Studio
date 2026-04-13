import { AvatarProfile, ProductProfile, GenerationSet } from '../types';
import { userService } from './userService';
import { auth } from '../firebase';

// ──────────────────────────────────────────
// dbService — migrado de IndexedDB a Firestore
// Todos los datos viven bajo users/{uid}/...
// Compatible con la misma API que usaba antes
// para no romper ningún módulo existente.
// ──────────────────────────────────────────

const getUid = (): string | null => auth.currentUser?.uid || null;

export const dbService = {

  async getAvatars(): Promise<AvatarProfile[]> {
    const uid = getUid();
    if (!uid) return [];
    return userService.getAvatars(uid);
  },

  async saveAvatar(avatar: AvatarProfile): Promise<void> {
    const uid = getUid();
    if (!uid) return;
    await userService.saveAvatar(uid, avatar);
  },

  async deleteAvatar(avatarId: string): Promise<void> {
    const uid = getUid();
    if (!uid) return;
    await userService.deleteAvatar(uid, avatarId);
  },

  async getProducts(): Promise<ProductProfile[]> {
    const uid = getUid();
    if (!uid) return [];
    return userService.getProducts(uid);
  },

  async saveProduct(product: ProductProfile): Promise<void> {
    const uid = getUid();
    if (!uid) return;
    await userService.saveProduct(uid, product);
  },

  async deleteProduct(productId: string): Promise<void> {
    const uid = getUid();
    if (!uid) return;
    await userService.deleteProduct(uid, productId);
  },

  async getSets(): Promise<GenerationSet[]> {
    const uid = getUid();
    if (!uid) return [];
    return userService.getSets(uid);
  },

  async saveSet(set: GenerationSet): Promise<void> {
    const uid = getUid();
    if (!uid) return;
    await userService.saveSet(uid, set);
  },

  async deleteSet(id: string): Promise<void> {
    const uid = getUid();
    if (!uid) return;
    await userService.deleteSet(uid, id);
  },

  // Mantenido por compatibilidad — ya no se usa activamente
  getAnonymousId(): string {
    let id = localStorage.getItem('luz_anon_id');
    if (!id) {
      id = 'anon_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('luz_anon_id', id);
    }
    return id;
  }

};
