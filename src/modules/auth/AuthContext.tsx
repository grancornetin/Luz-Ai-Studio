import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { userService, UserCredits, UserStats, PLAN_CREDITS } from '../../services/userService';
import { handleFirestoreError, OperationType } from '../../services/firestoreUtils';
import { runMigration } from '../../utils/migratePrompts';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  credits: UserCredits;
  stats: UserStats;
  loading: boolean;
  isAdmin: boolean;
  hasCredits: boolean;
  isNewUser: boolean;
  previewPlan: string | null;          // solo admin: plan que está simulando
  setPreviewPlan: (p: string | null) => void;
  markOnboardingDone: () => Promise<void>;
  deductCredit: () => Promise<boolean>;
  deductCredits: (amount: number) => Promise<boolean>;
  refreshCredits: () => Promise<void>;
  signOut: () => Promise<void>;
}

const DEFAULT_CREDITS: UserCredits = { available: 0, used: 0, plan: 'free' };
const DEFAULT_STATS: UserStats = {
  totalGenerations: 0, totalAvatars: 0,
  totalProducts: 0, creditsUsed: 0, lastActiveAt: ''
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [user, setUser]           = useState<FirebaseUser | null>(null);
  const [profile, setProfile]     = useState<UserProfile | null>(null);
  const [credits, setCredits]     = useState<UserCredits>(DEFAULT_CREDITS);
  const [stats, setStats]         = useState<UserStats>(DEFAULT_STATS);
  const [loading, setLoading]     = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [previewPlan, setPreviewPlanState] = useState<string | null>(null);

  const setPreviewPlan = (p: string | null) => setPreviewPlanState(p);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Usuario no autenticado — limpiar todo
        setUser(null);
        setProfile(null);
        setCredits(DEFAULT_CREDITS);
        setStats(DEFAULT_STATS);
        setLoading(false);
        return;
      }

      try {
        setUser(firebaseUser);

        // ── Cargar perfil desde Firestore ──
        const userRef  = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        let userProfile: UserProfile;

        if (userSnap.exists()) {
          const data = userSnap.data();
          userProfile = {
            id:          firebaseUser.uid,
            email:       firebaseUser.email       || '',
            displayName: firebaseUser.displayName || data.displayName || 'Usuario',
            photoURL:    firebaseUser.photoURL    || data.photoURL    || '',
            role:        data.role                || 'user',
          };
          setIsNewUser(false);
        } else {
          // Primera vez — crear perfil
          userProfile = {
            id:          firebaseUser.uid,
            email:       firebaseUser.email       || '',
            displayName: firebaseUser.displayName || 'Usuario',
            photoURL:    firebaseUser.photoURL    || '',
            role:        'user',
          };
          setIsNewUser(true);
          // El userService se encargará de crear el doc en Firestore
          await userService.initializeUser(firebaseUser.uid, userProfile.email, userProfile.displayName);
        }

        setProfile(userProfile);

        // ── Cargar créditos y stats en paralelo ──
        const [userCredits, userStats] = await Promise.all([
          userService.getCredits(firebaseUser.uid),
          userService.getStats(firebaseUser.uid),
        ]);
        setCredits(userCredits);
        setStats(userStats);

        // ── Migración localStorage → Firestore (fire-and-forget) ──
        // Se ejecuta una sola vez por usuario gracias al flag en Firestore.
        // No bloquea el login si falla.
        runMigration(
          firebaseUser.uid,
          firebaseUser.displayName || userProfile.displayName || 'Anonymous'
        ).catch(err => console.warn('[AuthContext] Migration warning:', err));

      } catch (err) {
        console.error('[AuthContext] Error loading user data:', err);
        // Aunque falle la carga de datos, el usuario sigue autenticado
        setUser(firebaseUser);
        setProfile({
          id:          firebaseUser.uid,
          email:       firebaseUser.email       || '',
          displayName: firebaseUser.displayName || 'Usuario',
          photoURL:    firebaseUser.photoURL    || '',
          role:        'user',
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setCredits(DEFAULT_CREDITS);
    setStats(DEFAULT_STATS);
  };

  const markOnboardingDone = async () => {
    if (!user) return;
    setIsNewUser(false);
    try {
      await updateDoc(doc(db, 'users', user.uid), { onboardingDone: true });
    } catch (err) {
      console.error('[AuthContext] markOnboardingDone error:', err);
    }
  };

  const deductCredit = async (): Promise<boolean> => {
    if (!user) return false;
    const success = await userService.deductCredits(user.uid, 1);
    if (success) await refreshCredits();
    return success;
  };

  const deductCredits = async (amount: number): Promise<boolean> => {
    if (!user) return false;
    const success = await userService.deductCredits(user.uid, amount);
    if (success) await refreshCredits();
    return success;
  };

  const refreshCredits = async () => {
    if (!user) return;
    const [newCredits, newStats] = await Promise.all([
      userService.getCredits(user.uid),
      userService.getStats(user.uid),
    ]);
    setCredits(newCredits);
    setStats(newStats);
  };

  const isAdmin = profile?.role === 'admin' ||
                  profile?.email === 'grancornetin@gmail.com';

  // Cuando el admin simula un plan, los créditos visibles cambian pero isAdmin se mantiene
  const effectiveCredits: UserCredits = (isAdmin && previewPlan)
    ? { ...credits, plan: previewPlan as UserCredits['plan'], available: previewPlan === 'free' ? 10 : previewPlan === 'weekly' ? 60 : previewPlan === 'starter' ? 200 : previewPlan === 'pro' ? 500 : 1200 }
    : credits;

  const hasCredits = (isAdmin && !previewPlan) || effectiveCredits.available > 0;

  return (
    <AuthContext.Provider value={{
      user, profile, credits: effectiveCredits, stats, loading,
      isAdmin, hasCredits, isNewUser,
      previewPlan, setPreviewPlan,
      markOnboardingDone, deductCredit, deductCredits,
      refreshCredits, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};