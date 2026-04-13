import React from 'react';
import { AvatarProfile, ProductProfile } from '../types';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthContext';
import { Zap, TrendingUp, User, Package, AlertCircle, Crown, ArrowRight } from 'lucide-react';

// ──────────────────────────────────────────
// MÓDULOS AGRUPADOS — nuevos nombres
// ──────────────────────────────────────────
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
        path: '/prompt-library',
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
  avatars: AvatarProfile[];
  products: ProductProfile[];
}

const Dashboard: React.FC<DashboardProps> = ({ avatars, products }) => {
  const navigate = useNavigate();
  const { profile, credits, stats, isAdmin } = useAuth();

  const displayName = profile?.displayName?.split(' ')[0] || 'Creador';
  const isOutOfCredits = !isAdmin && credits.available === 0;
  const isLowCredits   = !isAdmin && credits.available > 0 && credits.available <= 3;

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24 max-w-full overflow-hidden">

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
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Crown className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
            {isAdmin ? 'Admin' : (credits.plan.charAt(0).toUpperCase() + credits.plan.slice(1))}
          </span>
        </div>
      </header>

      {/* ALERTS */}
      {isOutOfCredits && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-2xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="text-xs font-black uppercase tracking-tight">Sin créditos disponibles</p>
            <p className="text-xs font-bold text-rose-500 uppercase tracking-widest">Suscríbete para continuar generando</p>
          </div>
        </div>
      )}
      {isLowCredits && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-700 px-5 py-4 rounded-2xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-black uppercase tracking-tight">
            Te queda{credits.available > 1 ? 'n' : ''} {credits.available} crédito{credits.available > 1 ? 's' : ''} — considera suscribirte
          </p>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Zap className="w-4 h-4 text-indigo-500" />, label: 'Créditos', value: isAdmin ? '∞' : String(credits.available), sub: 'disponibles' },
          { icon: <TrendingUp className="w-4 h-4 text-emerald-500" />, label: 'Generaciones', value: String(stats.totalGenerations), sub: 'totales' },
          { icon: <User className="w-4 h-4 text-purple-500" />, label: 'Modelos', value: String(avatars.length), sub: 'guardados' },
          { icon: <Package className="w-4 h-4 text-blue-500" />, label: 'Productos', value: String(products.length), sub: 'en catálogo' },
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

      {/* MODULE GROUPS */}
      {MODULE_GROUPS.map(group => (
        <div key={group.groupLabel} className="space-y-4">

          {/* GROUP LABEL */}
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-5 ${group.groupColor} rounded-full`} />
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">{group.groupLabel}</h2>
          </div>

          {/* CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {group.modules.map((mod, i) => (
              <div
                key={i}
                onClick={() => navigate(mod.path)}
                className="group bg-white p-4 md:p-7 rounded-2xl md:rounded-[36px] border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden flex md:block items-center gap-4 md:gap-0"
              >
                {/* ICON */}
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-[20px] ${mod.bg} flex-shrink-0 flex items-center justify-center text-lg md:text-xl md:mb-5 transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                  <i className={`fa-solid ${mod.icon} ${mod.accent}`}></i>
                </div>

                {/* TEXT */}
                <div className="flex-1 space-y-0.5 md:space-y-1 md:mb-4 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="text-base md:text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight md:leading-none md:truncate">{mod.title}</h3>
                    {mod.subtitle && (
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest md:truncate">{mod.subtitle}</span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-500 leading-tight md:leading-relaxed line-clamp-2 md:line-clamp-none">{mod.description}</p>
                  
                  {/* CREDIT COST MOBILE */}
                  {mod.credits > 0 && (
                    <div className="flex md:hidden items-center gap-1 mt-1">
                      <Zap className="w-2.5 h-2.5 text-indigo-400" />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                        {mod.credits} crédito{mod.credits > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* CREDIT COST DESKTOP */}
                {mod.credits > 0 && (
                  <div className="hidden md:flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-indigo-400" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                      {mod.credits} crédito{mod.credits > 1 ? 's' : ''} por imagen
                    </span>
                  </div>
                )}

                {/* ARROW */}
                <div className="hidden md:flex absolute top-7 right-7 w-9 h-9 rounded-full border border-slate-100 items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all">
                  <ArrowRight size={14} className="-rotate-45 group-hover:rotate-0 transition-transform" />
                </div>
                
                {/* MOBILE ARROW */}
                <div className="md:hidden text-slate-300">
                  <ArrowRight size={16} />
                </div>
              </div>
            ))}
          </div>

        </div>
      ))}

    </div>
  );
};

export default Dashboard;