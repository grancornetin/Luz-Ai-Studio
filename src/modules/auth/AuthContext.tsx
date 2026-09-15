import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  getRedirectResult,
  signInAnonymously,
  signInWithCustomToken,
  User as FirebaseUser,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp, type DocumentSnapshot } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { userService, UserCredits, UserStats, PLAN_CREDITS } from '../../services/userService';
import {
  deductMixedCredits as _deductMixedCredits,
  deductProCredit as _deductProCredit,
  refundMixedCredits as _refundMixedCredits,
  refundProCredit as _refundProCredit,
} from '../../services/creditsService';
import { PLAN_PRO_CREDITS } from '../../services/creditConfig';
import { handleFirestoreError, OperationType } from '../../services/firestoreUtils';
import { autoCheckMissions } from '../../services/missionsService';
import { runMigration } from '../../utils/migratePrompts';
import { setCurrentUserPlan } from '../../services/userPlanStore';

export interface UserInterests {
  categories: string[];
  tags: string[];
  preferredModules: string[];
}

export interface UserSocials {
  personal?: { instagram?: string; twitter?: string; tiktok?: string; linkedin?: string };
  business?: { website?: string; instagram?: string; facebook?: string; linkedin?: string };
}

export interface UserPreferences {
  emailNotifications: boolean;
  feedSortBy: 'recent' | 'likes' | 'personalized' | 'variations';
  theme: 'light' | 'dark';
}

export const DEFAULT_INTERESTS: UserInterests = { categories: [], tags: [], preferredModules: [] };
export const DEFAULT_SOCIALS: UserSocials = {};
export const DEFAULT_PREFERENCES: UserPreferences = { emailNotifications: true, feedSortBy: 'recent', theme: 'light' };

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
  // Perfil público extendido
  username?: string;
  bio?: string;
  realName?: string;
  showRealName?: boolean;
  interests: UserInterests;
  socials: UserSocials;
  preferences: UserPreferences;
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
  // true si la última carga del perfil falló incluso tras reintentar —
  // el rol/créditos mostrados pueden no ser los reales hasta refrescar.
  profileLoadError: boolean;
  previewPlan: string | null;
  setPreviewPlan: (p: string | null) => void;
  markOnboardingDone: () => Promise<void>;
  updateProfile: (data: Partial<Omit<UserProfile, 'id' | 'email' | 'role'>>) => Promise<void>;
  deductCredit: () => Promise<boolean>;
  deductCredits: (amount: number) => Promise<boolean>;
  refreshCredits: () => Promise<void>;
  signOut: () => Promise<void>;
  // Pro-credits para Campaign y Photodump
  proCredits: number;
  deductProCredit: () => Promise<boolean>;
  refundProCredit: () => Promise<boolean>;
  deductMixedCredits: (normalCost: number, proCost: number) => Promise<boolean>;
  refundMixedCredits: (normalCost: number, proCost: number) => Promise<boolean>;
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
  const [proCredits, setProCredits] = useState(0);
  // true cuando la última carga de perfil falló incluso tras reintentar —
  // la UI puede avisar ("no pudimos confirmar tu cuenta, reintentá") en vez
  // de que el usuario pierda privilegios sin explicación.
  const [profileLoadError, setProfileLoadError] = useState(false);

  const setPreviewPlan = (p: string | null) => setPreviewPlanState(p);

  useEffect(() => {
    // Gatillo de debug interno: ?debugAnon=1 dispara un login anónimo (para
    // inspeccionar la app sin datos reales). No hay botón ni mención de esto
    // en la UI — solo funciona pasando el parámetro exacto.
    if (new URLSearchParams(window.location.search).get('debugAnon') === '1' && !auth.currentUser) {
      signInAnonymously(auth).catch(err => console.warn('[AuthContext] debugAnon sign-in failed:', err));
    }

    // Expone signInWithCustomToken en window SOLO para uso de herramientas
    // de inspección locales (Playwright) — no hay UI ni parámetro de URL
    // que lo dispare, solo puede invocarse desde la consola/devtools.
    (window as any).__debugSignInWithCustomToken = (token: string) =>
      signInWithCustomToken(auth, token);

    // En móvil con signInWithRedirect, getRedirectResult debe completar
    // ANTES de que onAuthStateChanged dispare con user=null en el primer render.
    // Si no esperamos, loading=false → LoginWall aparece → flickea cuando llega el user real.
    let redirectResolved = false;
    const redirectPromise = getRedirectResult(auth)
      .catch(() => null)
      .finally(() => { redirectResolved = true; });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Espera el redirect result en el primer dispatch para evitar el flicker
      if (!redirectResolved) await redirectPromise;

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
        setProfileLoadError(false);

        // ── Cargar perfil desde Firestore ──
        // Reintenta antes de rendirse: una falla transitoria (cuota,
        // hiccup de red) no debe degradar a un admin real a "user" en
        // silencio — eso le hizo perder privilegios sin ningún aviso la
        // vez que se agotó la cuota diaria de Firestore.
        const userRef = doc(db, 'users', firebaseUser.uid);
        let userSnap: DocumentSnapshot | null = null;
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            userSnap = await getDoc(userRef);
            lastError = null;
            break;
          } catch (err) {
            lastError = err;
            if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          }
        }
        if (lastError) throw lastError;
        if (!userSnap) throw new Error('No se pudo cargar el perfil de usuario.');

        let userProfile: UserProfile;

        if (userSnap.exists()) {
          const data = userSnap.data();
          userProfile = {
            id:          firebaseUser.uid,
            email:       firebaseUser.email       || '',
            displayName: firebaseUser.displayName || data.displayName || 'Usuario',
            photoURL:    firebaseUser.photoURL    || data.photoURL    || '',
            role:        data.role                || 'user',
            username:    data.username,
            bio:         data.bio,
            realName:    data.realName,
            showRealName: data.showRealName ?? false,
            interests:   data.interests   || DEFAULT_INTERESTS,
            socials:     data.socials     || DEFAULT_SOCIALS,
            preferences: data.preferences || DEFAULT_PREFERENCES,
          };
          setIsNewUser(false);
        } else {
          // Primera vez — crear documento vía servidor (Admin SDK ignora Firestore rules)
          userProfile = {
            id:          firebaseUser.uid,
            email:       firebaseUser.email       || '',
            displayName: firebaseUser.displayName || 'Usuario',
            photoURL:    firebaseUser.photoURL    || '',
            role:        'user',
            interests:   DEFAULT_INTERESTS,
            socials:     DEFAULT_SOCIALS,
            preferences: DEFAULT_PREFERENCES,
          };
          setIsNewUser(true);
          // Llamar al endpoint servidor que crea el doc con Admin SDK
          const token = await firebaseUser.getIdToken();
          await fetch('/api/credits', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify({ action: 'initUser', payload: { email: userProfile.email, displayName: userProfile.displayName } }),
          }).catch(err => console.warn('[AuthContext] user-init warning:', err));
        }

        setProfile(userProfile);

        // ── Cargar créditos, stats y pro-credits en paralelo ──
        const [userCredits, userStats] = await Promise.all([
          userService.getCredits(firebaseUser.uid),
          userService.getStats(firebaseUser.uid),
        ]);
        setCredits(userCredits);
        setStats(userStats);

        // Pro-credits: leer desde Firestore directamente (campo proCreditsAvailable)
        try {
          const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDocSnap.exists()) {
            const d = userDocSnap.data();
            const planKey = (d.plan || 'free') as string;
            setCurrentUserPlan(planKey);
            const periodPro = PLAN_PRO_CREDITS[planKey] ?? 0;
            const usedPro   = d.proCreditsUsedThisPeriod ?? 0;
            const topUpPro  = d.proTopUpCredits ?? 0;
            setProCredits(Math.max(0, periodPro - usedPro) + topUpPro);
          }
        } catch {
          // non-blocking
        }

        // ── Auto-verificar misiones (fire-and-forget) ──
        autoCheckMissions(
          firebaseUser.uid,
          firebaseUser.emailVerified,
        ).catch(err => console.warn('[AuthContext] Mission autocheck warning:', err));

        // ── Migración localStorage → Firestore (fire-and-forget) ──
        // Se ejecuta una sola vez por usuario gracias al flag en Firestore.
        // No bloquea el login si falla.
        runMigration(
          firebaseUser.uid,
          firebaseUser.displayName || userProfile.displayName || 'Anonymous'
        ).catch(err => console.warn('[AuthContext] Migration warning:', err));

      } catch (err) {
        console.error('[AuthContext] Error loading user data:', err);
        setProfileLoadError(true);
        // Aunque falle la carga de datos, el usuario sigue autenticado.
        // Importante: NO se pisa un perfil ya cargado en esta sesión — una
        // falla transitoria posterior (ej. cuota de Firestore agotada) no
        // debe degradar a un admin real a "user" en silencio, que fue
        // justo lo que pasó la vez que se agotó la cuota diaria. Solo se
        // asume "user" cuando es la primera carga y no hay nada mejor.
        setUser(firebaseUser);
        setProfile(prev => prev ?? {
          id:          firebaseUser.uid,
          email:       firebaseUser.email       || '',
          displayName: firebaseUser.displayName || 'Usuario',
          photoURL:    firebaseUser.photoURL    || '',
          role:        'user',
          interests:   DEFAULT_INTERESTS,
          socials:     DEFAULT_SOCIALS,
          preferences: DEFAULT_PREFERENCES,
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      const { generationHistoryService } = await import('../../services/generationHistoryService');
      await generationHistoryService.clearLocalForUser(uid).catch(() => {});
    }
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setCredits(DEFAULT_CREDITS);
    setStats(DEFAULT_STATS);
  };

  const updateProfile = async (data: Partial<Omit<UserProfile, 'id' | 'email' | 'role'>>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { ...data, updatedAt: serverTimestamp() });
      setProfile(prev => prev ? { ...prev, ...data } : prev);
    } catch (err) {
      console.error('[AuthContext] updateProfile error:', err);
      throw err;
    }
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
    // Refrescar pro-credits también
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        const planKey = (d.plan || 'free') as string;
        setCurrentUserPlan(planKey);
        const periodPro = PLAN_PRO_CREDITS[planKey] ?? 0;
        const usedPro   = d.proCreditsUsedThisPeriod ?? 0;
        const topUpPro  = d.proTopUpCredits ?? 0;
        setProCredits(Math.max(0, periodPro - usedPro) + topUpPro);
      }
    } catch { /* non-blocking */ }
  };

  const handleDeductProCredit = async (): Promise<boolean> => {
    if (!user) return false;
    if (isAdmin && !previewPlan) return true;
    const ok = await _deductProCredit(user.uid);
    if (ok) setProCredits(p => Math.max(0, p - 1));
    return ok;
  };

  const handleRefundProCredit = async (): Promise<boolean> => {
    if (!user) return false;
    if (isAdmin && !previewPlan) return true;
    const ok = await _refundProCredit(user.uid);
    if (ok) setProCredits(p => p + 1);
    return ok;
  };

  const handleDeductMixedCredits = async (normalCost: number, proCost: number): Promise<boolean> => {
    if (!user) return false;
    if (isAdmin && !previewPlan) return true;
    const ok = await _deductMixedCredits(user.uid, normalCost, proCost);
    if (ok) {
      await refreshCredits();
    }
    return ok;
  };

  const handleRefundMixedCredits = async (normalCost: number, proCost: number): Promise<boolean> => {
    if (!user) return false;
    if (isAdmin && !previewPlan) return true;
    const ok = await _refundMixedCredits(user.uid, normalCost, proCost);
    if (ok) {
      await refreshCredits();
    }
    return ok;
  };

  const isAdmin = profile?.role === 'admin';

  // Cuando el admin simula un plan, los créditos visibles cambian pero isAdmin se mantiene
  const effectiveCredits: UserCredits = (isAdmin && previewPlan)
    ? { ...credits, plan: previewPlan as UserCredits['plan'], available: previewPlan === 'free' ? 10 : previewPlan === 'weekly' ? 60 : previewPlan === 'starter' ? 200 : previewPlan === 'pro' ? 500 : 1200 }
    : credits;

  const hasCredits = (isAdmin && !previewPlan) || effectiveCredits.available > 0;

  const effectiveProCredits = (isAdmin && !previewPlan) ? 999999 : proCredits;

  return (
    <AuthContext.Provider value={{
      user, profile, credits: effectiveCredits, stats, loading,
      isAdmin, hasCredits, isNewUser, profileLoadError,
      previewPlan, setPreviewPlan,
      markOnboardingDone, updateProfile, deductCredit, deductCredits,
      refreshCredits, signOut,
      proCredits: effectiveProCredits,
      deductProCredit: handleDeductProCredit,
      refundProCredit: handleRefundProCredit,
      deductMixedCredits: handleDeductMixedCredits,
      refundMixedCredits: handleRefundMixedCredits,
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
