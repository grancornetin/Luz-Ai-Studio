import React from 'react';
import { Prompt } from '../types/promptTypes';
import { Heart, Copy, Play, Trash2, Bookmark, Flag, Images } from 'lucide-react';

interface PromptCardProps {
  prompt: Prompt;
  onClick: () => void;
  onLike: (e: React.MouseEvent) => void;
  onRecreate: (e: React.MouseEvent) => void;
  // Admin
  isAdmin?: boolean;
  onDelete?: (e: React.MouseEvent, id: string) => void;
}

const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  onClick,
  onLike,
  onRecreate,
  isAdmin = false,
  onDelete
}) => {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [reported, setReported] = React.useState(false);

  const generationCount = (prompt.generations?.length || 0) + 1;
  const hasVariations = generationCount > 1;

  // Auto-reset confirm state if card loses focus
  React.useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete?.(e, prompt.id);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaved(prev => !prev);
  };

  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reported) return;
    setReported(true);
  };

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer relative"
    >

      {/* ── IMAGE AREA ── */}
      <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
        <img
          src={prompt.imageUrl}
          className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
          alt={prompt.title}
        />

        {/* GENERATIONS BADGE — always visible if > 1 */}
        {hasVariations && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white px-2.5 py-1.5 rounded-xl">
            <Images className="w-3 h-3" />
            <span className="text-[9px] font-black uppercase tracking-widest">
              {generationCount} ver.
            </span>
          </div>
        )}

        {/* ADMIN DELETE BADGE — top right, only in admin mode */}
        {isAdmin && (
          <div className="absolute top-3 right-3 z-20" onClick={e => e.stopPropagation()}>
            {confirmDelete ? (
              // Confirm state
              <div className="flex items-center gap-1.5 bg-rose-600 text-white px-3 py-2 rounded-xl shadow-lg animate-in zoom-in duration-150">
                <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                  ¿Eliminar?
                </span>
                <button
                  onClick={handleDeleteClick}
                  className="bg-white text-rose-600 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase hover:bg-rose-50 transition-colors"
                >
                  Sí
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                  className="bg-white/20 text-white rounded-lg px-2 py-0.5 text-[9px] font-black uppercase hover:bg-white/30 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={handleDeleteClick}
                className="w-8 h-8 bg-rose-500 hover:bg-rose-600 text-white rounded-xl flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
                title="Eliminar prompt"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* HOVER OVERLAY — actions */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent md:opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 md:p-4">
          <div className="flex gap-1.5 md:gap-2">

            {/* RECREAR */}
            <button
              onClick={onRecreate}
              className="flex-1 py-2.5 md:py-3 bg-indigo-600 text-white rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 md:gap-1.5 hover:bg-indigo-700 transition-colors"
            >
              <Play className="w-2.5 h-2.5 md:w-3 md:h-3 fill-current" />
              Recrear
            </button>

            {/* COPY */}
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(prompt.promptText); }}
              className="w-9 h-9 md:w-10 md:h-10 bg-white/20 backdrop-blur-md text-white rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
              title="Copiar prompt"
            >
              <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>

            {/* SAVE */}
            <button
              onClick={handleSave}
              className={`w-9 h-9 md:w-10 md:h-10 backdrop-blur-md rounded-xl flex items-center justify-center transition-all ${
                saved
                  ? 'bg-amber-500 text-white'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title={saved ? 'Guardado' : 'Guardar'}
            >
              <Bookmark className={`w-3.5 h-3.5 md:w-4 md:h-4 ${saved ? 'fill-current' : ''}`} />
            </button>

            {/* REPORT */}
            <button
              onClick={handleReport}
              className={`w-9 h-9 md:w-10 md:h-10 backdrop-blur-md rounded-xl flex items-center justify-center transition-all ${
                reported
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title={reported ? 'Reportado' : 'Reportar'}
            >
              <Flag className={`w-3 h-3 md:w-3.5 md:h-3.5 ${reported ? 'fill-current' : ''}`} />
            </button>

          </div>
        </div>
      </div>

      {/* ── FOOTER INFO ── */}
      <div className="p-5 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight line-clamp-2">
            {prompt.title}
          </h4>
          <button
            onClick={onLike}
            className="flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
          >
            <Heart className={`w-4 h-4 ${prompt.likes > 0 ? 'fill-red-400 text-red-400' : ''}`} />
            <span className="text-[10px] font-bold">{prompt.likes}</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* TAGS */}
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {prompt.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md"
              >
                #{tag}
              </span>
            ))}
            {prompt.tags.length > 2 && (
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest px-1 py-1">
                +{prompt.tags.length - 2}
              </span>
            )}
          </div>

          {/* SAVED INDICATOR */}
          {saved && (
            <Bookmark className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
          )}
        </div>
      </div>

    </div>
  );
};

export default PromptCard;
