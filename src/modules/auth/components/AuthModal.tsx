import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
// RUTA CORREGIDA: sube 3 niveles para encontrar firebase.ts en /src
import { auth } from '../../../firebase'; 
import { X, Mail, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'signup' | 'reset';

const googleProvider = new GoogleAuthProvider();

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode]               = useState<AuthMode>('login');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading]         = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);

  if (!isOpen) return null;

  const resetFields = () => {
    setEmail(''); setPassword(''); setDisplayName('');
    setError(null); setSuccess(null);
  };

  const changeMode = (m: AuthMode) => { resetFields(); setMode(m); };

  const friendlyError = (code: string): string => {
    const map: Record<string, string> = {
      'auth/user-not-found':      'Usuario no encontrado.',
      'auth/wrong-password':      'Contraseña incorrecta.',
      'auth/email-already-in-use':'El correo ya está en uso.',
      'auth/weak-password':       'La contraseña debe tener al menos 6 caracteres.',
      'auth/invalid-email':       'Correo inválido.',
      'auth/popup-closed-by-user':'Cerraste la ventana de Google. Intenta de nuevo.',
      'auth/cancelled-popup-request': 'Operación cancelada.',
      'auth/invalid-credential':  'Correo o contraseña incorrectos.',
    };
    return map[code] || 'Ocurrió un error inesperado.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        onClose();
      } else if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
        onClose();
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email);
        setSuccess('Enviamos un correo de recuperación. Revisa tu bandeja.');
        setTimeout(() => changeMode('login'), 3500);
      }
    } catch (err: any) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err: any) {
      setError(friendlyError(err.code));
    } finally {
      setLoadingGoogle(false);
    }
  };

  const TITLES: Record<AuthMode, string> = {
    login:  'Bienvenido de nuevo',
    signup: 'Crea tu cuenta',
    reset:  'Recuperar acceso',
  };

  const SUBTITLES: Record<AuthMode, string> = {
    login:  'Ingresa para continuar creando',
    signup: 'Únete a la comunidad de LUZ IA',
    reset:  'Te enviaremos un enlace de recuperación',
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 fade-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-10 w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-xl flex items-center justify-center transition-all"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <div className="p-8 md:p-10">
          <div className="mb-8 text-center">
            <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center shadow-xl shadow-brand-200 mx-auto mb-5">
              <i className="fa-solid fa-bolt text-white text-2xl"></i>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic">
              {TITLES[mode]}
            </h2>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">
              {SUBTITLES[mode]}
            </p>
          </div>

          {mode !== 'reset' && (
            <>
              <button
                onClick={handleGoogle}
                disabled={loadingGoogle || loading}
                className="w-full flex items-center justify-center gap-3 py-3.5 border-2 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 rounded-2xl transition-all font-bold text-sm text-slate-700 disabled:opacity-50"
              >
                {loadingGoogle ? (
                  <Loader2 className="animate-spin w-5 h-5 text-slate-400" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continuar con Google
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">o</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text" placeholder="Nombre completo" required
                  value={displayName} onChange={e => setDisplayName(e.target.value)}
                  autoComplete="name"
                  className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-brand-500 focus:bg-white rounded-2xl outline-none transition-all text-base md:text-sm font-medium"
                />
              </div>
            )}

            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="email" placeholder="Correo electrónico" required
                value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-brand-500 focus:bg-white rounded-2xl outline-none transition-all text-base md:text-sm font-medium"
              />
            </div>

            {mode !== 'reset' && (
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="password" placeholder="Contraseña" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-brand-500 focus:bg-white rounded-2xl outline-none transition-all text-base md:text-sm font-medium"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 text-accent-600 text-xs font-bold bg-accent-50 p-3 rounded-xl">
                <ArrowRight size={14} className="flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit" disabled={loading || loadingGoogle}
              className="w-full py-4 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-100 transition-all flex items-center justify-center gap-2"
            >
              {loading
                ? <Loader2 className="animate-spin" size={18} />
                : mode === 'login' ? 'Iniciar Sesión'
                : mode === 'signup' ? 'Crear Cuenta'
                : 'Enviar Enlace'
              }
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col gap-2.5 text-center">
            {mode === 'login' ? (
              <>
                <button onClick={() => changeMode('signup')} className="text-xs font-bold text-slate-500 hover:text-brand-600 transition-colors">
                  ¿No tienes cuenta? <span className="text-brand-600">Regístrate gratis</span>
                </button>
                <button onClick={() => changeMode('reset')} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">
                  Olvidé mi contraseña
                </button>
              </>
            ) : (
              <button onClick={() => changeMode('login')} className="text-xs font-bold text-slate-500 hover:text-brand-600 transition-colors">
                ¿Ya tienes cuenta? <span className="text-brand-600">Inicia sesión</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;