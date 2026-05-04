// src/hooks/useNotifications.ts
// Store global + hook React para notificaciones.
//
// Diseño:
//   - Un solo listener de Firestore por sesión (montado en App.tsx).
//   - Múltiples componentes (panel, badge del bottom-nav) consumen el mismo store
//     vía useNotifications() — sin duplicar suscripciones a Firebase.
//   - useSyncExternalStore garantiza renders consistentes en concurrent mode.

import { useCallback, useSyncExternalStore } from 'react';
import {
  subscribeToNotifications,
  markAsRead as markAsReadApi,
  markAllAsRead as markAllAsReadApi,
  deleteNotification as deleteNotificationApi,
  purgeOldNotifications,
  AppNotification,
} from '../services/notificationsService';

// ── Store interno ─────────────────────────────────────────────────────────────

type Listener = () => void;

interface Store {
  notifications: AppNotification[];
  loaded: boolean;
  uid: string | null;
}

let store: Store = { notifications: [], loaded: false, uid: null };
const listeners = new Set<Listener>();
let unsubFirestore: (() => void) | null = null;

function emit() {
  listeners.forEach(l => l());
}

function setStore(next: Partial<Store>) {
  store = { ...store, ...next };
  emit();
}

// ── Montaje / desmontaje del listener (lo llama App.tsx) ──────────────────────

export function startNotificationsListener(uid: string): void {
  if (store.uid === uid && unsubFirestore) return; // ya montado para este usuario

  // Desmontar listener anterior si cambió de usuario
  if (unsubFirestore) {
    unsubFirestore();
    unsubFirestore = null;
  }

  setStore({ notifications: [], loaded: false, uid });

  unsubFirestore = subscribeToNotifications(uid, items => {
    setStore({ notifications: items, loaded: true });
  });

  // Limpieza diferida de notificaciones viejas (no bloquea la suscripción)
  setTimeout(() => {
    purgeOldNotifications(uid).catch(() => {});
  }, 5000);
}

export function stopNotificationsListener(): void {
  if (unsubFirestore) {
    unsubFirestore();
    unsubFirestore = null;
  }
  setStore({ notifications: [], loaded: false, uid: null });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): Store {
  return store;
}

export interface UseNotificationsReturn {
  notifications:  AppNotification[];
  unreadCount:    number;
  loaded:         boolean;
  markAsRead:     (id: string) => Promise<void>;
  markAllAsRead:  () => Promise<void>;
  deleteOne:      (id: string) => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const unreadCount = snap.notifications.filter(n => !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    if (!snap.uid) return;
    await markAsReadApi(snap.uid, id);
  }, [snap.uid]);

  const markAllAsRead = useCallback(async () => {
    if (!snap.uid) return;
    const unreadIds = snap.notifications.filter(n => !n.read).map(n => n.id);
    await markAllAsReadApi(snap.uid, unreadIds);
  }, [snap.uid, snap.notifications]);

  const deleteOne = useCallback(async (id: string) => {
    if (!snap.uid) return;
    await deleteNotificationApi(snap.uid, id);
  }, [snap.uid]);

  return {
    notifications: snap.notifications,
    unreadCount,
    loaded:        snap.loaded,
    markAsRead,
    markAllAsRead,
    deleteOne,
  };
}
