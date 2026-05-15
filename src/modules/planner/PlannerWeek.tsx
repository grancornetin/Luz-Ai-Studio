/**
 * PlannerWeek.tsx — Vista principal del plan semanal.
 * Muestra las tareas del calendario ordenadas por día.
 * Cada tarea tiene caption, prompt, instrucciones y botón de ejecutar.
 * Ruta: /planner/:id
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Circle, ChevronDown, ChevronUp,
  Sparkles, Loader2, RotateCcw, CalendarDays, Copy, Check,
  Clock, TrendingUp, Zap, SkipForward,
} from 'lucide-react';
import {
  getProject, saveCalendar, updateCalendarEntryStatus, savePlannerBrief,
  Project, CalendarEntry, PlannerBrief,
} from '../../services/projectService';
import { getAuth } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';

// ── Metadatos de módulos ──────────────────────────────────────

const MODULE_META: Record<string, { label: string; color: string; bg: string; route: string }> = {
  product: { label: 'Product Studio',  color: '#F72C5B', bg: 'rgba(247,44,91,0.08)',   route: '/productos' },
  ugc:     { label: 'UGC Studio',      color: '#10B981', bg: 'rgba(16,185,129,0.08)',   route: '/studio-pro' },
  campaign:{ label: 'Campaign',        color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)',   route: '/campaign' },
  scene:   { label: 'Scene Clone',     color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',   route: '/clonar' },
  outfit:  { label: 'Outfit Extractor',color: '#EC4899', bg: 'rgba(236,72,153,0.08)',   route: '/outfit-extractor' },
  prompt:  { label: 'Prompt Studio',   color: '#6366F1', bg: 'rgba(99,102,241,0.08)',   route: '/prompt-studio' },
};

const GOAL_LABELS: Record<string, string> = {
  sell: 'Vender más',
  grow: 'Ganar seguidores',
  launch: 'Lanzar algo nuevo',
  maintain: 'Mantener presencia',
};

// ── Generación del plan (para regenerar) ─────────────────────

async function generateWeekPlan(
  product: string,
  goal: string,
  frequency: number,
  platforms: string[],
  previousTypes: string[] = [],
): Promise<CalendarEntry[]> {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('No autenticado');

  const today = new Date();
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const days: { iso: string; label: string }[] = [];
  let cursor = new Date(today);
  cursor.setDate(cursor.getDate() + 1);
  while (days.length < frequency) {
    days.push({
      iso: cursor.toISOString().split('T')[0],
      label: `${dayNames[cursor.getDay()].charAt(0).toUpperCase() + dayNames[cursor.getDay()].slice(1)} ${cursor.getDate()} ${monthNames[cursor.getMonth()]}`,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const goalLabel = GOAL_LABELS[goal] ?? goal;
  const platformList = platforms.join(', ');
  const avoidTypes = previousTypes.length > 0
    ? `\nNO repitas estos tipos de contenido de la semana anterior: ${previousTypes.join(', ')}`
    : '';

  const systemPrompt = `Sos directora de contenido para emprendedoras latinoamericanas que venden en redes sociales.
Tu tarea es crear un plan de contenido semanal concreto, ejecutable y variado.

PRODUCTO: ${product}
META DE LA SEMANA: ${goalLabel}
PLATAFORMAS: ${platformList}
DÍAS DEL PLAN: ${days.map(d => d.label).join(', ')}${avoidTypes}

Genera exactamente ${frequency} tareas, una por día.

Tipos disponibles (rotar, no repetir el mismo tipo dos veces):
- "Foto catálogo" → módulo: product
- "UGC review" → módulo: ugc
- "Behind the scenes" → módulo: prompt
- "Foto lifestyle" → módulo: product
- "Carrusel educativo" → módulo: prompt
- "Detalle del producto" → módulo: product
- "Testimonio de cliente" → módulo: ugc
- "Antes/después" → módulo: scene

Respondé ÚNICAMENTE con un array JSON válido. Sin texto adicional.

Formato exacto:
{
  "dayLabel": "string",
  "date": "YYYY-MM-DD",
  "contentType": "string",
  "module": "product|ugc|campaign|scene|outfit|prompt",
  "platform": "string de la lista de plataformas",
  "suggestedTime": "HH:MM",
  "prompt": "prompt completo listo para copiar en el módulo",
  "caption": "caption completo con emojis para publicar directamente",
  "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5",
  "whatToUpload": ["instrucción 1", "instrucción 2"],
  "howToConfigure": ["configuración 1", "configuración 2", "configuración 3"],
  "engagementHook": "consejo específico para generar comentarios en ese tipo de post"
}`;

  const res = await fetch('/api/gemini/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      action: 'generateText',
      model: 'gemini-2.5-flash',
      prompt: systemPrompt,
    }),
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Error generando el plan');

  const parsed: any[] = Array.isArray(data.json) ? data.json : JSON.parse(
    data.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  );

  return parsed.map((item, i) => ({
    id: uuidv4(),
    date: item.date ?? days[i]?.iso ?? '',
    dayLabel: item.dayLabel ?? days[i]?.label ?? '',
    contentType: item.contentType ?? 'Contenido',
    module: item.module ?? 'prompt',
    platform: item.platform ?? platforms[0] ?? 'Instagram Feed',
    suggestedTime: item.suggestedTime ?? '19:00',
    prompt: item.prompt ?? '',
    caption: item.caption ?? '',
    hashtags: item.hashtags ?? '',
    whatToUpload: Array.isArray(item.whatToUpload) ? item.whatToUpload : [],
    howToConfigure: Array.isArray(item.howToConfigure) ? item.howToConfigure : [],
    engagementHook: item.engagementHook ?? '',
    params: {},
    status: 'pending' as const,
  }));
}

// ── Componente CopyButton ─────────────────────────────────────

const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label = 'Copiar' }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
      style={{
        background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(247,44,91,0.08)',
        color: copied ? '#10B981' : '#F72C5B',
      }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado' : label}
    </button>
  );
};

// ── Componente TaskCard ───────────────────────────────────────

interface TaskCardProps {
  entry: CalendarEntry;
  onExecute: (entry: CalendarEntry) => void;
  onDone: (id: string) => void;
  onSkip: (id: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ entry, onExecute, onDone, onSkip }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = MODULE_META[entry.module] ?? MODULE_META.prompt;
  const isDone = entry.status === 'done';
  const isSkipped = entry.status === 'skipped';

  return (
    <div
      className={`bg-white rounded-2xl border transition-all overflow-hidden ${
        isDone
          ? 'border-emerald-100 opacity-70'
          : isSkipped
          ? 'border-slate-100 opacity-50'
          : 'border-slate-100 hover:border-slate-200 hover:shadow-md'
      }`}
    >
      {/* Línea de color del módulo arriba */}
      <div className="h-1 rounded-t-2xl" style={{ background: isDone ? '#10B981' : meta.color }} />

      <div className="p-5">
        {/* Cabecera de la tarea */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Ícono de estado */}
            <button
              onClick={() => !isDone && !isSkipped && onDone(entry.id)}
              className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110"
            >
              {isDone
                ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                : <Circle className="w-5 h-5 text-slate-200 hover:text-emerald-300 transition-colors" />
              }
            </button>

            <div className="min-w-0">
              <p className={`text-sm font-black uppercase italic tracking-tight ${isDone || isSkipped ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                {entry.contentType}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* Badge de módulo */}
                <span
                  className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  {meta.label}
                </span>
                {/* Plataforma */}
                <span className="text-[10px] text-slate-400 font-bold">{entry.platform}</span>
                {/* Hora */}
                <span className="text-[10px] text-slate-300 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {entry.suggestedTime}
                </span>
              </div>
            </div>
          </div>

          {/* Botón expandir */}
          {!isSkipped && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex-shrink-0 p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              {expanded
                ? <ChevronUp className="w-4 h-4 text-slate-400" />
                : <ChevronDown className="w-4 h-4 text-slate-400" />
              }
            </button>
          )}
        </div>

        {/* Preview del caption (siempre visible, recortado) */}
        {!isSkipped && entry.caption && (
          <p className={`text-xs text-slate-400 mt-3 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
            {entry.caption}
          </p>
        )}

        {/* ── Contenido expandido ── */}
        {expanded && !isSkipped && (
          <div className="mt-4 space-y-4 border-t border-slate-50 pt-4">

            {/* Caption completo */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Caption listo</p>
                <CopyButton text={`${entry.caption}\n\n${entry.hashtags}`} label="Copiar todo" />
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{entry.caption}</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{entry.hashtags}</p>
              </div>
            </div>

            {/* Prompt */}
            {entry.prompt && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Prompt para el módulo</p>
                  <CopyButton text={entry.prompt} />
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-600 leading-relaxed italic">"{entry.prompt}"</p>
                </div>
              </div>
            )}

            {/* Qué subir */}
            {entry.whatToUpload?.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Qué subir al módulo</p>
                <ul className="space-y-1.5">
                  {entry.whatToUpload.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[10px] font-black mt-0.5" style={{ color: meta.color }}>→</span>
                      <span className="text-xs text-slate-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cómo configurar */}
            {entry.howToConfigure?.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Cómo configurar</p>
                <ul className="space-y-1.5">
                  {entry.howToConfigure.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[10px] text-slate-300 font-black mt-0.5">·</span>
                      <span className="text-xs text-slate-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Engagement hook */}
            {entry.engagementHook && (
              <div
                className="rounded-xl p-3 flex items-start gap-2"
                style={{ background: 'rgba(247,44,91,0.04)', border: '1px solid rgba(247,44,91,0.1)' }}
              >
                <TrendingUp className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#F72C5B' }} />
                <p className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-black" style={{ color: '#F72C5B' }}>Para más engagement: </span>
                  {entry.engagementHook}
                </p>
              </div>
            )}

            {/* Acciones */}
            <div className="flex items-center gap-2 pt-1">
              {!isDone && (
                <>
                  <button
                    onClick={() => onExecute(entry)}
                    className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex-1 justify-center shadow-sm"
                    style={{ background: meta.color }}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Ir al módulo
                  </button>
                  <button
                    onClick={() => onDone(entry.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Hecho
                  </button>
                  <button
                    onClick={() => { setExpanded(false); onSkip(entry.id); }}
                    className="p-2.5 rounded-xl border border-slate-100 text-slate-400 hover:bg-slate-50 transition-colors"
                    title="Saltar esta tarea"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {isDone && (
                <p className="text-xs text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Completada
                </p>
              )}
            </div>
          </div>
        )}

        {/* Acciones rápidas (cuando está colapsada y no está hecha) */}
        {!expanded && !isDone && !isSkipped && (
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onExecute(entry)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all"
              style={{ background: meta.color }}
            >
              <Zap className="w-3 h-3" />
              Ejecutar
            </button>
            <button
              onClick={() => onDone(entry.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all border border-emerald-100 text-emerald-500 hover:bg-emerald-50"
            >
              <CheckCircle2 className="w-3 h-3" />
              Hecho
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────

const PlannerWeek: React.FC = () => {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();

  const [project,      setProject]      = useState<Project | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error,        setError]        = useState('');

  const loadProject = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await getProject(id);
      if (!p) throw new Error('Plan no encontrado');
      setProject(p);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const handleDone = async (entryId: string) => {
    if (!id || !project) return;
    await updateCalendarEntryStatus(id, entryId, 'done');
    setProject(prev => prev ? {
      ...prev,
      calendar: prev.calendar?.map(e => e.id === entryId ? { ...e, status: 'done' } : e),
    } : prev);
  };

  const handleSkip = async (entryId: string) => {
    if (!id || !project) return;
    await updateCalendarEntryStatus(id, entryId, 'skipped');
    setProject(prev => prev ? {
      ...prev,
      calendar: prev.calendar?.map(e => e.id === entryId ? { ...e, status: 'skipped' } : e),
    } : prev);
  };

  const handleExecute = (entry: CalendarEntry) => {
    const meta = MODULE_META[entry.module] ?? MODULE_META.prompt;
    // Activar la burbuja flotante con los datos de la tarea
    window.dispatchEvent(new CustomEvent('planner:task:activate', {
      detail: { ...entry, projectId: id },
    }));
    // Navegar al módulo (prompt studio recibe el prompt como param)
    if (entry.module === 'prompt') {
      navigate(`${meta.route}?prompt=${encodeURIComponent(entry.prompt)}`);
    } else {
      navigate(meta.route);
    }
  };

  const handleRegenerate = async () => {
    if (!project?.plannerBrief || !id) return;
    setRegenerating(true);
    setError('');
    try {
      const brief = project.plannerBrief;
      const previousTypes = project.calendar?.map(e => e.contentType) ?? [];
      const entries = await generateWeekPlan(
        brief.product, brief.goal, brief.frequency, brief.platforms, previousTypes
      );
      await saveCalendar(id, entries);
      setProject(prev => prev ? { ...prev, calendar: entries } : prev);
    } catch (err: any) {
      setError('No pudimos regenerar el plan. Intentá de nuevo.');
    } finally {
      setRegenerating(false);
    }
  };

  // ── Estados de carga ──────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
    </div>
  );
  if (error && !project) return (
    <div className="p-8 text-center text-red-500 text-sm">{error}</div>
  );
  if (!project) return (
    <div className="p-8 text-center text-slate-400 text-sm">Plan no encontrado</div>
  );

  const calendar  = project.calendar ?? [];
  const totalTasks = calendar.length;
  const doneTasks  = calendar.filter(e => e.status === 'done').length;
  const pct        = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const allDone    = totalTasks > 0 && doneTasks === totalTasks;

  // Escuchar marcado como hecho desde la burbuja flotante
  useEffect(() => {
    const handler = (e: Event) => {
      const { taskId } = (e as CustomEvent).detail;
      handleDone(taskId);
    };
    window.addEventListener('planner:task:complete', handler);
    return () => window.removeEventListener('planner:task:complete', handler);
  }, [id, project]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/planner')}
            className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">
              {project.name}
            </h1>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-0.5">
              {project.plannerBrief?.product ?? 'Plan de contenido'}
            </p>
          </div>
        </div>

        {project.plannerBrief && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-all disabled:opacity-40"
          >
            {regenerating
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RotateCcw className="w-3.5 h-3.5" />
            }
            {regenerating ? 'Regenerando...' : 'Nueva semana'}
          </button>
        )}
      </div>

      {/* Stats de progreso */}
      {totalTasks > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Progreso de la semana
            </p>
            <p className="text-xs font-black" style={{ color: pct === 100 ? '#10B981' : '#F72C5B' }}>
              {doneTasks}/{totalTasks} tareas
            </p>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: pct === 100 ? '#10B981' : '#F72C5B' }}
            />
          </div>
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              {doneTasks} hechas
            </span>
            <span className="flex items-center gap-1">
              <Circle className="w-3 h-3 text-slate-200" />
              {totalTasks - doneTasks - calendar.filter(e => e.status === 'skipped').length} pendientes
            </span>
          </div>
        </div>
      )}

      {/* Banner nueva semana */}
      {allDone && (
        <div
          className="rounded-2xl p-5 text-center space-y-3"
          style={{ background: 'rgba(247,44,91,0.04)', border: '1px solid rgba(247,44,91,0.12)' }}
        >
          <p className="text-sm font-black uppercase italic tracking-tight text-slate-900">
            ¡Completaste la semana! 🎉
          </p>
          <p className="text-xs text-slate-500">
            Armá el plan de la próxima semana con nuevos formatos.
          </p>
          <button
            onClick={handleRegenerate}
            disabled={regenerating || !project.plannerBrief}
            className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all mx-auto disabled:opacity-40"
            style={{ background: '#F72C5B', boxShadow: '0 8px 24px rgba(247,44,91,0.25)' }}
          >
            {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Armar próxima semana
          </button>
        </div>
      )}

      {/* Error de regeneración */}
      {error && (
        <p className="text-sm text-red-500 text-center font-medium">{error}</p>
      )}

      {/* Lista de tareas */}
      {calendar.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{ background: 'rgba(247,44,91,0.08)' }}
          >
            <CalendarDays className="w-8 h-8" style={{ color: '#F72C5B' }} />
          </div>
          <p className="text-slate-700 text-sm font-black uppercase italic tracking-tight">
            Sin tareas esta semana
          </p>
          <p className="text-slate-400 text-xs mt-1.5 max-w-xs mx-auto">
            Volvé al planner y configurá tu plan.
          </p>
          <button
            onClick={() => navigate('/planner/nuevo')}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 text-white rounded-2xl font-black text-sm uppercase tracking-widest mx-auto transition-all"
            style={{ background: '#F72C5B', boxShadow: '0 8px 24px rgba(247,44,91,0.25)' }}
          >
            <Sparkles className="w-4 h-4" />
            Armar plan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {calendar.map(entry => (
            <TaskCard
              key={entry.id}
              entry={entry}
              onExecute={handleExecute}
              onDone={handleDone}
              onSkip={handleSkip}
            />
          ))}
        </div>
      )}

      {/* Cambiar configuración */}
      {project.plannerBrief && (
        <div className="text-center pt-2">
          <button
            onClick={() => navigate(`/planner/nuevo?edit=${id}`)}
            className="text-xs text-slate-400 hover:text-slate-600 font-bold uppercase tracking-widest transition-colors"
          >
            Cambiar configuración del plan
          </button>
        </div>
      )}
    </div>
  );
};

export default PlannerWeek;
