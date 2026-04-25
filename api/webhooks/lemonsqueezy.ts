// api/webhooks/lemonsqueezy.ts
// Webhook de Lemon Squeezy — recibe eventos de pago y actualiza Firestore.
//
// Eventos manejados:
//   order_created          → top-up de créditos
//   subscription_created   → activar plan
//   subscription_updated   → renovar/cambiar plan
//   subscription_cancelled → degradar a free

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

// ── Firebase Admin (lazy init) ────────────────────────────────────────────────

let _app: App | null = null;

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }
  const raw     = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  _app = initializeApp({ credential: cert(JSON.parse(decoded)) });
  return _app;
}

function getDb() {
  const app = getAdminApp();
  const dbId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-3c2cbb8f-56a6-4903-b155-7db796076281';
  return getFirestore(app, dbId);
}

// ── Mapeo de variantes a planes ───────────────────────────────────────────────

type PlanId = 'free' | 'explorer' | 'starter' | 'pro' | 'studio';

const VARIANT_TO_PLAN: Record<string, PlanId> = {
  [process.env.LEMONSQUEEZY_VARIANT_WEEKLY              || '1572761']: 'explorer',
  [process.env.LEMONSQUEEZY_VARIANT_STARTER_MONTHLY     || '1572747']: 'starter',
  [process.env.LEMONSQUEEZY_VARIANT_STARTER_YEARLY      || '1572751']: 'starter',
  [process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY         || '1572752']: 'pro',
  [process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY          || '1572755']: 'pro',
  [process.env.LEMONSQUEEZY_VARIANT_STUDIO_MONTHLY      || '1572756']: 'studio',
  [process.env.LEMONSQUEEZY_VARIANT_STUDIO_YEARLY       || '1572758']: 'studio',
};

const TOPUP_VARIANT_CREDITS: Record<string, number> = {
  [process.env.LEMONSQUEEZY_VARIANT_TOPUP_30   || '1572814']: 30,
  [process.env.LEMONSQUEEZY_VARIANT_TOPUP_80   || '1572817']: 80,
  [process.env.LEMONSQUEEZY_VARIANT_TOPUP_200  || '1572822']: 200,
  [process.env.LEMONSQUEEZY_VARIANT_TOPUP_500  || '1572824']: 500,
  [process.env.LEMONSQUEEZY_VARIANT_TOPUP_1200 || '1572837']: 1200,
};

const PLAN_PERIOD_DAYS: Record<PlanId, number> = {
  free:    0,
  explorer: 7,
  starter:  30,
  pro:      30,
  studio:   30,
};

// ── Verificación de firma ─────────────────────────────────────────────────────

function verifySignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '';
  const hmac   = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ── Lógica por evento ─────────────────────────────────────────────────────────

async function handleOrderCreated(data: any): Promise<void> {
  const db        = getDb();
  const attrs     = data.attributes;
  const userId    = attrs.custom_data?.user_id || attrs.meta?.custom_data?.user_id;
  const variantId = String(attrs.first_order_item?.variant_id || attrs.variant_id || '');

  if (!userId) {
    console.warn('[LS Webhook] order_created: no user_id in custom_data');
    return;
  }

  const credits = TOPUP_VARIANT_CREDITS[variantId];
  if (!credits) {
    console.log(`[LS Webhook] order_created: variant ${variantId} is not a top-up, skipping`);
    return;
  }

  const userRef = db.collection('users').doc(userId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new Error(`User ${userId} not found`);

    tx.update(userRef, {
      topUpCredits:        FieldValue.increment(credits),
      'credits.available': FieldValue.increment(credits),
    });

    const txRef = db
      .collection('users').doc(userId)
      .collection('creditTransactions').doc(`topup_${Date.now()}`);
    tx.set(txRef, {
      type:      'topup',
      amount:    credits,
      variantId,
      orderId:   data.id,
      createdAt: FieldValue.serverTimestamp(),
      note:      `Top-up de ${credits} créditos`,
    });
  });

  console.log(`[LS Webhook] +${credits} top-up credits → user ${userId}`);

  // Si el usuario tiene referidor, darle créditos
  const userSnap = await userRef.get();
  const referredBy = userSnap.data()?.referredBy;
  if (referredBy) {
    await handleReferral(referredBy, userId);
  }
}

async function handleReferral(referrerId: string, newUserId: string): Promise<void> {
  const db       = getDb();
  const refRef   = db.collection('users').doc(referrerId);
  const REFERRAL_CREDITS    = 20;
  const REFERRAL_MAX        = 10;
  const REFERRED_BONUS      = 10;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(refRef);
    if (!snap.exists) return;
    const d = snap.data()!;
    const referralCount = (d.missions?.referralCount || 0);
    if (referralCount >= REFERRAL_MAX) return;

    tx.update(refRef, {
      'missions.referralCount': FieldValue.increment(1),
      topUpCredits:              FieldValue.increment(REFERRAL_CREDITS),
      'credits.available':       FieldValue.increment(REFERRAL_CREDITS),
    });

    const txRef = db.collection('users').doc(referrerId)
      .collection('creditTransactions').doc(`referral_${newUserId}_${Date.now()}`);
    tx.set(txRef, {
      type:      'mission',
      missionId: 'referral',
      amount:    REFERRAL_CREDITS,
      createdAt: FieldValue.serverTimestamp(),
      note:      `Referido suscrito: ${newUserId}`,
    });
  });

  // Bono al usuario referido
  const newUserRef = db.collection('users').doc(newUserId);
  await newUserRef.update({
    topUpCredits:        FieldValue.increment(REFERRED_BONUS),
    'credits.available': FieldValue.increment(REFERRED_BONUS),
  });

  console.log(`[LS Webhook] Referral: ${REFERRAL_CREDITS} cr → ${referrerId}, ${REFERRED_BONUS} cr → ${newUserId}`);
}

async function handleSubscriptionCreated(data: any): Promise<void> {
  await upsertSubscription(data, 'created');
}

async function handleSubscriptionUpdated(data: any): Promise<void> {
  await upsertSubscription(data, 'updated');
}

async function upsertSubscription(data: any, event: string): Promise<void> {
  const db     = getDb();
  const attrs  = data.attributes;
  const userId = attrs.custom_data?.user_id || attrs.meta?.custom_data?.user_id;
  const variantId = String(attrs.variant_id || '');
  const status    = attrs.status; // 'active' | 'paused' | 'cancelled' | 'expired'

  if (!userId) {
    console.warn(`[LS Webhook] subscription_${event}: no user_id`);
    return;
  }

  const plan = VARIANT_TO_PLAN[variantId];
  if (!plan) {
    console.warn(`[LS Webhook] subscription_${event}: unknown variant ${variantId}`);
    return;
  }

  if (status === 'cancelled' || status === 'expired') {
    await handleSubscriptionCancelled(data);
    return;
  }

  // Calcular fecha de fin del período actual
  const renewsAt   = attrs.renews_at   ? new Date(attrs.renews_at)   : null;
  const endsAt     = attrs.ends_at     ? new Date(attrs.ends_at)     : null;
  const validUntil = renewsAt || endsAt || new Date(Date.now() + PLAN_PERIOD_DAYS[plan] * 86400000);

  const userRef = db.collection('users').doc(userId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return;
    const d = snap.data()!;

    // Solo reiniciar créditos si es un nuevo período (plan cambió o es primera activación)
    const currentPlan = d.plan || 'free';
    const shouldReset = currentPlan !== plan || event === 'created';

    const updates: Record<string, any> = {
      plan,
      planValidUntil: Timestamp.fromDate(validUntil),
      lsSubscriptionId: data.id,
      lsVariantId:      variantId,
    };
    if (shouldReset) {
      updates.creditsUsedThisPeriod = 0;
      updates.lastPeriodReset       = FieldValue.serverTimestamp();
    }
    tx.update(userRef, updates);

    const txRef = db.collection('users').doc(userId)
      .collection('creditTransactions').doc(`sub_${plan}_${Date.now()}`);
    tx.set(txRef, {
      type:       'subscription',
      plan,
      variantId,
      validUntil: Timestamp.fromDate(validUntil),
      createdAt:  FieldValue.serverTimestamp(),
      note:       `Suscripción ${plan} ${event}`,
    });
  });

  console.log(`[LS Webhook] subscription_${event}: plan=${plan} → user ${userId} until ${validUntil.toISOString()}`);
}

async function handleSubscriptionCancelled(data: any): Promise<void> {
  const db     = getDb();
  const attrs  = data.attributes;
  const userId = attrs.custom_data?.user_id || attrs.meta?.custom_data?.user_id;
  if (!userId) return;

  await db.collection('users').doc(userId).update({
    plan:                  'free',
    planValidUntil:        null,
    creditsUsedThisPeriod: 0,
    lastPeriodReset:       FieldValue.serverTimestamp(),
    lsSubscriptionId:      null,
  });

  console.log(`[LS Webhook] subscription_cancelled → user ${userId} → free`);
}

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Leer body raw para verificar firma
  const signature = req.headers['x-signature'] as string || '';
  if (!signature) {
    console.error('[LS Webhook] Missing x-signature header');
    return res.status(401).json({ error: 'Missing signature' });
  }

  // Vercel ya parsea el body — necesitamos el raw string
  // Para webhooks usamos req.body directamente (Vercel lo mantiene como string si no hay Content-Type JSON)
  const rawBody = typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body);

  if (!verifySignature(rawBody, signature)) {
    console.error('[LS Webhook] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload  = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const event    = payload.meta?.event_name || '';
  const data     = payload.data || {};

  console.log(`[LS Webhook] Event: ${event} | ID: ${data.id}`);

  try {
    switch (event) {
      case 'order_created':
        await handleOrderCreated(data);
        break;
      case 'subscription_created':
        await handleSubscriptionCreated(data);
        break;
      case 'subscription_updated':
        await handleSubscriptionUpdated(data);
        break;
      case 'subscription_cancelled':
      case 'subscription_expired':
        await handleSubscriptionCancelled(data);
        break;
      default:
        console.log(`[LS Webhook] Unhandled event: ${event}`);
    }

    return res.status(200).json({ ok: true, event });
  } catch (err: any) {
    console.error(`[LS Webhook] Error handling ${event}:`, err.message);
    // Devolver 200 para que LS no reintente — el error fue nuestro, no de LS
    return res.status(200).json({ ok: false, error: err.message });
  }
}
