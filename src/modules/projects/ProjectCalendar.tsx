/**
 * ProjectCalendar.tsx
 * Vista semanal del calendario de contenido del proyecto.
 * Sistema de hábitos: el usuario marca cada día como hecho.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, Check, X, ArrowRight, Zap,
  TrendingUp, Target, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { CalendarEntry, ChecklistItem, updateCalendarEntryStatus, updateChecklistItemStatus } from '../../services/projectService';

interface ProjectCalendarProps {
  projectId: string;
  calendar: CalendarEntry[];
  checklist: ChecklistItem[];
  onCalendarChange: (updated: CalendarEntry[]) => void;
  onChecklistChange: (updated: ChecklistItem[]) => void;
}

// ── Colores por módulo ────────────────────────────────────────
const moduleStyles: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  campaign:  { bg: 'bg-brand-600/10',  border: 'border-brand-500/30',  text: 'text-brand-300',   badge: 'bg-brand-600 text-white' },
  photodump: { bg: 'bg-violet-600/10', border: 'border-violet-500/30', text: 'text-violet-300',  badge: 'bg-violet-600 text-white' },
  ugc:       { bg: 'bg-emerald-600/10',border: 'border-emerald-500/30',text: 'text-emerald-300', badge: 'bg-emerald-600 text-white' },
  catalog:   { bg: 'bg-sky-600/10',    border: 'border-sky-500/30',    text: 'text-sky-300',     badge: 'bg-sky-600 text-white' },
  prompt:    { bg: 'bg-slate-700/30',  border: 'border-slate-600/30',  text: 'text-slate-300',   badge: 'bg-slate-600 text-white' },
};

const moduleLabel: Record<string, string> = {
  campaign:  'Campaign',
  photodump: 'Photodump',
  ugc:       'UGC Studio',
  catalog:   'Catálogo',
  prompt:    'Prompt Studio',
};

const moduleRoute: Record<string, string> = {
  campaign:  '/prompt-studio',
  photodump: '/prompt-studio',
  ugc:       '/studio-pro',
  catalog:   '/productos',
  prompt:    '/prompt-studio',
};

// ── Componente principal ──────────────────────────────────────
const ProjectCalendar: React.FC<ProjectCalendarProps> = ({
  projectId,
  calendar,
  checklist,
  onCalendarChange,
  onChecklistChange,
}) => {
  const navigate = useNavigate();
  const [localCalendar,  setLocalCalendar]  = useState<CalendarEntry[]>(calendar);
  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>(checklist);
  const [weekOffset, setWeekOffset] = useState(0);

  // ── Estadísticas de hábito ────────────────────────────────────
  const done    = localCalendar.filter(e => e.status === 'done').length;
  const total   = localCalendar.length;
  const streak  = calcStreak(localCalendar);
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

  // ── Semanas ───────────────────────────────────────────────────
  const weeks  = groupByWeek(localCalendar);
  const weekKeys = Object.keys(weeks).sort();
  const currentWeekIdx = Math.min(Math.max(0, weekOffset), weekKeys.length - 1);
  const currentWeekKey = weekKeys[currentWeekIdx];
  const currentEntries = currentWeekKey ? weeks[currentWeekKey] : [];

  // ── Marcar entrada del calendario ────────────────────────────
  const toggleEntry = async (entryId: string) => {
    const entry = localCalendar.find(e => e.id === entryId);
    if (!entry) return;
    const newStatus: CalendarEntry['status'] = entry.status === 'done' ? 'pending' : 'done';
    const updated = localCalendar.map(e => e.id === entryId ? { ...e, status: newStatus } : e);
    setLocalCalendar(updated);
    onCalendarChange(updated);
    await updateCalendarEntryStatus(projectId, entryId, newStatus).catch(() => {});
  };

  const skipEntry = async (entryId: string) => {
    const updated = localCalendar.map(e => e.id === entryId ? { ...e, status: 'skipped' as const } : e);
    setLocalCalendar(updated);
    onCalendarChange(updated);
    await updateCalendarEntryStatus(projectId, entryId, 'skipped').catch(() => {});
  };

  // ── Marcar ítem de checklist ──────────────────────────────────
  const toggleChecklistItem = async (itemId: string) => {
    const item = localChecklist.find(i => i.id === itemId);
    if (!item) return;
    const newStatus: ChecklistItem['status'] = item.status === 'done' ? 'pending' : 'done';
    const updated = localChecklist.map(i => i.id === itemId ? { ...i, status: newStatus } : i);
    setLocalChecklist(updated);
    onChecklistChange(updated);
    await updateChecklistItemStatus(projectId, itemId, newStatus).catch(() => {});
  };

  // ── Ir a módulo ───────────────────────────────────────────────
  const goToModule = (entry: CalendarEntry) => {
    const base = moduleRoute[entry.module] ?? '/prompt-studio';
    const params = new URLSearchParams(entry.params);
    navigate(`${base}?${params.toString()}`);
  };

  if (localCalendar.length === 0 && localChecklist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
          <CalendarDays className="w-8 h-8 text-indigo-400" />
        </div>
        <div>
          <p className="text-white font-black text-sm uppercase tracking-tight">Sin calendario aún</p>
          <p className="text-slate-500 text-xs mt-1">Pedile al copiloto que te cree un plan de contenido o un calendario semanal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Stats de hábito ────────────────────────────────── */}
      {localCalendar.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-white">{done}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Completados</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Zap className="w-4 h-4 text-brand-400" />
            </div>
            <p className="text-2xl font-black text-white">{streak}</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Días seguidos</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Target className="w-4 h-4 text-violet-400" />
            </div>
            <p className="text-2xl font-black text-white">{pct}%</p>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Del plan</p>
          </div>
        </div>
      )}

      {/* Barra de progreso global */}
      {localCalendar.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Progreso del plan</p>
            <p className="text-[9px] font-black text-slate-400">{done} / {total}</p>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Calendario semanal ─────────────────────────────── */}
      {localCalendar.length > 0 && (
        <div className="space-y-3">
          {/* Navegación de semanas */}
          {weekKeys.length > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
                disabled={currentWeekIdx === 0}
                className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Semana {currentWeekIdx + 1} de {weekKeys.length}
              </p>
              <button
                onClick={() => setWeekOffset(w => Math.min(weekKeys.length - 1, w + 1))}
                disabled={currentWeekIdx === weekKeys.length - 1}
                className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Tarjetas de días */}
          <div className="space-y-2">
            {currentEntries.map(entry => {
              const style = moduleStyles[entry.module] ?? moduleStyles.prompt;
              const isToday = entry.date === todayISO();
              return (
                <div
                  key={entry.id}
                  className={`rounded-2xl border p-4 transition-all ${style.bg} ${style.border} ${
                    entry.status === 'done' ? 'opacity-60' : ''
                  } ${isToday ? 'ring-1 ring-indigo-500/40' : ''}`}
                >
                  <div className="flex items-start gap-3">

                    {/* Día */}
                    <div className="flex-shrink-0 text-center min-w-[44px]">
                      <p className="text-[8px] font-black text-slate-500 uppercase">{entry.dayLabel.split(' ')[0]}</p>
                      <p className={`text-xl font-black leading-none mt-0.5 ${isToday ? 'text-indigo-400' : 'text-white'}`}>
                        {entry.dayLabel.split(' ')[1]}
                      </p>
                      {isToday && <p className="text-[8px] font-black text-indigo-400 uppercase mt-0.5">Hoy</p>}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${style.badge}`}>
                              {moduleLabel[entry.module] ?? entry.module}
                            </span>
                          </div>
                          <p className={`text-xs font-black ${style.text} leading-tight`}>{entry.contentType}</p>
                          {entry.prompt && (
                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{entry.prompt}</p>
                          )}
                        </div>
                      </div>

                      {/* Acciones */}
                      {entry.status !== 'done' && entry.status !== 'skipped' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => goToModule(entry)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-all"
                          >
                            <ArrowRight className="w-3 h-3" />
                            Generar
                          </button>
                          <button
                            onClick={() => toggleEntry(entry.id)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 rounded-xl text-[10px] font-black text-emerald-300 uppercase tracking-widest transition-all"
                            title="Marcar como hecho"
                          >
                            <Check className="w-3 h-3" />
                            Listo
                          </button>
                          <button
                            onClick={() => skipEntry(entry.id)}
                            className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 rounded-xl text-slate-600 hover:text-red-400 transition-all"
                            title="Saltar este día"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {entry.status === 'done' && (
                        <div className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Completado</span>
                          <button
                            onClick={() => toggleEntry(entry.id)}
                            className="ml-auto text-[9px] text-slate-600 hover:text-slate-400 underline transition-colors"
                          >
                            Deshacer
                          </button>
                        </div>
                      )}

                      {entry.status === 'skipped' && (
                        <div className="flex items-center gap-1.5">
                          <X className="w-3.5 h-3.5 text-slate-600" />
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Omitido</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Checklist de plan ──────────────────────────────── */}
      {localChecklist.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan de contenido</p>
          <div className="space-y-2">
            {localChecklist.map(item => {
              const style = moduleStyles[item.module] ?? moduleStyles.prompt;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${style.bg} ${style.border} ${
                    item.status === 'done' ? 'opacity-50' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`w-5 h-5 rounded-lg flex-shrink-0 border-2 flex items-center justify-center transition-all ${
                      item.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-emerald-500'
                    }`}
                  >
                    {item.status === 'done' && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className={`text-xs flex-1 font-medium ${item.status === 'done' ? 'line-through text-slate-500' : style.text}`}>
                    {item.label}
                  </span>
                  {item.status !== 'done' && (
                    <button
                      onClick={() => {
                        const base = moduleRoute[item.module] ?? '/prompt-studio';
                        navigate(`${base}?${new URLSearchParams(item.params).toString()}`);
                      }}
                      className="flex-shrink-0 w-7 h-7 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-all"
                      title="Ir al módulo"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-slate-600 font-medium text-center">
            {localChecklist.filter(i => i.status === 'done').length} de {localChecklist.length} completados
          </p>
        </div>
      )}
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function groupByWeek(entries: CalendarEntry[]): Record<string, CalendarEntry[]> {
  const weeks: Record<string, CalendarEntry[]> = {};
  entries.forEach(e => {
    const d = new Date(e.date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const key = monday.toISOString().split('T')[0];
    if (!weeks[key]) weeks[key] = [];
    weeks[key].push(e);
  });
  return weeks;
}

function calcStreak(entries: CalendarEntry[]): number {
  const today = todayISO();
  const sorted = entries
    .filter(e => e.status === 'done' && e.date <= today)
    .map(e => e.date)
    .sort()
    .reverse();

  if (sorted.length === 0) return 0;

  let streak = 0;
  let current = new Date(today);

  for (const dateStr of sorted) {
    const d = new Date(dateStr);
    const diff = Math.round((current.getTime() - d.getTime()) / 86400000);
    if (diff <= 1) {
      streak++;
      current = d;
    } else {
      break;
    }
  }
  return streak;
}

export default ProjectCalendar;
