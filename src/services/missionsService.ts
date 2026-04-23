// src/services/missionsService.ts
// Sistema de misiones para ganar créditos gratis.
// Las misiones completadas se guardan en Firestore bajo users/{uid}/missions/{missionId}.

import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, increment, serverTimestamp,
} from 'firebase/firestore';

export interface Mission {
  id:              string;
  credits:         number;
  label:           string;
  description:     string;
  action:          string;
  maxCompletions?: number;
  icon:            string;
}

export const MISSIONS: Mission[] = [
  {
    id: 'tutorial',
    credits: 5,
    label: 'Completar el tutorial',
    description: 'Termina el tutorial de bienvenida de la app.',
    action: 'completeTutorial',
    maxCompletions: 1,
    icon: 'fa-graduation-cap',
  },
  {
    id: 'email_verified',
    credits: 10,
    label: 'Verificar tu correo',
    description: 'Confirma tu dirección de email.',
    action: 'verifyEmail',
    maxCompletions: 1,
    icon: 'fa-envelope-circle-check',
  },
  {
    id: 'instagram_follow',
    credits: 5,
    label: 'Seguir en Instagram',
    description: 'Sigue la cuenta oficial de LUZ IA en Instagram.',
    action: 'followInstagram',
    maxCompletions: 1,
    icon: 'fa-instagram',
  },
  {
    id: 'first_generation',
    credits: 5,
    label: 'Primera generación',
    description: 'Genera tu primera imagen en cualquier módulo.',
    action: 'firstGeneration',
    maxCompletions: 1,
    icon: 'fa-wand-magic-sparkles',
  },
  {
    id: 'referral',
    credits: 20,
    label: 'Invitar a un amigo',
    description: 'Un amigo se suscribe usando tu código de referido.',
    action: 'inviteFriend',
    maxCompletions: 10,
    icon: 'fa-user-plus',
  },
];

export interface MissionStatus {
  completed: boolean;
  count:     number;
  completedAt?: string;
}

export type UserMissions = Record<string, MissionStatus>;

// Obtiene el estado de misiones del usuario
export async function getUserMissions(userId: string): Promise<UserMissions> {
  try {
    const ref  = doc(db, 'users', userId, 'missions', 'status');
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as UserMissions) : {};
  } catch { return {}; }
}

// Completa una misión si no se ha excedido el máximo
export async function completeMission(userId: string, missionId: string): Promise<{ success: boolean; creditsEarned: number; message: string }> {
  const mission = MISSIONS.find(m => m.id === missionId);
  if (!mission) return { success: false, creditsEarned: 0, message: 'Misión no encontrada' };

  const statusRef = doc(db, 'users', userId, 'missions', 'status');
  const snap      = await getDoc(statusRef);
  const current   = snap.exists() ? (snap.data() as UserMissions) : {};
  const mStatus   = current[missionId] || { completed: false, count: 0 };

  const max = mission.maxCompletions ?? 1;
  if (mStatus.count >= max) {
    return { success: false, creditsEarned: 0, message: 'Misión ya completada' };
  }

  // Actualizar estado de misión
  await setDoc(statusRef, {
    [missionId]: {
      completed:   true,
      count:       mStatus.count + 1,
      completedAt: new Date().toISOString(),
    },
  }, { merge: true });

  // Sumar créditos al usuario
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    'credits.available': increment(mission.credits),
  });

  // Registrar transacción
  const txRef = doc(db, 'users', userId, 'creditTransactions', `mission_${missionId}_${Date.now()}`);
  await setDoc(txRef, {
    type:      'mission',
    missionId,
    amount:    mission.credits,
    createdAt: serverTimestamp(),
    note:      `Misión completada: ${mission.label}`,
  });

  return { success: true, creditsEarned: mission.credits, message: `+${mission.credits} créditos ganados` };
}

// Se llama cuando un referido se suscribe — suma créditos al referidor
export async function addReferralCredits(referrerId: string): Promise<void> {
  await completeMission(referrerId, 'referral');
}
