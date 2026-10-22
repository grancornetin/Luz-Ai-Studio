import { useAuth } from '../auth/AuthContext';

// Modo privado del Piloto: se activa por cuenta, nunca global.
// Hoy: cuentas admin + uids listados en VITE_PILOT_UIDS (separados por coma;
// un uid no es secreto). W8 lo extiende con la lista del servidor
// (config/pilot) sin cambiar esta firma.
const ENV_UIDS = String(import.meta.env.VITE_PILOT_UIDS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export function usePilotAccess(): boolean {
  const { user, isAdmin } = useAuth();
  if (!user) return false;
  return isAdmin || ENV_UIDS.includes(user.uid);
}
