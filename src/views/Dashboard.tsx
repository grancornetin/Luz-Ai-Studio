import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, CalendarDays, Camera, Check, CheckCircle2, ChevronDown, ChevronRight,
  Circle, Clapperboard, Copy, Gift, Images, Megaphone, Package, Palette, Shirt, ShoppingBag,
  SlidersHorizontal, Smartphone, Tag, UserRound, Users, WandSparkles, X, Zap,
} from 'lucide-react';
import { useAuth } from '../modules/auth/AuthContext';
import { useBrandProfiles } from '../hooks/useBrandProfiles';
import { generationHistoryService, type GenerationRecord } from '../services/generationHistoryService';
import { MISSIONS, getUserMissions, completeMission, isMissionOnCooldown, type UserMissions } from '../services/missionsService';
import { getReferralStats, redeemSpecialCode } from '../services/referralService';
import DailyInspiration from '../components/DailyInspiration';

type Icon = React.ComponentType<{ className?: string }>;

interface Goal {
  icon: Icon;
  title: string;
  description: string;
  cta: { label: string; path: string };
  links: { label: string; path: string }[];
  featured?: boolean;
}

const GOALS: Goal[] = [
  {
    icon: ShoppingBag,
    title: 'Vender un producto',
    description: 'Fotos de catálogo y campañas listas para publicar.',
    cta: { label: 'Foto de producto', path: '/productos' },
    links: [{ label: 'Campaña publicitaria', path: '/campaign' }, { label: 'Extraer prendas', path: '/outfit-extractor' }],
    featured: true,
  },
  {
    icon: Smartphone,
    title: 'Contenido para redes',
    description: 'Fotos naturales con tu avatar, tu producto y tu estilo.',
    cta: { label: 'Crear para redes', path: '/studio-pro' },
    links: [{ label: 'Clonar escena', path: '/clonar' }, { label: 'Historia en fotos', path: '/photodump' }],
  },
  {
    icon: UserRound,
    title: 'Un avatar digital',
    description: 'Crea la cara de tu marca y úsala en todas tus fotos.',
    cta: { label: 'Crear desde fotos', path: '/crear/clonar' },
    links: [{ label: 'Diseñar desde cero', path: '/crear/manual' }, { label: 'Mis avatares', path: '/modelos' }],
  },
  {
    icon: CalendarDays,
    title: 'Planificar mi semana',
    description: 'Qué publicar cada día, con textos y la herramienta indicada.',
    cta: { label: 'Abrir planificador', path: '/planner' },
    links: [{ label: 'Mis marcas', path: '/mis-marcas' }],
  },
];

interface Tool { icon: Icon; label: string; hint: string; cost: string; path: string }

const TOOL_GROUPS: { label: string; tools: Tool[] }[] = [
  {
    label: 'Avatar digital',
    tools: [
      { icon: Camera, label: 'Crear desde fotos', hint: 'A partir de fotos reales', cost: '8 cr.', path: '/crear/clonar' },
      { icon: SlidersHorizontal, label: 'Diseñar desde cero', hint: 'Sin fotos de nadie', cost: '8 cr.', path: '/crear/manual' },
      { icon: Users, label: 'Mis avatares', hint: 'Tus avatares guardados', cost: '', path: '/modelos' },
    ],
  },
  {
    label: 'Crear contenido',
    tools: [
      { icon: WandSparkles, label: 'Imagen libre', hint: 'Describe lo que quieres', cost: '2 cr.', path: '/prompt-studio' },
      { icon: Smartphone, label: 'Contenido para redes', hint: 'Fotos naturales', cost: '4 cr.', path: '/studio-pro' },
      { icon: Copy, label: 'Clonar escena', hint: 'Recrea el estilo de una foto', cost: '2 cr.', path: '/clonar' },
    ],
  },
  {
    label: 'Vender',
    tools: [
      { icon: Megaphone, label: 'Campañas', hint: 'Imágenes y textos para vender', cost: 'Sesión Pro', path: '/campaign' },
      { icon: Images, label: 'Historia en fotos', hint: 'Series para Instagram', cost: 'Sesión Pro', path: '/photodump' },
      { icon: Package, label: 'Foto de producto', hint: 'Catálogo profesional', cost: '2 cr.', path: '/productos' },
      { icon: Shirt, label: 'Extraer prendas', hint: 'Separa cada prenda', cost: '2 cr.', path: '/outfit-extractor' },
      { icon: CalendarDays, label: 'Planificador', hint: 'Qué publicar cada día', cost: '', path: '/planner' },
      { icon: Palette, label: 'Mis marcas', hint: 'El perfil de tu marca', cost: '', path: '/mis-marcas' },
    ],
  },
  ...(import.meta.env.DEV ? [{
    label: 'Interno',
    tools: [{ icon: Clapperboard, label: 'Director Lab', hint: 'Diagnóstico interno', cost: '', path: '/director-lab' }],
  }] : []),
];

const PREVIEW_PLANS = ['free', 'weekly', 'starter', 'pro', 'studio'] as const;

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const days = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return `Hoy, ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
  if (days === 1) return 'Ayer';
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
};

const SectionTitle: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className="mb-4 flex items-end justify-between gap-3">
    <h2 className="t-display text-lg text-slate-900 md:text-xl">{title}</h2>
    {action}
  </div>
);

const TextLink: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button onClick={onClick} className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-600">
    {children} <ArrowRight className="h-4 w-4" />
  </button>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile, credits, stats, isAdmin, user, proCredits } = useAuth();
  const { profiles: brands } = useBrandProfiles(user?.uid);
  const [recent, setRecent] = useState<GenerationRecord[] | null>(null);
  const [missions, setMissions] = useState<UserMissions>({});
  const [earnOpen, setEarnOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    generationHistoryService.getAll(4)
      .then(r => { if (alive) setRecent(r); })
      .catch(() => { if (alive) setRecent([]); });
    return () => { alive = false; };
  }, [user?.uid]);

  const reloadMissions = () => {
    if (user?.uid) getUserMissions(user.uid).then(setMissions).catch(() => {});
  };
  useEffect(reloadMissions, [user?.uid]);

  const displayName = profile?.displayName?.split(' ')[0] || 'Creador';
  const availableCredits = credits?.available || 0;
  const planName = credits?.plan || 'free';
  const isOutOfCredits = !isAdmin && availableCredits === 0;
  const isLowCredits = !isAdmin && availableCredits > 0 && availableCredits <= 5;

  const hasCreations = (recent?.length ?? 0) > 0 || (stats?.totalGenerations ?? 0) > 0;
  const steps = [
    { done: brands.length > 0, title: 'Crea tu marca', text: 'Así la IA conoce tu estilo y tu público.', cta: 'Crear marca', path: '/mis-marcas' },
    { done: (stats?.totalAvatars ?? 0) > 0, title: 'Crea tu avatar digital', text: 'La cara de tu marca, desde fotos o desde cero.', cta: 'Empezar', path: '/crear/clonar' },
    { done: false, title: 'Tu primera foto', text: 'Prueba con una foto de producto: 2 créditos.', cta: 'Probar', path: '/productos' },
  ];
  const stepsDone = steps.filter(s => s.done).length;
  const nextStep = steps.findIndex(s => !s.done);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-24 animate-in fade-in duration-500 md:space-y-10">

      {/* Estado */}
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="t-display break-words text-3xl text-slate-900 md:text-[2.6rem]">
            Hola, <span className="text-brand-600">{displayName}</span>
          </h1>
          <p className="mt-2 hidden text-sm text-slate-500 md:block">¿Qué quieres crear hoy?</p>
        </div>
        <div className="flex w-full items-center gap-1 rounded-[20px] border border-slate-200 bg-white py-1.5 pl-4 pr-1.5 sm:w-auto">
          <button onClick={() => navigate('/pricing')} className="flex min-h-10 items-baseline gap-1.5 whitespace-nowrap pr-3 text-xs font-semibold text-slate-500" title="Ver planes">
            <b className="text-lg font-black tabular-nums text-slate-900">{isAdmin ? '∞' : availableCredits}</b> créditos
          </button>
          <span className="mr-3 h-6 w-px bg-slate-200" />
          <button onClick={() => navigate('/buy-credits')} className="flex min-h-10 items-baseline gap-1.5 whitespace-nowrap pr-3 text-xs font-semibold text-slate-500">
            <b className="text-lg font-black tabular-nums text-slate-900">{isAdmin ? '∞' : proCredits}</b> sesiones Pro
          </button>
          <button
            onClick={() => navigate('/buy-credits')}
            className={`ml-auto inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-extrabold text-white transition-colors ${isOutOfCredits ? 'bg-brand-600 hover:bg-brand-700' : 'bg-slate-900 hover:bg-slate-700'}`}
          >
            <Zap className="h-4 w-4" /> Recargar
          </button>
        </div>
        {(isOutOfCredits || isLowCredits) && (
          <div className={`flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${isOutOfCredits ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1">
              {isOutOfCredits
                ? 'Te quedaste sin créditos. Recarga o elige un plan para seguir creando.'
                : `Te ${availableCredits === 1 ? 'queda 1 crédito' : `quedan ${availableCredits} créditos`}. Recarga o gana más con misiones.`}
            </span>
            <button onClick={() => navigate('/pricing')} className="inline-flex min-h-10 items-center gap-1 font-bold underline-offset-2 hover:underline">
              Ver planes <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      {/* Retomar / primeros pasos */}
      {recent === null ? (
        <section aria-busy="true">
          <SectionTitle title="Retoma donde quedaste" />
          <div className="-mx-4 flex gap-3 overflow-x-hidden px-4 md:mx-0 md:grid md:grid-cols-4 md:px-0">
            {[0, 1, 2, 3].map(i => <div key={i} className="aspect-[4/5] w-[58%] shrink-0 animate-pulse rounded-[20px] bg-slate-200/70 md:w-auto" />)}
          </div>
        </section>
      ) : hasCreations && recent.length > 0 ? (
        <section>
          <SectionTitle title="Retoma donde quedaste" action={<TextLink onClick={() => navigate('/historial')}>Ver historial</TextLink>} />
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0">
            {recent.map(r => (
              <button
                key={r.id}
                onClick={() => navigate('/historial')}
                className="group w-[58%] shrink-0 snap-start overflow-hidden rounded-[20px] border border-slate-200 bg-white text-left transition-shadow hover:shadow-lg md:w-auto"
              >
                <div className="relative aspect-[4/5] bg-slate-100">
                  <img src={r.imageUrl} alt={r.moduleLabel} loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute left-2.5 top-2.5 max-w-[85%] truncate rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-900">
                    {r.moduleLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span className="text-xs text-slate-500">{formatWhen(r.createdAt)}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section>
          <SectionTitle
            title="Tus primeros pasos"
            action={
              <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-xs font-bold text-slate-500">
                <span className="h-1.5 w-14 sm:w-24 overflow-hidden rounded-full bg-slate-200">
                  <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(stepsDone / steps.length) * 100}%` }} />
                </span>
                {stepsDone} de {steps.length}
              </div>
            }
          />
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-4">
            {steps.map((s, i) => (
              <button
                key={s.title}
                onClick={() => navigate(s.path)}
                className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white p-4 text-left transition-shadow hover:shadow-md md:flex-col md:items-start md:gap-3 md:p-5"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black ${s.done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-700'}`}>
                  {s.done ? <Check className="h-5 w-5" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-slate-900">{s.title}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-slate-500">{s.done ? 'Listo.' : s.text}</span>
                </span>
                {!s.done && (
                  <span className={`hidden min-h-11 items-center rounded-2xl px-4 text-sm font-extrabold md:inline-flex ${i === nextStep ? 'bg-brand-600 text-white' : 'border border-slate-200 text-slate-900'}`}>
                    {s.cta}
                  </span>
                )}
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 md:hidden" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Objetivos */}
      <section>
        <SectionTitle title="¿Qué quieres lograr?" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {GOALS.map(g => (
            <div
              key={g.title}
              className={`flex flex-col gap-3 rounded-[22px] border p-5 ${g.featured ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}
            >
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${g.featured ? 'bg-white/10' : 'bg-brand-50'}`}>
                <g.icon className={`h-[22px] w-[22px] ${g.featured ? 'text-white' : 'text-brand-600'}`} />
              </span>
              <div>
                <h3 className="font-sans text-[17px] font-extrabold normal-case not-italic tracking-normal">{g.title}</h3>
                <p className={`mt-1 text-sm leading-snug ${g.featured ? 'text-slate-300' : 'text-slate-500'}`}>{g.description}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.links.map(l => (
                  <button
                    key={l.path}
                    onClick={() => navigate(l.path)}
                    className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition-colors ${g.featured ? 'border-white/20 bg-white/5 text-slate-100 hover:bg-white/15' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => navigate(g.cta.path)}
                className={`mt-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold text-white transition-colors ${g.featured ? 'bg-brand-600 hover:bg-brand-700' : 'bg-slate-900 hover:bg-slate-700'}`}
              >
                {g.cta.label} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <details className="group mt-4 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-extrabold text-slate-900 [&::-webkit-details-marker]:hidden">
            Ver todas las herramientas
            <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid grid-cols-1 border-t border-slate-200 md:grid-cols-3">
            {TOOL_GROUPS.map(group => (
              <React.Fragment key={group.label}>
                <p className="col-span-full border-b border-slate-200 bg-slate-50 px-5 pb-1.5 pt-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                  {group.label}
                </p>
                {group.tools.map(t => (
                  <button
                    key={t.path}
                    onClick={() => navigate(t.path)}
                    className="flex min-h-14 items-center gap-3 border-b border-slate-100 px-5 py-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <t.icon className="h-[18px] w-[18px] shrink-0 text-slate-600" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-900">{t.label}</span>
                      <span className="block text-xs text-slate-400">{t.hint}</span>
                    </span>
                    {t.cost && <span className="ml-auto whitespace-nowrap text-[11px] font-extrabold text-slate-500">{t.cost}</span>}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        </details>
      </section>

      {/* Inspiración + gana créditos */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DailyInspiration userName={displayName} plan={planName} />
        </div>
        <div className="flex flex-col rounded-[22px] border border-slate-200 bg-white p-5">
          <h2 className="t-display flex items-center gap-2 text-lg text-slate-900">
            <Gift className="h-5 w-5 text-brand-600" /> Gana créditos
          </h2>
          <ul className="my-4 space-y-2.5">
            {MISSIONS.slice(0, 3).map(m => {
              const done = (missions[m.id]?.count ?? 0) >= m.maxCompletions;
              return (
                <li key={m.id} className="flex items-center gap-2.5 text-sm text-slate-700">
                  {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />}
                  <span className={`min-w-0 flex-1 ${done ? 'text-slate-400 line-through' : ''}`}>{m.label}</span>
                  <span className="text-xs font-extrabold text-emerald-600">+{m.credits}</span>
                </li>
              );
            })}
          </ul>
          <button
            onClick={() => setEarnOpen(true)}
            className="mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-extrabold text-slate-900 transition-colors hover:bg-slate-50"
          >
            Misiones, referidos y códigos
          </button>
        </div>
      </section>

      {earnOpen && (
        <EarnCreditsSheet
          missions={missions}
          onMissionsChange={reloadMissions}
          onClose={() => setEarnOpen(false)}
        />
      )}
    </div>
  );
};

const EarnCreditsSheet: React.FC<{ missions: UserMissions; onMissionsChange: () => void; onClose: () => void }> = ({ missions, onMissionsChange, onClose }) => {
  const { user, isAdmin, previewPlan, setPreviewPlan } = useAuth();
  const [completing, setCompleting] = useState<string | null>(null);
  const [missionMsg, setMissionMsg] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [specialCode, setSpecialCode] = useState('');
  const [codeMsg, setCodeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    getReferralStats(user.uid).then(s => { setReferralCode(s.code); setReferralCount(s.referralCount); }).catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleMission = async (missionId: string) => {
    if (!user?.uid || completing) return;
    if (missionId === 'follow_instagram') window.open('https://www.instagram.com/luziastudio', '_blank', 'noopener,noreferrer');
    setCompleting(missionId);
    const result = await completeMission(user.uid, missionId);
    setMissionMsg(result.message || null);
    if (result.success) onMissionsChange();
    setCompleting(null);
    setTimeout(() => setMissionMsg(null), 3000);
  };

  const handleRedeem = async () => {
    if (!user?.uid || !specialCode.trim() || redeeming) return;
    setRedeeming(true);
    setCodeMsg(null);
    const result = await redeemSpecialCode(user.uid, specialCode.trim());
    setCodeMsg({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) setSpecialCode('');
    setRedeeming(false);
    setTimeout(() => setCodeMsg(null), 5000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9000] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-5" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Gana créditos"
        onClick={e => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-7"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="t-display flex items-center gap-2 text-xl text-slate-900"><Gift className="h-5 w-5 text-brand-600" /> Gana créditos</h2>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {missionMsg && (
          <p className="mb-3 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> {missionMsg}
          </p>
        )}

        <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">Misiones</h3>
        <ul className="space-y-2">
          {MISSIONS.map(m => {
            const status = missions[m.id] || { completed: false, count: 0 };
            const maxed = status.count >= m.maxCompletions;
            const onCooldown = isMissionOnCooldown(status, m);
            const loading = completing === m.id;
            let label = m.id === 'follow_instagram' ? 'Seguir' : 'Completar';
            if (maxed) label = 'Hecho';
            else if (onCooldown) label = 'Mañana';
            else if (loading) label = '...';
            return (
              <li key={m.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${maxed ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-200'}`}>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{m.label}</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">+{m.credits} cr</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {m.description}{m.repeatable && m.maxCompletions > 1 ? ` · ${status.count}/${m.maxCompletions}` : ''}
                  </span>
                </span>
                <button
                  onClick={() => handleMission(m.id)}
                  disabled={maxed || onCooldown || loading}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-3.5 text-xs font-extrabold ${maxed ? 'bg-emerald-100 text-emerald-700' : onCooldown || loading ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-700'}`}
                >
                  {maxed && <Check className="h-3.5 w-3.5" />}{label}
                </button>
              </li>
            );
          })}
        </ul>

        <h3 className="mb-2 mt-6 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">Invita a tus amigos</h3>
        <p className="mb-2 text-sm text-slate-500">+10 créditos por cada amigo que cree su primera imagen. Máximo 5 ({referralCount}/5).</p>
        <div className="flex items-center gap-2">
          <span className="min-h-11 flex-1 select-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-black tracking-widest text-slate-800">{referralCode || '...'}</span>
          <button
            onClick={() => { if (referralCode) { void navigator.clipboard.writeText(referralCode); setCopied(true); setTimeout(() => setCopied(false), 1600); } }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-extrabold text-white hover:bg-slate-700"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        <h3 className="mb-2 mt-6 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400"><Tag className="h-3.5 w-3.5" /> Canjear código</h3>
        {codeMsg && (
          <p className={`mb-2 rounded-xl border px-4 py-2.5 text-sm font-bold ${codeMsg.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-brand-200 bg-brand-50 text-brand-700'}`}>
            {codeMsg.text}
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={specialCode}
            onChange={e => setSpecialCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleRedeem()}
            placeholder="Ej: LAUNCH2025"
            maxLength={20}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black uppercase tracking-widest text-slate-800 outline-none placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-slate-400"
          />
          <button
            onClick={handleRedeem}
            disabled={redeeming || !specialCode.trim()}
            className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 text-sm font-extrabold text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {redeeming ? '...' : 'Canjear'}
          </button>
        </div>

        {isAdmin && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-600">Admin: simular plan</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPreviewPlan(null)}
                className={`min-h-10 rounded-xl px-3 text-xs font-extrabold uppercase ${!previewPlan ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                Admin (real)
              </button>
              {PREVIEW_PLANS.map(p => (
                <button
                  key={p}
                  onClick={() => setPreviewPlan(previewPlan === p ? null : p)}
                  className={`min-h-10 rounded-xl px-3 text-xs font-extrabold uppercase ${previewPlan === p ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default Dashboard;
