/**
 * PlannerList.tsx — Biblioteca de planes de contenido.
 * Solo muestra los planes creados: nombre, fecha, imágenes, estado del calendario.
 * Todo el trabajo ocurre en PlannerDetail (/planner/:id).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects';
import {
  CalendarDays, Plus, Trash2, Download, Sparkles,
  Loader2, CheckCircle2, Clock,
} from 'lucide-react';
// Loader2 se usa en el botón de exportar

const PlannerList: React.FC = () => {
  const navigate = useNavigate();
  const { projects, loading, error, removeProject, exportProject } = useProjects();
  const [exportingId, setExportingId] = useState<string | null>(null);
  const strategicPlans = projects.filter(project => project.growthPlan);

  const handleCreate = () => {
    navigate('/planner/nuevo');
  };

  const handleExport = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setExportingId(id);
    try { await exportProject(id, name); }
    finally { setExportingId(null); }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar este plan? Esta acción no se puede deshacer.')) return;
    await removeProject(id);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">
            Mis Planes
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
            Tu semana de contenido, organizada y lista para ejecutar
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-5 py-3 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg"
          style={{ background: '#F72C5B', boxShadow: '0 8px 24px rgba(247,44,91,0.25)' }}
        >
          <Plus className="w-4 h-4" />
          Nuevo plan
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-red-500 text-center py-12 text-sm">{error}</div>
      )}

      {/* Estado vacío */}
      {!loading && strategicPlans.length === 0 && (
        <div
          onClick={handleCreate}
          className="group text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 hover:border-rose-300 transition-all cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
            style={{ background: 'rgba(247,44,91,0.08)' }}>
            <CalendarDays className="w-8 h-8" style={{ color: '#F72C5B' }} />
          </div>
          <p className="text-slate-700 text-sm font-black uppercase italic tracking-tight">Armá tu primera semana</p>
          <p className="text-slate-400 text-xs mt-1.5 max-w-xs mx-auto">
            Contanos qué vendés y la IA arma un plan de publicaciones completo con captions, hashtags e instrucciones.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-all"
            style={{ background: '#F72C5B' }}>
            <Plus className="w-4 h-4" />
            Armar mi semana
          </div>
        </div>
      )}

      {/* Grid de planes */}
      {strategicPlans.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategicPlans.map(proj => {
            const thumbs     = proj.items.slice(0, 4).map(i => i.url);
            const updatedAt  = proj.updatedAt?.toDate ? proj.updatedAt.toDate() : new Date();
            const growthTasks = proj.growthPlan?.tasks ?? [];
            const totalDays  = growthTasks.length || proj.calendar?.length || 0;
            const doneDays   = growthTasks.length
              ? growthTasks.filter(task => task.status === 'ready' || task.status === 'published').length
              : proj.calendar?.filter(e => e.status === 'done').length ?? 0;
            const hasCalendar = totalDays > 0;
            const pct        = hasCalendar ? Math.round((doneDays / totalDays) * 100) : 0;

            return (
              <div
                key={proj.id}
                onClick={() => navigate(`/planner/${proj.id}`)}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 transition-all cursor-pointer overflow-hidden"
              >
                {/* Barra de progreso arriba */}
                <div className="h-1 bg-slate-100">
                  {hasCalendar && (
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: pct === 100 ? '#10B981' : '#F72C5B' }}
                    />
                  )}
                </div>

                {/* Mosaico de thumbnails */}
                <div className="grid grid-cols-2 gap-0.5 h-36 bg-slate-100">
                  {thumbs.length === 0 ? (
                    <div className="col-span-2 flex items-center justify-center bg-slate-50">
                      <Sparkles className="w-8 h-8 text-slate-200" />
                    </div>
                  ) : (
                    [...thumbs, ...Array(4 - thumbs.length).fill(null)].map((url, i) => (
                      <div key={i} className="overflow-hidden bg-slate-100">
                        {url
                          ? <img src={url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-slate-50" />
                        }
                      </div>
                    ))
                  )}
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-black text-sm uppercase italic tracking-tight text-slate-900 truncate">
                        {proj.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {hasCalendar ? (
                          <div className="flex items-center gap-1">
                            {pct === 100
                              ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              : <Clock className="w-3 h-3 text-slate-400" />
                            }
                            <span className={`text-[10px] font-black ${pct === 100 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {doneDays}/{totalDays} tareas
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300 italic">Sin plan aún</span>
                        )}
                        <span className="text-[10px] text-slate-300">·</span>
                        <span className="text-[10px] text-slate-300">
                          {updatedAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={e => handleExport(e, proj.id, proj.name)}
                        disabled={exportingId === proj.id}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Exportar ZIP"
                      >
                        {exportingId === proj.id
                          ? <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                          : <Download className="w-3.5 h-3.5 text-slate-400" />
                        }
                      </button>
                      <button
                        onClick={e => handleDelete(e, proj.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Barra de progreso visual */}
                  {hasCalendar && (
                    <div className="space-y-1">
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: pct === 100 ? '#10B981' : '#F72C5B' }}
                        />
                      </div>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{pct}% completado</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlannerList;
