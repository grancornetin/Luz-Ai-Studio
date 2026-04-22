/**
 * SavedPromptsPanel.tsx
 * Shows user's boards and saved prompts.
 * Pinterest-like: board grid → click board → see prompts inside.
 */
import React, { useState, useEffect } from 'react';
import {
  FolderPlus, Bookmark, ArrowLeft, Trash2,
  LayoutGrid, Globe, Lock
} from 'lucide-react';
import { Prompt, PromptBoard } from '../types/promptTypes';
import { promptService } from '../services/promptService';
import { useAuth } from '../../auth/AuthContext';

interface SavedPromptsPanelProps {
  boards: PromptBoard[];
  savedIds: Set<string>;
  onPromptClick: (p: Prompt) => void;
  onRecreate: (p: Prompt) => void;
  onUnsave: (id: string) => void;
  onCreateBoard: (name: string, description?: string) => Promise<string | null>;
}

const SavedPromptsPanel: React.FC<SavedPromptsPanelProps> = ({
  boards, savedIds, onPromptClick, onRecreate, onUnsave, onCreateBoard,
}) => {
  const { user } = useAuth();
  const [activeBoard, setActiveBoard] = useState<PromptBoard | null>(null);
  const [allSaved, setAllSaved]       = useState<Prompt[]>([]);
  const [loading, setLoading]         = useState(false);
  const [newBoardName, setNewBoard]   = useState('');
  const [showCreate, setShowCreate]   = useState(false);
  const [creating, setCreating]       = useState(false);

  // Load all saved prompts
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    promptService.getSavedPrompts(user.uid)
      .then(setAllSaved)
      .finally(() => setLoading(false));
  }, [user, savedIds]);

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return;
    setCreating(true);
    const id = await onCreateBoard(newBoardName.trim());
    if (id) { setNewBoard(''); setShowCreate(false); }
    setCreating(false);
  };

  const boardPrompts = activeBoard
    ? allSaved.filter(p => activeBoard.promptIds.includes(p.id))
    : allSaved;

  const noSaved = savedIds.size === 0;

  return (
    <div className="space-y-8">

      {/* HEADER ROW */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {activeBoard && (
            <button
              onClick={() => setActiveBoard(null)}
              className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">
              {activeBoard ? activeBoard.name : 'Guardados'}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              {activeBoard
                ? `${boardPrompts.length} prompts en este tablero`
                : `${savedIds.size} prompts · ${boards.length} tableros`}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreate(p => !p)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          Nuevo tablero
        </button>
      </div>

      {/* CREATE BOARD FORM */}
      {showCreate && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 flex gap-3 shadow-sm">
          <input
            type="text"
            value={newBoardName}
            onChange={e => setNewBoard(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateBoard()}
            placeholder="Nombre del tablero..."
            autoFocus
            className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            onClick={handleCreateBoard}
            disabled={creating || !newBoardName.trim()}
            className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {creating ? '...' : 'Crear'}
          </button>
          <button
            onClick={() => setShowCreate(false)}
            className="px-4 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* BOARDS GRID (only shown when not inside a board) */}
      {!activeBoard && boards.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Tableros</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {boards.map(board => {
              const boardPromptsCount = board.promptIds.length;
              const coverPrompt = allSaved.find(p => board.promptIds.includes(p.id));
              return (
                <div
                  key={board.id}
                  onClick={() => setActiveBoard(board)}
                  className="group cursor-pointer bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-lg transition-all hover:scale-[1.02]"
                >
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    {coverPrompt?.imageUrl ? (
                      <img
                        src={coverPrompt.imageUrl}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        alt={board.name}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <LayoutGrid className="w-10 h-10 text-slate-200" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      {board.isPublic
                        ? <Globe className="w-3.5 h-3.5 text-white/80" />
                        : <Lock className="w-3.5 h-3.5 text-white/80" />}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">{board.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {boardPromptsCount} prompt{boardPromptsCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="h-px bg-slate-100 my-8" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Todos los guardados</p>
        </div>
      )}

      {/* EMPTY STATE */}
      {noSaved && !loading && (
        <div className="py-24 text-center space-y-4">
          <div className="w-20 h-20 bg-slate-100 rounded-[32px] flex items-center justify-center mx-auto opacity-40">
            <Bookmark className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Sin prompts guardados</p>
          <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">
            Usa el ícono <Bookmark className="w-3 h-3 inline" /> en cualquier prompt para guardarlo aquí
          </p>
        </div>
      )}

      {/* SAVED PROMPTS GRID */}
      {!loading && boardPrompts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {boardPrompts.map(prompt => (
            <div
              key={prompt.id}
              onClick={() => onPromptClick(prompt)}
              className="group bg-white rounded-[28px] overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.015] transition-all duration-300 cursor-pointer relative"
            >
              <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
                {prompt.imageUrl && (
                  <img
                    src={prompt.imageUrl}
                    className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
                    alt={prompt.title}
                    loading="lazy"
                  />
                )}
                {/* HOVER OVERLAY */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                  <div className="flex gap-1.5">
                    <button
                      onClick={e => { e.stopPropagation(); onRecreate(prompt); }}
                      className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-indigo-700 transition-colors"
                    >
                      Recrear
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); onUnsave(prompt.id); }}
                      className="w-9 h-9 bg-amber-500 text-white rounded-xl flex items-center justify-center hover:bg-amber-600 transition-colors"
                      title="Quitar de guardados"
                    >
                      <Bookmark className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight line-clamp-2">
                  {prompt.title}
                </h4>
                <div className="flex flex-wrap gap-1 mt-2">
                  {prompt.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedPromptsPanel;