// src/services/promptRevealService.ts
// Revelado de prompts en la galería.
// - Pro / Studio / Admin: gratis (sin gastar créditos)
// - Resto de planes: cuesta REVEAL_PROMPT crédito (1), queda desbloqueado para siempre

import { db } from '../firebase';
import {
  doc, getDoc, setDoc, serverTimestamp,
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { CREDIT_COSTS, isPromptRevealFree } from './creditConfig';
import { deductCredits } from './creditsService';

// ── Verificar si ya fue revelado ──────────────────────────────────────────────

export async function isPromptRevealed(userId: string, promptId: string): Promise<boolean> {
  try {
    const ref  = doc(db, 'promptReveals', `${userId}_${promptId}`);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch { return false; }
}

// ── Obtener todos los reveals del usuario (para UI batch) ─────────────────────

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

// ── Revelar prompt ────────────────────────────────────────────────────────────

export interface RevealResult {
  success:         boolean;
  message?:        string;
  alreadyRevealed?: boolean;
}

export async function revealPrompt(
  userId:   string,
  promptId: string,
  planId:   string,
): Promise<RevealResult> {
  // Ya revelado antes — acceso directo sin costo
  const already = await isPromptRevealed(userId, promptId);
  if (already) return { success: true, alreadyRevealed: true };

  // Plan con revelado gratis (Pro / Studio / Admin)
  if (isPromptRevealFree(planId)) {
    await markRevealed(userId, promptId);
    return { success: true };
  }

  // Descontar crédito usando el servicio central (topUp primero, luego período)
  const ok = await deductCredits(userId, CREDIT_COSTS.REVEAL_PROMPT);
  if (!ok) {
    return {
      success: false,
      message: `Créditos insuficientes. Necesitas ${CREDIT_COSTS.REVEAL_PROMPT} crédito para revelar este prompt.`,
    };
  }

  await markRevealed(userId, promptId);
  return { success: true };
}
