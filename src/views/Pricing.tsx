import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, ArrowLeft, DollarSign } from 'lucide-react';
import { PLANS, type PlanKey } from '../services/creditConfig';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../modules/auth/AuthContext';
import { buildCheckoutUrl, PLAN_TO_VARIANT, type VariantKey } from '../services/checkoutService';

const PLAN_ORDER: PlanKey[] = ['free', 'weekly', 'starter', 'pro', 'studio'];

const PLAN_STYLE: Record<string, { badge: string; button: string; card: string }> = {
  free:    { badge: 'bg-slate-100 text-slate-500',   button: 'bg-slate-900 hover:bg-slate-700 text-white',   card: '' },
  weekly:  { badge: 'bg-brand-100 text-brand-600',   button: 'bg-brand-600 hover:bg-brand-700 text-white',   card: '' },
  starter: { badge: 'bg-brand-100 text-brand-600',   button: 'bg-brand-600 hover:bg-brand-700 text-white',   card: '' },
  pro:     { badge: 'bg-indigo-100 text-indigo-600', button: 'bg-indigo-600 hover:bg-indigo-700 text-white', card: 'ring-2 ring-indigo-500 shadow-xl shadow-indigo-100' },
  studio:  { badge: 'bg-violet-100 text-violet-600', button: 'bg-violet-600 hover:bg-violet-700 text-white', card: '' },
};

export default function Pricing() {
  const navigate    = useNavigate();
  const { credits, user } = useAuth();
  const { currency, toggle, format } = useCurrency();

  const handleSubscribe = (planId: string) => {
    if (planId === 'free') return;
    const variantKey = PLAN_TO_VARIANT[planId] as VariantKey | undefined;
    if (!variantKey || !user?.uid) {
      alert('Inicia sesión para suscribirte.');
      return;
    }
    const url = buildCheckoutUrl(variantKey, user.uid);
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-24 animate-in fade-in duration-500">

      {/* Header */}
      <header className="flex items-center justify-between px-1 pt-2">
        <div>
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 text-xs font-bold uppercase tracking-widest mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </button>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-tight">
            Planes <span className="text-indigo-600">&amp; Precios</span>
          </h1>
          <p className="text-slate-500 font-medium mt-2 text-sm">Elige el plan que mejor se adapte a tu flujo de trabajo.</p>
        </div>

        {/* Toggle de moneda */}
        <button
          onClick={toggle}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <DollarSign className="w-3.5 h-3.5" />
          {currency === 'USD' ? 'Ver en CLP' : 'Ver en USD'}
        </button>
      </header>

      {/* Aviso de plan actual */}
      {credits?.plan && credits.plan !== 'free' && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 px-5 py-3 rounded-2xl">
          <Zap className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <p className="text-xs font-black text-indigo-700 uppercase tracking-widest">
            Tu plan actual: {credits.plan.toUpperCase()} · {credits.available} créditos disponibles
          </p>
        </div>
      )}

      {/* Cards de planes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {PLAN_ORDER.map(key => {
          const plan   = PLANS[key];
          const style  = PLAN_STYLE[key];
          const isPro  = key === 'pro';
          const isCurrent = credits?.plan === key;

          return (
            <div
              key={key}
              className={`bg-white rounded-[28px] border border-slate-100 p-6 flex flex-col gap-5 relative transition-all ${style.card}`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow">
                  Más popular
                </div>
              )}

              <div>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${style.badge}`}>
                  {plan.label}
                </span>
                <div className="mt-4 space-y-0.5">
                  {plan.priceMonthly === 0 ? (
                    <p className="text-3xl font-black text-slate-900">Gratis</p>
                  ) : (
                    <>
                      {(plan as any).priceAnchor && (
                        <p className="text-sm text-slate-400 line-through font-bold">
                          {format((plan as any).priceAnchor)}
                        </p>
                      )}
                      <p className="text-3xl font-black text-slate-900">{format(plan.priceMonthly)}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {key === 'weekly' ? 'por semana' : 'por mes'}
                      </p>
                    </>
                  )}
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-1">{plan.approxImages}</p>
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-[11px] font-medium text-slate-600 leading-tight">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(key)}
                disabled={isCurrent}
                className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isCurrent
                    ? 'bg-slate-100 text-slate-400 cursor-default'
                    : style.button
                }`}
              >
                {isCurrent ? 'Plan actual' : plan.priceMonthly === 0 ? 'Empezar gratis' : 'Suscribirse'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Sección top-up */}
      <div className="bg-slate-50 rounded-[32px] border border-slate-100 p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">¿Necesitas más créditos?</h2>
            <p className="text-xs text-slate-400 font-medium mt-1">Recarga en cualquier momento sin cambiar de plan.</p>
          </div>
          <button
            onClick={() => navigate('/buy-credits')}
            className="px-5 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
          >
            Ver recargas
          </button>
        </div>
      </div>

      {/* FAQ rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { q: '¿Qué es un crédito?', a: '1 crédito = $0.10 USD. Cada imagen cuesta 2 créditos con Nano Banana 2 (Gemini) o 1 crédito con Seedream 4.5. Model DNA cuesta 8 créditos (4 imágenes, siempre Gemini).' },
          { q: '¿Los créditos vencen?', a: 'Los créditos de planes mensuales se renuevan cada ciclo. Los créditos de recargas y misiones no vencen.' },
          { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Cancelas cuando quieras desde tu panel de cuenta. Tu plan se mantiene activo hasta el fin del período pagado.' },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-[20px] border border-slate-100 p-5 space-y-2">
            <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.q}</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
