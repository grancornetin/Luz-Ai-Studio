import React, { useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { addItemToProject } from '../../services/projectService';
import { X, FolderPlus } from 'lucide-react';

interface Props {
  imageUrl: string;
  type: 'reference' | 'result';
  module: string;
  metadata?: Record<string, any>;
  onAdded?: () => void;
  className?: string;
}

export const AddToProjectButton: React.FC<Props> = ({
  imageUrl,
  type,
  module,
  metadata,
  onAdded,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [addingToProjectId, setAddingToProjectId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { projects, addProject } = useProjects();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddToProject = async (projectId: string) => {
    setAddingToProjectId(projectId);
    try {
      await addItemToProject(projectId, { type, url: imageUrl, module, metadata });
      showToast('Imagen agregada al proyecto');
      onAdded?.();
      setIsOpen(false);
    } catch (err: any) {
      showToast('Error: ' + err.message);
    } finally {
      setAddingToProjectId(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newProjectName.trim()) return;
    setIsCreating(true);
    try {
      const newProject = await addProject(newProjectName.trim());
      await addItemToProject(newProject.id, { type, url: imageUrl, module, metadata });
      showToast('Proyecto creado e imagen agregada');
      onAdded?.();
      setIsOpen(false);
      setNewProjectName('');
    } catch (err: any) {
      showToast('Error: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        className={`p-2 bg-white/90 rounded-full shadow-md hover:bg-indigo-50 transition-all ${className}`}
        title="Agregar a proyecto"
      >
        <FolderPlus className="w-4 h-4 text-indigo-600" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[20000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-black text-lg uppercase tracking-tighter">Agregar a proyecto</h3>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {projects.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No tienes proyectos aún. Crea uno nuevo.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tus proyectos</p>
                  {projects.map(proj => (
                    <button
                      key={proj.id}
                      onClick={() => handleAddToProject(proj.id)}
                      disabled={addingToProjectId === proj.id}
                      className="w-full flex justify-between items-center p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all disabled:opacity-60"
                    >
                      <div className="text-left">
                        <p className="font-bold text-sm">{proj.name}</p>
                        <p className="text-xs text-slate-400">{proj.items.length} {proj.items.length === 1 ? 'imagen' : 'imágenes'}</p>
                      </div>
                      {addingToProjectId === proj.id ? (
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      ) : (
                        <FolderPlus className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Crear nuevo proyecto</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nombre del proyecto"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                    disabled={isCreating}
                  />
                  <button
                    onClick={handleCreateAndAdd}
                    disabled={!newProjectName.trim() || isCreating}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                  >
                    {isCreating ? 'Creando...' : 'Crear'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold z-[20001]">
          {toast}
        </div>
      )}
    </>
  );
};
