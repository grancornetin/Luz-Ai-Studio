/**
 * scripts/retryFailedBatch.js
 *
 * Reencola en QStash todos los items con status 'failed' de un batch,
 * con un delay configurable entre cada uno.
 *
 * Uso:
 *   node scripts/retryFailedBatch.js --batchId=batch_xxx  --delay=30
 *   node scripts/retryFailedBatch.js --batchIds=batch_xxx,batch_yyy --delay=30
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cwd       = resolve(__dirname, '..');

// ── Leer .env.local ───────────────────────────────────────────────────────────

const envRaw = readFileSync(resolve(cwd, '.env.local'), 'utf-8');
function env(key) {
  const m = envRaw.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m ? m[1].trim() : '';
}

const GOOGLE_KEY    = env('GOOGLE_SERVICE_ACCOUNT_KEY');
const DB_ID         = env('FIRESTORE_DATABASE_ID') || 'ai-studio-3c2cbb8f-56a6-4903-b155-7db796076281';
const WORKER_SECRET = env('BATCH_WORKER_SECRET');
const BASE_URL      = 'https://luz-ia-studio-1.vercel.app';

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, fallback = '') {
  const m = args.find(a => a.startsWith(`--${name}=`));
  return m ? m.split('=').slice(1).join('=') : fallback;
}

const DELAY_SECONDS = Number(getArg('delay', '30'));
const BATCH_IDS = [
  ...getArg('batchId')  ? [getArg('batchId')]  : [],
  ...getArg('batchIds') ? getArg('batchIds').split(',').map(s => s.trim()) : [],
];

if (BATCH_IDS.length === 0) {
  console.error('✗ Debes pasar --batchId=xxx o --batchIds=xxx,yyy');
  process.exit(1);
}

// ── Firebase Admin ────────────────────────────────────────────────────────────

const { initializeApp, cert, getApps } = await import('firebase-admin/app');
const { getFirestore }                  = await import('firebase-admin/firestore');

const decoded = GOOGLE_KEY.startsWith('{')
  ? GOOGLE_KEY
  : Buffer.from(GOOGLE_KEY, 'base64').toString('utf-8');

if (!getApps().length) initializeApp({ credential: cert(JSON.parse(decoded)) });
const db = getFirestore(getApps()[0], DB_ID);

// ── Recolectar items fallidos ─────────────────────────────────────────────────

const workerUrl = `${BASE_URL}/api/batch`;
const allItems  = [];

for (const batchId of BATCH_IDS) {
  const snap = await db.collection('prompt_batch_items')
    .where('batchId', '==', batchId)
    .where('status',  '==', 'failed')
    .get();

  if (snap.empty) { console.log(`Batch ${batchId}: sin items fallidos.`); continue; }
  console.log(`Batch ${batchId}: ${snap.size} items fallidos encontrados.`);

  for (const doc of snap.docs) allItems.push(doc);

  // Marcar batch como processing
  await db.collection('prompt_batches').doc(batchId).update({
    status: 'processing', updatedAt: new Date(),
  });
}

if (allItems.length === 0) { console.log('Nada que reintentar.'); process.exit(0); }

const totalMinutes = Math.round((allItems.length * DELAY_SECONDS) / 60);
console.log(`\n→ ${allItems.length} items a reintentar, ${DELAY_SECONDS}s entre cada uno (~${totalMinutes} min total)`);
console.log('→ Enviando al worker de Vercel con delay escalonado...\n');

// ── Enviar al worker con delay escalonado ─────────────────────────────────────
// En lugar de QStash, llamamos directamente al endpoint con fetch + setTimeout
// escalonado. El script se queda vivo hasta que todos estén despachados.

let dispatched = 0;

for (let i = 0; i < allItems.length; i++) {
  const doc  = allItems[i];
  const item = doc.data();
  const delayMs = i * DELAY_SECONDS * 1000;

  setTimeout(async () => {
    try {
      // Resetear estado en Firestore
      await doc.ref.update({ status: 'queued', attempts: 0, error: null, updatedAt: new Date() });

      // Llamar al worker
      const res = await fetch(workerUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'worker', itemId: item.id, batchId: item.batchId, adminSecret: WORKER_SECRET }),
      });
      const data = await res.json();
      dispatched++;
      const eta = Math.round(((allItems.length - dispatched) * DELAY_SECONDS) / 60);
      process.stdout.write(`[${dispatched}/${allItems.length}] item ${item.index} → ${data.ok ? 'OK' : 'ERROR: ' + data.error} (faltan ~${eta} min)\n`);
    } catch (e) {
      dispatched++;
      process.stdout.write(`[${dispatched}/${allItems.length}] item ${item.index} → fetch error: ${e.message}\n`);
    }

    if (dispatched === allItems.length) {
      console.log('\n✓ Todos los items procesados.');
      process.exit(0);
    }
  }, delayMs);
}

console.log(`Script activo. No cierres esta terminal hasta que termine (${totalMinutes} min).\n`);
