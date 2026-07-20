/**
 * PlannerTaskBubble.tsx — Burbuja flotante global que acompaña a la emprendedora
 * mientras ejecuta una tarea del Planner en cualquier módulo.
 *
 * Se activa con el evento DOM 'planner:task:activate' y se monta en App.tsx
 * junto a AppAssistant. Posición: bottom-6 left-6 (opuesto al asistente).
 *
 * Eventos escuchados:  planner:task:activate  { detail: CalendarEntry & { projectId } }
 * Eventos emitidos:    planner:task:complete   { detail: { taskId, projectId } }
 */
import React, { useState, useEffect } from 'react';
import {
  X, ChevronUp, ChevronDown, Copy, Check,
  CheckCircle2, Zap, TrendingUp, CalendarDays,
} from 'lucide-react';
import { contentPlanService } from '../modules/planner/v3/contentPlanService';

// ── Tipos ─────────────────────────────────────────────────────

interface TaskPayload {
  id: string;
  projectId: string;
  dayLabel: string;
  contentType: string;
  module: string;
  platform: string;
  suggestedTime: string;
  prompt: string;
  caption: string;
  hashtags: string;
  whatToUpload: string[];
  howToConfigure: string[];
  engagementHook: string;
  whyThisContent?: string;
}

const MODULE_META: Record<string, { label: string; color: string; bg: string }> = {
  product: { label: 'Product Studio',   color: '#F72C5B', bg: 'rgba(247,44,91,0.08)' },
  ugc:     { label: 'UGC Studio',       color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  campaign:{ label: 'Campaign',         color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
  scene:   { label: 'Scene Clone',      color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  outfit:  { label: 'Outfit Extractor', color: '#EC4899', bg: 'rgba(236,72,153,0.08)' },
  prompt:  { label: 'Prompt Studio',    color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
};

// ── CopyButton inline ─────────────────────────────────────────

const CopyBtn: React.FC<{ text: string; small?: boolean }> = ({ text, small }) => {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      className={`flex items-center gap-1 rounded-lg font-black uppercase tracking-widest transition-all flex-shrink-0 ${
        small ? 'text-[8px] px-2 py-1' : 'text-[9px] px-2.5 py-1.5'
      }`}
      style={{
        background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(247,44,91,0.08)',
        color: copied ? '#10B981' : '#F72C5B',
      }}
    >
      {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
      {copied ? 'Ok' : 'Copiar'}
    </button>
  );
};

// ── Componente principal ──────────────────────────────────────

const PlannerTaskBubble: React.FC = () => {
  const [task,     setTask]     = useState<TaskPayload | null>(null);
  const [open,     setOpen]     = useState(false);
  const [marking,  setMarking]  = useState(false);
  const [marked,   setMarked]   = useState(false);

  // Escuchar activación desde PlannerWeek
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TaskPayload>).detail;
      setTask(detail);
      setOpen(true);
      setMarked(false);
    };
    window.addEventListener('planner:task:activate', handler);
    return () => window.removeEventListener('planner:task:activate', handler);
  }, []);

  const handleComplete = async () => {
    if (!task || marking) return;
    setMarking(true);
    try {
      await contentPlanService.updateTaskStatus(task.projectId, task.id, 'done');
      window.dispatchEvent(new CustomEvent('planner:task:complete', {
        detail: { taskId: task.id, projectId: task.projectId },
      }));
      setMarked(true);
      // Cerrar la burbuja después de un momento
      setTimeout(() => {
        setTask(null);
        setOpen(false);
        setMarked(false);
      }, 1800);
    } finally {
      setMarking(false);
    }
  };

  const handleDismiss = () => {
    setTask(null);
    setOpen(false);
  };

  // Sin tarea activa — no renderizar nada
  if (!task) return null;

  const meta = MODULE_META[task.module] ?? MODULE_META.prompt;

  return (
    <>
      {/* ── Panel expandido ── */}
      <div
        className={`fixed z-[890] bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300
          left-2 right-2 md:left-6 md:right-auto
          bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-24
          rounded-[24px] md:rounded-[28px]
          w-auto md:w-[min(360px,calc(100vw-24px))]
          origin-bottom-left
          ${open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}
        `}
        style={{ maxHeight: 'min(560px, calc(100dvh - 130px))' }}
      >
        {/* Franja de color del módulo */}
        <div className="h-1 flex-shrink-0" style={{ background: meta.color }} />

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0 border-b border-slate-50">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: meta.bg }}
          >
            <CalendarDays className="w-4 h-4" style={{ color: meta.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black uppercase italic tracking-tight text-slate-900 truncate">
              {task.contentType}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5 truncate">
              {task.dayLabel} · {task.platform} · {task.suggestedTime}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setOpen(o => !o)}
              className="p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

          {/* Badge módulo */}
          <span
            className="inline-block text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>

          {/* Prompt */}
          {task.whyThisContent && (
            <details className="rounded-xl bg-rose-50 p-3">
              <summary className="cursor-pointer text-[9px] font-black uppercase tracking-widest text-[#F72C5B]">Por qué este contenido</summary>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{task.whyThisContent}</p>
            </details>
          )}

          {/* Prompt */}
          {task.prompt && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Prompt</p>
                <CopyBtn text={task.prompt} small />
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-600 leading-relaxed italic">"{task.prompt}"</p>
              </div>
            </div>
          )}

          {/* Caption */}
          {task.caption && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Caption</p>
                <CopyBtn text={`${task.caption}\n\n${task.hashtags}`} small />
              </div>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs text-slate-700 leading-relaxed">{task.caption}</p>
                <p className="text-[10px] text-slate-400">{task.hashtags}</p>
              </div>
            </div>
          )}

          {/* Qué subir */}
          {task.whatToUpload?.length > 0 && (
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Qué subir</p>
              <ul className="space-y-1">
                {task.whatToUpload.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[9px] font-black mt-0.5 flex-shrink-0" style={{ color: meta.color }}>→</span>
                    <span className="text-xs text-slate-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cómo configurar */}
          {task.howToConfigure?.length > 0 && (
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Configurar así</p>
              <ul className="space-y-1">
                {task.howToConfigure.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[9px] text-slate-300 font-black mt-0.5 flex-shrink-0">·</span>
                    <span className="text-xs text-slate-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Engagement hook */}
          {task.engagementHook && (
            <div
              className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: 'rgba(247,44,91,0.04)', border: '1px solid rgba(247,44,91,0.1)' }}
            >
              <TrendingUp className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: '#F72C5B' }} />
              <p className="text-[10px] text-slate-600 leading-relaxed">
                <span className="font-black" style={{ color: '#F72C5B' }}>Engagement: </span>
                {task.engagementHook}
              </p>
            </div>
          )}
        </div>

        {/* Footer — marcar como completada */}
        <div className="p-4 border-t border-slate-50 flex-shrink-0">
          {marked ? (
            <div className="flex items-center justify-center gap-2 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <p className="text-xs font-black uppercase tracking-widest text-emerald-600">
                ¡Tarea completada!
              </p>
            </div>
          ) : (
            <button
              onClick={handleComplete}
              disabled={marking}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {marking ? 'Guardando...' : 'Marcar como completada'}
            </button>
          )}
        </div>
      </div>

      {/* ── Botón burbuja minimizado ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`hidden md:flex fixed bottom-6 left-6 z-[900] w-14 h-14 rounded-2xl shadow-2xl items-center justify-center transition-all duration-300 ${
          open ? 'scale-95' : 'hover:scale-110'
        }`}
        style={{
          background: open ? '#1e293b' : meta.color,
          boxShadow: open ? '' : `0 8px 24px ${meta.color}40`,
        }}
        title={open ? 'Minimizar' : `Tarea activa: ${task.contentType}`}
      >
        {open ? (
          <ChevronDown className="w-5 h-5 text-white" />
        ) : (
          <Zap className="w-5 h-5 text-white" />
        )}
        {/* Badge indicador de tarea activa */}
        {!open && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white animate-pulse"
            style={{ background: '#F72C5B' }}
          />
        )}
      </button>
    </>
  );
};

export default PlannerTaskBubble;
