import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getProject, removeItemFromProject, exportProjectAsZip, addItemToProject,
  updateProjectName, Project, ProjectItem, ChecklistItem, CalendarEntry,
} from '../../services/projectService';
import {
  ArrowLeft, Download, Trash2, Image as ImageIcon,
  Pencil, Check, X, Upload, MessageSquare, Images, CalendarDays,
} from 'lucide-react';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { readAndCompressFile } from '../../utils/imageUtils';
import ProjectCopilot from './ProjectCopilot';
import ProjectCalendar from './ProjectCalendar';

type WorkspaceTab = 'copilot' | 'images' | 'calendar';

const ProjectDetail: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project,     setProject]     = useState<Project | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState('');
  const [uploading,   setUploading]   = useState(false);
  const [mobileTab,   setMobileTab]   = useState<WorkspaceTab>('copilot');

  const [lightboxOpen,   setLightboxOpen]   = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex,  setLightboxIndex]  = useState(0);

  const loadProject = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const proj = await getProject(id);
      if (!proj) throw new Error('Proyecto no encontrado');
      setProject(proj);
      setNameInput(proj.name);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const handleRemoveItem = async (itemId: string) => {
    if (!id || !project) return;
    if (!window.confirm('¿Eliminar esta imagen del proyecto?')) return;
    await removeItemFromProject(id, itemId);
    await loadProject();
  };

  const handleExport = async () => {
    if (!id || !project) return;
    setIsExporting(true);
    try { await exportProjectAsZip(id, project.name); }
    catch (err: any) { alert('Error al exportar: ' + err.message); }
    finally { setIsExporting(false); }
  };

  const handleSaveName = async () => {
    if (!id || !nameInput.trim() || !project) return;
    await updateProjectName(id, nameInput.trim());
    setProject(prev => prev ? { ...prev, name: nameInput.trim() } : prev);
    setEditingName(false);
  };

  const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    try {
      const base64 = await readAndCompressFile(file);
      await addItemToProject(id, { type: 'reference', url: base64, module: 'manual_upload', metadata: { filename: file.name } });
      await loadProject();
    } catch (err: any) {
      alert('Error al subir imagen: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const openLightbox = (items: ProjectItem[], clicked: ProjectItem) => {
    setLightboxImages(items.map(i => i.url));
    setLightboxIndex(items.findIndex(i => i.id === clicked.id));
    setLightboxOpen(true);
  };

  const handleChecklistUpdate = (checklist: ChecklistItem[]) => {
    setProject(prev => prev ? { ...prev, checklist } : prev);
  };
  const handleCalendarUpdate = (calendar: CalendarEntry[]) => {
    setProject(prev => prev ? { ...prev, calendar } : prev);
    setMobileTab('calendar');
  };

  // ── Loading / Error ──────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px] text-gray-400 text-sm font-bold uppercase tracking-widest animate-pulse">
      Cargando proyecto...
    </div>
  );
  if (error)    return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!project) return <div className="p-8 text-center text-gray-500">Proyecto no encontrado</div>;

  const references = project.items.filter(i => i.type === 'reference');
  const results    = project.items.filter(i => i.type === 'result');
  const allItems   = project.items;
  const hasCalendar = (project.calendar?.length ?? 0) > 0 || (project.checklist?.length ?? 0) > 0;

  // ── Image Card ───────────────────────────────────────────────
  const ImageCard = ({ item }: { item: ProjectItem }) => (
    <div className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200
                    hover:border-[#F72C5B]/30 transition-all shadow-sm">
      <img
        src={item.url} alt=""
        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
        onClick={() => openLightbox(allItems, item)}
      />
      <button
        onClick={() => handleRemoveItem(item.id)}
        className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-full shadow
                   opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
      >
        <Trash2 className="w-3 h-3 text-red-400" />
      </button>
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent
                      opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[9px] text-white font-bold uppercase truncate">{item.module.replace(/_/g, ' ')}</p>
      </div>
    </div>
  );

  // ── Images Panel ─────────────────────────────────────────────
  const ImagesPanel = () => (
    <div className="space-y-5">
      {/* Upload */}
      <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed
        transition-all cursor-pointer ${
          uploading
            ? 'border-[#F72C5B]/40 bg-[#FFF0F4] text-[#F72C5B]'
            : 'border-gray-200 hover:border-[#F72C5B]/40 hover:bg-[#FFF0F4] text-gray-400 hover:text-[#F72C5B]'
        }`}>
        <input type="file" accept="image/*" className="hidden" onChange={handleUploadReference} disabled={uploading} />
        {uploading
          ? <><div className="w-4 h-4 border-2 border-[#F72C5B] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Subiendo...</span></>
          : <><Upload className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Subir referencia</span></>
        }
      </label>

      {/* Referencias */}
      {references.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            Referencias
            <span className="bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full text-[9px]">
              {references.length}
            </span>
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {references.map(item => <ImageCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {/* Generaciones */}
      {results.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            Generaciones
            <span className="bg-[#FFF0F4] text-[#F72C5B] px-1.5 py-0.5 rounded-full text-[9px] border border-[#F72C5B]/15">
              {results.length}
            </span>
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {results.map(item => <ImageCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {/* Vacío */}
      {project.items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-center mb-3">
            <ImageIcon className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-gray-500 text-sm font-medium">Sin imágenes aún</p>
          <p className="text-gray-400 text-xs mt-1">Subí una referencia o usá el copiloto</p>
        </div>
      )}
    </div>
  );

  // ── Tabs config ───────────────────────────────────────────────
  const TABS: { id: WorkspaceTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'copilot',  label: 'Copiloto', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'images',   label: 'Imágenes', icon: <Images className="w-4 h-4" />, badge: project.items.length || undefined },
    { id: 'calendar', label: 'Plan',     icon: <CalendarDays className="w-4 h-4" />,
      badge: hasCalendar ? (project.calendar?.filter(e => e.status === 'done').length ?? 0) || undefined : undefined },
  ];

  return (
    <div className="flex flex-col h-full max-h-screen bg-[#F4F6F9]">

      {/* ── HEADER ────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-gray-100 flex-shrink-0 flex-wrap gap-y-2 shadow-sm">
        <button
          onClick={() => navigate('/projects')}
          className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>

        {editingName ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              autoFocus type="text" value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
              className="text-xl font-black uppercase italic tracking-tighter text-gray-900 bg-transparent
                         border-b-2 border-[#F72C5B] focus:outline-none flex-1 min-w-0"
            />
            <button
              onClick={handleSaveName}
              className="p-1.5 rounded-lg bg-[#FFF0F4] hover:bg-[#fce0e7] transition-colors"
            >
              <Check className="w-4 h-4 text-[#F72C5B]" />
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter text-gray-900 truncate">
              {project.name}
            </h1>
            <button
              onClick={() => setEditingName(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <Pencil className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <ModuleTutorial moduleId="projectCopilot" steps={TUTORIAL_CONFIGS.projectCopilot} label="¿Cómo funciona?" compact />
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest hidden sm:block">
            {project.items.length} imagen{project.items.length !== 1 ? 'es' : ''}
          </span>
          <button
            onClick={handleExport}
            disabled={isExporting || project.items.length === 0}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl font-bold text-xs flex items-center gap-2
                       disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            {isExporting
              ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Download className="w-3.5 h-3.5" />
            }
            <span className="hidden sm:inline">Exportar ZIP</span>
          </button>
        </div>
      </header>

      {/* ── TABS MOBILE ───────────────────────────────────────── */}
      <div className="flex md:hidden border-b border-gray-100 bg-white flex-shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setMobileTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-black uppercase tracking-widest
              transition-colors border-b-2 relative ${
              mobileTab === tab.id
                ? 'border-[#F72C5B] text-[#F72C5B]'
                : 'border-transparent text-gray-400'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && (
              <span className="bg-gray-100 text-gray-500 text-[9px] font-black px-1.5 py-0.5 rounded-full ml-0.5">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── WORKSPACE ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">

        {/* Mobile */}
        <div className="md:hidden h-full overflow-y-auto p-4">
          {mobileTab === 'copilot' && (
            <div className="h-full" style={{ minHeight: '70vh' }}>
              <ProjectCopilot
                project={project}
                onChecklistUpdate={handleChecklistUpdate}
                onCalendarUpdate={handleCalendarUpdate}
              />
            </div>
          )}
          {mobileTab === 'images' && <ImagesPanel />}
          {mobileTab === 'calendar' && (
            <ProjectCalendar
              projectId={project.id}
              calendar={project.calendar ?? []}
              checklist={project.checklist ?? []}
              onCalendarChange={handleCalendarUpdate}
              onChecklistChange={handleChecklistUpdate}
            />
          )}
        </div>

        {/* Desktop: 3 columnas */}
        <div className="hidden md:grid md:grid-cols-12 h-full">

          {/* Imágenes — 30% */}
          <div className="md:col-span-3 p-5 overflow-y-auto border-r border-gray-100 bg-white">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">
              Imágenes del proyecto
            </p>
            <ImagesPanel />
          </div>

          {/* Copiloto — 45% */}
          <div className="md:col-span-5 bg-white overflow-hidden flex flex-col border-r border-gray-100" style={{ minHeight: 0 }}>
            <ProjectCopilot
              project={project}
              onChecklistUpdate={handleChecklistUpdate}
              onCalendarUpdate={handleCalendarUpdate}
            />
          </div>

          {/* Calendario — 25% */}
          <div className="md:col-span-4 p-5 overflow-y-auto bg-[#F4F6F9]">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">
              Plan de contenido
            </p>
            <ProjectCalendar
              projectId={project.id}
              calendar={project.calendar ?? []}
              checklist={project.checklist ?? []}
              onCalendarChange={handleCalendarUpdate}
              onChecklistChange={handleChecklistUpdate}
            />
          </div>

        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onDownload={(url, idx) => {
            const link = document.createElement('a');
            link.href = url;
            link.download = `project_image_${idx + 1}.png`;
            link.click();
          }}
        />
      )}
    </div>
  );
};

export default ProjectDetail;