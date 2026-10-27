import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../auth/AuthContext';

// Modo privado del Piloto: se activa por cuenta, nunca global.
// Se concede si la cuenta es admin, si su uid está en VITE_PILOT_UIDS (se fija al compilar)
// o si está en el documento Firestore config/pilot { uids: [...] } (espejo de solo lectura,
// que se puede cambiar sin recompilar). QA1: antes el espejo no lo leía nadie.
const ENV_UIDS = String(import.meta.env.VITE_PILOT_UIDS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export type PilotAccessState = 'checking' | 'yes' | 'no';

export function usePilotAccessState(): PilotAccessState {
  const { user, isAdmin } = useAuth();
  const uid = user?.uid ?? '';
  const direct = !!uid && (isAdmin || ENV_UIDS.includes(uid));
  const [mirror, setMirror] = useState<'checking' | 'yes' | 'no'>('checking');

  useEffect(() => {
    if (!uid || direct) { setMirror('no'); return; }
    let off = false;
    setMirror('checking');
    getDoc(doc(db, 'config', 'pilot'))
      .then(s => {
        const uids = s.exists() ? (s.data()?.uids as unknown) : [];
        if (!off) setMirror(Array.isArray(uids) && uids.includes(uid) ? 'yes' : 'no');
      })
      .catch(() => { if (!off) setMirror('no'); }); // sin permiso o sin documento = no está en la lista
    return () => { off = true; };
  }, [uid, direct]);

  if (!uid) return 'no';
  if (direct) return 'yes';
  return mirror;
}

export function usePilotAccess(): boolean {
  return usePilotAccessState() === 'yes';
}
