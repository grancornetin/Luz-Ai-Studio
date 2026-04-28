/**
 * src/server/firebaseAdmin.ts
 *
 * Firebase Admin SDK para endpoints serverless de Vercel.
 * NO reemplaza src/firebase.ts (cliente/frontend).
 *
 * Variable de entorno requerida (igual que el resto de la API):
 *   GOOGLE_SERVICE_ACCOUNT_KEY  — base64 del JSON de service account
 *
 * También acepta las variables separadas como fallback:
 *   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getFirebaseAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  // Opción 1: GOOGLE_SERVICE_ACCOUNT_KEY en base64 (patrón del proyecto)
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (rawKey) {
    const credentials = JSON.parse(Buffer.from(rawKey, 'base64').toString('utf-8'));
    return initializeApp({ credential: cert(credentials) });
  }

  // Opción 2: variables separadas (para Vercel env vars individuales)
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  throw new Error(
    'Firebase Admin: falta GOOGLE_SERVICE_ACCOUNT_KEY (o FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)'
  );
}

export const adminDb = getFirestore(getFirebaseAdminApp());
