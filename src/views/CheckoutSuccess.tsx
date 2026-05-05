import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Zap, Loader2 } from 'lucide-react';
import { useAuth } from '../modules/auth/AuthContext';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const { refreshCredits, credits } = useAuth();
  const initialCredits = useRef(credits.available);
  const attempts = useRef(0);
  const maxAttempts = 15; // 15 × 2s = 30s máximo
  const [creditsReceived, setCreditsReceived] = useState(false);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    // Capturamos los créditos iniciales justo cuando monta el componente
    initialCredits.current = credits.available;
  }, []);

  useEffect(() => {
    if (creditsReceived) return;

    const poll = async () => {
      if (attempts.current >= maxAttempts) {
        setPolling(false);
        return;
      }
      attempts.current += 1;
      await refreshCredits().catch(() => {});
    };

    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [creditsReceived]);

  // Cuando los créditos suben, marcamos éxito y redirigimos automáticamente
  useEffect(() => {
    if (credits.available > initialCredits.current && !creditsReceived) {
      setCreditsReceived(true);
      setPolling(false);
      const timer = setTimeout(() => navigate('/dashboard'), 2500);
      return () => clearTimeout(timer);
    }
  }, [credits.available]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-emerald-50 rounded-[28px] flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">
            ¡Pago exitoso!
          </h1>
          <p className="text-slate-500 font-medium leading-relaxed">
            {creditsReceived
              ? 'Tus créditos están listos. Te llevamos al dashboard...'
              : polling
              ? 'Activando tus créditos, un momento...'
              : 'Tus créditos estarán disponibles en breve. Puedes ir al dashboard.'}
          </p>
        </div>

        {creditsReceived ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
            <Zap className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-bold text-emerald-700 text-left">
              ¡Créditos acreditados! Redirigiendo al dashboard...
            </p>
          </div>
        ) : polling ? (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-slate-400 flex-shrink-0 animate-spin" />
            <p className="text-sm font-medium text-slate-500 text-left">
              Esperando confirmación del pago...
            </p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-bold text-amber-700 text-left">
              Si no ves los créditos, recarga la página en unos segundos.
            </p>
          </div>
        )}

        <button
          onClick={() => navigate('/dashboard')}
          className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
        >
          Ir al Dashboard
        </button>
        <button
          onClick={() => navigate('/pricing')}
          className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
        >
          Ver mis créditos
        </button>
      </div>
    </div>
  );
}
