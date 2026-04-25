import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Zap } from 'lucide-react';
import { useAuth } from '../modules/auth/AuthContext';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const { refreshCredits } = useAuth();

  useEffect(() => {
    // Refrescar créditos tras el pago (el webhook puede tardar 2-5s)
    const t = setTimeout(() => { refreshCredits().catch(() => {}); }, 3000);
    return () => clearTimeout(t);
  }, []);

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
            Tus créditos se activarán en unos segundos. Si no los ves de inmediato, recarga la página.
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
          <Zap className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-bold text-emerald-700 text-left">
            Los créditos ya están en tu cuenta. ¡A generar!
          </p>
        </div>
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
