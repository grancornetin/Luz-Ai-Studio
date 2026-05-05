// scripts/credit-manual.mjs
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Leer .env.local manualmente
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
const auth = getAuth(app);
const db = getFirestore(app, 'ai-studio-3c2cbb8f-56a6-4903-b155-7db796076281');

const EMAIL   = 'grancornetin@gmail.com';
const CREDITS = 30;

async function run() {
  console.log(`Buscando usuario: ${EMAIL}`);
  const userRecord = await auth.getUserByEmail(EMAIL);
  const uid = userRecord.uid;
  console.log(`UID: ${uid}`);

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    console.error('Documento no encontrado en Firestore');
    process.exit(1);
  }

  const before = snap.data().topUpCredits || 0;
  console.log(`topUpCredits antes: ${before}`);

  await db.runTransaction(async (tx) => {
    tx.update(userRef, {
      topUpCredits:        FieldValue.increment(CREDITS),
      'credits.available': FieldValue.increment(CREDITS),
    });
    const txRef = db.collection('users').doc(uid)
      .collection('creditTransactions').doc(`manual_${Date.now()}`);
    tx.set(txRef, {
      type:      'topup',
      amount:    CREDITS,
      productId: 'pdt_0NdkerVP1qcaNPz5mEAtL',
      paymentId: 'manual_dodo_usd3.29_2026-05-05',
      createdAt: FieldValue.serverTimestamp(),
      note:      'Top-up manual: 30 créditos ($3.29 — webhook no procesado)',
    });
  });

  const after = (await userRef.get()).data().topUpCredits;
  console.log(`topUpCredits después: ${after}`);
  console.log(`✅ ${CREDITS} créditos acreditados correctamente.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
