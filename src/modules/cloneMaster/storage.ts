const DB_NAME  = 'app_clone_master';
const STORE    = 'sessions';

export interface CloneMasterSession {
  id: string;
  createdAt: number;
  targetImage: string;       // imagen objetivo original
  baseComposition: string;   // resultado base (paso 3)
  finalImage?: string;       // resultado final (paso 4, si existe)
  face1: string;
  body1: string;
  face2?: string;
  body2?: string;
  outfit1?: string;
  outfit2?: string;
  cameraStyle: string;
  aspectRatio: string;
  enableSecondSubject: boolean;
}

export const cloneMasterStorage = {
  async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  },

  async saveSession(session: CloneMasterSession): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.put(session);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  },

  async listSessions(): Promise<CloneMasterSession[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req   = store.getAll();
      req.onsuccess = () =>
        resolve((req.result as CloneMasterSession[]).sort((a, b) => b.createdAt - a.createdAt));
      req.onerror = () => reject(req.error);
    });
  },

  async deleteSession(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  },
};
