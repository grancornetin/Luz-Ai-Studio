import { useState } from 'react';
import { useAuth } from '../modules/auth/AuthContext';

// ──────────────────────────────────────────
// useCreditGuard
// Hook reutilizable para verificar y descontar
// créditos antes de generar en cualquier módulo.
//
// Uso:
//   const { checkAndDeduct, refundCredits, NoCreditsModal } = useCreditGuard();
//
//   const handleGenerate = async () => {
//     const ok = await checkAndDeduct(4); // 4 créditos
//     if (!ok) return;                    // Modal ya se mostró
//     
//     try {
//       await generationService.generate(...);
//     } catch (error) {
//       await refundCredits(4);           // Reembolsar si falla
//     }
//   };
// ──────────────────────────────────────────

interface UseCreditGuardReturn {
  checking: boolean;
  showNoCredits: boolean;
  requiredCredits: number;
  closeModal: () => void;
  checkAndDeduct: (required: number) => Promise<boolean>;
  refundCredits: (amount: number) => Promise<boolean>;
}

export const useCreditGuard = (): UseCreditGuardReturn => {
  const { credits, isAdmin, deductCredits, user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [showNoCredits, setShowNoCredits] = useState(false);
  const [requiredCredits, setRequiredCredits] = useState(1);

  const closeModal = () => setShowNoCredits(false);

  /**
   * Verifica si hay créditos suficientes y los descuenta.
   * Retorna true si se puede continuar, false si no.
   */
  const checkAndDeduct = async (required: number): Promise<boolean> => {
    // Admin nunca paga créditos
    if (isAdmin) return true;

    // Sin créditos suficientes → mostrar modal
    if (credits.available < required) {
      setRequiredCredits(required);
      setShowNoCredits(true);
      return false;
    }

    // Descontar créditos
    setChecking(true);
    try {
      const ok = await deductCredits(required);
      if (!ok) {
        setRequiredCredits(required);
        setShowNoCredits(true);
        return false;
      }
      return true;
    } catch {
      return false;
    } finally {
      setChecking(false);
    }
  };

  /**
   * Reembolso de créditos.
   *
   * Notificaciones Nivel 3: el reembolso se hace server-side desde los workers
   * (api/_notifications.ts → reportShotResult), de forma atómica e
   * independiente de si el navegador está abierto. Por eso esta función ya
   * no toca Firestore — solo loggea para trazabilidad.
   *
   * Se mantiene en la API para no romper los módulos que siguen llamándola.
   */
  const refundCredits = async (amount: number): Promise<boolean> => {
    if (isAdmin || amount <= 0 || !user) return true;
    console.log(`[useCreditGuard] Refund de ${amount} créditos delegado al server (no-op cliente)`);
    return true;
  };

  return {
    checking,
    showNoCredits,
    requiredCredits,
    closeModal,
    checkAndDeduct,
    refundCredits,
  };
};