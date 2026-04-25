import React from 'react';
import { X, Zap, ArrowRight, Crown, Check } from 'lucide-react';

interface NoCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  required?: number;
  available?: number;
}

const PLANS = [
  {
    id: 'starter',
    label: 'Starter',
    price: '$9.99',
    period: '/mes',
    credits: 240,
    images: '~120',
    highlight: false,
    accentClass: 'border-sky-500/20 bg-sky-500/5',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
    features: ['240 créditos mensuales', 'Todos los módulos', 'Galería comunitaria', 'Soporte por email'],
  },
  {
    id: 'pro',
    label: 'Pro',
    price: '$19.99',
    period: '/mes',
    credits: 600,
    images: '~300',
    highlight: true,
    accentClass: 'border-violet-500/40 bg-violet-500/8',
    badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    features: ['600 créditos mensuales', 'Todos los módulos', 'Campaign Generator ilimitado', 'Soporte prioritario'],
  },
  {
    id: 'studio',
    label: 'Studio',
    price: '$39.99',
    period: '/mes',
    credits: 1500,
    images: '~750',
    highlight: false,
    accentClass: 'border-fuchsia-500/20 bg-fuchsia-500/5',
    badgeClass: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/20',
    features: ['1,500 créditos mensuales', 'Todo lo de Pro', 'Prioridad de generación', 'Chat de soporte dedicado'],
  },
] as const;

const NoCreditsModal: React.FC<NoCreditsModalProps> = ({ isOpen, onClose, required = 1, available = 0 }) => {
  if (!isOpen) return null;
  const deficit = required - available;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-lg bg-[#0D0D14] border border-white/[0.08] rounded-t-[28px] sm:rounded-3xl shadow-2xl shadow-black/70 overflow-hidden animate-slide-up sm:animate-scale-in max-h-[92dvh] overflow-y-auto scrollbar-hide"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-white/15 rounded-full" />
        </div>

        <div className="relative px-6 pt-5 pb-6 sm:pt-6">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 border border-brand-500/20 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-brand-400" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-40" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-500" />
                </span>
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase italic tracking-tight leading-none">Sin créditos</h2>
                <p className="text-2xs font-black text-white/35 uppercase tracking-[0.25em] mt-1.5">
                  Necesitas {required} cr · Tienes {available}
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/80 transition-all touch-target"
              aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>

          <div className="relative mt-5 flex items-center gap-3 bg-brand-500/8 border border-brand-500/15 rounded-2xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 animate-pulse" />
            <p className="text-xs font-bold text-brand-300/80 leading-relaxed">
              Te faltan <span className="font-black text-brand-300">{deficit} crédito{deficit > 1 ? 's' : ''}</span> para continuar. Elige un plan para desbloquear la generación.
            </p>
          </div>
        </div>

        <div className="px-6 pb-2 space-y-3">
          {PLANS.map(plan => (
            <div key={plan.id}
              className={`relative rounded-2xl border p-4 transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
                plan.highlight ? 'border-violet-500/40 bg-gradient-to-br from-violet-600/12 to-fuchsia-600/6' : plan.accentClass
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-4">
                  <div className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow-lg shadow-violet-900/50">
                    <Crown size={9} /> Recomendado
                  </div>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`badge border text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-lg ${plan.badgeClass}`}>{plan.label}</span>
                    <span className="text-2xs font-bold text-white/25 uppercase">{plan.credits} cr · {plan.images} imgs/mes</span>
                  </div>
                  {plan.highlight && (
                    <ul className="space-y-1 mt-2">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-2">
                          <Check size={10} className="text-violet-400 flex-shrink-0" />
                          <span className="text-[11px] text-white/50">{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-lg font-black text-white leading-none">{plan.price}</div>
                    <div className="text-[9px] font-bold text-white/25 uppercase">{plan.period}</div>
                  </div>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${plan.highlight ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white' : 'bg-white/5 text-white/30'}`}>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pt-4">
          <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/15 rounded-2xl px-4 py-3">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 flex-shrink-0" />
            <p className="text-[10px] font-bold text-amber-300/70 leading-relaxed">
              💳 Los pagos se habilitarán muy pronto. Si necesitas créditos ahora, contacta al equipo de soporte.
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-2">
          <button className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-violet-900/40 hover:opacity-90 active:scale-[0.98] transition-all touch-target">
            Ver planes completos
          </button>
          <button onClick={onClose}
            className="w-full py-3.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-white/40 hover:text-white/70 rounded-2xl font-black text-xs uppercase tracking-widest transition-all touch-target">
            Cerrar
          </button>
        </div>
        <div className="h-safe-bottom" />
      </div>
    </div>
  );
};

export default NoCreditsModal;
