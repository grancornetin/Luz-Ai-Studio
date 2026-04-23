// src/services/promptRevealService.ts
// Gestiona el revelado de prompts completos en la galería.
// - Planes Pro/Studio/Admin: revelado gratuito
// - Demás planes: cuesta REVEAL_PROMPT créditos (1)

import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, increment,
  serverTimestamp, collection, query, where, getDocs,
} from 'firebase/firestore';
import { CREDIT_COSTS, isPromptRevealFree } from './creditConfig';

// Verifica si el usuario ya reveló un prompt
export async function isPromptRevealed(userId: string, promptId: string): Promise<boolean> {
  try {
    const ref  = doc(db, 'promptReveals', `${userId}_${promptId}`);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch { return false; }
}

// Obtiene todos los promptIds revelados por un usuario (para UI batch)
export async function getUserRevealedPrompts(userId: string): Promise<Set<string>> {
  try {
    const q    = query(collection(db, 'promptReveals'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const ids  = new Set<string>();
    snap.forEach(d => ids.add(d.data().promptId));
    return ids;
  } catch { return new Set(); }
}

async function markRevealed(userId: string, promptId: string): Promise<void> {
  const ref = doc(db, 'promptReveals', `${userId}_${promptId}`);
  await setDoc(ref, {
    userId,
    promptId,
    revealedAt: serverTimestamp(),
  });
}

async function getUserCredits(userId: string): Promise<number> {
  const ref  = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return 0;
  return snap.data()?.credits?.available ?? 0;
}

async function deductCredits(userId: string, amount: number, note: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    'credits.available': increment(-amount),
  });
  const txRef = doc(db, 'users', userId, 'creditTransactions', `reveal_${Date.now()}`);
  await setDoc(txRef, {
    type:      'deduct',
    amount:    -amount,
    createdAt: serverTimestamp(),
    note,
  });
}

export interface RevealResult {
  success:  boolean;
  message?: string;
  alreadyRevealed?: boolean;
}

export async function revealPrompt(
  userId:   string,
  promptId: string,
  planId:   string,
): Promise<RevealResult> {
  // Ya revelado antes
  const already = await isPromptRevealed(userId, promptId);
  if (already) return { success: true, alreadyRevealed: true };

  // Plan que revela gratis
  if (isPromptRevealFree(planId)) {
    await markRevealed(userId, promptId);
    return { success: true };
  }

  // Verificar créditos
  const available = await getUserCredits(userId);
  if (available < CREDIT_COSTS.REVEAL_PROMPT) {
    return {
      success: false,
      message: `Créditos insuficientes. Necesitas ${CREDIT_COSTS.REVEAL_PROMPT} crédito para revelar este prompt.`,
    };
  }

  // Descontar y marcar
  await deductCredits(userId, CREDIT_COSTS.REVEAL_PROMPT, `Revelar prompt ${promptId}`);
  await markRevealed(userId, promptId);
  return { success: true };
}
