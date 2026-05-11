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

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-gray-900">
            Proyectos
          </h1>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mt-1">
            Organiza tus imágenes generadas y referencias
          </p>
        </div>

        {/* Crear nuevo proyecto */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nombre del proyecto..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400
                       focus:outline-none focus:border-[#F72C5B] focus:ring-2 focus:ring-[#F72C5B]/10 w-52 transition-all"
            disabled={isCreating}
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || isCreating}
            className="px-5 py-2 bg-[#F72C5B] text-white rounded-xl font-bold text-sm flex items-center gap-2
                       disabled:opacity-40 hover:bg-[#C4224A] transition-colors"
          >
            <Plus className="w-4 h-4" />
            {isCreating ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>

      {/* ── Estados de carga / error ── */}
      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm font-bold uppercase tracking-widest animate-pulse">
          Cargando proyectos...
        </div>
      )}
      {error && (
        <div className="text-red-500 text-center py-12 text-sm">{error}</div>
      )}

      {/* ── Estado vacío ── */}
      {!loading && projects.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-[#FFF0F4] border border-[#F72C5B]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-8 h-8 text-[#F72C5B]" />
          </div>
          <p className="text-gray-600 text-sm font-medium">No tenés proyectos aún.</p>
          <p className="text-gray-400 text-xs mt-1">Creá uno para empezar a organizar tus imágenes.</p>
        </div>
      )}

      {/* ── Grid de proyectos ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map(proj => {
          const thumbs = proj.items.slice(0, 4).map(i => i.url);
          const updatedAt = proj.updatedAt?.toDate ? proj.updatedAt.toDate() : new Date();
          const references = proj.items.filter(i => i.type === 'reference').length;
          const results    = proj.items.filter(i => i.type === 'result').length;

          return (
            <div
              key={proj.id}
              onClick={() => navigate(`/projects/${proj.id}`)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#F72C5B]/20
                         transition-all duration-200 overflow-hidden group cursor-pointer"
            >
              {/* Franja de color superior */}
              <div className="h-1 bg-[#F72C5B]" />

              {/* Mosaico de thumbnails */}
              <div className="grid grid-cols-2 gap-0.5 h-40 bg-gray-100">
                {thumbs.length === 0 ? (
                  <div className="col-span-2 flex items-center justify-center bg-gray-50">
                    <FolderOpen className="w-10 h-10 text-gray-300" />
                  </div>
                ) : (
                  [...thumbs, ...Array(4 - thumbs.length).fill(null)].map((url, i) => (
                    <div key={i} className="overflow-hidden bg-gray-100">
                      {url ? (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-50" />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Body */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-black text-base uppercase italic tracking-tighter text-gray-900 truncate">
                      {proj.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {references > 0 && (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {references} ref.
                        </span>
                      )}
                      {results > 0 && (
                        <span className="text-[10px] font-bold text-[#F72C5B] bg-[#FFF0F4] px-2 py-0.5 rounded-full border border-[#F72C5B]/15">
                          {results} generadas
                        </span>
                      )}
                      <span className="text-[10px] text-gray-300">
                        {updatedAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>

                  {/* Acciones hover */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={(e) => handleExport(e, proj.id, proj.name)}
                      disabled={exportingId === proj.id}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Exportar ZIP"
                    >
                      {exportingId === proj.id ? (
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 text-gray-400" />
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
