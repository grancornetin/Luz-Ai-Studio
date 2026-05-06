import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getProject,
  removeItemFromProject,
  exportProjectAsZip,
  addItemToProject,
  Project,
  ProjectItem,
  updateProjectName,
} from '../../services/projectService';
import {
  ArrowLeft, Download, Trash2, Image as ImageIcon,
  Pencil, Check, X, Upload, MessageSquare, Images,
} from 'lucide-react';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import ProjectCopilot from './ProjectCopilot';
import { readAndCompressFile } from '../../utils/imageUtils';

type WorkspaceTab = 'images' | 'copilot';

const ProjectDetail: React.FC = () => {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();

  const [project,    setProject]    = useState<Project | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput,  setNameInput]  = useState('');
  const [uploading,  setUploading]  = useState(false);

  // Mobile tab state
  const [mobileTab,  setMobileTab]  = useState<WorkspaceTab>('copilot');

  // Lightbox
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
      await addItemToProject(id, {
        type: 'reference',
        url: base64,
        module: 'manual_upload',
        metadata: { filename: file.name },
      });
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px] text-slate-400 text-sm font-bold uppercase tracking-widest">
      Cargando proyecto...
    </div>
  );
  if (error)    return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!project) return <div className="p-8 text-center text-slate-500">Proyecto no encontrado</div>;

  const references = project.items.filter(i => i.type === 'reference');
  const results    = project.items.filter(i => i.type === 'result');
  const allItems   = project.items;

  // ── Image card ───────────────────────────────────────────────
  const ImageCard = ({ item }: { item: ProjectItem }) => (
    <div className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
      <img
        src={item.url}
        alt=""
        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
        onClick={() => openLightbox(allItems, item)}
      />
      <button
        onClick={() => handleRemoveItem(item.id)}
        className="absolute top-2 right-2 p-1.5 bg-black/50 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        title="Eliminar del proyecto"
      >
        <Trash2 className="w-3 h-3 text-white" />
      </button>
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[9px] text-white font-bold uppercase truncate">{item.module.replace(/_/g, ' ')}</p>
      </div>
    </div>
  );

  // ── Panel de imágenes ─────────────────────────────────────────
  const ImagesPanel = () => (
    <div className="space-y-6 h-full overflow-y-auto">

      {/* Subir referencia */}
      <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
        uploading
          ? 'border-indigo-300 bg-indigo-50 text-indigo-400'
          : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-400 hover:text-indigo-500'
      }`}>
        <input type="file" accept="image/*" className="hidden" onChange={handleUploadReference} disabled={uploading} />
        {uploading ? (
          <>
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest">Subiendo...</span>
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Subir referencia al proyecto</span>
          </>
        )}
      </label>

      {/* Referencias */}
      {references.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
            Referencias <span className="text-slate-300">({references.length})</span>
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {references.map(item => <ImageCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
            Generaciones <span className="text-slate-300">({results.length})</span>
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {results.map(item => <ImageCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {project.items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ImageIcon className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm font-medium">Sin imágenes aún</p>
          <p className="text-slate-400 text-xs mt-1">
            Subí una referencia o usá el copiloto para generar contenido
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full max-h-screen">

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-4 bg-white border-b border-slate-100 flex-shrink-0 flex-wrap gap-y-2">
        <button
          onClick={() => navigate('/projects')}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>

        {editingName ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
              className="text-xl font-black uppercase italic tracking-tighter text-slate-900 bg-transparent border-b-2 border-indigo-400 focus:outline-none flex-1 min-w-0"
            />
            <button onClick={handleSaveName} className="p-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 transition-colors">
              <Check className="w-4 h-4 text-indigo-600" />
            </button>
            <button onClick={() => setEditingName(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter text-slate-900 truncate">
              {project.name}
            </h1>
            <button onClick={() => setEditingName(true)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
              <Pencil className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">
            {project.items.length} imagen{project.items.length !== 1 ? 'es' : ''}
          </span>
          <button
            onClick={handleExport}
            disabled={isExporting || project.items.length === 0}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center gap-2 disabled:opacity-40 hover:bg-slate-700 transition-colors"
          >
            {isExporting
              ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Download className="w-3.5 h-3.5" />
            }
            <span className="hidden sm:inline">Exportar ZIP</span>
          </button>
        </div>
      </header>

      {/* ── MOBILE TABS ────────────────────────────────────── */}
      <div className="flex md:hidden border-b border-slate-100 bg-white flex-shrink-0">
        <button
          onClick={() => setMobileTab('copilot')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest transition-colors border-b-2 ${
            mobileTab === 'copilot'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Copiloto
        </button>
        <button
          onClick={() => setMobileTab('images')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest transition-colors border-b-2 ${
            mobileTab === 'images'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400'
          }`}
        >
          <Images className="w-4 h-4" />
          Imágenes
          {project.items.length > 0 && (
            <span className="bg-slate-200 text-slate-600 text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {project.items.length}
            </span>
          )}
        </button>
      </div>

      {/* ── WORKSPACE ──────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">

        {/* Mobile: una sola columna según tab */}
        <div className="md:hidden h-full p-4">
          {mobileTab === 'copilot'
            ? <ProjectCopilot project={project} />
            : <ImagesPanel />
          }
        </div>

        {/* Desktop: dos columnas */}
        <div className="hidden md:grid md:grid-cols-5 h-full gap-0">

          {/* Columna imágenes (40%) */}
          <div className="md:col-span-2 p-6 overflow-y-auto border-r border-slate-100 bg-slate-50/50">
            <ImagesPanel />
          </div>

          {/* Columna copiloto (60%) */}
          <div className="md:col-span-3 p-6 bg-slate-900 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
            <ProjectCopilot project={project} />
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
