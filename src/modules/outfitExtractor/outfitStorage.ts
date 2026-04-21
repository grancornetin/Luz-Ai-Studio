// modules/outfitExtractor/outfitStorage.ts
import { OutfitKit, SavedOutfitItem, OutfitCombination } from './types';

const DB_NAME = 'app_outfit_kit_db';
const STORE_KITS = 'outfit_kits';
const STORE_ITEMS = 'outfit_items';
const STORE_COMBINATIONS = 'outfit_combinations';
const MAX_KITS = 10;
const MAX_ITEMS = 50;
const MAX_COMBINATIONS = 20;

export const outfitStorage = {
  async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_KITS)) {
          db.createObjectStore(STORE_KITS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_ITEMS)) {
          const itemStore = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
          itemStore.createIndex('category', 'category', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_COMBINATIONS)) {
          db.createObjectStore(STORE_COMBINATIONS, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // ── KITS (Extracciones Completas) ──────────────────────────
  async saveKit(kit: OutfitKit): Promise<void> {
    const db = await this.openDB();
    const kits = await this.listKits();
    if (kits.length >= MAX_KITS) {
      const oldest = kits.sort((a, b) => a.createdAt - b.createdAt)[0];
      await this.deleteKit(oldest.id);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KITS, 'readwrite');
      const store = tx.objectStore(STORE_KITS);
      store.put(kit);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async listKits(): Promise<OutfitKit[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KITS, 'readonly');
      const store = tx.objectStore(STORE_KITS);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = (request.result as OutfitKit[]).sort((a, b) => b.createdAt - a.createdAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async deleteKit(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KITS, 'readwrite');
      const store = tx.objectStore(STORE_KITS);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // ── ITEMS (Prendas Individuales) ──────────────────────────
  async saveItems(items: SavedOutfitItem[]): Promise<void> {
    const db = await this.openDB();
    const existing = await this.listItems();
    if (existing.length + items.length > MAX_ITEMS) {
      const sorted = existing.sort((a, b) => a.createdAt - b.createdAt);
      const toDelete = sorted.slice(0, (existing.length + items.length) - MAX_ITEMS);
      for (const item of toDelete) {
        await this.deleteItem(item.id);
      }
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      const store = tx.objectStore(STORE_ITEMS);
      items.forEach(item => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async listItems(): Promise<SavedOutfitItem[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readonly');
      const store = tx.objectStore(STORE_ITEMS);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = (request.result as SavedOutfitItem[]).sort((a, b) => b.createdAt - a.createdAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async deleteItem(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      const store = tx.objectStore(STORE_ITEMS);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // ── COMBINATIONS (Sets Creados) ──────────────────────────
  async saveCombination(combo: OutfitCombination): Promise<void> {
    const db = await this.openDB();
    const combos = await this.listCombinations();
    if (combos.length >= MAX_COMBINATIONS) {
      const oldest = combos.sort((a, b) => a.createdAt - b.createdAt)[0];
      await this.deleteCombination(oldest.id);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COMBINATIONS, 'readwrite');
      const store = tx.objectStore(STORE_COMBINATIONS);
      store.put(combo);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async listCombinations(): Promise<OutfitCombination[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COMBINATIONS, 'readonly');
      const store = tx.objectStore(STORE_COMBINATIONS);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = (request.result as OutfitCombination[]).sort((a, b) => b.createdAt - a.createdAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async deleteCombination(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COMBINATIONS, 'readwrite');
      const store = tx.objectStore(STORE_COMBINATIONS);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};