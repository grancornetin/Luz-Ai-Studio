// src/services/referralService.ts
// Sistema de referidos y códigos especiales de lanzamiento.
//
// Referidos:
//   - Cada usuario tiene un referralCode único (ej: LUZ-AB12CD) generado al registrarse
//   - Al registrarse, el nuevo usuario puede ingresar el código de quien lo invitó
//   - Cuando el referido hace su primera generación → referidor recibe 10 cr (máx 5 veces)
//   - Referido recibe 5 cr extra al usar el código
//
// Códigos especiales de lanzamiento:
//   - Tú los creas manualmente en Firestore: specialCodes/{code}
//   - Estructura: { credits: 30, maxUses: 1, usedBy: [], active: true, note: '' }
//   - El usuario los canjea desde la app → recibe topUpCredits

import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc,
  arrayUnion, increment, serverTimestamp, collection,
  query, where, getDocs,
} from 'firebase/firestore';
import { addTopUpCredits } from './creditsService';

// ── Generar código de referido único ─────────────────────────────────────────

export function generateReferralCode(uid: string): string {
  // Toma los primeros 6 chars del uid en mayúsculas, prefijo LUZ-
  const suffix = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  return `LUZ-${suffix}`;
}

// ── Obtener el código de referido del usuario ─────────────────────────────────

export async function getUserReferralCode(uid: string): Promise<string> {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return generateReferralCode(uid);
  return snap.data()?.referralCode || generateReferralCode(uid);
}

// ── Aplicar código de referido al registrarse ─────────────────────────────────
// El nuevo usuario ingresa el código de quien lo invitó.
// Se guarda en su perfil para luego disparar el crédito al referidor.

export async function applyReferralCode(
  newUserId:    string,
  referralCode: string,
): Promise<{ success: boolean; message: string }> {
  if (!referralCode.trim()) return { success: false, message: 'Código vacío' };

  const code = referralCode.trim().toUpperCase();

  // Buscar al usuario dueño del código
  const q    = query(collection(db, 'users'), where('referralCode', '==', code));
  const snap = await getDocs(q);

  if (snap.empty) return { success: false, message: 'Código de referido no válido' };

  const referrerId = snap.docs[0].id;
  if (referrerId === newUserId) return { success: false, message: 'No puedes usar tu propio código' };

  // Guardar quién lo refirió en el perfil del nuevo usuario
  const newUserRef = doc(db, 'users', newUserId);
  await updateDoc(newUserRef, {
    referredBy:      referrerId,
    referralCodeUsed: code,
  });

  // El nuevo usuario recibe 5 créditos de bienvenida por el referido
  await addTopUpCredits(newUserId, 5, `Bienvenida por referido de ${code}`);

  return { success: true, message: '+5 créditos de bienvenida aplicados' };
}

// ── Disparar créditos al referidor cuando el referido genera ─────────────────
// Se llama desde checkFirstGeneration o desde el módulo de generación.

export async function rewardReferrer(newUserId: string): Promise<void> {
  try {
    const newUserRef  = doc(db, 'users', newUserId);
    const newUserSnap = await getDoc(newUserRef);
    if (!newUserSnap.exists()) return;

    const referrerId      = newUserSnap.data()?.referredBy;
    const alreadyRewarded = newUserSnap.data()?.referralRewardSent;
    if (!referrerId || alreadyRewarded) return;

    // Verificar que el referidor no excedió el máximo (5 referidos)
    const referrerRef  = doc(db, 'users', referrerId);
    const referrerSnap = await getDoc(referrerRef);
    if (!referrerSnap.exists()) return;

    const referralCount = referrerSnap.data()?.referralCount || 0;
    if (referralCount >= 5) return;

    // Dar créditos al referidor
    await addTopUpCredits(referrerId, 10, `Referido exitoso — usuario ${newUserId.slice(0, 6)}`);
    await updateDoc(referrerRef, { referralCount: increment(1) });

    // Marcar que ya se envió el reward para no repetirlo
    await updateDoc(newUserRef, { referralRewardSent: true });
  } catch (e) {
    console.error('[referralService] rewardReferrer error:', e);
  }
}

// ── Canjear código especial de lanzamiento ────────────────────────────────────
// Códigos creados manualmente en Firestore: specialCodes/{CODIGO}
// Estructura: { credits: 30, maxUses: 1, usedBy: [], active: true, note: 'Lanzamiento' }

export interface RedeemResult {
  success:  boolean;
  credits?: number;
  message:  string;
}

export async function redeemSpecialCode(
  userId: string,
  code:   string,
): Promise<RedeemResult> {
  if (!code.trim()) return { success: false, message: 'Ingresa un código' };

  const normalized = code.trim().toUpperCase();
  const codeRef    = doc(db, 'specialCodes', normalized);
  const codeSnap   = await getDoc(codeRef);

  if (!codeSnap.exists()) return { success: false, message: 'Código no válido' };

  const data = codeSnap.data();

  if (!data.active) return { success: false, message: 'Este código ya no está activo' };

  const usedBy: string[] = data.usedBy || [];
  if (usedBy.includes(userId)) return { success: false, message: 'Ya canjeaste este código' };

  if (usedBy.length >= (data.maxUses || 1)) {
    return { success: false, message: 'Este código ya alcanzó su límite de usos' };
  }

  // Marcar como usado
  await updateDoc(codeRef, {
    usedBy:    arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });

  // Dar créditos al usuario
  await addTopUpCredits(userId, data.credits, `Código especial: ${normalized}`);

  return {
    success: true,
    credits: data.credits,
    message: `¡Código canjeado! +${data.credits} créditos agregados a tu cuenta`,
  };
}

// ── Estadísticas de referidos del usuario ────────────────────────────────────

export async function getReferralStats(uid: string): Promise<{
  code:         string;
  referralCount: number;
  maxReferrals: number;
}> {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { code: generateReferralCode(uid), referralCount: 0, maxReferrals: 5 };

  const data = snap.data();
  return {
    code:          data.referralCode || generateReferralCode(uid),
    referralCount: data.referralCount || 0,
    maxReferrals:  5,
  };
}
