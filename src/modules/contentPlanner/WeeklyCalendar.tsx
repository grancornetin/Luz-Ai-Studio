/**
 * WeeklyCalendar.tsx
 * Vista semanal visual del plan de contenido.
 * Muestra los días planificados con estado, horario y módulo sugerido.
 * Permite marcar como hecho, saltear y navegar al módulo de generación.
 */
import React, { useState, useMemo } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Check,
  SkipForward, Play, Flame, Target, ArrowRight,
} from 'lucide-react';
import { CalendarEntry, ChecklistItem } from '../../services/projectService';

// ── Tipos ─────────────────────────────────────────────────────

interface Props {
  projectId: string;
  calendar: CalendarEntry[];
  checklist: ChecklistItem[];
  onCalendarChange: (calendar: CalendarEntry[]) => void;
  onChecklistChange: (checklist: ChecklistItem[]) => void;
  onNavigateModule: (path: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────

const MODULE_ROUTES: Record<string, string> = {
  campaign:  '/prompt-studio?mode=campaign',
  photodump: '/prompt-studio?mode=photodump',
  ugc:       '/studio-pro',
  catalog:   '/productos',
  prompt:    '/prompt-studio',
  scene:     '/clonar',
  outfit:    '/outfit-extractor',
};

const MODULE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  campaign:  { label: 'Campaign',  color: '#F72C5B', bg: 'bg-rose-50',    border: 'border-rose-200' },
  photodump: { label: 'Photodump', color: '#7C3AED', bg: 'bg-violet-50',  border: 'border-violet-200' },
  ugc:       { label: 'UGC',       color: '#10B981', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  catalog:   { label: 'Product',   color: '#0EA5E9', bg: 'bg-sky-50',     border: 'border-sky-200' },
  prompt:    { label: 'Prompt',    color: '#64748b', bg: 'bg-slate-50',   border: 'border-slate-200' },
  scene:     { label: 'Scene',     color: '#D97706', bg: 'bg-amber-50',   border: 'border-amber-200' },
  outfit:    { label: 'Outfit',    color: '#C026D3', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200' },
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=domingo
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lunes
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.getDate()} ${start.toLocaleDateString('es-CL', { month: 'short' })} — ${end.getDate()} ${end.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })}`;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// ── Componente de entrada de calendario ──────────────────────

const CalendarEntryCard: React.FC<{
  entry: CalendarEntry;
  onToggleDone: () => void;
  onSkip: () => void;
  onGenerate: () => void;
}> = ({ entry, onToggleDone, onSkip, onGenerate }) => {
  const meta = MODULE_META[entry.module] || MODULE_META.prompt;
  const isDone    = entry.status === 'done';
  const isSkipped = entry.status === 'skipped';

  return (
    <div className={`rounded-xl border p-3 transition-all ${
      isDone    ? 'bg-emerald-50 border-emerald-200 opacity-80' :
      isSkipped ? 'bg-slate-50 border-slate-200 opacity-50' :
      `${meta.bg} ${meta.border}`
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-tight leading-tight ${isDone ? 'text-emerald-700' : isSkipped ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {entry.contentType}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full text-white"
              style={{ background: isDone ? '#10B981' : isSkipped ? '#94a3b8' : meta.color }}
            >
              {isDone ? 'Listo' : isSkipped ? 'Saltado' : meta.label}
            </span>
            {entry.notes && (
              <span className="text-[8px] text-slate-400">{entry.notes}</span>
            )}
          </div>
        </div>
      </div>

      {!isSkipped && entry.prompt && (
        <p className="text-[10px] text-slate-500 leading-snug mb-2 line-clamp-2">{entry.prompt}</p>
      )}

      {!isSkipped && (
        <div className="flex gap-1.5">
          <button
            onClick={onToggleDone}
            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${
              isDone
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
            }`}
          >
            <Check className="w-2.5 h-2.5" />
            {isDone ? 'Deshacer' : 'Listo'}
          </button>
          {!isDone && (
            <>
              <button
                onClick={onGenerate}
                className="flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-white transition-all flex items-center justify-center gap-1"
                style={{ background: meta.color }}
              >
                <Play className="w-2.5 h-2.5" />
                Generar
              </button>
              <button
                onClick={onSkip}
                className="py-1.5 px-2 rounded-lg text-[9px] font-black text-slate-400 hover:text-slate-600 bg-white border border-slate-200 hover:border-slate-300 transition-all"
                title="Saltear"
              >
                <SkipForward className="w-2.5 h-2.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────

const WeeklyCalendar: React.FC<Props> = ({
  calendar,
  checklist,
  onCalendarChange,
  onChecklistChange,
  onNavigateModule,
}) => {
  const today     = useMemo(() => new Date(), []);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(today));

  // ── Navegación de semanas ────────────────────────────────────
  const prevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d);
  };

  const goToday = () => setCurrentWeekStart(getWeekStart(today));

  // ── Días de la semana actual ─────────────────────────────────
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentWeekStart]);

  // ── Entradas agrupadas por día ───────────────────────────────
  const entriesByDay = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    for (const day of weekDays) {
      map[isoDate(day)] = [];
    }
    for (const entry of calendar) {
      if (map[entry.date] !== undefined) {
        map[entry.date].push(entry);
      }
    }
    return map;
  }, [calendar, weekDays]);

  // ── Estadísticas ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = calendar.length;
    const done    = calendar.filter(e => e.status === 'done').length;
    const pending = calendar.filter(e => e.status === 'pending').length;

    // Racha de días consecutivos completados hasta hoy
    let streak = 0;
    const sortedDone = calendar
      .filter(e => e.status === 'done')
      .map(e => e.date)
      .sort()
      .reverse();

    if (sortedDone.length > 0) {
      const check = new Date(today);
      check.setHours(0, 0, 0, 0);
      for (const dateStr of sortedDone) {
        if (isoDate(check) === dateStr) {
          streak++;
          check.setDate(check.getDate() - 1);
        } else break;
      }
    }

    return { total, done, pending, streak };
  }, [calendar, today]);

  // ── Acciones sobre entradas ──────────────────────────────────
  const updateEntryStatus = (id: string, status: CalendarEntry['status']) => {
    const updated = calendar.map(e => e.id === id ? { ...e, status } : e);
    onCalendarChange(updated);
  };

  const handleGenerate = (entry: CalendarEntry) => {
    const basePath = MODULE_ROUTES[entry.module] || MODULE_ROUTES.prompt;
    const hasParams = Object.keys(entry.params || {}).length > 0;
    const path = hasParams
      ? `${basePath.includes('?') ? basePath + '&' : basePath + '?'}${new URLSearchParams(entry.params).toString()}`
      : basePath;
    onNavigateModule(path);
  };

  // ── Checklist ─────────────────────────────────────────────────
  const toggleChecklist = (id: string) => {
    const updated = checklist.map(i =>
      i.id === id ? { ...i, status: i.status === 'done' ? 'pending' : 'done' } : i
    ) as ChecklistItem[];
    onChecklistChange(updated);
  };

  // ── Estado vacío ──────────────────────────────────────────────
  if (calendar.length === 0 && checklist.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: 'rgba(247,44,91,0.08)' }}>
          <CalendarDays className="w-7 h-7" style={{ color: '#F72C5B' }} />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-800 uppercase italic">Sin plan todavía</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
            Usá el Copiloto para generar tu calendario semanal. Solo decile qué vendés y cuántas veces querés publicar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Stats rápidas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: <CalendarDays className="w-4 h-4" />, label: 'Días',      value: stats.total,   color: '#F72C5B' },
          { icon: <Check className="w-4 h-4" />,         label: 'Listos',    value: stats.done,    color: '#10B981' },
          { icon: <Target className="w-4 h-4" />,        label: 'Pendientes',value: stats.pending, color: '#F59E0B' },
          { icon: <Flame className="w-4 h-4" />,         label: 'Racha',     value: stats.streak,  color: '#EF4444' },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-1">
            <span style={{ color: s.color }}>{s.icon}</span>
            <span className="text-xl font-black text-slate-800">{s.value}</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Navegación de semana */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <button
            onClick={prevWeek}
            className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{formatWeekRange(currentWeekStart)}</p>
            <button
              onClick={goToday}
              className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border"
              style={{ background: 'rgba(247,44,91,0.06)', borderColor: 'rgba(247,44,91,0.2)', color: '#F72C5B' }}
            >
              Hoy
            </button>
          </div>

          <button
            onClick={nextWeek}
            className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Grilla de 7 días */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {weekDays.map((day, i) => {
            const dayIso   = isoDate(day);
            const isToday  = dayIso === isoDate(today);
            const entries  = entriesByDay[dayIso] || [];
            const hasDone  = entries.some(e => e.status === 'done');
            const hasPend  = entries.some(e => e.status === 'pending');

            return (
              <div
                key={dayIso}
                className={`flex flex-col items-center py-3 px-1 border-r last:border-r-0 border-slate-100 ${isToday ? '' : ''}`}
                style={isToday ? { background: 'rgba(247,44,91,0.04)' } : {}}
              >
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{DAY_NAMES[i]}</p>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center mt-1 ${isToday ? 'text-white' : 'text-slate-700'}`}
                  style={isToday ? { background: '#F72C5B' } : {}}>
                  <span className="text-xs font-black">{day.getDate()}</span>
                </div>
                <div className="flex gap-0.5 mt-1.5 h-2">
                  {hasDone && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  {hasPend && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detalle del día seleccionado — lista por día */}
        <div className="p-4 space-y-4">
          {weekDays.map(day => {
            const dayIso  = isoDate(day);
            const entries = entriesByDay[dayIso] || [];
            if (entries.length === 0) return null;

            const isToday = dayIso === isoDate(today);

            return (
              <div key={dayIso}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                    {day.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </span>
                  {isToday && (
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full text-white" style={{ background: '#F72C5B' }}>Hoy</span>
                  )}
                </div>
                <div className="space-y-2">
                  {entries.map(entry => (
                    <CalendarEntryCard
                      key={entry.id}
                      entry={entry}
                      onToggleDone={() => updateEntryStatus(entry.id, entry.status === 'done' ? 'pending' : 'done')}
                      onSkip={() => updateEntryStatus(entry.id, 'skipped')}
                      onGenerate={() => handleGenerate(entry)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Días fuera de la semana actual con entradas */}
          {calendar.filter(e => !Object.keys(entriesByDay).includes(e.date)).length > 0 && (
            <div className="text-center py-4 text-xs text-slate-400">
              Navegá entre semanas para ver el resto del calendario
            </div>
          )}

          {weekDays.every(d => (entriesByDay[isoDate(d)] || []).length === 0) && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">Sin contenido planificado para esta semana.</p>
              <p className="text-xs text-slate-300 mt-1">Navegá a otra semana o pedile al Copiloto que arme un plan.</p>
            </div>
          )}
        </div>
      </div>

      {/* Checklist de tareas */}
      {checklist.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Plan de tareas</p>
            <span className="text-[9px] font-black text-slate-400">
              {checklist.filter(i => i.status === 'done').length}/{checklist.length} completadas
            </span>
          </div>
          <div className="space-y-2">
            {checklist.map(item => {
              const meta = MODULE_META[item.module] || MODULE_META.prompt;
              return (
                <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  item.status === 'done' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <button
                    onClick={() => toggleChecklist(item.id)}
                    className={`w-5 h-5 rounded-lg flex-shrink-0 border-2 flex items-center justify-center transition-all ${
                      item.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-emerald-400'
                    }`}
                  >
                    {item.status === 'done' && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className={`text-xs flex-1 ${item.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {item.label}
                  </span>
                  {item.status !== 'done' && (
                    <button
                      onClick={() => onNavigateModule(`${MODULE_ROUTES[item.module] || MODULE_ROUTES.prompt}?${new URLSearchParams(item.params || {}).toString()}`)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase text-white transition-all flex-shrink-0"
                      style={{ background: meta.color }}
                    >
                      Ir <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyCalendar;
