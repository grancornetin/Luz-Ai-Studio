// src/modules/piloto/budget/reserveSpend.ts
// Cliente: pide permiso de gasto al servidor ANTES de una llamada que no pasa
// por api/gemini/image.ts ni content.ts (esas ya miden solas en el servidor).
// Sin llaves: usa la sesion Firebase de la usuaria. Si la cuenta no es piloto,
// el servidor responde pilot:false y se permite sin cambios.
import { getAuth } from 'firebase/auth';
import type { BudgetKind } from './ledgerTypes';

export interface SpendPermission { allowed: boolean; reason?: string; alert?: boolean }

export async function reserveSpend(kind: BudgetKind, estimatedUSD: number, taskId?: string): Promise<SpendPermission> {
  try {
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) return { allowed: false, reason: 'Inicia sesión para continuar.' };
    const r = await fetch('/api/gemini/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'pilotLedger', ledgerAction: 'reserve', kind, estimatedUSD, taskId }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 402) return { allowed: false, reason: j.reason };
    if (!r.ok) return { allowed: false, reason: 'No pude verificar el presupuesto ahora. Intenta de nuevo en un rato.' };
    if (j.pilot === false) return { allowed: true };
    return { allowed: !!j.allowed, alert: j.alert, reason: j.reason };
  } catch {
    return { allowed: false, reason: 'No pude verificar el presupuesto ahora. Intenta de nuevo en un rato.' };
  }
}
