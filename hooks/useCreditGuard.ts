import { useState } from 'react';
import { useAuth } from '../src/modules/auth/AuthContext';
import { userService } from '../src/services/userService';

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
   * Reembolsa créditos al usuario cuando una generación falla.
   * Retorna true si se pudo reembolsar, false si no.
   */
  const refundCredits = async (amount: number): Promise<boolean> => {
    // Admin nunca paga créditos, no necesita reembolso
    if (isAdmin) return true;
    
    // No hay créditos para reembolsar
    if (amount <= 0) return true;
    
    // Usuario no autenticado
    if (!user) return false;
    
    try {
      // Obtener créditos actuales del usuario
      const currentCredits = await userService.getCredits(user.uid);
      
      // Calcular nuevos créditos (sumar el reembolso)
      const newAvailable = currentCredits.available + amount;
      
      // Actualizar créditos en Firestore
      await userService.updateCredits(user.uid, {
        available: newAvailable,
        used: currentCredits.used,
        plan: currentCredits.plan
      });
      
      console.log(`[useCreditGuard] Reembolsados ${amount} créditos. Nuevo total: ${newAvailable}`);
      return true;
    } catch (error) {
      console.error('[useCreditGuard] Error refunding credits:', error);
      return false;
    }
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