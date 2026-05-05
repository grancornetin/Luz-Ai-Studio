// api/credits.ts
// Endpoint servidor para todas las operaciones de escritura de créditos.
// El cliente nunca modifica topUpCredits / creditsUsedThisPeriod directamente —
// lo hace aquí, usando Firebase Admin SDK (que ignora las Firestore rules).
//
// Acciones:
//   deduct        — descuenta créditos antes de una generación
//   resetPeriod   — reinicia el contador del período mensual si ya venció
//   rewardMission — suma créditos de recompensa por completar una misión

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { setCorsHeaders, setSecurityHeaders, verifyAuth } from './_middleware.js';

// ── Firebase Admin (lazy init) ────────────────────────────────────────────────

function getAdminDb() {
  if (getApps().length === 0) {
    const raw     = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
    const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
    initializeApp({ credential: cert(JSON.parse(decoded)) });
  }
  const dbId = process.env.FIRESTORE_DATABASE_ID || '(default)';
  return getFirestore(dbId);
}

// ── Plan limits ───────────────────────────────────────────────────────────────

const PLAN_PERIOD_CREDITS: Record<string, number> = {
  free:    10,
  explorer: 60,
  starter:  200,
  pro:      500,
  studio:   1200,
  admin:    999999,
};

const PLAN_PERIOD_DAYS: Record<string, number> = {
  free:    36500,
  explorer: 7,
  starter:  30,
  pro:      30,
  studio:   30,
  admin:    36500,
};

function getPeriodLimit(plan: string): number {
  return PLAN_PERIOD_CREDITS[plan] ?? 0;
}

// ── Handler ───────────────────────────────────────────────────────────────────

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

  const { action, payload } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Missing action' });

  try {
    const db      = getAdminDb();
    const userRef = db.collection('users').doc(uid);

    // ── deduct ─────────────────────────────────────────────────────────────────
    // Descuenta créditos en transacción atómica. Prioridad: topUp primero,
    // luego créditos del período. Admin nunca paga.
    if (action === 'deduct') {
      const cost = Number(payload?.cost);
      if (!cost || cost <= 0) return res.status(400).json({ error: 'Invalid cost' });

      let ok = false;
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) throw new Error('User not found');

        const d    = snap.data()!;
        const plan = d.plan || 'free';

        if (plan === 'admin') { ok = true; return; }

        const topUp     = Number(d.topUpCredits)           || 0;
        const used      = Number(d.creditsUsedThisPeriod)  || 0;
        const limit     = getPeriodLimit(plan);
        const remaining = limit - used;

        // Prioridad: suscripción (período) primero, topUp como respaldo.
        let topUpDeduct  = 0;
        let periodDeduct = 0;

        if (remaining >= cost) {
          periodDeduct = cost;
        } else if (remaining > 0 && (remaining + topUp) >= cost) {
          periodDeduct = remaining;
          topUpDeduct  = cost - remaining;
        } else if (topUp >= cost) {
          topUpDeduct = cost;
        } else {
          throw new Error('Insufficient credits');
        }

        const updates: Record<string, any> = {};
        if (topUpDeduct  > 0) updates.topUpCredits           = topUp - topUpDeduct;
        if (periodDeduct > 0) updates.creditsUsedThisPeriod  = used  + periodDeduct;
        updates['credits.available'] = Math.max(0, (d.credits?.available || 0) - cost);
        tx.update(userRef, updates);
        ok = true;
      });

      return res.status(200).json({ ok });
    }

    // ── resetPeriod ────────────────────────────────────────────────────────────
    // Comprueba si el período del usuario ya venció y resetea el contador.
    // El cliente lo llama al cargar créditos; el server decide si aplica.
    if (action === 'resetPeriod') {
      const snap = await userRef.get();
      if (!snap.exists) return res.status(200).json({ reset: false });

      const d    = snap.data()!;
      const plan = d.plan || 'free';

      if (plan === 'free' || plan === 'admin') {
        return res.status(200).json({ reset: false });
      }

      const lastReset   = d.lastPeriodReset as Timestamp | undefined;
      const periodDays  = PLAN_PERIOD_DAYS[plan] || 30;
      const now         = Date.now();
      const resetMs     = lastReset ? lastReset.toMillis() : 0;
      const elapsedDays = (now - resetMs) / (1000 * 60 * 60 * 24);

      if (elapsedDays >= periodDays) {
        await userRef.update({
          creditsUsedThisPeriod: 0,
          lastPeriodReset:       FieldValue.serverTimestamp(),
        });
        return res.status(200).json({ reset: true });
      }

      return res.status(200).json({ reset: false });
    }

    // ── rewardMission ──────────────────────────────────────────────────────────
    // Suma créditos de recompensa por misión completada.
    // Valida que la misión exista y que el usuario no la haya completado ya.
    if (action === 'rewardMission') {
      const { missionId, credits: mCredits } = payload || {};
      if (!missionId || !mCredits || mCredits <= 0) {
        return res.status(400).json({ error: 'Invalid missionId or credits' });
      }
      // Máximo razonable por misión (evita que el cliente infle el número)
      if (Number(mCredits) > 50) {
        return res.status(400).json({ error: 'Credit reward too high' });
      }

      await userRef.update({
        topUpCredits:        FieldValue.increment(Number(mCredits)),
        'credits.available': FieldValue.increment(Number(mCredits)),
      });

      const txRef = db.collection('users').doc(uid)
        .collection('creditTransactions').doc(`mission_${missionId}_${Date.now()}`);
      await txRef.set({
        type:      'mission',
        missionId,
        amount:    Number(mCredits),
        createdAt: FieldValue.serverTimestamp(),
        note:      `Misión completada: ${missionId}`,
      });

      return res.status(200).json({ ok: true });
    }

    // ── initUser ───────────────────────────────────────────────────────────────
    // Crea el documento de usuario con Admin SDK (ignora Firestore rules).
    // Idempotente: si ya existe con créditos, no hace nada.
    if (action === 'initUser') {
      const { email, displayName } = payload || {};
      const snap = await userRef.get();

      if (snap.exists) {
        const data = snap.data()!;
        const hasWelcomeCredits = data.topUpCredits != null && data.topUpCredits > 0;
        if (!hasWelcomeCredits) {
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

      const referralCode = uid.slice(0, 8).toUpperCase();
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
          referralCode,
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
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err: any) {
    console.error('[Credits API] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
