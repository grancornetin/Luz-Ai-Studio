// src/services/missionsService.ts
// Sistema de misiones para ganar créditos gratis.
// Completadas → users/{uid}/missions/status
// Créditos → van a topUpCredits (persistentes, no expiran con el período)

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
  maxCompletions:  number;
  icon:            string;
  repeatable:      boolean;
  cooldownHours?:  number; // para misiones repetibles con cooldown
}

export const MISSIONS: Mission[] = [
  {
    id:             'verify_email',
    credits:        5,
    label:          'Verificar tu correo',
    description:    'Confirma tu dirección de email para mayor seguridad.',
    action:         'verifyEmail',
    maxCompletions: 1,
    repeatable:     false,
    icon:           'fa-envelope-circle-check',
  },
  {
    id:             'complete_tutorial',
    credits:        3,
    label:          'Completar el tutorial',
    description:    'Termina el tutorial de bienvenida de la app.',
    action:         'completeTutorial',
    maxCompletions: 1,
    repeatable:     false,
    icon:           'fa-graduation-cap',
  },
  {
    id:             'first_generation',
    credits:        5,
    label:          'Primera generación',
    description:    'Genera tu primera imagen en cualquier módulo.',
    action:         'firstGeneration',
    maxCompletions: 1,
    repeatable:     false,
    icon:           'fa-wand-magic-sparkles',
  },
  {
    id:             'follow_instagram',
    credits:        5,
    label:          'Seguir en Instagram',
    description:    'Sigue @luziastudio en Instagram.',
    action:         'followInstagram',
    maxCompletions: 1,
    repeatable:     false,
    icon:           'fa-brands fa-instagram',
  },
  {
    id:             'daily_login',
    credits:        1,
    label:          'Login diario',
    description:    'Inicia sesión cada día para ganar créditos.',
    action:         'dailyLogin',
    maxCompletions: 365,
    repeatable:     true,
    cooldownHours:  24,
    icon:           'fa-calendar-check',
  },
  {
    id:             'referral',
    credits:        10,
    label:          'Invitar a un amigo',
    description:    'Un amigo se registra usando tu código de referido.',
    action:         'referFriend',
    maxCompletions: 5,
    repeatable:     true,
    icon:           'fa-user-plus',
  },
];

export interface MissionStatus {
  completed:    boolean;
  count:        number;
  completedAt?: string;
  lastCompletedAt?: string; // para repetibles con cooldown
}

export type UserMissions = Record<string, MissionStatus>;

// ── Leer estado de misiones ───────────────────────────────────────────────────

export async function getUserMissions(userId: string): Promise<UserMissions> {
  try {
    const ref  = doc(db, 'users', userId, 'missions', 'status');
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as UserMissions) : {};
  } catch { return {}; }
}

// ── Verificar si una misión repetible está en cooldown ────────────────────────

export function isMissionOnCooldown(status: MissionStatus, mission: Mission): boolean {
  if (!mission.repeatable || !mission.cooldownHours) return false;
  if (!status.lastCompletedAt) return false;
  const last    = new Date(status.lastCompletedAt).getTime();
  const elapsed = (Date.now() - last) / (1000 * 60 * 60);
  return elapsed < mission.cooldownHours;
}

// ── Completar misión ──────────────────────────────────────────────────────────

export async function completeMission(
  userId:    string,
  missionId: string,
): Promise<{ success: boolean; creditsEarned: number; message: string }> {
  const mission = MISSIONS.find(m => m.id === missionId);
  if (!mission) return { success: false, creditsEarned: 0, message: 'Misión no encontrada' };

  const statusRef = doc(db, 'users', userId, 'missions', 'status');
  const snap      = await getDoc(statusRef);
  const current   = snap.exists() ? (snap.data() as UserMissions) : {};
  const mStatus   = current[missionId] || { completed: false, count: 0 };

  // Verificar límite de completaciones
  if (mStatus.count >= mission.maxCompletions) {
    return { success: false, creditsEarned: 0, message: 'Misión ya completada al máximo' };
  }

  // Verificar cooldown para misiones repetibles
  if (isMissionOnCooldown(mStatus, mission)) {
    return { success: false, creditsEarned: 0, message: 'Misión en cooldown, espera un poco' };
  }

  const now = new Date().toISOString();

  // Actualizar estado de misión
  await setDoc(statusRef, {
    [missionId]: {
      completed:       true,
      count:           (mStatus.count || 0) + 1,
      completedAt:     mStatus.completedAt || now,
      lastCompletedAt: now,
    },
  }, { merge: true });

  // Sumar créditos a topUpCredits (persistentes, no expiran)
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    topUpCredits:        increment(mission.credits),
    'credits.available': increment(mission.credits), // campo legacy sincronizado
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

  return {
    success:       true,
    creditsEarned: mission.credits,
    message:       `+${mission.credits} créditos ganados`,
  };
}

// ── Auto-verificar misiones automáticas ──────────────────────────────────────
// Se llama al cargar el perfil — verifica condiciones sin que el usuario haga nada.

export async function autoCheckMissions(
  userId:        string,
  emailVerified: boolean,
): Promise<{ missionId: string; creditsEarned: number }[]> {
  const earned: { missionId: string; creditsEarned: number }[] = [];

  // verify_email — automática
  if (emailVerified) {
    const r = await completeMission(userId, 'verify_email');
    if (r.success && !r.message.includes('máximo')) {
      earned.push({ missionId: 'verify_email', creditsEarned: r.creditsEarned });
    }
  }

  // daily_login — automática al cargar
  const r = await completeMission(userId, 'daily_login');
  if (r.success) {
    earned.push({ missionId: 'daily_login', creditsEarned: r.creditsEarned });
  }

  return earned;
}

// ── Auto-completar primera generación ────────────────────────────────────────
// Se llama desde cualquier módulo al finalizar una generación exitosa.

export async function checkFirstGeneration(userId: string): Promise<void> {
  const statusRef = doc(db, 'users', userId, 'missions', 'status');
  const snap      = await getDoc(statusRef);
  const current   = snap.exists() ? (snap.data() as UserMissions) : {};
  if (!current['first_generation'] || current['first_generation'].count === 0) {
    await completeMission(userId, 'first_generation');
  }
}

// ── Créditos por referido exitoso ─────────────────────────────────────────────
// Se llama cuando un referido hace su primera generación.

export async function addReferralCredits(referrerId: string): Promise<void> {
  await completeMission(referrerId, 'referral');
}
