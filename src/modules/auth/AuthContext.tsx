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
  isNewUser: boolean;           // true si es la primera vez que entra
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

  const [user, setUser]         = useState<FirebaseUser | null>(null);
  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [credits, setCredits]   = useState<UserCredits>(DEFAULT_CREDITS);
  const [stats, setStats]       = useState<UserStats>(DEFAULT_STATS);
  const [loading, setLoading]   = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    // BYPASS FIREBASE AUTH FOR TESTING
    const mockUser = {
      uid: 'local-admin-uid',
      email: 'admin@local.test',
      displayName: 'Admin (Local Mode)',
    } as FirebaseUser;
    
    setUser(mockUser);
    setProfile({
      id: mockUser.uid,
      email: mockUser.email!,
      displayName: mockUser.displayName!,
      photoURL: '',
      role: 'admin'
    });
    setCredits({ available: 9999, used: 0, plan: 'admin' });
    setStats(DEFAULT_STATS);
    setIsNewUser(false);
    setLoading(false);

    /*
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // ... original code ...
    });
    return () => unsubscribe();
    */
  }, []);

  const signOut = async () => {
    // await firebaseSignOut(auth);
    console.log("Sign out disabled in local mode");
  };

  // Marca el onboarding como visto en Firestore
  const markOnboardingDone = async () => {
    setIsNewUser(false);
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
      userService.getStats(user.uid)
    ]);
    setCredits(newCredits);
    setStats(newStats);
  };

  const isAdmin = profile?.role === 'admin' ||
                  profile?.email === 'grancornetin@gmail.com';

  const hasCredits = isAdmin || credits.available > 0;

  return (
    <AuthContext.Provider value={{
      user, profile, credits, stats, loading,
      isAdmin, hasCredits, isNewUser,
      markOnboardingDone, deductCredit, deductCredits,
      refreshCredits, signOut
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