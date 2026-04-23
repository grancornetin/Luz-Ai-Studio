/**
 * PublishPromptModal.tsx
 * Collect title, tags, optional board, then call onPublish.
 */
import React, { useState } from 'react';
import { X, Share2, Tag, FolderPlus, ChevronDown } from 'lucide-react';
import { PromptDNA, PromptBoard } from '../types/promptTypes';

interface PublishPromptModalProps {
  imageUrl: string;
  promptText: string;
  promptDNA: PromptDNA;
  boards?: PromptBoard[];
  existingTags?: string[]; // todas las etiquetas ya en uso en la galería
  onClose: () => void;
  onPublish: (title: string, tags: string[], boardId?: string) => void | Promise<void>;
  onCreateBoard?: (name: string) => Promise<string | null>;
}

// Normaliza una etiqueta para comparación: minúsculas, sin espacios, sin acentos
function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Encuentra la etiqueta existente más similar (distancia Levenshtein simple ≤ 2)
function findSimilarTag(input: string, existing: string[]): string | null {
  const norm = normalizeTag(input);
  for (const tag of existing) {
    if (normalizeTag(tag) === norm) return tag; // exacto
  }
  // Levenshtein ≤ 2
  for (const tag of existing) {
    const a = normalizeTag(tag);
    if (Math.abs(a.length - norm.length) > 2) continue;
    let diff = 0;
    for (let i = 0; i < Math.max(a.length, norm.length); i++) {
      if (a[i] !== norm[i]) diff++;
      if (diff > 2) break;
    }
    if (diff <= 2) return tag;
  }
  return null;
}

const PublishPromptModal: React.FC<PublishPromptModalProps> = ({
  imageUrl,
  promptText,
  promptDNA,
  boards = [],
  existingTags = [],
  onClose,
  onPublish,
  onCreateBoard,
}) => {
  const [title, setTitle]             = useState('');
  const [tagInput, setTagInput]       = useState('');
  const [tags, setTags]               = useState<string[]>([]);
  const [tagWarning, setTagWarning]   = useState<string | null>(null);
  const [selectedBoard, setBoard]     = useState<string | undefined>(undefined);
  const [showBoardMenu, setShowMenu]  = useState(false);
  const [newBoardName, setNewBoard]   = useState('');
  const [creatingBoard, setCreating]  = useState(false);
  const [publishing, setPublishing]   = useState(false);

  // Sugerencias: etiquetas existentes que contienen el texto del input
  const suggestions = tagInput.trim().length > 0
    ? existingTags
        .filter(t => normalizeTag(t).includes(normalizeTag(tagInput)) && !tags.includes(t))
        .slice(0, 8)
    : [];

  const addTag = (raw?: string) => {
    const input = raw || tagInput;
    const norm  = normalizeTag(input);
    if (!norm) return;

    // Buscar duplicado exacto o similar
    const similar = findSimilarTag(norm, existingTags);
    if (similar && !tags.includes(similar)) {
      // usar la etiqueta existente normalizada
      setTags(prev => [...prev, similar]);
      setTagWarning(similar !== norm ? `Usamos "${similar}" para mantener consistencia.` : null);
    } else if (!tags.includes(norm)) {
      setTags(prev => [...prev, norm]);
      setTagWarning(null);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
  };

  const handleCreateBoard = async () => {
    if (!newBoardName.trim() || !onCreateBoard) return;
    setCreating(true);
    const id = await onCreateBoard(newBoardName.trim());
    if (id) {
      setBoard(id);
      setNewBoard('');
      setShowMenu(false);
    }
    setCreating(false);
  };

  const handlePublish = async () => {
    if (!title.trim()) return;
    setPublishing(true);
    try {
      await onPublish(title.trim(), tags, selectedBoard);
    } finally {
      setPublishing(false);
    }
  };

  const selectedBoardName = boards.find(b => b.id === selectedBoard)?.name;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-xl flex items-start justify-center p-4 md:p-8 overflow-y-auto animate-in fade-in">
      <div
        className="bg-white w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in duration-300 my-4 md:my-12"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 md:p-10 space-y-7">

          {/* HEADER */}
          <header className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-tight">
                Publicar en Comunidad
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                Comparte tu creación con todos los usuarios
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-all flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* BODY */}
          <div className="flex flex-col md:flex-row gap-7">
            {/* IMAGE PREVIEW */}
            <div className="w-full md:w-[160px] aspect-[3/4] rounded-2xl overflow-hidden shadow-md border border-slate-100 flex-shrink-0">
              <img src={imageUrl} className="w-full h-full object-cover" alt="preview" />
            </div>

            {/* FORM */}
            <div className="flex-1 space-y-5">

              {/* TITLE */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Título *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej: Luxury Lipstick Campaign"
                  maxLength={80}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* TAGS */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Tags
                </label>
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={tagInput}
                        onChange={e => { setTagInput(e.target.value); setTagWarning(null); }}
                        onKeyDown={handleKeyDown}
                        placeholder="belleza, minimal..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <button
                      onClick={() => addTag()}
                      className="px-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {/* Sugerencias de etiquetas existentes */}
                  {suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-full">Etiquetas existentes:</span>
                      {suggestions.map(s => (
                        <button
                          key={s}
                          onClick={() => { addTag(s); }}
                          className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors"
                        >
                          #{s}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Aviso de normalización */}
                  {tagWarning && (
                    <p className="mt-1.5 text-[9px] font-bold text-amber-500 uppercase tracking-widest">
                      ⚡ {tagWarning}
                    </p>
                  )}
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map(tag => (
                      <span
                        key={tag}
                        className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                      >
                        #{tag}
                        <button onClick={() => removeTag(tag)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* BOARD (optional) */}
              {(boards.length > 0 || onCreateBoard) && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Tablero (opcional)
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setShowMenu(p => !p)}
                      className="w-full flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <span className={selectedBoardName ? 'text-slate-700' : 'text-slate-400'}>
                        {selectedBoardName || 'Selecciona un tablero...'}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showBoardMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showBoardMenu && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 max-h-48 overflow-y-auto">
                        {/* No board option */}
                        <button
                          onClick={() => { setBoard(undefined); setShowMenu(false); }}
                          className="w-full px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors"
                        >
                          Sin tablero
                        </button>

                        {/* Existing boards */}
                        {boards.map(board => (
                          <button
                            key={board.id}
                            onClick={() => { setBoard(board.id); setShowMenu(false); }}
                            className={`w-full px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${
                              selectedBoard === board.id
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {board.name}
                          </button>
                        ))}

                        {/* Create new board */}
                        {onCreateBoard && (
                          <div className="border-t border-slate-100 p-3 space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newBoardName}
                                onChange={e => setNewBoard(e.target.value)}
                                placeholder="Nuevo tablero..."
                                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                              />
                              <button
                                onClick={handleCreateBoard}
                                disabled={creatingBoard || !newBoardName.trim()}
                                className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                              >
                                <FolderPlus className="w-3 h-3" />
                                {creatingBoard ? '...' : 'Crear'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <button
              onClick={handlePublish}
              disabled={!title.trim() || publishing}
              className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl ${
                !title.trim() || publishing
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
              }`}
            >
              <Share2 className="w-5 h-5" />
              {publishing ? 'Publicando...' : 'Publicar Prompt'}
            </button>
            <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest">
              Visible para toda la comunidad · Puedes eliminar después
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PublishPromptModal;