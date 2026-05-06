import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Zap, ArrowRight, Crown } from 'lucide-react';
import { PLANS as CONFIG_PLANS } from '../../services/creditConfig';

interface NoCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  required?: number;
  available?: number;
}

const PLANS = [
  {
    id: 'starter',
    label: CONFIG_PLANS.starter.label,
    price: `$${CONFIG_PLANS.starter.priceMonthly}`,
    credits: CONFIG_PLANS.starter.credits,
    images: CONFIG_PLANS.starter.approxImages,
    color: 'bg-brand-600',
    highlight: false,
  },
  {
    id: 'pro',
    label: CONFIG_PLANS.pro.label,
    price: `$${CONFIG_PLANS.pro.priceMonthly}`,
    credits: CONFIG_PLANS.pro.credits,
    images: CONFIG_PLANS.pro.approxImages,
    color: 'bg-brand-600',
    highlight: true,
  },
  {
    id: 'studio',
    label: CONFIG_PLANS.studio.label,
    price: `$${CONFIG_PLANS.studio.priceMonthly}`,
    credits: CONFIG_PLANS.studio.credits,
    images: CONFIG_PLANS.studio.approxImages,
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
  const navigate = useNavigate();
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[36px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 fade-in duration-200 max-h-[90vh] flex flex-col"
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
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">

          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            Para continuar generando imágenes elige un plan. Los créditos se renuevan cada mes y nunca expiran durante el período de suscripción.
          </p>

          {/* PLANS */}
          <div className="space-y-3">
            {PLANS.map(plan => (
              <div
                key={plan.id}
                onClick={() => { onClose(); navigate('/pricing'); }}
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
