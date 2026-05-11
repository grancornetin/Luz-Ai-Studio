/**
 * ContentPlannerModule.tsx
 * "Publicar Studio" — Planificador de contenido social con copiloto elevado.
 * Integra: Copiloto IA + Remix Engine + Calendario visual + Captions.
 * No genera imágenes por sí mismo — orquesta los módulos existentes.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  Project, CalendarEntry, ChecklistItem,
  createProject, getProjects, saveCalendar, saveChecklist,
} from '../../services/projectService';
import ContentPlannerCopilot from './ContentPlannerCopilot';
import WeeklyCalendar from './WeeklyCalendar';
import RemixIdeasGrid, { RemixIdea } from './RemixIdeasGrid';
import { Sparkles, CalendarDays, Lightbulb, Plus, FolderOpen, ChevronRight, Loader2 } from 'lucide-react';

// ── Tabs del módulo ───────────────────────────────────────────

type Tab = 'copilot' | 'calendar' | 'remix';

const TAB_META: Record<Tab, { label: string; sublabel: string; icon: React.ReactNode }> = {
  copilot:  { label: 'Copiloto',   sublabel: 'Estrategia + captions',   icon: <Sparkles className="w-4 h-4" /> },
  calendar: { label: 'Calendario', sublabel: 'Plan semanal visual',      icon: <CalendarDays className="w-4 h-4" /> },
  remix:    { label: 'Remix',      sublabel: '30 ideas desde tus fotos', icon: <Lightbulb className="w-4 h-4" /> },
};

// ── Selector de proyecto ──────────────────────────────────────

interface ProjectSelectorProps {
  projects: Project[];
  selected: Project | null;
  onSelect: (p: Project) => void;
  onCreate: () => void;
  creating: boolean;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects, selected, onSelect, onCreate, creating,
}) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <FolderOpen className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Proyecto activo</span>
      </div>
      <button
        onClick={onCreate}
        disabled={creating}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
        style={{ background: 'rgba(247,44,91,0.08)', color: '#F72C5B' }}
      >
        {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        Nuevo
      </button>
    </div>

    {projects.length === 0 ? (
      <p className="text-xs text-slate-400 italic">No tenés proyectos aún. Creá uno para empezar.</p>
    ) : (
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
              selected?.id === p.id
                ? 'border-rose-200 text-rose-600 font-black'
                : 'border-slate-100 text-slate-700 hover:border-slate-200'
            }`}
            style={selected?.id === p.id ? { background: 'rgba(247,44,91,0.06)' } : { background: 'white' }}
          >
            <span className="text-xs truncate">{p.name}</span>
            {selected?.id === p.id && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#F72C5B' }} />}
          </button>
        ))}
      </div>
    )}
  </div>
);

// ── Módulo principal ──────────────────────────────────────────

const ContentPlannerModule: React.FC = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [activeTab,       setActiveTab]       = useState<Tab>('copilot');
  const [projects,        setProjects]        = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);

  // Estado derivado del proyecto activo (se actualiza desde el copiloto)
  const [calendar,  setCalendar]  = useState<CalendarEntry[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [remixIdeas, setRemixIdeas] = useState<RemixIdea[]>([]);

  // ── Cargar proyectos ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getProjects()
      .then(ps => {
        setProjects(ps);
        if (ps.length > 0 && !selectedProject) setSelectedProject(ps[0]);
      })
      .finally(() => setLoadingProjects(false));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar calendar/checklist cuando cambia el proyecto seleccionado
  useEffect(() => {
    if (!selectedProject) return;
    setCalendar(selectedProject.calendar ?? []);
    setChecklist(selectedProject.checklist ?? []);
  }, [selectedProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Crear nuevo proyecto ──────────────────────────────────────
  const handleCreateProject = useCallback(async () => {
    setCreatingProject(true);
    try {
      const name = `Plan ${new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`;
      const newProject = await createProject(name);
      setProjects(prev => [newProject, ...prev]);
      setSelectedProject(newProject);
      setCalendar([]);
      setChecklist([]);
      setRemixIdeas([]);
    } finally {
      setCreatingProject(false);
    }
  }, []);

  const handleSelectProject = (p: Project) => {
    setSelectedProject(p);
    setRemixIdeas([]);
    setActiveTab('copilot');
  };

  // ── Callbacks desde el Copiloto ───────────────────────────────
  const handleCalendarUpdate = useCallback((cal: CalendarEntry[]) => {
    setCalendar(cal);
    // Cambiar al tab de calendario para mostrar el resultado
    setActiveTab('calendar');
  }, []);

  const handleChecklistUpdate = useCallback((cl: ChecklistItem[]) => {
    setChecklist(cl);
  }, []);

  const handleRemixIdeas = useCallback((ideas: RemixIdea[]) => {
    setRemixIdeas(ideas);
    setActiveTab('remix');
  }, []);

  // ── Guardar calendario desde la vista semanal ─────────────────
  const handleCalendarSave = useCallback(async (updated: CalendarEntry[]) => {
    if (!selectedProject) return;
    setCalendar(updated);
    await saveCalendar(selectedProject.id, updated).catch(() => {});
  }, [selectedProject]);

  // ── Guardar checklist ─────────────────────────────────────────
  const handleChecklistSave = useCallback(async (updated: ChecklistItem[]) => {
    if (!selectedProject) return;
    setChecklist(updated);
    await saveChecklist(selectedProject.id, updated).catch(() => {});
  }, [selectedProject]);

  // ── Navegar a módulo de generación ───────────────────────────
  const handleNavigateModule = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // ── Loading inicial ───────────────────────────────────────────
  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#F72C5B' }} />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Cargando proyectos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(247,44,91,0.12)' }}>
              <CalendarDays className="w-4 h-4" style={{ color: '#F72C5B' }} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Publicar Studio</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            Ya tenés las fotos. Ahora te ayudamos a publicarlas con estrategia.
          </p>
        </div>
      </div>

      {/* ── Layout principal: sidebar izquierdo + contenido ── */}
      <div className="flex gap-6 items-start">

        {/* Sidebar de proyecto (desktop) */}
        <div className="hidden lg:block w-64 flex-shrink-0 space-y-4">
          <ProjectSelector
            projects={projects}
            selected={selectedProject}
            onSelect={handleSelectProject}
            onCreate={handleCreateProject}
            creating={creatingProject}
          />

          {/* Estadísticas rápidas del plan activo */}
          {selectedProject && (calendar.length > 0 || checklist.length > 0) && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan activo</p>
              {calendar.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Días planificados</span>
                  <span className="text-xs font-black" style={{ color: '#F72C5B' }}>{calendar.length}</span>
                </div>
              )}
              {calendar.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Completados</span>
                  <span className="text-xs font-black text-emerald-600">
                    {calendar.filter(e => e.status === 'done').length}
                  </span>
                </div>
              )}
              {checklist.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Tareas pendientes</span>
                  <span className="text-xs font-black text-amber-600">
                    {checklist.filter(i => i.status === 'pending').length}
                  </span>
                </div>
              )}
              {remixIdeas.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Ideas de remix</span>
                  <span className="text-xs font-black text-violet-600">{remixIdeas.length}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Área principal */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Sin proyecto seleccionado */}
          {!selectedProject ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: 'rgba(247,44,91,0.08)' }}>
                <CalendarDays className="w-8 h-8" style={{ color: '#F72C5B' }} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase italic">Creá tu primer plan</h2>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                  Empezá creando un proyecto para organizar tu contenido de la semana.
                </p>
              </div>
              <button
                onClick={handleCreateProject}
                disabled={creatingProject}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50"
                style={{ background: '#F72C5B', boxShadow: '0 8px 24px rgba(247,44,91,0.25)' }}
              >
                {creatingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Crear proyecto
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(Object.entries(TAB_META) as [Tab, typeof TAB_META[Tab]][]).map(([key, meta]) => {
                  const isActive = activeTab === key;
                  // Badge en tabs con contenido
                  const badge =
                    key === 'calendar' && calendar.length > 0 ? calendar.length :
                    key === 'remix'    && remixIdeas.length > 0 ? remixIdeas.length :
                    null;

                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-all flex-shrink-0 ${
                        isActive
                          ? 'border-rose-200 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                      }`}
                      style={isActive ? { background: 'rgba(247,44,91,0.06)', color: '#F72C5B', borderColor: 'rgba(247,44,91,0.3)' } : {}}
                    >
                      <span className={isActive ? '' : 'opacity-60'}>{meta.icon}</span>
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-black uppercase tracking-tight">{meta.label}</p>
                          {badge !== null && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: isActive ? '#F72C5B' : '#e2e8f0', color: isActive ? 'white' : '#64748b' }}>
                              {badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] opacity-60 hidden sm:block">{meta.sublabel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Contenido del tab activo */}
              {activeTab === 'copilot' && (
                <ContentPlannerCopilot
                  project={selectedProject}
                  onCalendarUpdate={handleCalendarUpdate}
                  onChecklistUpdate={handleChecklistUpdate}
                  onRemixIdeas={handleRemixIdeas}
                  onNavigateModule={handleNavigateModule}
                />
              )}

              {activeTab === 'calendar' && (
                <WeeklyCalendar
                  projectId={selectedProject.id}
                  calendar={calendar}
                  checklist={checklist}
                  onCalendarChange={handleCalendarSave}
                  onChecklistChange={handleChecklistSave}
                  onNavigateModule={handleNavigateModule}
                />
              )}

              {activeTab === 'remix' && (
                <RemixIdeasGrid
                  ideas={remixIdeas}
                  onNavigateModule={handleNavigateModule}
                  onRequestMore={() => setActiveTab('copilot')}
                />
              )}
            </>
          )}

          {/* Selector mobile */}
          <div className="lg:hidden">
            <ProjectSelector
              projects={projects}
              selected={selectedProject}
              onSelect={handleSelectProject}
              onCreate={handleCreateProject}
              creating={creatingProject}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentPlannerModule;
