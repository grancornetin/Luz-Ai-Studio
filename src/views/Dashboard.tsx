/**
 * Dashboard.tsx — UPDATED
 * Punto 5: Añade Prompt Gallery e Historial como cards visibles
 * en el dashboard principal, no solo en el menú lateral.
 */
import React, { useState, useEffect } from 'react';
import { AvatarProfile, ProductProfile } from '../../types';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthContext';
import {
  Zap, TrendingUp, User, Package, AlertCircle,
  Crown, ArrowRight, Sparkles, Clock, Images,
  Settings, FileText, Mail, CreditCard, UserCircle, Gift, ShoppingCart, Tag, LogOut
} from 'lucide-react';
import { MISSIONS, getUserMissions, completeMission, isMissionOnCooldown, type UserMissions } from '../services/missionsService';
import { getReferralStats, redeemSpecialCode } from '../services/referralService';
import { useModelSelection } from '../hooks/useModelSelection';

// creditsGemini: costo con Nano Banana 2 | creditsSeedream: costo con Seedream
// null = precio fijo (no varía con el modelo) | 0 = gratis
const MODULE_GROUPS = [
  {
    groupLabel: 'Crear modelo digital',
    groupColor: 'bg-indigo-600',
    modules: [
      {
        path: '/crear/clonar',
        title: 'Crear modelo',
        subtitle: 'desde fotos',
        description: 'Extrae el ADN biométrico de fotos reales para crear un modelo digital fiel.',
        icon: 'fa-camera',
        accent: 'text-indigo-600',
        bg: 'bg-indigo-50',
        creditsGemini: 8,    // 4 imágenes × 2 cr — siempre Gemini
        creditsSeedream: null, // no aplica — solo Gemini
      },
      {
        path: '/crear/manual',
        title: 'Crear modelo',
        subtitle: 'desde cero',
        description: 'Diseña una identidad digital 100% nueva configurando cada rasgo.',
        icon: 'fa-sliders',
        accent: 'text-violet-600',
        bg: 'bg-violet-50',
        creditsGemini: 8,
        creditsSeedream: null,
      },
      {
        path: '/modelos',
        title: 'Mis modelos',
        subtitle: 'Avatares guardados',
        description: 'Accede a todos tus modelos creados y úsalos en cualquier módulo.',
        icon: 'fa-user-astronaut',
        accent: 'text-purple-600',
        bg: 'bg-purple-50',
        creditsGemini: 0,
        creditsSeedream: 0,
      },
    ]
  },
  {
    groupLabel: 'Generar contenido',
    groupColor: 'bg-emerald-600',
    modules: [
      {
        path: '/prompt-studio',
        title: 'Generador con IA',
        subtitle: 'Prompt Studio',
        description: 'Crea imágenes con prompts avanzados, campañas y generación masiva.',
        icon: 'fa-wand-magic-sparkles',
        accent: 'text-indigo-600',
        bg: 'bg-indigo-50',
        creditsGemini: 2,
        creditsSeedream: 1,
      },
      {
        path: '/studio-pro',
        title: 'Contenido para redes',
        subtitle: 'UGC & Social',
        description: 'Genera contenido tipo smartphone orgánico con tu modelo e identidad de marca.',
        icon: 'fa-mobile-screen-button',
        accent: 'text-emerald-600',
        bg: 'bg-emerald-50',
        creditsGemini: 4,    // 2 cr × 2 (master + shot)
        creditsSeedream: 2,
      },
      {
        path: '/clonar',
        title: 'Clonar escena',
        subtitle: 'Scene Clone',
        description: 'Replica una fotografía existente inyectando una nueva identidad.',
        icon: 'fa-clone',
        accent: 'text-blue-600',
        bg: 'bg-blue-50',
        creditsGemini: 2,
        creditsSeedream: 1,
      },
    ]
  },
  {
    groupLabel: 'Herramientas',
    groupColor: 'bg-slate-700',
    modules: [
      {
        path: '/outfit-extractor',
        title: 'Extraer prendas',
        subtitle: 'Outfit Extractor',
        description: 'Separa cada prenda de un outfit y genera renders ghost individuales.',
        icon: 'fa-shirt',
        accent: 'text-purple-600',
        bg: 'bg-purple-50',
        creditsGemini: 2,
        creditsSeedream: 1,
      },
      {
        path: '/productos',
        title: 'Foto de producto',
        subtitle: 'Product Studio',
        description: 'Analiza y genera fotografía comercial de tus productos.',
        icon: 'fa-gem',
        accent: 'text-slate-700',
        bg: 'bg-slate-100',
        creditsGemini: 2,
        creditsSeedream: 1,
      },
    ]
  },
];

interface DashboardProps {
  avatars?: AvatarProfile[];
  products?: ProductProfile[];
}

type DashTab = 'home' | 'account' | 'profile' | 'terms' | 'contact';

const NAV_TABS: { id: DashTab; label: string; icon: React.ReactNode; route?: string }[] = [
  { id: 'home',    label: 'Inicio',   icon: <i className="fa-solid fa-house text-xs" /> },
  { id: 'account', label: 'Cuenta',   icon: <CreditCard className="w-3.5 h-3.5" /> },
  { id: 'profile', label: 'Perfil',   icon: <UserCircle className="w-3.5 h-3.5" />, route: '/cuenta' },
  { id: 'terms',   label: 'Términos', icon: <FileText className="w-3.5 h-3.5" />,   route: '/terminos' },
  { id: 'contact', label: 'Contacto', icon: <Mail className="w-3.5 h-3.5" />,       route: '/contacto' },
];

const PREVIEW_PLANS = ['free', 'weekly', 'starter', 'pro', 'studio'] as const;

const Dashboard: React.FC<DashboardProps> = ({ avatars = [], products = [] }) => {
  const navigate = useNavigate();
  const { profile, credits, stats, isAdmin, user, previewPlan, setPreviewPlan, signOut } = useAuth();
  const [activeTab, setActiveTab]     = useState<DashTab>('home');
  const [missions, setMissions]       = useState<UserMissions>({});
  const [completing, setCompleting]   = useState<string | null>(null);
  const [missionMsg, setMissionMsg]   = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [specialCode, setSpecialCode]   = useState('');
  const [codeMsg, setCodeMsg]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [redeemingCode, setRedeemingCode] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      getUserMissions(user.uid).then(setMissions).catch(() => {});
      getReferralStats(user.uid).then(s => {
        setReferralCode(s.code);
        setReferralCount(s.referralCount);
      }).catch(() => {});
    }
  }, [user?.uid]);

  const handleRedeemCode = async () => {
    if (!user?.uid || !specialCode.trim() || redeemingCode) return;
    setRedeemingCode(true);
    setCodeMsg(null);
    const result = await redeemSpecialCode(user.uid, specialCode.trim());
    setCodeMsg({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) setSpecialCode('');
    setRedeemingCode(false);
    setTimeout(() => setCodeMsg(null), 5000);
  };

  const handleCompleteMission = async (missionId: string) => {
    if (!user?.uid || completing) return;
    setCompleting(missionId);
    const result = await completeMission(user.uid, missionId);
    setMissionMsg(result.message || null);
    if (result.success) getUserMissions(user.uid).then(setMissions).catch(() => {});
    setCompleting(null);
    setTimeout(() => setMissionMsg(null), 3000);
  };

  const { modelId } = useModelSelection();
  const displayName      = profile?.displayName?.split(' ')[0] || 'Creador';
  const availableCredits = credits?.available || 0;
  const planName         = credits?.plan || 'free';
  const totalGens        = stats?.totalGenerations || 0;
  const isOutOfCredits   = !isAdmin && availableCredits === 0;
  const isLowCredits     = !isAdmin && availableCredits > 0 && availableCredits <= 5;
  const [dismissedLowCredits, setDismissedLowCredits] = useState(
    localStorage.getItem('dismissedLowCredits') === 'true'
  );

  const handleTab = (tab: typeof NAV_TABS[0]) => {
    if (tab.route) { navigate(tab.route); return; }
    setActiveTab(tab.id);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-24 max-w-full overflow-hidden">

      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-1">
        <div>
          <h1 className="t-display text-3xl md:text-5xl text-slate-900 flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span>Hola,</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-indigo-600 break-words pr-1">{displayName}</span>
            <span>👋</span>
          </h1>
          <p className="t-body-sm mt-1">
            Tu ecosistema de producción publicitaria está listo.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate('/pricing')} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-100 rounded-2xl t-meta text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">
            <Tag className="w-3.5 h-3.5" /> Planes
          </button>
          <button onClick={() => navigate('/buy-credits')} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-2xl t-meta hover:bg-indigo-700 transition-all shadow-sm">
            <ShoppingCart className="w-3.5 h-3.5" /> Recargar
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Crown className="w-4 h-4 text-amber-500" />
            <span className="t-meta text-slate-600">
              {isAdmin ? 'Admin' : (planName.charAt(0).toUpperCase() + planName.slice(1))}
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl t-meta transition-all border border-rose-100"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* NAV TABS */}
      <nav className="flex gap-1 bg-white border border-slate-100 rounded-2xl p-1 shadow-sm overflow-x-auto scrollbar-hide">
        {NAV_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTab(tab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl t-meta whitespace-nowrap transition-all flex-shrink-0 ${
              activeTab === tab.id && !tab.route
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* TAB: PERFIL */}
      {activeTab === 'profile' && (
        <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6 animate-in fade-in">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center overflow-hidden border-2 border-white shadow">
              {profile?.photoURL
                ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                : <User className="w-7 h-7 text-indigo-400" />
              }
            </div>
            <div>
              <p className="t-title text-lg">{profile?.displayName || 'Usuario'}</p>
              <p className="t-body-sm text-slate-400">{profile?.email}</p>
            </div>
          </div>
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-2">
            <Settings className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Edición de perfil</p>
            <p className="text-[10px] text-slate-400">Nombre de usuario, foto, descripción e intereses — disponible próximamente.</p>
          </div>
        </section>
      )}

      {/* TAB: CUENTA — créditos + stats + misiones + planes */}
      {activeTab === 'account' && (
        <section className="space-y-6 animate-in fade-in">

          {/* Créditos y plan */}
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-indigo-500" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Suscripción y créditos</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plan</p>
                <p className="text-lg font-black text-slate-800 uppercase">{isAdmin ? 'Admin' : planName}</p>
              </div>
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-1">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Créditos</p>
                <p className="text-2xl font-black text-indigo-700">{isAdmin ? '∞' : availableCredits}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Generaciones</p>
                <p className="text-2xl font-black text-slate-700">{stats?.totalGenerations || 0}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Modelos</p>
                <p className="text-2xl font-black text-slate-700">{stats?.totalAvatars || 0}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/pricing')}
                className="py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                <Tag className="w-3.5 h-3.5" /> Mejorar plan
              </button>
              <button
                onClick={() => navigate('/buy-credits')}
                className="py-3.5 bg-white border border-indigo-200 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-3.5 h-3.5" /> Recargar créditos
              </button>
            </div>

            {/* Admin: simular plan */}
            {isAdmin && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Admin — Simular plan</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setPreviewPlan(null)}
                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${!previewPlan ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    Admin (real)
                  </button>
                  {PREVIEW_PLANS.map(p => (
                    <button key={p} onClick={() => setPreviewPlan(previewPlan === p ? null : p)}
                      className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${previewPlan === p ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {p}
                    </button>
                  ))}
                </div>
                {previewPlan && (
                  <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Simulando: {previewPlan.toUpperCase()}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Misiones integradas en Cuenta */}
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5 text-indigo-500" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Misiones · Gana créditos gratis</h2>
            </div>

            {missionMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest animate-in fade-in">
                ✓ {missionMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MISSIONS.map(m => {
                const status     = missions[m.id] || { completed: false, count: 0 };
                const maxed      = status.count >= m.maxCompletions;
                const onCooldown = isMissionOnCooldown(status, m);
                const isLoading  = completing === m.id;
                const blocked    = maxed || onCooldown;
                const iconClass  = m.icon.startsWith('fa-brands') ? m.icon : `fa-solid ${m.icon}`;
                let btnLabel = 'Completar';
                if (maxed) btnLabel = '✓ Hecho';
                else if (onCooldown) btnLabel = 'Mañana';
                else if (isLoading) btnLabel = '...';

                return (
                  <div key={m.id} className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                    maxed ? 'border-emerald-100 bg-emerald-50/40'
                    : onCooldown ? 'border-slate-100 opacity-60'
                    : 'border-slate-100 hover:border-indigo-200'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${maxed ? 'bg-emerald-100' : 'bg-indigo-50'}`}>
                      <i className={`${iconClass} text-sm ${maxed ? 'text-emerald-500' : 'text-indigo-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{m.label}</p>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${maxed ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>+{m.credits} cr</span>
                      </div>
                      <p className="text-[9px] text-slate-400">{m.description}</p>
                      {m.repeatable && m.maxCompletions > 1 && (
                        <p className="text-[8px] text-slate-300 font-bold uppercase">{status.count}/{m.maxCompletions}</p>
                      )}
                    </div>
                    <button
                      onClick={() => !blocked && handleCompleteMission(m.id)}
                      disabled={blocked || isLoading}
                      className={`flex-shrink-0 px-2.5 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                        maxed ? 'bg-emerald-100 text-emerald-500 cursor-default'
                        : onCooldown ? 'bg-slate-100 text-slate-400 cursor-default'
                        : isLoading ? 'bg-slate-100 text-slate-400 cursor-wait'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >{btnLabel}</button>
                  </div>
                );
              })}
            </div>

            {/* Referidos */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Tu código de referido</p>
                  <p className="text-[9px] text-slate-400">+10 cr por cada amigo que genere · Máx 5 ({referralCount}/5)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2">
                  <p className="text-xs font-black text-slate-700 tracking-widest select-all">{referralCode || '...'}</p>
                </div>
                <button
                  onClick={() => referralCode && navigator.clipboard.writeText(referralCode)}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                >Copiar</button>
              </div>
            </div>

            {/* Código especial */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-amber-500" /> Canjear código especial
              </p>
              {codeMsg && (
                <div className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest animate-in fade-in ${
                  codeMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'
                }`}>
                  {codeMsg.type === 'success' ? '✓' : '✗'} {codeMsg.text}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text" value={specialCode}
                  onChange={e => setSpecialCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleRedeemCode()}
                  placeholder="Ej: LAUNCH2025" maxLength={20}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-800 uppercase tracking-widest outline-none focus:border-amber-400 transition-all placeholder:text-slate-300 placeholder:font-medium placeholder:normal-case placeholder:tracking-normal"
                />
                <button onClick={handleRedeemCode} disabled={redeemingCode || !specialCode.trim()}
                  className="px-3 py-2.5 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 disabled:opacity-40 transition-all">
                  {redeemingCode ? '...' : 'Canjear'}
                </button>
              </div>
            </div>
          </div>

        </section>
      )}

      {/* TAB: CONFIGURACIÓN — redirige a AccountSettings */}
      {activeTab === 'settings' && (
        <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6 animate-in fade-in">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-5 h-5 text-slate-500" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Configuración</h2>
          </div>
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-2">
            <Settings className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Preferencias</p>
            <p className="text-[10px] text-slate-400">Cambiar email, contraseña, idioma y notificaciones — disponible próximamente.</p>
          </div>
        </section>
      )}

      {/* HOME TAB CONTENT */}
      {activeTab === 'home' && (<>

      {/* ALERTS */}
      {isOutOfCredits && (
        <div className="flex items-center justify-between gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-xs font-black uppercase tracking-tight">Sin créditos disponibles</p>
              <p className="text-xs font-bold text-rose-500 mt-0.5">Recarga créditos o suscríbete para continuar generando.</p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => navigate('/buy-credits')} className="px-3 py-2 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all">Recargar</button>
            <button onClick={() => navigate('/pricing')} className="px-3 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all">Planes</button>
          </div>
        </div>
      )}
      {isLowCredits && !dismissedLowCredits && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-700 px-5 py-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-xs font-black uppercase tracking-tight">Te quedan pocos créditos</p>
              <p className="text-xs font-bold text-amber-600 mt-0.5">
                Te queda{availableCredits > 1 ? 'n' : ''} {availableCredits} crédito{availableCredits > 1 ? 's' : ''} — completa misiones o compra más.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => navigate('/pricing')} className="px-3 py-2 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all">Comprar</button>
            <button
              onClick={() => { localStorage.setItem('dismissedLowCredits', 'true'); setDismissedLowCredits(true); }}
              className="text-amber-400 hover:text-amber-600 transition-colors p-1"
              title="Cerrar"
            >✕</button>
          </div>
        </div>
      )}

      {/* ── HERO: greeting card + gradient credit card ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Greeting + CTA */}
        <div className="bg-white border border-slate-100 rounded-[28px] p-6 md:p-8 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Buenos días,</p>
            <h2 className="t-display text-3xl md:text-4xl text-slate-900">{displayName}</h2>
          </div>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Tu ecosistema de producción publicitaria está listo.
            {totalGens > 0 && <> Has generado <strong className="text-slate-700">{totalGens} imágenes</strong> en total.</>}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => navigate('/studio-pro')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-pink-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-violet-200/60 hover:shadow-violet-300/60 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" /> Crear contenido
            </button>
            <button
              onClick={() => navigate('/prompt-gallery')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
            >
              Ver inspiración →
            </button>
          </div>
        </div>

        {/* Gradient credit card */}
        <div className="relative bg-gradient-to-br from-violet-600 to-pink-600 rounded-[28px] p-6 md:p-8 text-white overflow-hidden shadow-xl shadow-violet-200/60">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1 relative">Saldo · {isAdmin ? 'Admin' : (planName.charAt(0).toUpperCase() + planName.slice(1))}</p>
          <div className="flex items-baseline gap-3 relative">
            <span className="text-5xl md:text-6xl font-black tracking-tighter leading-none">{isAdmin ? '∞' : availableCredits}</span>
            <span className="text-sm opacity-85">créditos</span>
          </div>
          {!isAdmin && (
            <p className="text-xs opacity-80 mt-1 relative">~{Math.floor(availableCredits / 2)} imágenes posibles</p>
          )}
          {!isAdmin && (
            <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, (availableCredits / 100) * 100)}%` }}
              />
            </div>
          )}
          <div className="flex items-center justify-between mt-4 relative">
            <span className="text-[10px] opacity-75">
              {isAdmin ? 'Acceso ilimitado' : `Plan ${planName}`}
            </span>
            <button
              onClick={() => navigate('/pricing')}
              className="px-3 py-1.5 bg-white text-violet-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-violet-50 transition-all"
            >
              Ver planes
            </button>
          </div>
        </div>
      </div>

      {/* ── STATS (monthly) ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Generaciones', value: String(totalGens), sub: 'totales', color: 'text-slate-900' },
          { label: 'Modelos',      value: String(avatars?.length || 0), sub: 'guardados', color: 'text-purple-600' },
          { label: 'Productos',    value: String(products?.length || 0), sub: 'en catálogo', color: 'text-blue-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white px-4 py-4 rounded-2xl border border-slate-100 shadow-sm space-y-0.5">
            <p className="t-meta text-slate-400">{s.label}</p>
            <p className={`text-2xl font-black ${s.color} tracking-tight`}>{s.value}</p>
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── QUICK ACTIONS 2×2 ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-5 bg-violet-600 rounded-full" />
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">¿Qué necesitas crear?</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { t: 'Modelo digital',   s: 'Desde tus fotos',   cost: '8 cr',     accent: 'text-violet-600', bg: 'bg-violet-50',  path: '/crear/clonar' },
            { t: 'Contenido UGC',    s: 'Estilo iPhone',     cost: '12-28 cr', accent: 'text-pink-600',   bg: 'bg-pink-50',    path: '/studio-pro'   },
            { t: 'Foto de producto', s: '5 ángulos pro',     cost: '2 cr/foto',accent: 'text-indigo-600', bg: 'bg-indigo-50',  path: '/productos'    },
            { t: 'Clonar escena',    s: 'Tu cara aquí',      cost: '2 cr',     accent: 'text-emerald-600',bg: 'bg-emerald-50', path: '/clonar'       },
          ].map(a => (
            <button
              key={a.t}
              onClick={() => navigate(a.path)}
              className="bg-white border border-slate-100 rounded-[20px] p-4 text-left hover:shadow-md hover:border-slate-200 transition-all group"
            >
              <div className={`w-8 h-8 rounded-xl ${a.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <Sparkles className={`w-4 h-4 ${a.accent}`} />
              </div>
              <p className="text-sm font-bold text-slate-800 leading-tight">{a.t}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{a.s}</p>
              <p className={`text-[10px] font-black mt-2 ${a.accent}`}>{a.cost}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── QUICK ACCESS: Gallery + History ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-5 bg-indigo-600 rounded-full" />
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Acceso Rápido</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* PROMPT GALLERY CARD */}
          <div
            onClick={() => navigate('/prompt-gallery')}
            className="group relative bg-gradient-to-br from-indigo-600 to-violet-600 p-6 md:p-8 rounded-[32px] cursor-pointer hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-200 transition-all overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="t-display text-lg text-white">Prompt Gallery</h3>
                    <p className="t-meta text-indigo-200">Comunidad</p>
                  </div>
                </div>
                <p className="text-sm text-indigo-100 font-medium leading-relaxed max-w-xs">
                  Explora, guarda y publica prompts con la comunidad.
                </p>
              </div>
              <div className="w-9 h-9 rounded-full border border-white/30 flex items-center justify-center text-white/60 group-hover:bg-white group-hover:text-indigo-600 transition-all flex-shrink-0 mt-1">
                <ArrowRight size={16} className="-rotate-45 group-hover:rotate-0 transition-transform" />
              </div>
            </div>
          </div>

          {/* GENERATION HISTORY CARD */}
          <div
            onClick={() => navigate('/historial')}
            className="group relative bg-white border border-slate-100 p-6 md:p-8 rounded-[32px] cursor-pointer hover:scale-[1.02] hover:shadow-xl hover:border-slate-200 transition-all overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -translate-y-1/2 translate-x-1/2" />

            <div className="relative z-10 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="t-display text-lg text-slate-900">Mis Generaciones</h3>
                    <p className="t-meta">Historial</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-xs">
                  Todas las imágenes generadas. Descarga, filtra y gestiona tu trabajo.
                </p>
                {totalGens > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Images className="w-3.5 h-3.5 text-slate-400" />
                    <span className="t-meta">{totalGens} generacion{totalGens !== 1 ? 'es' : ''} totales</span>
                  </div>
                )}
              </div>
              <div className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all flex-shrink-0 mt-1">
                <ArrowRight size={16} className="-rotate-45 group-hover:rotate-0 transition-transform" />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* MODULE GROUPS */}
      {MODULE_GROUPS.map(group => (
        <div key={group.groupLabel} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-5 ${group.groupColor} rounded-full`} />
            <h2 className="t-meta text-slate-500">{group.groupLabel}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {group.modules.map((mod, i) => (
              <div
                key={i}
                onClick={() => navigate(mod.path)}
                className="group bg-white p-4 md:p-7 rounded-2xl md:rounded-[36px] border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden flex md:block items-center gap-4 md:gap-0"
              >
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-[20px] ${mod.bg} flex-shrink-0 flex items-center justify-center text-lg md:text-xl md:mb-5 transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                  <i className={`fa-solid ${mod.icon} ${mod.accent}`}></i>
                </div>
                <div className="flex-1 space-y-0.5 md:space-y-1 md:mb-4 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="t-title text-base md:text-lg">{mod.title}</h3>
                    {mod.subtitle && (
                      <span className="t-meta">{mod.subtitle}</span>
                    )}
                  </div>
                  <p className="t-body-sm leading-tight md:leading-relaxed line-clamp-2 md:line-clamp-none">{mod.description}</p>
                  {mod.creditsGemini > 0 && (() => {
                    const cost = mod.creditsSeedream !== null
                      ? (modelId === 'seedream' ? mod.creditsSeedream : mod.creditsGemini)
                      : mod.creditsGemini;
                    return (
                      <div className="flex md:hidden items-center gap-1 mt-1">
                        <Zap className="w-2.5 h-2.5 text-amber-400" />
                        <span className="t-meta text-amber-500">{cost} cr.</span>
                      </div>
                    );
                  })()}
                </div>
                {mod.creditsGemini > 0 && (() => {
                  const cost = mod.creditsSeedream !== null
                    ? (modelId === 'seedream' ? mod.creditsSeedream : mod.creditsGemini)
                    : mod.creditsGemini;
                  const hasRange = mod.creditsSeedream !== null && mod.creditsSeedream !== mod.creditsGemini;
                  return (
                    <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span className="t-meta whitespace-nowrap">
                        {hasRange
                          ? `${cost} cr. · desde ${mod.creditsSeedream} con Seedream`
                          : `${cost} cr. · solo Gemini`}
                      </span>
                    </div>
                  );
                })()}
                <div className="hidden md:flex absolute top-7 right-7 w-9 h-9 rounded-full border border-slate-100 items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all">
                  <ArrowRight size={14} className="-rotate-45 group-hover:rotate-0 transition-transform" />
                </div>
                <div className="md:hidden text-slate-300">
                  <ArrowRight size={16} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      </>)}
    </div>
  );
};

export default Dashboard;