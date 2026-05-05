// scripts/credit-manual.mjs
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const envRaw = readFileSync('.env.local', 'utf-8');
const envVars = {};
for (const line of envRaw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq < 0) continue;
  envVars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

const RAW_KEY = envVars['GOOGLE_SERVICE_ACCOUNT_KEY'] || '';
const decoded = RAW_KEY.startsWith('{') ? RAW_KEY : Buffer.from(RAW_KEY, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(decoded);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app, 'ai-studio-3c2cbb8f-56a6-4903-b155-7db796076281');

const ACCOUNTS = [
  {
    uid:            'wOiO0sLEpWb6sV0SvWOSq4XNnfC2',
    email:          'comprasxinternet3@gmail.com',
    welcomeCredits: 20,
    topupCredits:   30,  // pago $3.29
    topupNote:      'Top-up 30 créditos ($3.29 — webhook no procesado)',
  },
  {
    uid:            'mLHK4ZfEurQ4Sb6h6DDRKMvtnZo1',
    email:          'segunda cuenta',
    welcomeCredits: 20,
    topupCredits:   0,
    topupNote:      '',
  },
];

async function processAccount(account) {
  const { uid, email, welcomeCredits, topupCredits, topupNote } = account;
  const totalCredits = welcomeCredits + topupCredits;
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();

  console.log(`\n── ${email} (${uid})`);

  if (snap.exists) {
    // Documento existe pero probablemente sin créditos — incrementamos
    const data = snap.data();
    console.log(`  Documento existente. topUpCredits: ${data.topUpCredits}, credits.available: ${data.credits?.available}`);

    await db.runTransaction(async (tx) => {
      tx.update(userRef, {
        topUpCredits:        FieldValue.increment(totalCredits),
        'credits.available': FieldValue.increment(totalCredits),
        updatedAt:           FieldValue.serverTimestamp(),
      });

      // Transacción de bienvenida
      const welcomeRef = db.collection('users').doc(uid)
        .collection('creditTransactions').doc(`welcome_manual_${Date.now()}`);
      tx.set(welcomeRef, {
        type: 'topup', amount: welcomeCredits,
        paymentId: 'manual_welcome_2026-05-05',
        createdAt: FieldValue.serverTimestamp(),
        note: `Créditos de bienvenida (asignación manual — documento existente sin créditos)`,
      });

      // Transacción del top-up pagado (solo si aplica)
      if (topupCredits > 0) {
        const topupRef = db.collection('users').doc(uid)
          .collection('creditTransactions').doc(`topup_manual_${Date.now() + 1}`);
        tx.set(topupRef, {
          type: 'topup', amount: topupCredits,
          productId: 'pdt_0NdkerVP1qcaNPz5mEAtL',
          paymentId: 'manual_dodo_usd3.29_2026-05-05',
          createdAt: FieldValue.serverTimestamp(),
          note: topupNote,
        });
      }
    });
  } else {
    // Documento no existe — lo creamos completo
    console.log(`  Documento NO existe. Creando con ${totalCredits} créditos...`);

    await db.runTransaction(async (tx) => {
      tx.set(userRef, {
        uid,
        email,
        displayName: email.split('@')[0],
        plan: 'free',
        planValidUntil: null,
        creditsUsedThisPeriod: 0,
        topUpCredits: totalCredits,
        lastPeriodReset: FieldValue.serverTimestamp(),
        referralCode: uid.slice(0, 8).toUpperCase(),
        referralCount: 0,
        referredBy: null,
        credits: { available: totalCredits, used: 0, plan: 'free' },
        interests: { categories: [], tags: [], preferredModules: [] },
        socials: {},
        preferences: { emailNotifications: true, feedSortBy: 'recent', theme: 'light' },
        onboardingDone: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const welcomeRef = db.collection('users').doc(uid)
        .collection('creditTransactions').doc(`welcome_manual_${Date.now()}`);
      tx.set(welcomeRef, {
        type: 'topup', amount: welcomeCredits,
        paymentId: 'manual_welcome_2026-05-05',
        createdAt: FieldValue.serverTimestamp(),
        note: 'Créditos de bienvenida (documento creado manualmente)',
      });

      if (topupCredits > 0) {
        const topupRef = db.collection('users').doc(uid)
          .collection('creditTransactions').doc(`topup_manual_${Date.now() + 1}`);
        tx.set(topupRef, {
          type: 'topup', amount: topupCredits,
          productId: 'pdt_0NdkerVP1qcaNPz5mEAtL',
          paymentId: 'manual_dodo_usd3.29_2026-05-05',
          createdAt: FieldValue.serverTimestamp(),
          note: topupNote,
        });
      }
    });
  }

  const after = (await userRef.get()).data();
  console.log(`  ✅ topUpCredits: ${after.topUpCredits} | credits.available: ${after.credits?.available}`);
}

async function run() {
  for (const account of ACCOUNTS) {
    await processAccount(account);
  }
  console.log('\n✅ Todas las cuentas procesadas.');
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
