import { useState } from 'react';
import { useAuth } from '../modules/auth/AuthContext';
import { refundCredits as apiRefundCredits } from '../services/creditsService';

interface UseCreditGuardReturn {
  checking: boolean;
  showNoCredits: boolean;
  requiredCredits: number;
  closeModal: () => void;
  checkAndDeduct: (required: number) => Promise<boolean>;
  refundCredits: (amount: number) => Promise<boolean>;
}

export const useCreditGuard = (): UseCreditGuardReturn => {
  const { credits, isAdmin, deductCredits, refreshCredits, user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [showNoCredits, setShowNoCredits] = useState(false);
  const [requiredCredits, setRequiredCredits] = useState(1);

  const closeModal = () => setShowNoCredits(false);

  const checkAndDeduct = async (required: number): Promise<boolean> => {
    if (isAdmin) return true;

    if (credits.available < required) {
      setRequiredCredits(required);
      setShowNoCredits(true);
      return false;
    }

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

  const refundCredits = async (amount: number): Promise<boolean> => {
    if (isAdmin || amount <= 0 || !user) return true;
    try {
      const ok = await apiRefundCredits(user.uid, amount);
      await refreshCredits();
      return ok;
    } catch {
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
