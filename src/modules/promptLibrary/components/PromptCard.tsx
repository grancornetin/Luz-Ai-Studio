/**
 * PromptCard.tsx — Pinterest-style card
 * Like, save to board, copy, recreate, report, delete (admin/author)
 */
import React from 'react';
import { Prompt } from '../types/promptTypes';
import {
  Heart, Copy, Play, Trash2, Bookmark,
  Flag, Images, MessageCircle, MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

interface PromptCardProps {
  prompt: Prompt;
  onClick: () => void;
  onLike: (e: React.MouseEvent) => void;
  onRecreate: (e: React.MouseEvent) => void;
  onSave?: (e: React.MouseEvent) => void;
  onReport?: (e: React.MouseEvent) => void;
  isAdmin?: boolean;
  onDelete?: (e: React.MouseEvent, id: string) => void;
  isSaved?: boolean;
  isLiked?: boolean;
}

const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  onClick,
  onLike,
  onRecreate,
  onSave,
  onReport,
  isAdmin = false,
  onDelete,
  isSaved = false,
  isLiked = false,
}) => {
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [reported, setReported] = React.useState(
    user ? (prompt.reportedBy || []).includes(user.uid) : false
  );
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const generationCount = (prompt.generations?.length || 0) + 1;
  const hasVariations = generationCount > 1;
  const isAuthor = user?.uid === prompt.authorId;
  const canDelete = isAdmin || isAuthor;

  // Close menu on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-reset confirm state
  React.useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete?.(e, prompt.id);
  };

  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reported) return;
    setReported(true);
    onReport?.(e);
    setShowMenu(false);
  };

  const authorInitial = (prompt.authorName || 'A').charAt(0).toUpperCase();

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-[28px] overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.015] transition-all duration-300 cursor-pointer relative"
    >
      {/* ── IMAGE AREA ── */}
      <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
        {prompt.imageUrl ? (
          <img
            src={prompt.imageUrl}
            className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
            alt={prompt.title}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <span className="text-4xl opacity-20">✦</span>
          </div>
        )}

        {/* BADGES — top left */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
          {hasVariations && (
            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md text-white px-2 py-1.5 rounded-xl">
              <Images className="w-3 h-3" />
              <span className="text-[9px] font-black uppercase tracking-widest">{generationCount} ver.</span>
            </div>
          )}
          {isAuthor && (
            <div className="flex items-center gap-1 bg-indigo-600/80 backdrop-blur-md text-white px-2 py-1.5 rounded-xl">
              <span className="text-[9px] font-black uppercase tracking-widest">Tuyo</span>
            </div>
          )}
        </div>

        {/* ADMIN DELETE — top right */}
        {canDelete && (
          <div className="absolute top-3 right-3 z-20" onClick={e => e.stopPropagation()}>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 bg-rose-600 text-white px-3 py-2 rounded-xl shadow-lg">
                <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">¿Eliminar?</span>
                <button
                  onClick={handleDeleteClick}
                  className="bg-white text-rose-600 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase hover:bg-rose-50"
                >Sí</button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                  className="bg-white/20 text-white rounded-lg px-2 py-0.5 text-[9px] font-black uppercase hover:bg-white/30"
                >No</button>
              </div>
            ) : (
              <button
                onClick={handleDeleteClick}
                className="w-8 h-8 bg-rose-500/80 hover:bg-rose-600 text-white rounded-xl flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* HOVER OVERLAY */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          <div className="flex gap-1.5">
            {/* RECREAR */}
            <button
              onClick={onRecreate}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-indigo-700 transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
              Recrear
            </button>

            {/* COPY */}
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(prompt.promptText); }}
              className="w-9 h-9 bg-white/20 backdrop-blur-sm text-white rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
              title="Copiar prompt"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            {/* SAVE / BOOKMARK */}
            <button
              onClick={(e) => { e.stopPropagation(); onSave?.(e); }}
              className={`w-9 h-9 backdrop-blur-sm rounded-xl flex items-center justify-center transition-all ${
                isSaved ? 'bg-amber-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title={isSaved ? 'Guardado' : 'Guardar'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
            </button>

            {/* MORE MENU */}
            <div ref={menuRef} className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(p => !p); }}
                className="w-9 h-9 bg-white/20 backdrop-blur-sm text-white rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {showMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 min-w-[140px]">
                  {!reported && !isAuthor && (
                    <button
                      onClick={handleReport}
                      className="w-full flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-orange-500 hover:bg-orange-50 transition-colors"
                    >
                      <Flag className="w-3 h-3" />
                      Reportar
                    </button>
                  )}
                  {reported && (
                    <div className="flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <Flag className="w-3 h-3 fill-current" />
                      Reportado
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="p-4 space-y-3">
        {/* Title + Like */}
        <div className="flex justify-between items-start gap-2">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight line-clamp-2 flex-1">
            {prompt.title}
          </h4>
          <button
            onClick={onLike}
            className="flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 group/like"
          >
            <Heart className={`w-4 h-4 transition-transform group-hover/like:scale-125 ${
              isLiked ? 'fill-red-500 text-red-500' : ''
            }`} />
            <span className="text-[10px] font-bold">{prompt.likes}</span>
          </button>
        </div>

        {/* Meta row: author + comments + saves */}
        <div className="flex items-center justify-between gap-2">
          {/* Author avatar */}
          <div className="flex items-center gap-1.5 min-w-0">
            {prompt.authorPhotoURL ? (
              <img
                src={prompt.authorPhotoURL}
                className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                alt={prompt.authorName}
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] font-black">{authorInitial}</span>
              </div>
            )}
            <span className="text-[9px] font-bold text-slate-400 truncate">
              {prompt.authorName || 'Anonymous'}
            </span>
          </div>

          {/* Comment + save counts */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {prompt.commentsCount > 0 && (
              <div className="flex items-center gap-1 text-slate-300">
                <MessageCircle className="w-3 h-3" />
                <span className="text-[9px] font-bold">{prompt.commentsCount}</span>
              </div>
            )}
            {isSaved && (
              <Bookmark className="w-3 h-3 fill-amber-400 text-amber-400" />
            )}
          </div>
        </div>

        {/* Tags */}
        {prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {prompt.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md"
              >
                #{tag}
              </span>
            ))}
            {prompt.tags.length > 3 && (
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest px-1 py-1">
                +{prompt.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptCard;