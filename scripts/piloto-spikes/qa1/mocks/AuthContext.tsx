import React from 'react';
const fakeUser: any = { uid: 'preview-uid', email: 'ella@ejemplo.cl', displayName: 'Camila', getIdToken: async () => 'tok' };
const value: any = {
  user: fakeUser, profile: { id: 'preview-uid', username: 'Camila', role: 'user' }, loading: false,
  isAdmin: true, hasCredits: true, isNewUser: false, profileLoadError: false,
  credits: { available: 999999, used: 0, plan: 'admin' }, stats: {}, proCredits: 0,
  previewPlan: null, setPreviewPlan: () => {},
  markOnboardingDone: async () => {}, updateProfile: async () => {}, deductCredit: async () => true, deductCredits: async () => true,
  refreshCredits: async () => {}, signOut: async () => {}, deductProCredit: async () => true, refundProCredit: async () => true,
  deductMixedCredits: async () => true, refundMixedCredits: async () => true,
};
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
export const useAuth = () => value;
export const DEFAULT_INTERESTS = { categories: [], tags: [], preferredModules: [] };
export const DEFAULT_SOCIALS = {};
export const DEFAULT_PREFERENCES = {};
