// src/components/shared/WalletPill.tsx
import React from 'react';
import { Zap, TrendingUp, ShoppingBag, Crown } from 'lucide-react';
import { useAuth } from '../../modules/auth/AuthContext';
import { useNavigate } from 'react-router-dom';

interface WalletPillProps {
  showPlanButton?: boolean;
  className?: string;
}

export const WalletPill: React.FC<WalletPillProps> = ({
  showPlanButton = true,
  className = '',
}) => {
  const { credits, isAdmin, previewPlan, setPreviewPlan } = useAuth();
  const navigate = useNavigate();
  const [showPlanMenu, setShowPlanMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Cerrar menú al hacer clic fuera
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPlanMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getPlanLabel = (plan: string): string => {
    const labels: Record<string, string> = {
      free: 'Free',
      starter: 'Starter',
      pro: 'Pro',
      studio: 'Studio',
      admin: 'Admin',
    };
    return labels[plan] || plan;
  };

  const getPlanColor = (plan: string): string => {
    const colors: Record<string, string> = {
      free: 'bg-slate-100 text-slate-600',
      starter: 'bg-blue-100 text-blue-600',
      pro: 'bg-indigo-100 text-indigo-600',
      studio: 'bg-violet-100 text-violet-600',
      admin: 'bg-rose-100 text-rose-600',
    };
    return colors[plan] || 'bg-slate-100 text-slate-600';
  };

  const handlePlanClick = (plan: string) => {
    if (isAdmin) {
      setPreviewPlan?.(plan === previewPlan ? null : plan);
    } else {
      navigate('/pricing');
    }
    setShowPlanMenu(false);
  };

  const currentPlanLabel = getPlanLabel(credits.plan);
  const currentPlanColor = getPlanColor(credits.plan);
  const isPreviewing = isAdmin && previewPlan !== null;

  return (
    <div className={`relative flex items-center gap-3 ${className}`}>
      {/* SALDO */}
      <div
        className="flex items-center gap-2 bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-2 rounded-full shadow-lg border border-white/10 hover:shadow-xl transition-all cursor-default"
        title="Créditos disponibles"
      >
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-bold">{credits.available}</span>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          créditos
        </span>
      </div>

      {/* PLAN BUTTON (suscribirse / cambiar plan) */}
      {showPlanButton && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowPlanMenu(!showPlanMenu)}
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
              isPreviewing
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                : `${currentPlanColor} hover:opacity-80`
            }`}
          >
            {isPreviewing ? (
              <>
                <Crown className="w-3.5 h-3.5" />
                <span>Vista previa: {getPlanLabel(previewPlan)}</span>
                <span className="text-[9px] opacity-70">(Admin)</span>
              </>
            ) : (
              <>
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{currentPlanLabel}</span>
              </>
            )}
          </button>

          {showPlanMenu && isAdmin && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 min-w-[180px] animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2 border-b border-slate-100 bg-slate-50">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Vista previa (admin)
                </p>
              </div>
              {['free', 'starter', 'pro', 'studio'].map(plan => (
                <button
                  key={plan}
                  onClick={() => handlePlanClick(plan)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold uppercase tracking-wider transition-colors ${
                    previewPlan === plan
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{getPlanLabel(plan)}</span>
                  {previewPlan === plan && (
                    <span className="text-[9px] font-black text-indigo-500">✓</span>
                  )}
                </button>
              ))}
              <button
                onClick={() => handlePlanClick('admin')}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-t border-slate-100 text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <span>Admin (ilimitado)</span>
                {previewPlan === 'admin' && (
                  <span className="text-[9px] font-black text-rose-500">✓</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};