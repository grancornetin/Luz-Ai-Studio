import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft, DollarSign, TrendingDown } from 'lucide-react';
import { TOP_UP_PACKAGES } from '../services/creditConfig';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../modules/auth/AuthContext';
import { buildCheckoutUrl, TOPUP_TO_VARIANT, type VariantKey } from '../services/checkoutService';

export default function BuyCredits() {
  const navigate         = useNavigate();
  const { credits, user } = useAuth();
  const { currency, toggle, format } = useCurrency();

  const handleBuy = (pkgId: string) => {
    const variantKey = TOPUP_TO_VARIANT[pkgId] as VariantKey | undefined;
    if (!variantKey || !user?.uid) {
      alert('Inicia sesión para comprar créditos.');
      return;
    }
    const url = buildCheckoutUrl(variantKey, user.uid);
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-24 animate-in fade-in duration-500">

      {/* Header */}
      <header className="flex items-center justify-between px-1 pt-2">
        <div>
          <button onClick={() => navigate('/pricing')} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 text-xs font-bold uppercase tracking-widest mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Precios
          </button>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-tight">
            Recargar <span className="text-indigo-600">Créditos</span>
          </h1>
          <p className="text-slate-500 font-medium mt-2 text-sm">Compra créditos adicionales sin cambiar tu plan.</p>
        </div>
        <button
          onClick={toggle}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <DollarSign className="w-3.5 h-3.5" />
          {currency === 'USD' ? 'Ver en CLP' : 'Ver en USD'}
        </button>
      </header>

      {/* Saldo actual */}
      <div className="flex items-center gap-4 bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-4">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Créditos disponibles</p>
          <p className="text-2xl font-black text-indigo-700">{credits?.available ?? 0}</p>
        </div>
      </div>

      {/* Regla de precio */}
      <div className="bg-white border border-slate-100 rounded-2xl px-6 py-4 flex items-center gap-3">
        <TrendingDown className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        <p className="text-xs font-bold text-slate-600">
          <span className="font-black text-slate-800">1 crédito = {format(0.10)} · </span>
          Cada imagen cuesta <strong>2 cr. con Nano Banana 2</strong> o <strong>1 cr. con Seedream 4.5</strong>. Los paquetes más grandes tienen mejor precio por crédito.
        </p>
      </div>

      {/* Packages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {TOP_UP_PACKAGES.map((pkg) => {
          const pricePerCredit = pkg.priceUSD / pkg.credits;
          const isBest = pkg.credits === 500;

          return (
            <div
              key={pkg.id}
              className={`bg-white rounded-[28px] border p-6 flex flex-col gap-4 relative transition-all hover:shadow-lg ${
                isBest ? 'border-indigo-300 shadow-lg shadow-indigo-50 ring-2 ring-indigo-400' : 'border-slate-100'
              }`}
            >
              {isBest && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow">
                  Mejor valor
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">{pkg.credits}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">créditos</p>
                </div>
              </div>

              <div>
                <p className="text-3xl font-black text-slate-900">{format(pkg.priceUSD)}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                  {format(pricePerCredit)} por crédito · ~{Math.floor(pkg.credits / 2)}–{pkg.credits} imágenes
                </p>
              </div>

              <button
                onClick={() => handleBuy(pkg.id)}
                className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isBest
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                    : 'bg-slate-900 text-white hover:bg-slate-700'
                }`}
              >
                Comprar ahora
              </button>
            </div>
          );
        })}
      </div>

      {/* Referencia de costos */}
      <div className="bg-slate-50 rounded-[28px] border border-slate-100 p-8 space-y-4">
        <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tighter">¿Cuánto me alcanza?</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'AI Generator', cost: '1–2 cr.', note: 'según modelo', icon: 'fa-wand-magic-sparkles' },
            { label: 'Scene Clone',  cost: '1–2 cr.', note: 'según modelo', icon: 'fa-clone' },
            { label: 'Content Studio (sesión)', cost: '7–14 cr.', note: 'según modelo', icon: 'fa-mobile-screen-button' },
            { label: 'Model DNA',    cost: '8 cr.',   note: 'solo Gemini',  icon: 'fa-dna' },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 text-center space-y-1">
              <i className={`fa-solid ${item.icon} text-indigo-500 text-lg`}></i>
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight leading-tight">{item.label}</p>
              <p className="text-xs font-black text-slate-600">{item.cost}</p>
              <p className="text-[9px] font-medium text-slate-400">{item.note}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
