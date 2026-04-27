import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getProject,
  removeItemFromProject,
  exportProjectAsZip,
  Project,
  ProjectItem,
} from '../../services/projectService';
import { ArrowLeft, Download, Trash2, Image as ImageIcon, Pencil, Check, X } from 'lucide-react';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { updateProjectName } from '../../services/projectService';

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

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

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleRemoveItem = async (itemId: string) => {
    if (!id || !project) return;
    if (!window.confirm('¿Eliminar esta imagen del proyecto?')) return;
    await removeItemFromProject(id, itemId);
    await loadProject();
  };

  const handleExport = async () => {
    if (!id || !project) return;
    setIsExporting(true);
    try {
      await exportProjectAsZip(id, project.name);
    } catch (err: any) {
      alert('Error al exportar: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveName = async () => {
    if (!id || !nameInput.trim() || !project) return;
    await updateProjectName(id, nameInput.trim());
    setProject(prev => prev ? { ...prev, name: nameInput.trim() } : prev);
    setEditingName(false);
  };

  const openLightbox = (allItems: ProjectItem[], clickedItem: ProjectItem) => {
    const urls = allItems.map(i => i.url);
    const idx = allItems.findIndex(i => i.id === clickedItem.id);
    setLightboxImages(urls);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  if (loading) return <div className="p-8 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">Cargando proyecto...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!project) return <div className="p-8 text-center text-slate-500">Proyecto no encontrado</div>;

  const references = project.items.filter(i => i.type === 'reference');
  const results = project.items.filter(i => i.type === 'result');

  const ImageCard = ({ item, allItems }: { item: ProjectItem; allItems: ProjectItem[] }) => (
    <div className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
      <img
        src={item.url}
        alt=""
        className="w-full h-full object-cover cursor-pointer"
        onClick={() => openLightbox(allItems, item)}
      />
      <button
        onClick={() => handleRemoveItem(item.id)}
        className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        title="Eliminar del proyecto"
      >
        <Trash2 className="w-3 h-3 text-red-500" />
      </button>
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[9px] text-white font-bold uppercase truncate">{item.module}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/projects')} className="p-2 rounded-full hover:bg-slate-100 transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>

        {editingName ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
              className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 bg-transparent border-b-2 border-indigo-400 focus:outline-none flex-1"
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
            <h1 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-slate-900 truncate">{project.name}</h1>
            <button onClick={() => setEditingName(true)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
              <Pencil className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={isExporting || project.items.length === 0}
          className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 hover:bg-indigo-700 transition-colors flex-shrink-0"
        >
          {isExporting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Exportar ZIP
        </button>
      </div>

      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest -mt-2 pl-11">
        {project.items.length} {project.items.length === 1 ? 'imagen' : 'imágenes'} en total
      </p>

      {/* Referencias */}
      {references.length > 0 && (
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">
            Referencias <span className="text-slate-300">({references.length})</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {references.map(item => (
              <ImageCard key={item.id} item={item} allItems={references} />
            ))}
          </div>
        </section>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">
            Generaciones <span className="text-slate-300">({results.length})</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {results.map(item => (
              <ImageCard key={item.id} item={item} allItems={results} />
            ))}
          </div>
        </section>
      )}

      {project.items.length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-100">
          <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Este proyecto aún no tiene imágenes.</p>
          <p className="text-slate-400 text-xs mt-1">Agrega desde cualquier módulo con el botón <strong>Agregar a proyecto</strong>.</p>
        </div>
      )}

      {lightboxOpen && (
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
