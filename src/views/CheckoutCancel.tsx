import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function CheckoutCancel() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-slate-50 rounded-[28px] flex items-center justify-center mx-auto">
          <XCircle className="w-10 h-10 text-slate-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">
            Pago cancelado
          </h1>
          <p className="text-slate-500 font-medium">
            No se realizó ningún cargo. Puedes intentarlo cuando quieras.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/pricing')}
            className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
          >
            Ver planes
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
