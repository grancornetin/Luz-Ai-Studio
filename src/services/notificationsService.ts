// src/services/notificationsService.ts
// Cliente Firestore para la colección users/{uid}/notifications.
// El SERVER (Admin SDK desde los workers) crea y actualiza estas notificaciones —
// el cliente solo lee, marca como leídas, y borra.

import {
  collection, query, orderBy, onSnapshot,
  doc, getDoc, updateDoc, deleteDoc, writeBatch, getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';

// ── Tipos (espejo del schema escrito por api/_notifications.ts) ───────────────

export type NotificationStatus = 'in_progress' | 'completed' | 'partial' | 'failed';
export type ShotStatus         = 'completed' | 'failed';

export interface ShotRecord {
  index:        number;
  status:       ShotStatus;
  imageUrl?:    string;
  error?:       string;
  completedAt:  number; // epoch ms
}

export interface AppNotification {
  id:              string;
  sessionId:       string;
  module:          string;
  moduleLabel:     string;
  status:          NotificationStatus;
  totalShots:      number;
  completedShots:  number;
  failedShots:     number;
  shots:           ShotRecord[];
  creditsCharged:  number;
  creditsRefunded: number;
  metadata?:       Record<string, any>;
  read:            boolean;
  createdAt:       number;
  updatedAt:       number;
}

// ── Suscripción en vivo ───────────────────────────────────────────────────────
// Devuelve un unsubscribe para desconectar el listener al desloguear.
export function subscribeToNotifications(
  uid: string,
  onChange: (items: AppNotification[]) => void,
): Unsubscribe {
  const ref = collection(db, 'users', uid, 'notifications');
  const q   = query(ref, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    snap => {
      const items = snap.docs.map(d => ({
        ...(d.data() as Omit<AppNotification, 'id'>),
        id: d.id,
      })) as AppNotification[];
      onChange(items);
    },
    err => {
      console.warn('[notifications] subscribe error:', err.message);
      onChange([]);
    },
  );
}

// ── Leer una notificación específica (para "retomar sesión") ─────────────────
export async function getNotification(uid: string, notificationId: string): Promise<AppNotification | null> {
  try {
    const ref = doc(db, 'users', uid, 'notifications', notificationId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { ...(snap.data() as Omit<AppNotification, 'id'>), id: snap.id } as AppNotification;
  } catch (err: any) {
    console.warn('[notifications] getNotification failed:', err.message);
    return null;
  }
}

// ── Acciones del cliente ──────────────────────────────────────────────────────

export async function markAsRead(uid: string, notificationId: string): Promise<void> {
  const ref = doc(db, 'users', uid, 'notifications', notificationId);
  await updateDoc(ref, { read: true });
}

export async function markAllAsRead(uid: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.update(doc(db, 'users', uid, 'notifications', id), { read: true });
  }
  await batch.commit();
}

export async function deleteNotification(uid: string, notificationId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'notifications', notificationId));
}

// ── Limpieza de notificaciones viejas (retención 30 días) ─────────────────────
// Se ejecuta en background al montar el listener, sin bloquear la UI.
const RETENTION_DAYS = 30;
const RETENTION_MS   = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export async function purgeOldNotifications(uid: string): Promise<void> {
  const ref = collection(db, 'users', uid, 'notifications');
  try {
    const snap = await getDocs(ref);
    const cutoff = Date.now() - RETENTION_MS;
    const expired = snap.docs.filter(d => {
      const data = d.data() as AppNotification;
      return data.createdAt && data.createdAt < cutoff;
    });
    if (!expired.length) return;
    const batch = writeBatch(db);
    expired.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`[notifications] Purged ${expired.length} notification(s) older than ${RETENTION_DAYS} days`);
  } catch (err: any) {
    console.warn('[notifications] purge failed:', err.message);
  }
}
