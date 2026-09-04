import { PhotodumpSet } from './types';

const DB_NAME    = 'app_photodump_module';
const STORE_NAME = 'sets';

export const photodumpStorage = {
  async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror  = () => reject(request.error);
    });
  },

  async save(set: PhotodumpSet): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(set);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  },

  async list(): Promise<PhotodumpSet[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
      req.onerror   = () => reject(req.error);
    });
  },

  async delete(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  },

  // Borrado en masa (sep 2026, pedido real del usuario: "si quiero borrar
  // alguno, solo puedo uno por uno y es lentísimo") — una sola transacción
  // para todos los ids en vez de N llamadas a delete() separadas, más rápido
  // y evita dejar la biblioteca a medio borrar si el navegador se cierra en
  // medio de un borrado largo.
  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const id of ids) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  },
};
