// api/webhooks/dodopayments.ts
// Webhook de Dodo Payments — recibe eventos de pago y actualiza Firestore.
//
// Eventos manejados:
//   payment.succeeded        → top-up de créditos
//   subscription.active      → activar plan
//   subscription.renewed     → renovar plan (reinicia créditos del período)
//   subscription.updated     → cambio de plan
//   subscription.cancelled   → degradar a free

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

// ── Mapeo de product IDs a planes ─────────────────────────────────────────────

type PlanId = 'free' | 'explorer' | 'starter' | 'pro' | 'studio';

const PLAN_MAP: Record<string, PlanId> = {
  'pdt_0Ndkemfv32OrQVYJz61cC': 'explorer',
  'pdt_0NdkenhFzJay2DV5p7NjJ': 'starter',
  'pdt_0Ndkenzh1TDpnBsYYb10X': 'pro',
  'pdt_0Ndkeq69pIogTOkZoiPsU': 'studio',
  'pdt_0NdkenAaZoxBR9CuacRFE': 'starter',
  'pdt_0Ndkep4Tk7VvkaXGgoeJm': 'pro',
  'pdt_0NdkeqknL77gFkeCJtAzR': 'studio',
};

const PLAN_PERIOD_DAYS: Record<PlanId, number> = {
  free:     0,
  explorer: 7,
  starter:  30,
  pro:      30,
  studio:   30,
};

const TOPUP_CREDITS: Record<string, number> = {
  'pdt_0NdkerVP1qcaNPz5mEAtL': 30,
  'pdt_0NdkesPrt2T90Vx7Cgyao': 80,
  'pdt_0NdkestYwa7zXpYriJlqD': 200,
  'pdt_0NdkeuBMXieJkr4jjoaVu': 500,
  'pdt_0NdkeuaAdzWxtjjWcyX4D': 1200,
};

// Pro-credit top-ups — actualizar IDs cuando estén creados en Dodo
const TOPUP_PRO_CREDITS: Record<string, number> = {
  // 'PENDING': 20,   // PRO_TOPUP_20  — $5.99
  // 'PENDING': 60,   // PRO_TOPUP_60  — $14.99
  // 'PENDING': 150,  // PRO_TOPUP_150 — $34.99
  // 'PENDING': 400,  // PRO_TOPUP_400 — $79.99
};

// ── Verificación de firma ─────────────────────────────────────────────────────

function verifySignature(rawBody: string, signature: string): boolean {
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET || '';
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

async function handlePaymentSucceeded(data: any): Promise<void> {
  const db = getDb();

  // Dodo envía customer_id dentro de data.customer.customer_id
  // y el product_id en data.product_cart[0].product_id
  const userId    = (data.customer?.customer_id ?? data.customer_id) as string | undefined;
  const productId = (data.product_cart?.[0]?.product_id ?? data.product_id) as string | undefined;

  console.log('[Dodo Webhook] payment.succeeded raw data keys:', Object.keys(data));
  console.log('[Dodo Webhook] payment.succeeded customer:', JSON.stringify(data.customer));
  console.log('[Dodo Webhook] payment.succeeded product_cart:', JSON.stringify(data.product_cart));
  console.log('[Dodo Webhook] payment.succeeded resolved userId:', userId, 'productId:', productId);

  if (!userId || !productId) {
    console.warn('[Dodo Webhook] payment.succeeded: missing customer_id or product_id', JSON.stringify(data));
    return;
  }

  const credits    = TOPUP_CREDITS[productId];
  const proCredits = TOPUP_PRO_CREDITS[productId];

  if (!credits && !proCredits) {
    console.log(`[Dodo Webhook] payment.succeeded: product ${productId} is not a top-up, skipping`);
    return;
  }

  const userRef = db.collection('users').doc(userId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new Error(`User ${userId} not found`);

    if (credits) {
      tx.update(userRef, {
        topUpCredits:        FieldValue.increment(credits),
        'credits.available': FieldValue.increment(credits),
      });
      const txRef = db.collection('users').doc(userId)
        .collection('creditTransactions').doc(`topup_${Date.now()}`);
      tx.set(txRef, {
        type:      'topup',
        amount:    credits,
        productId,
        paymentId: data.payment_id || data.id,
        createdAt: FieldValue.serverTimestamp(),
        note:      `Top-up de ${credits} créditos`,
      });
    }

    if (proCredits) {
      tx.update(userRef, {
        'credits.proCredits': FieldValue.increment(proCredits),
      });
      const txRef = db.collection('users').doc(userId)
        .collection('creditTransactions').doc(`pro_topup_${Date.now()}`);
      tx.set(txRef, {
        type:      'pro_topup',
        amount:    proCredits,
        productId,
        paymentId: data.payment_id || data.id,
        createdAt: FieldValue.serverTimestamp(),
        note:      `Top-up de ${proCredits} pro-credits (Campaign/Photodump)`,
      });
    }
  });

  if (credits)    console.log(`[Dodo Webhook] +${credits} top-up credits → user ${userId}`);
  if (proCredits) console.log(`[Dodo Webhook] +${proCredits} pro-credits → user ${userId}`);

  // Si el usuario tiene referidor, darle créditos
  const userSnap = await userRef.get();
  const referredBy = userSnap.data()?.referredBy;
  if (referredBy) {
    await handleReferral(referredBy, userId);
  }
}

async function handleReferral(referrerId: string, newUserId: string): Promise<void> {
  const db            = getDb();
  const refRef        = db.collection('users').doc(referrerId);
  const REFERRAL_CREDITS = 20;
  const REFERRAL_MAX     = 10;
  const REFERRED_BONUS   = 10;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(refRef);
    if (!snap.exists) return;
    const d = snap.data()!;
    if ((d.missions?.referralCount || 0) >= REFERRAL_MAX) return;

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

  const newUserRef = db.collection('users').doc(newUserId);
  await newUserRef.update({
    topUpCredits:        FieldValue.increment(REFERRED_BONUS),
    'credits.available': FieldValue.increment(REFERRED_BONUS),
  });

  console.log(`[Dodo Webhook] Referral: ${REFERRAL_CREDITS} cr → ${referrerId}, ${REFERRED_BONUS} cr → ${newUserId}`);
}

async function handleSubscriptionActive(data: any, isRenewal: boolean): Promise<void> {
  const db        = getDb();
  const userId    = (data.customer?.customer_id ?? data.customer_id) as string | undefined;
  const productId = (data.product_id ?? data.items?.[0]?.price?.product_id) as string | undefined;

  if (!userId || !productId) {
    console.warn('[Dodo Webhook] subscription event: missing customer_id or product_id', JSON.stringify(data));
    return;
  }

  const plan = PLAN_MAP[productId];
  if (!plan) {
    console.warn(`[Dodo Webhook] subscription event: unknown product ${productId}`);
    return;
  }

  const currentPeriodEnd = data.current_period_end
    ? new Date(data.current_period_end * 1000)
    : new Date(Date.now() + PLAN_PERIOD_DAYS[plan] * 86400000);

  const userRef = db.collection('users').doc(userId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return;
    const d = snap.data()!;

    const currentPlan = d.plan || 'free';
    const shouldReset = currentPlan !== plan || isRenewal;

    const updates: Record<string, any> = {
      plan,
      planValidUntil:   Timestamp.fromDate(currentPeriodEnd),
      dodoProductId:    productId,
      dodoSubId:        data.subscription_id || data.id,
    };
    if (shouldReset) {
      updates.creditsUsedThisPeriod = 0;
      updates.lastPeriodReset       = FieldValue.serverTimestamp();
    }
    tx.update(userRef, updates);

    const event = isRenewal ? 'renewed' : 'active';
    const txRef = db.collection('users').doc(userId)
      .collection('creditTransactions').doc(`sub_${plan}_${Date.now()}`);
    tx.set(txRef, {
      type:       'subscription',
      plan,
      productId,
      validUntil: Timestamp.fromDate(currentPeriodEnd),
      createdAt:  FieldValue.serverTimestamp(),
      note:       `Suscripción ${plan} ${event}`,
    });
  });

  console.log(`[Dodo Webhook] subscription: plan=${plan} → user ${userId} until ${currentPeriodEnd.toISOString()}`);
}

async function handleSubscriptionUpdated(data: any): Promise<void> {
  const db        = getDb();
  const userId    = (data.customer?.customer_id ?? data.customer_id) as string | undefined;
  const productId = (data.product_id ?? data.items?.[0]?.price?.product_id) as string | undefined;
  if (!userId || !productId) return;

  const plan = PLAN_MAP[productId];
  if (!plan) return;

  const currentPeriodEnd = data.current_period_end
    ? new Date(data.current_period_end * 1000)
    : new Date(Date.now() + PLAN_PERIOD_DAYS[plan] * 86400000);

  await db.collection('users').doc(userId).update({
    plan,
    planValidUntil: Timestamp.fromDate(currentPeriodEnd),
    dodoProductId:  productId,
  });

  console.log(`[Dodo Webhook] subscription.updated: plan=${plan} → user ${userId}`);
}

async function handleSubscriptionCancelled(data: any): Promise<void> {
  const db     = getDb();
  const userId = (data.customer?.customer_id ?? data.customer_id) as string | undefined;
  if (!userId) return;

  await db.collection('users').doc(userId).update({
    plan:                  'free',
    planValidUntil:        null,
    creditsUsedThisPeriod: 0,
    lastPeriodReset:       FieldValue.serverTimestamp(),
    dodoSubId:             null,
  });

  console.log(`[Dodo Webhook] subscription.cancelled → user ${userId} → free`);
}

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const signature = req.headers['x-dodo-signature'] as string || '';
  if (!signature) {
    console.error('[Dodo Webhook] Missing x-dodo-signature header');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const rawBody = typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body);

  if (!verifySignature(rawBody, signature)) {
    console.error('[Dodo Webhook] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload   = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const eventType = payload.type as string || '';
  const data      = payload.data || payload;

  // Log completo para diagnóstico — eliminar después de confirmar que los webhooks funcionan
  console.log(`[Dodo Webhook] Event: ${eventType}`);
  console.log('[Dodo Webhook] Full payload:', JSON.stringify(payload, null, 2));

  try {
    switch (eventType) {
      case 'payment.succeeded':
        await handlePaymentSucceeded(data);
        break;
      case 'subscription.active':
        await handleSubscriptionActive(data, false);
        break;
      case 'subscription.renewed':
        await handleSubscriptionActive(data, true);
        break;
      case 'subscription.updated':
        await handleSubscriptionUpdated(data);
        break;
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(data);
        break;
      default:
        console.log(`[Dodo Webhook] Unhandled event: ${eventType}`);
    }

    return res.status(200).json({ ok: true, event: eventType });
  } catch (err: any) {
    // Importante: si la firma fue válida pero falló el procesamiento (ej. Firestore
    // tuvo un hipo transitorio), respondemos 500 para que Dodo reintente. Si
    // respondiéramos 200, Dodo daría el evento por entregado y el cliente perdería
    // sus créditos de forma silenciosa.
    console.error(`[Dodo Webhook] Error handling ${eventType}:`, err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
