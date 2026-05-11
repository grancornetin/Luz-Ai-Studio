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

// ── Estilos por módulo — tema claro ───────────────────────────
const moduleStyles: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  campaign:  {
    bg:     'bg-[#FFF0F4]',
    border: 'border-[#F72C5B]/20',
    text:   'text-[#F72C5B]',
    badge:  'bg-[#F72C5B] text-white',
  },
  photodump: {
    bg:     'bg-violet-50',
    border: 'border-violet-200',
    text:   'text-violet-700',
    badge:  'bg-violet-600 text-white',
  },
  ugc: {
    bg:     'bg-emerald-50',
    border: 'border-emerald-200',
    text:   'text-emerald-700',
    badge:  'bg-emerald-600 text-white',
  },
  catalog: {
    bg:     'bg-sky-50',
    border: 'border-sky-200',
    text:   'text-sky-700',
    badge:  'bg-sky-600 text-white',
  },
  prompt: {
    bg:     'bg-gray-50',
    border: 'border-gray-200',
    text:   'text-gray-600',
    badge:  'bg-gray-500 text-white',
  },
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

  // ── Estadísticas ──────────────────────────────────────────────
  const done   = localCalendar.filter(e => e.status === 'done').length;
  const total  = localCalendar.length;
  const streak = calcStreak(localCalendar);
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

  // ── Semanas ───────────────────────────────────────────────────
  const weeks        = groupByWeek(localCalendar);
  const weekKeys     = Object.keys(weeks).sort();
  const currentWeekIdx     = Math.min(Math.max(0, weekOffset), weekKeys.length - 1);
  const currentWeekKey     = weekKeys[currentWeekIdx];
  const currentEntries     = currentWeekKey ? weeks[currentWeekKey] : [];

  // ── Marcar entrada ────────────────────────────────────────────
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

  // ── Marcar checklist ──────────────────────────────────────────
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

  // ── Estado vacío ──────────────────────────────────────────────
  if (localCalendar.length === 0 && localChecklist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center space-y-4">
        <div className="w-14 h-14 bg-[#FFF0F4] border border-[#F72C5B]/20 rounded-2xl
                        flex items-center justify-center">
          <CalendarDays className="w-7 h-7 text-[#F72C5B]" />
        </div>
        <div>
          <p className="text-gray-700 font-black text-sm uppercase tracking-tight">Sin calendario aún</p>
          <p className="text-gray-400 text-xs mt-1 max-w-[200px] mx-auto leading-relaxed">
            Pedile al copiloto que te cree un plan de contenido o un calendario semanal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Stats de hábito ─────────────────────────────────── */}
      {localCalendar.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white border border-gray-100 rounded-2xl p-3.5 text-center shadow-sm">
            <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-xl font-black text-gray-900">{done}</p>
            <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Hechos</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-3.5 text-center shadow-sm">
            <Zap className="w-4 h-4 text-[#F72C5B] mx-auto mb-1" />
            <p className="text-xl font-black text-gray-900">{streak}</p>
            <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Seguidos</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-3.5 text-center shadow-sm">
            <Target className="w-4 h-4 text-violet-500 mx-auto mb-1" />
            <p className="text-xl font-black text-gray-900">{pct}%</p>
            <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Del plan</p>
          </div>
        </div>
      )}

      {/* ── Barra de progreso ────────────────────────────────── */}
      {localCalendar.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Progreso</p>
            <p className="text-[9px] font-black text-gray-500">{done} / {total}</p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#F72C5B] rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Calendario semanal ───────────────────────────────── */}
      {localCalendar.length > 0 && (
        <div className="space-y-3">

          {/* Navegación de semanas */}
          {weekKeys.length > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
                disabled={currentWeekIdx === 0}
                className="w-8 h-8 bg-white border border-gray-200 rounded-xl flex items-center justify-center
                           text-gray-400 hover:text-gray-700 hover:border-gray-300 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Semana {currentWeekIdx + 1} de {weekKeys.length}
              </p>
              <button
                onClick={() => setWeekOffset(w => Math.min(weekKeys.length - 1, w + 1))}
                disabled={currentWeekIdx === weekKeys.length - 1}
                className="w-8 h-8 bg-white border border-gray-200 rounded-xl flex items-center justify-center
                           text-gray-400 hover:text-gray-700 hover:border-gray-300 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Tarjetas de días */}
          <div className="space-y-2">
            {currentEntries.map(entry => {
              const style   = moduleStyles[entry.module] ?? moduleStyles.prompt;
              const isToday = entry.date === todayISO();
              return (
                <div
                  key={entry.id}
                  className={`rounded-2xl border p-3.5 transition-all shadow-sm ${style.bg} ${style.border} ${
                    entry.status === 'done' ? 'opacity-60' : ''
                  } ${isToday ? 'ring-2 ring-[#F72C5B]/20' : ''}`}
                >
                  <div className="flex items-start gap-3">

                    {/* Día */}
                    <div className="flex-shrink-0 text-center min-w-[40px]">
                      <p className="text-[8px] font-black text-gray-400 uppercase">
                        {entry.dayLabel.split(' ')[0]}
                      </p>
                      <p className={`text-xl font-black leading-none mt-0.5 ${isToday ? 'text-[#F72C5B]' : 'text-gray-800'}`}>
                        {entry.dayLabel.split(' ')[1]}
                      </p>
                      {isToday && (
                        <p className="text-[8px] font-black text-[#F72C5B] uppercase mt-0.5">Hoy</p>
                      )}
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
                          <p className={`text-xs font-black ${style.text} leading-tight`}>
                            {entry.contentType}
                          </p>
                          {entry.prompt && (
                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{entry.prompt}</p>
                          )}
                        </div>
                      </div>

                      {/* Acciones — pendiente */}
                      {entry.status !== 'done' && entry.status !== 'skipped' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => goToModule(entry)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2
                                       bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300
                                       rounded-xl text-[10px] font-black text-gray-600 uppercase tracking-widest
                                       transition-all shadow-sm"
                          >
                            <ArrowRight className="w-3 h-3" />
                            Generar
                          </button>
                          <button
                            onClick={() => toggleEntry(entry.id)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2
                                       bg-emerald-50 hover:bg-emerald-100 border border-emerald-200
                                       rounded-xl text-[10px] font-black text-emerald-700 uppercase tracking-widest
                                       transition-all"
                            title="Marcar como hecho"
                          >
                            <Check className="w-3 h-3" />
                            Listo
                          </button>
                          <button
                            onClick={() => skipEntry(entry.id)}
                            className="w-9 h-9 flex items-center justify-center
                                       bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200
                                       rounded-xl text-gray-400 hover:text-red-400 transition-all"
                            title="Saltar este día"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Completado */}
                      {entry.status === 'done' && (
                        <div className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                            Completado
                          </span>
                          <button
                            onClick={() => toggleEntry(entry.id)}
                            className="ml-auto text-[9px] text-gray-400 hover:text-gray-600 underline transition-colors"
                          >
                            Deshacer
                          </button>
                        </div>
                      )}

                      {/* Omitido */}
                      {entry.status === 'skipped' && (
                        <div className="flex items-center gap-1.5">
                          <X className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Omitido
                          </span>
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

      {/* ── Checklist de plan ────────────────────────────────── */}
      {localChecklist.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Plan de contenido
          </p>
          <div className="space-y-2">
            {localChecklist.map(item => {
              const style = moduleStyles[item.module] ?? moduleStyles.prompt;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all shadow-sm ${style.bg} ${style.border} ${
                    item.status === 'done' ? 'opacity-50' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`w-5 h-5 rounded-lg flex-shrink-0 border-2 flex items-center justify-center transition-all ${
                      item.status === 'done'
                        ? 'bg-emerald-500 border-emerald-500'
                        : `border-gray-300 hover:border-[#F72C5B]`
                    }`}
                  >
                    {item.status === 'done' && <Check className="w-3 h-3 text-white" />}
                  </button>

                  <span className={`text-xs flex-1 font-medium ${
                    item.status === 'done' ? 'line-through text-gray-400' : style.text
                  }`}>
                    {item.label}
                  </span>

                  {item.status !== 'done' && (
                    <button
                      onClick={() => {
                        const base = moduleRoute[item.module] ?? '/prompt-studio';
                        navigate(`${base}?${new URLSearchParams(item.params).toString()}`);
                      }}
                      className="flex-shrink-0 w-7 h-7 bg-white hover:bg-gray-50 border border-gray-200
                                 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700
                                 transition-all shadow-sm"
                      title="Ir al módulo"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-gray-400 font-medium text-center">
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