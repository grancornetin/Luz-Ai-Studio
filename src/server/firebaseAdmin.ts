/**
 * src/server/firebaseAdmin.ts
 *
 * Firebase Admin SDK para endpoints serverless de Vercel.
 * NO reemplaza src/firebase.ts (cliente/frontend).
 *
 * Variable de entorno:
 *   GOOGLE_SERVICE_ACCOUNT_KEY  — base64 del JSON de service account
 *   FIRESTORE_DATABASE_ID       — ID de la base de datos (default: ai-studio-...)
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getFirebaseAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const raw      = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const decoded  = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  return initializeApp({ credential: cert(JSON.parse(decoded)) });
}

const app = getFirebaseAdminApp();

const DB_ID = process.env.FIRESTORE_DATABASE_ID
  || 'ai-studio-3c2cbb8f-56a6-4903-b155-7db796076281';

export const adminDb = getFirestore(app, DB_ID);
