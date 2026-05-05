// api/user-init.ts
// Crea el documento de usuario en Firestore usando Admin SDK (ignora Firestore rules).
// Se llama desde AuthContext cuando detecta que el documento no existe.
// Idempotente: si el doc ya existe, no hace nada.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { setCorsHeaders, setSecurityHeaders, verifyAuth } from './_middleware.js';

function getAdminDb() {
  if (getApps().length === 0) {
    const raw     = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
    const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
    initializeApp({ credential: cert(JSON.parse(decoded)) });
  }
  const dbId = process.env.FIRESTORE_DATABASE_ID || '(default)';
  return getFirestore(dbId);
}

function generateReferralCode(uid: string): string {
  return uid.slice(0, 8).toUpperCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (setCorsHeaders(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let uid: string;
  try {
    uid = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { email, displayName } = req.body || {};

  try {
    const db      = getAdminDb();
    const userRef = db.collection('users').doc(uid);
    const snap    = await userRef.get();

    if (snap.exists) {
      // Ya existe — solo verificar que tenga créditos iniciales
      const data = snap.data()!;
      const hasCredits = data.topUpCredits != null && data.topUpCredits > 0;
      if (!hasCredits) {
        // Existe pero sin créditos — asignar los de bienvenida
        await db.runTransaction(async (tx) => {
          tx.update(userRef, {
            topUpCredits:        FieldValue.increment(20),
            'credits.available': FieldValue.increment(20),
            updatedAt:           FieldValue.serverTimestamp(),
          });
          const txRef = userRef.collection('creditTransactions').doc(`welcome_${Date.now()}`);
          tx.set(txRef, {
            type: 'topup', amount: 20,
            paymentId: 'welcome_credits',
            createdAt: FieldValue.serverTimestamp(),
            note: 'Créditos de bienvenida (asignación tardía)',
          });
        });
        return res.status(200).json({ ok: true, created: false, credited: true });
      }
      return res.status(200).json({ ok: true, created: false, credited: false });
    }

    // No existe — crear documento completo con 20 créditos de bienvenida
    await db.runTransaction(async (tx) => {
      tx.set(userRef, {
        uid,
        email:                 email || '',
        displayName:           displayName || 'Usuario',
        plan:                  'free',
        planValidUntil:        null,
        creditsUsedThisPeriod: 0,
        topUpCredits:          20,
        lastPeriodReset:       FieldValue.serverTimestamp(),
        referralCode:          generateReferralCode(uid),
        referralCount:         0,
        referredBy:            null,
        credits: { available: 20, used: 0, plan: 'free' },
        interests:   { categories: [], tags: [], preferredModules: [] },
        socials:     {},
        preferences: { emailNotifications: true, feedSortBy: 'recent', theme: 'light' },
        onboardingDone: false,
        createdAt:  FieldValue.serverTimestamp(),
        updatedAt:  FieldValue.serverTimestamp(),
      });

      const txRef = userRef.collection('creditTransactions').doc(`welcome_${Date.now()}`);
      tx.set(txRef, {
        type: 'topup', amount: 20,
        paymentId: 'welcome_credits',
        createdAt: FieldValue.serverTimestamp(),
        note: 'Créditos de bienvenida',
      });
    });

    return res.status(200).json({ ok: true, created: true, credited: true });

  } catch (err: any) {
    console.error('[user-init] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
