// ─────────────────────────────────────────────────────────────────
// HIBERNACIÓN de la app completa.
//
// HIBERNATE = true  → las cuentas que NO son admin ven solo "Mi negocio"
//                      (menú lateral y barra móvil) y cualquier otra ruta
//                      las lleva a /mi-negocio.
// HIBERNATE = false → todo vuelve a ser como antes.
//
// No se borra ni se desconecta ningún módulo: solo se esconde el acceso.
// La app completa también está respaldada en la etiqueta
// `luz-completa-2026-10-23` y la rama `archive/luz-completa-2026-10-23`.
// ─────────────────────────────────────────────────────────────────
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export const HIBERNATE = true;

/** Rutas que siguen disponibles en hibernación (Mi negocio, la cuenta para salir y el Planner:
 *  la pantalla Hoy manda a /planner/:id/cierre para el cierre semanal; sin esto rebotaba a /mi-negocio). */
const ALLOWED_PREFIXES = ['/mi-negocio', '/cuenta', '/planner'];

export function isAllowedWhenHibernated(pathname: string): boolean {
  return ALLOWED_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

/** true = esta cuenta ve la app hibernada. Los admin ven todo siempre. */
export function useHibernated(): boolean {
  const { isAdmin } = useAuth();
  return HIBERNATE && !isAdmin;
}

/** Envuelve las rutas internas: en hibernación, lo no permitido va a /mi-negocio. */
export const HibernationGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hibernated = useHibernated();
  const { pathname } = useLocation();
  if (hibernated && !isAllowedWhenHibernated(pathname)) return <Navigate to="/mi-negocio" replace />;
  return <>{children}</>;
};
