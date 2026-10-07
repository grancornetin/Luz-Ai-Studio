// src/utils/uploadConsent.ts
// Consentimiento de responsabilidad sobre el contenido subido.
// Se guarda en localStorage (rápido) y en Firestore (respaldo por cuenta).
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const CONSENT_LS_KEY = 'luz_upload_consent_v1';

export function hasConsented(): boolean {
  try { return !!localStorage.getItem(CONSENT_LS_KEY); } catch { return false; }
}

function markLocalConsent() {
  try { localStorage.setItem(CONSENT_LS_KEY, new Date().toISOString()); } catch { /* ignore */ }
}

export async function hasRemoteConsent(): Promise<boolean> {
  try {
    const user = getAuth().currentUser;
    if (!user) return false;
    const snap = await getDoc(doc(db, 'users', user.uid, 'consents', 'uploadTerms'));
    const accepted = snap.exists() && snap.data()?.accepted === true;
    if (accepted) markLocalConsent();
    return accepted;
  } catch {
    return false;
  }
}

export async function saveConsentToFirestore() {
  markLocalConsent();
  try {
    const user = getAuth().currentUser;
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'consents', 'uploadTerms'), {
      accepted:   true,
      acceptedAt: serverTimestamp(),
      version:    'v1',
      userAgent:  navigator.userAgent,
    }, { merge: true });
  } catch { /* no bloquear la UI si falla */ }
}
