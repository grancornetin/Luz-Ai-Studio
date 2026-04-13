import React from 'react';
import { X, Zap, ArrowRight, Crown } from 'lucide-react';

// ──────────────────────────────────────────
// NoCreditsModal
// Se muestra cuando el usuario intenta generar
// sin tener suficientes créditos.
// ──────────────────────────────────────────

interface NoCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  required?: number;   // Cuántos créditos necesita la acción
  available?: number;  // Cuántos tiene disponibles
}

const PLANS = [
  {
    id: 'starter',
    label: 'Starter',
    price: '$9.99',
    credits: 240,
    images: '~120',
    color: 'bg-brand-600',
    highlight: false,
  },
  {
    id: 'pro',
    label: 'Pro',
    price: '$19.99',
    credits: 600,
    images: '~300',
    color: 'bg-brand-600',
    highlight: true,
  },
  {
    id: 'studio',
    label: 'Studio',
    price: '$39.99',
    credits: 1500,
    images: '~750',
    color: 'bg-violet-600',
    highlight: false,
  },
];

const NoCreditsModal: React.FC<NoCreditsModalProps> = ({
  isOpen,
  onClose,
  required = 1,
  available = 0,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-[36px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-br from-rose-500 to-orange-500 p-7 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white transition-colors"
          >
            <X size={14} />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tight leading-none">
                Sin créditos
              </h2>
              <p className="text-white/80 text-xs font-bold mt-1 uppercase tracking-widest">
                Necesitas {required} cr · Tienes {available}
              </p>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-5">

          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            Para continuar generando imágenes elige un plan. Los créditos se renuevan cada mes y nunca expiran durante el período de suscripción.
          </p>

          {/* PLANS */}
          <div className="space-y-3">
            {PLANS.map(plan => (
              <div
                key={plan.id}
                className={`relative flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  plan.highlight
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-2.5 left-4 bg-brand-600 text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5" />
                    Recomendado
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${plan.color} rounded-xl flex items-center justify-center`}>
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{plan.label}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                      {plan.credits} cr · {plan.images} imágenes/mes
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900">{plan.price}<span className="text-[9px] font-bold text-slate-400">/mes</span></span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            ))}
          </div>

          {/* NOTA PAGOS */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5">
            <p className="text-[10px] font-bold text-amber-700 text-center leading-relaxed">
              💳 Los pagos se habilitarán próximamente. Si necesitas créditos ahora, contacta al equipo de soporte.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
          >
            Cerrar
          </button>

        </div>
      </div>
    </div>
  );
};

export default NoCreditsModal;
