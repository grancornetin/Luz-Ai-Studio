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
  Settings, FileText, Mail, CreditCard, UserCircle, Gift, ShoppingCart, Tag
} from 'lucide-react';
import { MISSIONS, getUserMissions, completeMission, type UserMissions } from '../services/missionsService';

const MODULE_GROUPS = [
  {
    groupLabel: 'Crear Identidad',
    groupColor: 'bg-indigo-600',
    modules: [
      {
        path: '/crear/clonar',
        title: 'Model DNA',
        subtitle: 'From Photos',
        description: 'Extrae el ADN biométrico de fotos reales para crear un modelo digital fiel.',
        icon: 'fa-camera',
        accent: 'text-indigo-600',
        bg: 'bg-indigo-50',
        credits: 4,
      },
      {
        path: '/crear/manual',
        title: 'Model DNA',
        subtitle: 'From Scratch',
        description: 'Diseña una identidad digital 100% nueva configurando cada rasgo.',
        icon: 'fa-sliders',
        accent: 'text-violet-600',
        bg: 'bg-violet-50',
        credits: 4,
      },
      {
        path: '/modelos',
        title: 'Biblioteca',
        subtitle: 'Modelos guardados',
        description: 'Accede a todos tus modelos creados y úsalos en cualquier módulo.',
        icon: 'fa-user-astronaut',
        accent: 'text-purple-600',
        bg: 'bg-purple-50',
        credits: 0,
      },
    ]
  },
  {
    groupLabel: 'Generar Contenido',
    groupColor: 'bg-emerald-600',
    modules: [
      {
        path: '/prompt-studio',
        title: 'AI Generator',
        subtitle: 'Prompt Studio',
        description: 'Crea imágenes con prompts avanzados, campañas y generación masiva.',
        icon: 'fa-wand-magic-sparkles',
        accent: 'text-indigo-600',
        bg: 'bg-indigo-50',
        credits: 2,
      },
      {
        path: '/studio-pro',
        title: 'Content Studio',
        subtitle: 'UGC & Social',
        description: 'Genera contenido tipo iPhone orgánico con tu modelo e identidad de marca.',
        icon: 'fa-mobile-screen-button',
        accent: 'text-emerald-600',
        bg: 'bg-emerald-50',
        credits: 4,
      },
      {
        path: '/clonar',
        title: 'Scene Clone',
        subtitle: 'Clonar escena',
        description: 'Replica una fotografía existente inyectando una nueva identidad.',
        icon: 'fa-clone',
        accent: 'text-blue-600',
        bg: 'bg-blue-50',
        credits: 4,
      },
    ]
  },
  {
    groupLabel: 'Herramientas',
    groupColor: 'bg-slate-700',
    modules: [
      {
        path: '/outfit-extractor',
        title: 'Outfit Kit',
        subtitle: 'Extractor de prendas',
        description: 'Separa cada prenda de un outfit y genera renders ghost individuales.',
        icon: 'fa-shirt',
        accent: 'text-purple-600',
        bg: 'bg-purple-50',
        credits: 1,
      },
      {
        path: '/productos',
        title: 'Catálogo',
        subtitle: 'Product shots',
        description: 'Analiza y genera fotografía comercial de tus productos.',
        icon: 'fa-gem',
        accent: 'text-slate-700',
        bg: 'bg-slate-100',
        credits: 1,
      },
    ]
  },
];

interface DashboardProps {
  avatars?: AvatarProfile[];
  products?: ProductProfile[];
}

type DashTab = 'home' | 'missions' | 'profile' | 'account' | 'settings' | 'terms' | 'contact';

const NAV_TABS: { id: DashTab; label: string; icon: React.ReactNode; route?: string }[] = [
  { id: 'home',     label: 'Inicio',        icon: <i className="fa-solid fa-house text-xs" /> },
  { id: 'missions', label: 'Misiones',      icon: <Gift className="w-3.5 h-3.5" /> },
  { id: 'profile',  label: 'Perfil',        icon: <UserCircle className="w-3.5 h-3.5" /> },
  { id: 'account',  label: 'Cuenta',        icon: <CreditCard className="w-3.5 h-3.5" /> },
  { id: 'settings', label: 'Configuración', icon: <Settings className="w-3.5 h-3.5" /> },
  { id: 'terms',    label: 'Términos',      icon: <FileText className="w-3.5 h-3.5" />,  route: '/terminos' },
  { id: 'contact',  label: 'Contacto',      icon: <Mail className="w-3.5 h-3.5" />,      route: '/descargo' },
];

const Dashboard: React.FC<DashboardProps> = ({ avatars = [], products = [] }) => {
  const navigate = useNavigate();
  const { profile, credits, stats, isAdmin, user } = useAuth();
  const [activeTab, setActiveTab]     = useState<DashTab>('home');
  const [missions, setMissions]       = useState<UserMissions>({});
  const [completing, setCompleting]   = useState<string | null>(null);
  const [missionMsg, setMissionMsg]   = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) getUserMissions(user.uid).then(setMissions).catch(() => {});
  }, [user?.uid]);

  const handleCompleteMission = async (missionId: string) => {
    if (!user?.uid || completing) return;
    setCompleting(missionId);
    const result = await completeMission(user.uid, missionId);
    setMissionMsg(result.message || null);
    if (result.success) getUserMissions(user.uid).then(setMissions).catch(() => {});
    setCompleting(null);
    setTimeout(() => setMissionMsg(null), 3000);
  };

  const displayName      = profile?.displayName?.split(' ')[0] || 'Creador';
  const availableCredits = credits?.available || 0;
  const planName         = credits?.plan || 'free';
  const totalGens        = stats?.totalGenerations || 0;
  const isOutOfCredits   = !isAdmin && availableCredits === 0;
  const isLowCredits     = !isAdmin && availableCredits > 0 && availableCredits <= 3;

  const handleTab = (tab: typeof NAV_TABS[0]) => {
    if (tab.route) { navigate(tab.route); return; }
    setActiveTab(tab.id);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-24 max-w-full overflow-hidden">

      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-1">
        <div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-tight">
            Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-indigo-600">{displayName}</span> 👋
          </h1>
          <p className="text-slate-500 font-medium italic mt-1 text-xs md:text-base">
            Tu ecosistema de producción publicitaria está listo.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate('/pricing')} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">
            <Tag className="w-3.5 h-3.5" /> Planes
          </button>
          <button onClick={() => navigate('/buy-credits')} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-sm">
            <ShoppingCart className="w-3.5 h-3.5" /> Recargar
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Crown className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
              {isAdmin ? 'Admin' : (planName.charAt(0).toUpperCase() + planName.slice(1))}
            </span>
          </div>
        </div>
      </header>

      {/* NAV TABS */}
      <nav className="flex gap-1 bg-white border border-slate-100 rounded-2xl p-1 shadow-sm overflow-x-auto scrollbar-hide">
        {NAV_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTab(tab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex-shrink-0 ${
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
              <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{profile?.displayName || 'Usuario'}</p>
              <p className="text-xs text-slate-400 font-medium">{profile?.email}</p>
            </div>
          </div>
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-2">
            <Settings className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Edición de perfil</p>
            <p className="text-[10px] text-slate-400">Nombre de usuario, foto, descripción e intereses — disponible próximamente.</p>
          </div>
        </section>
      )}

      {/* TAB: CUENTA */}
      {activeTab === 'account' && (
        <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6 animate-in fade-in">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-5 h-5 text-indigo-500" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Cuenta y suscripción</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plan actual</p>
              <p className="text-lg font-black text-slate-800 uppercase">{isAdmin ? 'Admin' : planName}</p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-1">
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Créditos</p>
              <p className="text-lg font-black text-indigo-700">{isAdmin ? '∞' : availableCredits}</p>
            </div>
          </div>
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-2">
            <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Gestión de planes</p>
            <p className="text-[10px] text-slate-400">Cambiar plan, recargar créditos y gestionar suscripción — disponible próximamente.</p>
          </div>
          <button
            onClick={() => navigate('/descargo')}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
          >
            Contactar para cambio de plan
          </button>
        </section>
      )}

      {/* TAB: CONFIGURACIÓN */}
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

      {/* TAB: MISIONES */}
      {activeTab === 'missions' && (
        <section className="space-y-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Gift className="w-5 h-5 text-indigo-500" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Misiones · Gana créditos gratis</h2>
          </div>
          {missionMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest animate-in fade-in">
              ✓ {missionMsg}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MISSIONS.map(m => {
              const status   = missions[m.id] || { completed: false, count: 0 };
              const maxed    = status.count >= (m.maxCompletions ?? 1);
              const isLoading = completing === m.id;
              return (
                <div key={m.id} className={`bg-white rounded-[24px] border p-5 flex items-start gap-4 transition-all ${maxed ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 hover:border-indigo-200'}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${maxed ? 'bg-emerald-100' : 'bg-indigo-50'}`}>
                    <i className={`fa-solid ${m.icon} text-lg ${maxed ? 'text-emerald-500' : 'text-indigo-500'}`}></i>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{m.label}</p>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${maxed ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        +{m.credits} créditos
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">{m.description}</p>
                    {m.maxCompletions && m.maxCompletions > 1 && (
                      <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">{status.count}/{m.maxCompletions} completadas</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleCompleteMission(m.id)}
                    disabled={maxed || isLoading}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                      maxed ? 'bg-emerald-100 text-emerald-500 cursor-default' :
                      isLoading ? 'bg-slate-100 text-slate-400 cursor-wait' :
                      'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {maxed ? '✓ Hecho' : isLoading ? '...' : 'Completar'}
                  </button>
                </div>
              );
            })}
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
      {isLowCredits && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-700 px-5 py-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-xs font-black uppercase tracking-tight">
              Te queda{availableCredits > 1 ? 'n' : ''} {availableCredits} crédito{availableCredits > 1 ? 's' : ''} — recarga para no interrumpir tu flujo
            </p>
          </div>
          <button onClick={() => navigate('/buy-credits')} className="flex-shrink-0 px-3 py-2 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all">Recargar</button>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Zap className="w-4 h-4 text-indigo-500" />, label: 'Créditos', value: isAdmin ? '∞' : String(availableCredits), sub: 'disponibles' },
          { icon: <TrendingUp className="w-4 h-4 text-emerald-500" />, label: 'Generaciones', value: String(totalGens), sub: 'totales' },
          { icon: <User className="w-4 h-4 text-purple-500" />, label: 'Modelos', value: String(avatars?.length || 0), sub: 'guardados' },
          { icon: <Package className="w-4 h-4 text-blue-500" />, label: 'Productos', value: String(products?.length || 0), sub: 'en catálogo' },
        ].map((s, i) => (
          <div key={i} className="bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm space-y-1">
            <div className="flex items-center gap-2">
              {s.icon}
              <p className="text-xs font-black uppercase text-slate-400 tracking-widest">{s.label}</p>
            </div>
            <p className="text-2xl font-black text-slate-900 leading-none">{s.value}</p>
            <p className="text-xs font-bold text-slate-400 uppercase">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── QUICK ACCESS: Gallery + History ── */}
      <div className="space-y-4">
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
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase italic tracking-tighter leading-none">
                      Prompt Gallery
                    </h3>
                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">
                      Comunidad
                    </p>
                  </div>
                </div>
                <p className="text-sm text-indigo-100 font-medium leading-relaxed max-w-xs">
                  Explora, guarda y publica prompts con la comunidad. Tableros, likes y comentarios.
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
                    <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter leading-none">
                      Mis Generaciones
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Historial
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-xs">
                  Todas las imágenes que has generado en cada módulo. Descarga, filtra y gestiona tu trabajo.
                </p>
                {totalGens > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Images className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {totalGens} generacion{totalGens !== 1 ? 'es' : ''} totales
                    </span>
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
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">{group.groupLabel}</h2>
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
                    <h3 className="text-base md:text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight md:leading-none">{mod.title}</h3>
                    {mod.subtitle && (
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{mod.subtitle}</span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-500 leading-tight md:leading-relaxed line-clamp-2 md:line-clamp-none">{mod.description}</p>
                  {mod.credits > 0 && (
                    <div className="flex md:hidden items-center gap-1 mt-1">
                      <Zap className="w-2.5 h-2.5 text-indigo-400" />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                        {mod.credits} crédito{mod.credits > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                {mod.credits > 0 && (
                  <div className="hidden md:flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-indigo-400" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                      {mod.credits} crédito{mod.credits > 1 ? 's' : ''} por imagen
                    </span>
                  </div>
                )}
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