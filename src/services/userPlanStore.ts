// src/services/userPlanStore.ts
// Singleton que guarda el plan del usuario autenticado en memoria.
// AuthContext lo actualiza al cargar el perfil.
// Los servicios de generación lo leen para pasarlo al servidor sin necesitar el contexto de React.

let _currentPlan: string = 'free';

export function setCurrentUserPlan(plan: string): void {
  _currentPlan = plan || 'free';
}

export function getCurrentUserPlan(): string {
  return _currentPlan;
}
