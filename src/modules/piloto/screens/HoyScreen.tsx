// Pantalla 3 — "Hoy": el post de hoy listo para publicar.
// Construida sobre FlowShell. Datos: Planner v3 (contentPlanService),
// catálogo y marca del piloto. Las imágenes las deja listas contentFactory.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Check, CalendarCheck, Clock, Download, Gem, Lightbulb, Loader2, RefreshCw,
  Sparkles, Tag, UserRound, WifiOff,
} from 'lucide-react';
import { FlowShell } from '../../../components/shared/flow/FlowShell';
import {
  ActionCaption, Footnote, GroupedList, GroupedRow, InlineBanner, LargeTitle, PrimaryButton,
  ProgressBar, SectionTitle,
} from '../../../components/shared/flow/primitives';
import { useAuth } from '../../auth/AuthContext';
import type { CatalogItem, GeneratedAsset, PilotPlanTask } from '../types';
import {
  BUDGET_MESSAGE, FIDELITY_REVIEW_BELOW, FactoryError, OPTIONS_TODAY, createDefaultIO, currentAssets,
  preGenerateWindow, produceTask, variantOf, type PreGenProgress,
} from '../contentFactory';
import { contentPlanService, loadActivePlan, loadBrand, loadCatalog, type PilotBrand } from '../pilotData';
import { identityService } from '../services/identityService';
import { generateLaunchPlan, launchResultToPlanFields } from '../../planner/v3/plannerV3AiService';
import type { PlanPlatform } from '../../planner/v3/plannerV3Types';

type PlanWithTasks = NonNullable<Awaited<ReturnType<typeof loadActivePlan>>>;
type Phase = 'loading' | 'error' | 'needs-brand' | 'needs-catalog' | 'needs-plan' | 'ready';

const MAX_FRESH = 3; // veces que puede pedir "otra idea" por post

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const dayDiff = (iso: string, from: Date) => Math.round((parseISO(iso).getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / 86400000);

function pickTasks(tasks: PilotPlanTask[], now: Date) {
  const pending = tasks.filter(t => t.status === 'pending').sort((a, b) => a.date.localeCompare(b.date));
  const todayISO = isoOf(now);
  const today = pending.find(t => t.date === todayISO) ?? pending.find(t => t.date > todayISO) ?? pending[0] ?? null;
  const ahead = today ? pending.filter(t => t.date > today.date).slice(0, 2) : [];
  return { today, ahead };
}

const dayName = (t: PilotPlanTask, now: Date) => {
  const d = dayDiff(t.date, now);
  return d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : d === 2 ? 'Pasado mañana' : t.dayLabel;
};

// ── Guardado de fotos y texto ────────────────────────────────────

async function fetchFile(url: string, name: string): Promise<File | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const b = await r.blob();
    return new File([b], name, { type: b.type || 'image/jpeg' });
  } catch { return null; }
}

function triggerDownload(file: File) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ── Piezas visuales ──────────────────────────────────────────────

const Skeleton: React.FC<{ label?: string }> = ({ label }) => (
  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[16px] bg-[color:var(--fill)]">
    <div className="photo-sweep absolute inset-0" />
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-[14px] font-medium text-[color:var(--text-2)]">
      <Loader2 size={22} className="animate-spin" />
      {label}
    </span>
  </div>
);

const PhotoCard: React.FC<{
  asset: GeneratedAsset; index: number; selected: boolean; onToggle: () => void;
}> = ({ asset, index, selected, onToggle }) => {
  const original = asset.status === 'fallback_original';
  const review = !original && typeof asset.fidelityScore === 'number' && asset.fidelityScore < FIDELITY_REVIEW_BELOW;
  return (
    <div className="flow-card relative aspect-[4/5] w-full overflow-hidden rounded-[16px] bg-[color:var(--fill)]">
      <img src={asset.url} alt={`Opción ${index + 1} de tu foto de hoy`} className="photo-reveal h-full w-full object-cover" loading="lazy" />
      {(original || review) && (
        <span className="absolute bottom-3 left-3 right-14 rounded-[10px] bg-black/60 px-2.5 py-1.5 text-[12px] font-semibold leading-4 text-white backdrop-blur-md">
          {original ? 'Esta es tu foto original' : 'Revisa que la pieza se vea igual a la tuya'}
        </span>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={selected ? `Quitar opción ${index + 1}` : `Elegir opción ${index + 1}`}
        className={`flow-press absolute right-2.5 top-2.5 flex h-11 w-11 items-center justify-center rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.25)] backdrop-blur-xl ${selected ? 'bg-[color:var(--brand)] text-white' : 'bg-white/85 text-[color:var(--text)]'}`}
      >
        <Check size={20} strokeWidth={2.8} />
      </button>
    </div>
  );
};

const Thumbs: React.FC<{ task: PilotPlanTask; busy: boolean }> = ({ task, busy }) => {
  const assets = currentAssets(task);
  if (!assets.length) {
    return (
      <div className="flex gap-2">
        {[0, 1].map(i => <div key={i} className="relative aspect-[4/5] w-[72px] overflow-hidden rounded-[10px] bg-[color:var(--fill)]">{busy && <div className="photo-sweep absolute inset-0" />}</div>)}
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      {assets.slice(0, 3).map(a => <img key={a.id} src={a.url} alt="" className="aspect-[4/5] w-[72px] rounded-[10px] object-cover" loading="lazy" />)}
    </div>
  );
};

// ── Pantalla ─────────────────────────────────────────────────────

const HoyScreen: React.FC = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const io = useMemo(() => createDefaultIO(), []);

  const [phase, setPhase] = useState<Phase>('loading');
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [plan, setPlan] = useState<PlanWithTasks | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [brand, setBrand] = useState<PilotBrand | null>(null);
  const [prog, setProg] = useState<PreGenProgress | null>(null);
  const [budgetMsg, setBudgetMsg] = useState('');
  const [genError, setGenError] = useState('');
  const [skipped, setSkipped] = useState<Record<string, number[]>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [busyAction, setBusyAction] = useState<'' | 'publish' | 'fresh'>('');
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const aborter = useRef({ aborted: false });
  const fileCache = useRef(new Map<string, File>());
  const genKey = useRef('');

  // ── conexión ──
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ── carga de datos ──
  const load = useCallback(async () => {
    if (!uid) return;
    setPhase('loading');
    setNow(new Date());
    try {
      const [b, cat, p] = await Promise.all([loadBrand(uid), loadCatalog(uid), loadActivePlan()]);
      setBrand(b); setItems(cat); setPlan(p);
      setPhase(!b ? 'needs-brand' : !cat.length ? 'needs-catalog' : !p ? 'needs-plan' : 'ready');
    } catch {
      setPhase('error');
    }
  }, [uid]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { aborter.current.aborted = true; }, []);

  const patchLocal = useCallback((taskId: string, patch: Partial<PilotPlanTask>) => {
    setPlan(p => (p ? { ...p, tasks: p.tasks.map(t => (t.id === taskId ? { ...t, ...patch } : t)) } : p));
  }, []);

  const { today, ahead } = useMemo(() => pickTasks(plan?.tasks ?? [], now), [plan?.tasks, now]);

  // ── pre-generación en segundo plano: hoy + 2 días ──
  const startPreGen = useCallback(async (p: PlanWithTasks, from: Date) => {
    setGenError(''); setBudgetMsg('');
    const result = await preGenerateWindow({
      uid, planId: p.id, tasks: p.tasks, items, brand: brand ?? undefined, io, today: from,
      onProgress: setProg, onUpdate: patchLocal, signal: aborter.current,
    });
    if (result.budgetStopped) setBudgetMsg(BUDGET_MESSAGE);
    else if (result.error) setGenError(result.error);
  }, [uid, items, brand, io, patchLocal]);

  useEffect(() => {
    if (phase !== 'ready' || !plan || !today) return;
    const key = `${plan.id}|${today.id}|${plan.tasks.filter(t => t.status === 'done').length}`;
    if (genKey.current === key) return;
    genKey.current = key;
    if (!online) return;
    void startPreGen(plan, parseISO(today.date) < now ? now : parseISO(today.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, plan?.id, today?.id, online]);

  // ── fotos de hoy ──
  const todayAssets = today ? currentAssets(today) : [];
  const todayBusy = !!today && (today.generationStatus === 'generating' || today.generationStatus === 'queued' || (todayAssets.length === 0 && !!prog?.running));
  const chosen = (today ? todayAssets : []).filter((_, i) => !(skipped[today!.id] ?? []).includes(i));
  const canFresh = !!today && variantOf(today.assets) < MAX_FRESH && !todayBusy;

  // Se bajan las fotos de a poco para que "Descargar" pueda compartirlas al instante en el celular.
  useEffect(() => {
    todayAssets.forEach((a, i) => {
      if (fileCache.current.has(a.url)) return;
      void fetchFile(a.url, `post-${(today?.date ?? 'hoy')}-${i + 1}.jpg`).then(f => { if (f) fileCache.current.set(a.url, f); });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayAssets.map(a => a.id).join('|')]);

  const toggle = (taskId: string, i: number) =>
    setSkipped(s => { const cur = s[taskId] ?? []; return { ...s, [taskId]: cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i] }; });

  const onSave = async () => {
    if (!today || !chosen.length) return;
    setSaving(true); setSaved('');
    const text = [today.caption, today.hashtags].filter(Boolean).join('\n\n');
    try { await navigator.clipboard.writeText(text); } catch { /* sin permiso de portapapeles: las fotos igual se guardan */ }
    const files = chosen.map((a, i) => fileCache.current.get(a.url)).filter((f): f is File => !!f);
    try {
      const nav2 = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      const touch = window.matchMedia?.('(pointer: coarse)').matches;
      if (touch && files.length === chosen.length && nav2.canShare?.({ files })) {
        await navigator.share({ files });
        setSaved('Texto copiado. Elige "Guardar imagen" para dejarlas en tu galería.');
      } else if (files.length === chosen.length) {
        files.forEach((f, i) => setTimeout(() => triggerDownload(f), i * 350));
        setSaved('Texto copiado y fotos descargadas.');
      } else {
        chosen.forEach(a => window.open(a.url, '_blank', 'noopener'));
        setSaved('Texto copiado. Mantén apretada cada foto para guardarla.');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setSaved('Texto copiado. No pudimos guardar las fotos; inténtalo de nuevo.');
      else setSaved('Texto copiado.');
    }
    setSaving(false);
  };

  const onPublished = async () => {
    if (!plan || !today) return;
    setBusyAction('publish');
    try {
      // QA1: mismo carril serial que la fábrica; updateTaskStatus (leer-todo/escribir-todo) pisaba las fotos recién guardadas.
      await io.patchTask(uid, plan.id, today.id, { status: 'done' });
      patchLocal(today.id, { status: 'done' });
      setSaved('');
    } catch {
      setGenError('No pudimos marcarlo como publicado. Revisa tu conexión e inténtalo de nuevo.');
    }
    setBusyAction('');
  };

  const onFresh = async () => {
    if (!plan || !today || !canFresh) return;
    setBusyAction('fresh'); setGenError(''); setBudgetMsg('');
    try {
      await produceTask({
        uid, planId: plan.id, task: today, items, brand: brand ?? undefined, io, options: OPTIONS_TODAY,
        fresh: true, onUpdate: patchLocal, signal: aborter.current,
        onImageDone: () => undefined,
      });
      setSkipped(s => ({ ...s, [today.id]: [] }));
    } catch (e: any) {
      if (e instanceof FactoryError && e.code === 'BUDGET_LIMIT') setBudgetMsg(BUDGET_MESSAGE);
      else setGenError(e instanceof FactoryError ? e.message : 'No pudimos crear otras fotos ahora. Inténtalo en un rato.');
    }
    setBusyAction('');
  };

  // Arma la semana (la 1 del calendario de 6 semanas, o la siguiente si ya cerró la anterior).
  // QA1: antes ningún botón llamaba al motor del plan de arranque; "Armar mi semana" iba al asistente genérico.
  const onCreatePlan = async () => {
    setCreatingPlan(true); setGenError(''); setBudgetMsg('');
    try {
      const pb = await identityService.getPilotBrand(uid);
      if (!pb?.pilotSeed) { nav('/planner/nuevo'); return; }
      const plans = await contentPlanService.listPlans();
      const prev = plans.find(p => p.brandId === pb.id && p.status === 'closed' && p.launchOutline?.length);
      const weekNumber = prev ? Math.min(6, prev.weekNumber + 1) : 1;
      const history = prev ? await contentPlanService.getHistoryForBrand(pb.id) : [];
      const result = await generateLaunchPlan({
        brand: pb, seed: pb.pilotSeed, catalog: items, weekNumber,
        outline: prev?.launchOutline, history, previousTasks: prev?.tasks as PilotPlanTask[] | undefined,
      });
      const fields = launchResultToPlanFields(result);
      const platforms = Array.from(new Set(fields.tasks.map(t => t.platform))) as PlanPlatform[];
      const n = fields.tasks.length;
      await contentPlanService.createPlan({
        brandId: pb.id, brandName: pb.brandName,
        monthlyFocus: { goal: 'start', focusProduct: '', notes: '' },
        weekNumber, frequency: n <= 3 ? 3 : n <= 5 ? 5 : 7, platforms, status: 'active',
        ...fields, previousPlanId: prev?.id,
      });
      genKey.current = '';
      await load();
    } catch (e: any) {
      setGenError(/tope|BUDGET/i.test(String(e?.message)) ? BUDGET_MESSAGE : 'No pudimos armar tu semana. Revisa tu conexión e inténtalo de nuevo.');
    }
    setCreatingPlan(false);
  };

  const retryGen = () => { genKey.current = ''; if (plan && today) { genKey.current = `${plan.id}|${today.id}|retry${Date.now()}`; void startPreGen(plan, now); } };

  // ── estados que no son "listo" ──
  const trailing = (
    <button type="button" onClick={() => nav('/cuenta')} aria-label="Mi perfil" className="flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--action)] active:opacity-60">
      <UserRound size={22} />
    </button>
  );

  if (phase === 'loading') {
    return (
      <FlowShell title="Hoy" trailing={trailing}>
        <LargeTitle subtitle="Un momento">Preparando tu semana</LargeTitle>
        <div className="mt-6"><Skeleton label="Buscando tus datos" /></div>
      </FlowShell>
    );
  }

  if (phase === 'error' || (!online && phase !== 'ready')) {
    return (
      <FlowShell title="Hoy" trailing={trailing} actions={<PrimaryButton onClick={() => void load()} icon={<RefreshCw size={20} />}>Reintentar</PrimaryButton>}>
        <LargeTitle subtitle={online ? 'No pudimos cargar tus datos. No se perdió nada.' : 'Necesitamos internet para preparar tus fotos.'}>
          {online ? 'Algo no salió bien' : 'Sin conexión'}
        </LargeTitle>
        <div className="mt-6 flex justify-center text-[color:var(--placeholder)]">{online ? <AlertTriangle size={44} /> : <WifiOff size={44} />}</div>
      </FlowShell>
    );
  }

  const emptyStep = phase === 'needs-brand'
    ? { title: 'Primero cuéntanos de tu marca', text: 'Son unas pocas preguntas, con un toque cada una. Con eso armamos tu semana de publicaciones.', cta: 'Contar sobre mi marca', to: '/mi-negocio/marca', icon: <Sparkles size={20} /> }
    : phase === 'needs-catalog'
      ? { title: 'Ahora sube tus joyas', text: 'Sube fotos de cada pieza, de varios lados si puedes. Las tuyas nunca se modifican.', cta: 'Subir mis joyas', to: '/mi-negocio/catalogo', icon: <Gem size={20} /> }
      : phase === 'needs-plan'
        ? { title: 'Falta armar tu semana', text: 'Te dejamos las publicaciones listas, con fotos, texto y hora. Toma menos de un minuto.', cta: 'Armar mi semana', to: '', icon: <CalendarCheck size={20} /> }
        : null;
  if (emptyStep) {
    const isPlanStep = phase === 'needs-plan';
    return (
      <FlowShell title="Hoy" trailing={trailing} actions={<PrimaryButton onClick={() => (isPlanStep ? void onCreatePlan() : nav(emptyStep.to))} loading={isPlanStep && creatingPlan} icon={emptyStep.icon}>{emptyStep.cta}</PrimaryButton>}>
        <LargeTitle subtitle={emptyStep.text}>{emptyStep.title}</LargeTitle>
        {isPlanStep && (genError || budgetMsg) && (
          <div className="mt-4"><InlineBanner tone={genError ? 'danger' : 'warn'} icon={<AlertTriangle size={20} />}>{genError || budgetMsg}</InlineBanner></div>
        )}
      </FlowShell>
    );
  }

  // ── listo ──
  const total = prog?.totalImages ?? 0;
  const value = total ? Math.min(1, (prog?.doneImages ?? 0) / total) : 0;
  const preparing = !!prog?.running;
  const isToday = !!today && dayDiff(today.date, now) <= 0;

  if (!today) {
    return (
      <FlowShell title="Hoy" trailing={trailing} actions={plan ? <PrimaryButton onClick={() => nav(`/planner/${plan.id}/cierre`)} icon={<CalendarCheck size={20} />}>Cerrar mi semana</PrimaryButton> : undefined}>
        <LargeTitle subtitle="Publicaste todo lo de esta semana. Cuéntanos cómo te fue y armamos la siguiente.">Terminaste la semana</LargeTitle>
      </FlowShell>
    );
  }

  const actions = (
    <>
      <ActionCaption>{chosen.length ? `${chosen.length === 1 ? '1 foto elegida' : `${chosen.length} fotos elegidas`} · texto listo para pegar` : 'Elige al menos una foto'}</ActionCaption>
      <PrimaryButton onClick={() => void onSave()} loading={saving} disabled={!chosen.length || todayBusy} icon={<Download size={20} />}>
        Descargar y copiar texto
      </PrimaryButton>
    </>
  );

  return (
    <FlowShell title="Hoy" trailing={trailing} actions={actions}>
      <LargeTitle subtitle={`${today.dayLabel} · ${today.platform} · ${today.format}`}>{isToday ? 'Tu post de hoy' : 'Tu próximo post'}</LargeTitle>

      {!online && (
        <div className="mt-3"><InlineBanner tone="warn" icon={<WifiOff size={20} />}>Sin conexión. Lo que ya está listo se puede ver; las fotos nuevas esperan a que vuelva internet.</InlineBanner></div>
      )}
      {budgetMsg && (
        <div className="mt-3"><InlineBanner tone="warn" icon={<AlertTriangle size={20} />}>{budgetMsg}</InlineBanner></div>
      )}
      {genError && (
        <div className="mt-3"><InlineBanner tone="danger" icon={<AlertTriangle size={20} />} action={{ label: 'Reintentar', onPress: retryGen }}>{genError}</InlineBanner></div>
      )}

      {preparing && (
        <div className="mt-4">
          <ProgressBar value={Math.max(0.04, value)} label="Progreso de tus fotos" />
          <Footnote className="mt-2" icon={<Loader2 size={14} className="animate-spin" />}>
            Preparando tu semana: {prog?.doneImages ?? 0} de {total} fotos
          </Footnote>
        </div>
      )}

      {/* Opciones: tarjetas verticales grandes */}
      <div className="mt-4">
        {todayAssets.length > 0 ? (
          <div className="flow-carousel -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 min-[428px]:-mx-5 min-[428px]:px-5 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {todayAssets.map((a, i) => (
              <div key={a.id} className="shrink-0 snap-start md:shrink" style={{ width: todayAssets.length === 1 ? '100%' : 'calc(100vw - 32px - 28px)', maxWidth: '100%' }}>
                <PhotoCard asset={a} index={i} selected={!(skipped[today.id] ?? []).includes(i)} onToggle={() => toggle(today.id, i)} />
              </div>
            ))}
          </div>
        ) : todayBusy || today.generationStatus === 'idle' || !today.generationStatus ? (
          <Skeleton label="Preparando tus fotos" />
        ) : (
          <InlineBanner tone="danger" icon={<AlertTriangle size={20} />} action={{ label: 'Reintentar', onPress: () => void onFresh() }}>
            No pudimos preparar las fotos de este post. No se cobró nada que no se haya hecho.
          </InlineBanner>
        )}
        {todayAssets.length > 1 && <Footnote className="mt-2">Toca el círculo para elegir cuáles descargar.</Footnote>}
      </div>

      {saved && <Footnote className="mt-3" icon={<Check size={15} strokeWidth={2.6} className="text-[color:var(--ok-fg)]" />}>{saved}</Footnote>}

      {/* Texto */}
      <SectionTitle>Texto para publicar</SectionTitle>
      <div className="rounded-[12px] bg-[color:var(--fill)] p-4">
        <p className="whitespace-pre-wrap break-words text-[16px] leading-[23px]">{today.caption}</p>
        {today.hashtags && <p className="mt-3 break-words text-[15px] leading-[21px] text-[color:var(--action)]">{today.hashtags}</p>}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Footnote icon={<Clock size={15} />}>Hora sugerida: {today.suggestedTime}</Footnote>
        {today.whyThisContent && <Footnote icon={<Lightbulb size={15} />}>{today.whyThisContent}</Footnote>}
        {today.engagementHook && <Footnote icon={<Tag size={15} />}>{today.engagementHook}</Footnote>}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <button
          type="button"
          onClick={() => void onPublished()}
          disabled={busyAction !== ''}
          className="flow-press flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[color:var(--separator)] bg-white px-4 text-[16px] font-semibold disabled:opacity-50"
        >
          {busyAction === 'publish' ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Ya lo publiqué
        </button>
        <button
          type="button"
          onClick={() => void onFresh()}
          disabled={!canFresh || busyAction !== ''}
          className="flow-press flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[color:var(--separator)] bg-white px-4 text-[16px] font-semibold disabled:opacity-40"
        >
          {busyAction === 'fresh' ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} Dame otra idea
        </button>
      </div>
      {!canFresh && !todayBusy && variantOf(today.assets) >= MAX_FRESH && (
        <Footnote className="mt-2">Ya probaste varias ideas para este post. Mañana hay más.</Footnote>
      )}

      {/* Mañana y pasado mañana */}
      {ahead.length > 0 && (
        <>
          <SectionTitle>Lo que viene</SectionTitle>
          <div className="flex flex-col gap-3">
            {ahead.map(t => {
              const busy = t.generationStatus === 'generating' || t.generationStatus === 'queued' || preparing;
              return (
                <div key={t.id} className="rounded-[12px] bg-[color:var(--fill)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[15px] font-semibold">{dayName(t, now)}</p>
                    <span className="text-[13px] text-[color:var(--text-2)]">{t.suggestedTime}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[14px] text-[color:var(--text-2)]">{t.title}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <Thumbs task={t} busy={busy} />
                    <span className="shrink-0 text-[13px] font-medium text-[color:var(--text-2)]">
                      {currentAssets(t).length >= 2 ? 'Listo' : busy ? 'Preparando…' : 'Pendiente'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <SectionTitle>Tu negocio</SectionTitle>
      <GroupedList>
        <GroupedRow title="Mi marca" chevron onPress={() => nav('/mi-negocio/marca')} />
        <GroupedRow title="Mi catálogo" subtitle={`${items.length} ${items.length === 1 ? 'pieza' : 'piezas'}`} chevron onPress={() => nav('/mi-negocio/catalogo')} />
        <GroupedRow title="Cierre de la semana" subtitle="Cuéntanos qué publicaste y cómo te fue" chevron last onPress={() => nav(`/planner/${plan!.id}/cierre`)} />
      </GroupedList>
    </FlowShell>
  );
};

export default HoyScreen;
