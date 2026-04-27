import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects';
import { FolderOpen, Plus, Trash2, Download } from 'lucide-react';

const ProjectsList: React.FC = () => {
  const navigate = useNavigate();
  const { projects, loading, error, removeProject, exportProject, addProject } = useProjects();
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      await addProject(newName.trim());
      setNewName('');
    } finally {
      setIsCreating(false);
    }
  };

  const handleExport = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setExportingId(id);
    try {
      await exportProject(id, name);
    } finally {
      setExportingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar este proyecto? Esta acción no se puede deshacer.')) return;
    await removeProject(id);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">Proyectos</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">
            Organiza tus imágenes generadas y referencias
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nombre del proyecto..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 w-48"
            disabled={isCreating}
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || isCreating}
            className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {isCreating ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-400 text-sm font-bold uppercase tracking-widest">
          Cargando proyectos...
        </div>
      )}
      {error && (
        <div className="text-red-500 text-center py-12 text-sm">{error}</div>
      )}

      {!loading && projects.length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-100">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No tienes proyectos aún.</p>
          <p className="text-slate-400 text-xs mt-1">Crea uno para empezar a organizar tus imágenes.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map(proj => {
          const thumbs = proj.items.slice(0, 4).map(i => i.url);
          const updatedAt = proj.updatedAt?.toDate ? proj.updatedAt.toDate() : new Date();

          return (
            <div
              key={proj.id}
              onClick={() => navigate(`/projects/${proj.id}`)}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden group cursor-pointer"
            >
              {/* Thumbnail grid */}
              <div className="grid grid-cols-2 gap-0.5 h-36 bg-slate-100">
                {thumbs.length === 0 ? (
                  <div className="col-span-2 flex items-center justify-center">
                    <FolderOpen className="w-8 h-8 text-slate-300" />
                  </div>
                ) : (
                  [...thumbs, ...Array(4 - thumbs.length).fill(null)].map((url, i) => (
                    <div key={i} className="overflow-hidden bg-slate-100">
                      {url ? (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-100" />
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-black text-base uppercase tracking-tighter text-slate-900 truncate">{proj.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {proj.items.length} {proj.items.length === 1 ? 'imagen' : 'imágenes'} · {updatedAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={(e) => handleExport(e, proj.id, proj.name)}
                      disabled={exportingId === proj.id}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Exportar ZIP"
                    >
                      {exportingId === proj.id ? (
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, proj.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Eliminar proyecto"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectsList;
