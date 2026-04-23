/**
 * PromptDetailModal.tsx
 * ─────────────────────────────────────────────────────────────
 * Pinterest-style detail view for a prompt.
 *
 * Features:
 *  - Image gallery with variations (LCS diff engine preserved)
 *  - Fullscreen viewer
 *  - Real-time comments (via usePromptComments)
 *  - Like / unlike (optimistic, integrated)
 *  - Save to board (with board picker)
 *  - Author info
 *  - DNA viewer + prompt diff
 *  - Share / copy actions
 *  - Keyboard navigation (←→ images, Esc close)
 * ─────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  X, Copy, Play, Heart, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, Bookmark, Send, Trash2,
  MessageCircle, FolderPlus, Check, Share2, MoreHorizontal,
  ChevronDown
} from 'lucide-react';

import { Prompt, PromptBoard } from '../types/promptTypes';
import PromptDNAViewer from './PromptDNAViewer';
import { usePromptComments } from '../hooks/usePromptLibrary';
import { useAuth } from '../../auth/AuthContext';
import { revealPrompt, isPromptRevealed } from '../../../services/promptRevealService';
import { isPromptRevealFree, CREDIT_COSTS } from '../../../services/creditConfig';
import { Eye, EyeOff } from 'lucide-react';

// ══════════════════════════════════════════════════════════════
// 🔬 WORD-LEVEL DIFF ENGINE (LCS-based, preserved from original)
// ══════════════════════════════════════════════════════════════

type DiffToken = { text: string; type: 'equal' | 'added' | 'removed' };

const tokenize = (text: string): string[] =>
  text.split(/,\s*/).map(t => t.trim()).filter(Boolean);

const buildLCS = (a: string[], b: string[]): number[][] => {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1].toLowerCase() === b[j - 1].toLowerCase()
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
};

const diffTokens = (baseText: string, variantText: string): DiffToken[] => {
  const a = tokenize(baseText);
  const b = tokenize(variantText);
  if (!a.length && !b.length) return [];
  const dp = buildLCS(a, b);
  const result: DiffToken[] = [];
  let i = a.length, j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
      result.unshift({ text: b[j - 1], type: 'equal' }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ text: b[j - 1], type: 'added' }); j--;
    } else {
      result.unshift({ text: a[i - 1], type: 'removed' }); i--;
    }
  }
  return result;
};

const PromptDiff: React.FC<{ baseText: string; variantText: string }> = ({ baseText, variantText }) => {
  const tokens = useMemo(() => diffTokens(baseText, variantText), [baseText, variantText]);
  const addedCount   = tokens.filter(t => t.type === 'added').length;
  const removedCount = tokens.filter(t => t.type === 'removed').length;
  const hasChanges   = addedCount > 0 || removedCount > 0;

  return (
    <div className="space-y-3">
      {hasChanges && (
        <div className="flex items-center gap-4 flex-wrap">
          {addedCount > 0 && (
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              {addedCount} añadido{addedCount !== 1 ? 's' : ''}
            </span>
          )}
          {removedCount > 0 && (
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-rose-500">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
              {removedCount} eliminado{removedCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
      <p className="text-sm leading-relaxed font-medium text-slate-700">
        {tokens.map((token, i) => {
          const comma = i < tokens.length - 1 ? ', ' : '';
          if (token.type === 'added') return (
            <React.Fragment key={i}>
              <mark className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-bold not-italic border border-emerald-200">{token.text}</mark>
              {comma && <span className="text-slate-400">{comma}</span>}
            </React.Fragment>
          );
          if (token.type === 'removed') return (
            <React.Fragment key={i}>
              <span className="line-through decoration-rose-400 decoration-2 text-rose-400/80 bg-rose-50 px-1 py-0.5 rounded-md text-xs">{token.text}</span>
              {comma && <span className="text-slate-400">{comma}</span>}
            </React.Fragment>
          );
          return (
            <React.Fragment key={i}>
              <span className="text-slate-500 italic">{token.text}</span>
              {comma && <span className="text-slate-400">{comma}</span>}
            </React.Fragment>
          );
        })}
      </p>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 💬 COMMENTS SECTION
// ══════════════════════════════════════════════════════════════

const CommentsSection: React.FC<{ promptId: string }> = ({ promptId }) => {
  const { user, profile, isAdmin } = useAuth();
  const { comments, loading, posting, addComment, deleteComment } = usePromptComments(promptId);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new comment arrives
  useEffect(() => {
    if (comments.length > 0) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    await addComment(text);
    setText('');
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'ahora';
      if (diffMin < 60) return `${diffMin}m`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `${diffH}h`;
      const diffD = Math.floor(diffH / 24);
      return `${diffD}d`;
    } catch { return ''; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-slate-400" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Comentarios {comments.length > 0 && `· ${comments.length}`}
        </p>
      </div>

      {/* COMMENTS LIST */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1 scrollbar-hide">
        {loading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-7 h-7 rounded-full bg-slate-200 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && comments.length === 0 && (
          <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest py-4">
            Sé el primero en comentar
          </p>
        )}

        {!loading && comments.map(comment => {
          const isOwn = user?.uid === comment.authorId;
          const canDelete = isOwn || isAdmin;
          const initial = (comment.authorName || 'A').charAt(0).toUpperCase();

          return (
            <div key={comment.id} className="flex gap-3 group">
              {/* AVATAR */}
              {comment.authorPhotoURL ? (
                <img
                  src={comment.authorPhotoURL}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                  alt={comment.authorName}
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 text-[10px] font-black">
                  {initial}
                </div>
              )}

              {/* CONTENT */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-black text-slate-700 truncate">
                    {comment.authorName || 'Anonymous'}
                  </span>
                  <span className="text-[9px] font-bold text-slate-300 flex-shrink-0">
                    {formatTime(comment.createdAt)}
                  </span>
                  {canDelete && (
                    <button
                      onClick={() => deleteComment(comment.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed break-words">
                  {comment.text}
                </p>
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* COMMENT INPUT */}
      {user ? (
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          {/* User avatar */}
          {profile?.photoURL ? (
            <img src={profile.photoURL} className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" alt="me" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-black">
              {(profile?.displayName || user.displayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder="Añade un comentario..."
              disabled={posting}
              className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || posting}
              className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-30 transition-all flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest py-2 border-t border-slate-100">
          Inicia sesión para comentar
        </p>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 📌 BOARD PICKER
// ══════════════════════════════════════════════════════════════

interface BoardPickerProps {
  boards: PromptBoard[];
  promptId: string;
  onAddToBoard: (boardId: string) => void;
  onCreateBoard?: (name: string) => Promise<string | null>;
  onClose: () => void;
}

const BoardPicker: React.FC<BoardPickerProps> = ({
  boards, promptId, onAddToBoard, onCreateBoard, onClose,
}) => {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleAdd = async (boardId: string) => {
    onAddToBoard(boardId);
    setAdded(boardId);
    setTimeout(onClose, 800);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !onCreateBoard) return;
    setCreating(true);
    const id = await onCreateBoard(newName.trim());
    if (id) { onAddToBoard(id); setAdded(id); setTimeout(onClose, 800); }
    setCreating(false);
  };

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 min-w-[220px] animate-in zoom-in-95 duration-150"
    >
      <div className="p-3 border-b border-slate-100">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Guardar en tablero</p>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {boards.length === 0 ? (
          <p className="px-4 py-3 text-[10px] font-bold text-slate-400 text-center">Sin tableros aún</p>
        ) : (
          boards.map(board => (
            <button
              key={board.id}
              onClick={() => handleAdd(board.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="truncate">{board.name}</span>
              {added === board.id
                ? <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                : <ChevronDown className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 -rotate-90" />}
            </button>
          ))
        )}
      </div>

      {onCreateBoard && (
        <div className="p-3 border-t border-slate-100 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Nuevo tablero..."
            className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 🏠 MAIN MODAL
// ══════════════════════════════════════════════════════════════

export interface PromptDetailModalProps {
  prompt: Prompt;
  onClose: () => void;
  onLike: (id: string) => void;
  onRecreate: (prompt: Prompt) => void;
  isSaved?: boolean;
  isLiked?: boolean;
  onSave?: () => void;
  boards?: PromptBoard[];
  onAddToBoard?: (boardId: string) => void;
  onCreateBoard?: (name: string) => Promise<string | null>;
}

const PromptDetailModal: React.FC<PromptDetailModalProps> = ({
  prompt,
  onClose,
  onLike,
  onRecreate,
  isSaved = false,
  isLiked = false,
  onSave,
  boards = [],
  onAddToBoard,
  onCreateBoard,
}) => {
  const { user, credits } = useAuth();
  const planId = credits?.plan || 'free';

  // ── REVEAL STATE ─────────────────────────────────────────────
  const [revealed,       setRevealed]       = useState(false);
  const [revealLoading,  setRevealLoading]  = useState(false);
  const [revealError,    setRevealError]    = useState<string | null>(null);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const isFreeReveal = isPromptRevealFree(planId);

  // Comprobar si ya reveló este prompt al abrir el modal
  useEffect(() => {
    if (!user?.uid) return;
    if (isFreeReveal) { setRevealed(true); return; }
    isPromptRevealed(user.uid, prompt.id).then(setRevealed).catch(() => {});
  }, [user?.uid, prompt.id, isFreeReveal]);

  const handleReveal = async () => {
    if (!user?.uid) return;
    if (isFreeReveal) { setRevealed(true); return; }
    setRevealLoading(true);
    setRevealError(null);
    const result = await revealPrompt(user.uid, prompt.id, planId);
    if (result.success) {
      setRevealed(true);
      setShowRevealModal(false);
    } else {
      setRevealError(result.message || 'No se pudo revelar el prompt');
    }
    setRevealLoading(false);
  };

  // ── ALL IMAGES (base + variations) ─────────────────────────
  const allImages = useMemo(() => [
    { imageUrl: prompt.imageUrl, promptText: prompt.promptText, promptDNA: prompt.promptDNA, label: 'Original' },
    ...(prompt.generations || []).map((gen, i) => ({
      imageUrl: gen.imageUrl, promptText: gen.promptText, promptDNA: gen.promptDNA, label: `Variación ${i + 1}`,
    })),
  ], [prompt]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'details' | 'comments'>('details');
  const thumbnailsRef = useRef<HTMLDivElement>(null);

  const active = allImages[activeIndex];
  const hasMultiple = allImages.length > 1;
  const authorInitial = (prompt.authorName || 'A').charAt(0).toUpperCase();

  // ── NAVIGATION ──────────────────────────────────────────────
  const navigateTo = useCallback((index: number) => {
    if (index === activeIndex || isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => { setActiveIndex(index); setIsTransitioning(false); }, 150);
  }, [activeIndex, isTransitioning]);

  const navigatePrev = useCallback(() =>
    navigateTo(activeIndex > 0 ? activeIndex - 1 : allImages.length - 1),
    [activeIndex, allImages.length, navigateTo]);

  const navigateNext = useCallback(() =>
    navigateTo(activeIndex < allImages.length - 1 ? activeIndex + 1 : 0),
    [activeIndex, allImages.length, navigateTo]);

  // ── KEYBOARD ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { isFullscreen ? setIsFullscreen(false) : onClose(); }
      if (e.key === 'ArrowLeft'  && hasMultiple) navigatePrev();
      if (e.key === 'ArrowRight' && hasMultiple) navigateNext();
      if (e.key === 'l' || e.key === 'L') onLike(prompt.id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, hasMultiple, navigatePrev, navigateNext, onClose, onLike, prompt.id]);

  // ── SCROLL THUMBNAIL ────────────────────────────────────────
  useEffect(() => {
    if (!thumbnailsRef.current) return;
    const thumb = thumbnailsRef.current.children[activeIndex] as HTMLElement;
    thumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeIndex]);

  useEffect(() => { setActiveIndex(0); setIsFullscreen(false); }, [prompt]);

  // ── COPY ────────────────────────────────────────────────────
  const handleCopy = async () => {
    await navigator.clipboard.writeText(active.promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* ════════════════════════════════════════════════════ */}
      {/* MAIN MODAL                                          */}
      {/* ════════════════════════════════════════════════════ */}
      <div
        className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-xl flex items-start md:items-center justify-center p-0 md:p-8 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white w-full max-w-6xl md:max-h-[92vh] rounded-none md:rounded-[48px] overflow-hidden flex flex-col md:flex-row relative shadow-2xl min-h-screen md:min-h-0"
          onClick={e => e.stopPropagation()}
        >

          {/* MOBILE CLOSE */}
          <button
            onClick={onClose}
            className="md:hidden fixed top-4 right-4 z-[1100] w-10 h-10 bg-black/50 backdrop-blur-md text-white rounded-xl flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ════════════════ LEFT — IMAGE PANEL ════════════ */}
          <div className="md:w-[45%] h-[55vw] md:h-full relative bg-slate-900 flex-shrink-0">

            {/* MAIN IMAGE */}
            <div className="relative w-full h-full overflow-hidden">
              {active.imageUrl ? (
                <img
                  src={active.imageUrl}
                  className={`w-full h-full object-cover transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
                  alt={active.label}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-6xl opacity-10">✦</span>
                </div>
              )}

              {/* TOP CONTROLS OVERLAY */}
              <div className="absolute top-4 right-4 z-20 flex gap-2">
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="w-10 h-10 bg-black/40 backdrop-blur-md text-white rounded-xl flex items-center justify-center hover:bg-black/60 transition-colors"
                  title="Pantalla completa"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              {/* COUNTER */}
              {hasMultiple && (
                <div className="absolute top-4 left-4 z-20 bg-black/50 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                  {activeIndex + 1} / {allImages.length}
                </div>
              )}

              {/* ARROWS */}
              {hasMultiple && (
                <>
                  <button onClick={navigatePrev} className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/40 backdrop-blur-md text-white rounded-xl flex items-center justify-center hover:bg-black/60 transition-all hover:scale-110 active:scale-95">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={navigateNext} className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/40 backdrop-blur-md text-white rounded-xl flex items-center justify-center hover:bg-black/60 transition-all hover:scale-110 active:scale-95">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* ZOOM OVERLAY */}
              <div onClick={() => setIsFullscreen(true)} className="absolute inset-0 cursor-zoom-in z-10" />
            </div>

            {/* THUMBNAIL STRIP */}
            {hasMultiple && (
              <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-4 px-4">
                <div ref={thumbnailsRef} className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {allImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => navigateTo(i)}
                      className={`relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                        activeIndex === i ? 'border-white scale-110 shadow-lg' : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/60'
                      }`}
                    >
                      <img src={img.imageUrl} className="w-full h-full object-cover" alt={img.label} />
                      {i === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[6px] text-white font-black text-center py-0.5 uppercase">BASE</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ════════════════ RIGHT — CONTENT ════════════════ */}
          <div className="md:w-[55%] h-full flex flex-col overflow-hidden">

            {/* TOP BAR */}
            <div className="flex items-start justify-between gap-4 px-8 pt-8 pb-4 flex-shrink-0 border-b border-slate-100">

              {/* AUTHOR + TITLE */}
              <div className="min-w-0 flex-1">
                {/* Author */}
                <div className="flex items-center gap-2 mb-2">
                  {prompt.authorPhotoURL ? (
                    <img src={prompt.authorPhotoURL} className="w-6 h-6 rounded-full object-cover flex-shrink-0" alt={prompt.authorName} />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 text-[9px] font-black">
                      {authorInitial}
                    </div>
                  )}
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">
                    {prompt.authorName || 'Anonymous'}
                  </span>
                </div>

                <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                  {prompt.title}
                </h2>

                {activeIndex > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-lg mt-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                    {active.label}
                  </span>
                )}
              </div>

              {/* CLOSE */}
              <button
                onClick={onClose}
                className="hidden md:flex w-9 h-9 bg-slate-100 text-slate-400 rounded-xl items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ACTION BAR */}
            <div className="flex items-center gap-2 px-8 py-3 flex-shrink-0 border-b border-slate-100">

              {/* LIKE */}
              <button
                onClick={() => onLike(prompt.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isLiked
                    ? 'bg-red-50 text-red-500 hover:bg-red-100'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Heart className={`w-4 h-4 transition-transform hover:scale-125 ${isLiked ? 'fill-current' : ''}`} />
                <span>{prompt.likes}</span>
              </button>

              {/* SAVE / BOOKMARK + BOARD PICKER */}
              <div className="relative">
                <button
                  onClick={() => { if (boards.length > 0 || onCreateBoard) setShowBoardPicker(p => !p); else onSave?.(); }}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    isSaved
                      ? 'bg-amber-50 text-amber-500 hover:bg-amber-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                  <span>{isSaved ? 'Guardado' : 'Guardar'}</span>
                  {(boards.length > 0 || onCreateBoard) && (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>

                {showBoardPicker && (
                  <BoardPicker
                    boards={boards}
                    promptId={prompt.id}
                    onAddToBoard={(boardId) => { onAddToBoard?.(boardId); onSave?.(); }}
                    onCreateBoard={onCreateBoard}
                    onClose={() => setShowBoardPicker(false)}
                  />
                )}
              </div>

              {/* RECREATE */}
              <button
                onClick={() => onRecreate({ ...prompt, promptText: active.promptText, promptDNA: active.promptDNA })}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Recrear
              </button>

              {/* COPY */}
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ml-auto ${
                  copied ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                title="Copiar prompt"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            {/* TAB SWITCHER: Details / Comments */}
            <div className="flex px-8 pt-4 gap-6 flex-shrink-0 border-b border-slate-100">
              {(['details', 'comments'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveRightTab(tab)}
                  className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                    activeRightTab === tab
                      ? 'text-indigo-600 border-indigo-600'
                      : 'text-slate-400 border-transparent hover:text-slate-600'
                  }`}
                >
                  {tab === 'details' ? 'Detalles' : (
                    <span className="flex items-center gap-1.5">
                      Comentarios
                      {prompt.commentsCount > 0 && (
                        <span className="w-4 h-4 bg-indigo-100 text-indigo-600 rounded-full text-[8px] flex items-center justify-center font-black">
                          {prompt.commentsCount > 9 ? '9+' : prompt.commentsCount}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">

              {activeRightTab === 'details' && (
                <>
                  {/* TAGS */}
                  {prompt.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {prompt.tags.map(tag => (
                        <span key={tag} className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* PROMPT DNA */}
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">
                      Prompt DNA {activeIndex > 0 ? `· ${active.label}` : '· Original'}
                    </p>
                    <PromptDNAViewer dna={active.promptDNA} />
                  </div>

                  {/* PROMPT TEXT */}
                  <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {activeIndex > 0 ? 'Diferencias vs Original' : 'Prompt Completo'}
                      </p>
                      <div className="flex items-center gap-2">
                        {activeIndex > 0 && (
                          <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-50 px-2 py-1 rounded-lg">Visual Diff</span>
                        )}
                        {!isFreeReveal && (
                          <span className="text-[8px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 px-2 py-1 rounded-lg flex items-center gap-1">
                            <i className="fa-solid fa-coins text-[8px]"></i> {CREDIT_COSTS.REVEAL_PROMPT} crédito
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Texto borroso o revelado */}
                    <div className="relative">
                      {activeIndex > 0 ? (
                        <div className={revealed ? '' : 'blur-sm select-none pointer-events-none'}>
                          <PromptDiff baseText={allImages[0].promptText} variantText={active.promptText} />
                        </div>
                      ) : (
                        <p className={`text-sm text-slate-600 italic leading-relaxed transition-all duration-300 ${revealed ? '' : 'blur-sm select-none'}`}>
                          "{active.promptText}"
                        </p>
                      )}

                      {/* Overlay de reveal */}
                      {!revealed && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50/80 rounded-xl">
                          <EyeOff className="w-5 h-5 text-slate-400" />
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center px-4">
                            {isFreeReveal ? 'Cargando...' : `Revela el prompt completo por ${CREDIT_COSTS.REVEAL_PROMPT} crédito`}
                          </p>
                          {!isFreeReveal && (
                            <button
                              onClick={() => setShowRevealModal(true)}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                            >
                              <Eye className="w-3 h-3 inline mr-1" /> Revelar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Modal de confirmación de reveal */}
                  {showRevealModal && (
                    <div className="fixed inset-0 z-[3000] bg-black/60 flex items-center justify-center p-6" onClick={() => setShowRevealModal(false)}>
                      <div className="bg-white rounded-[28px] p-8 max-w-sm w-full space-y-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="text-center space-y-2">
                          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto">
                            <Eye className="w-7 h-7 text-indigo-600" />
                          </div>
                          <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">Revelar prompt</h3>
                          <p className="text-sm text-slate-500">
                            Esto usará <span className="font-black text-indigo-600">{CREDIT_COSTS.REVEAL_PROMPT} crédito</span> de tu cuenta.<br />
                            Créditos disponibles: <span className="font-black">{credits?.available ?? 0}</span>
                          </p>
                        </div>
                        {revealError && (
                          <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-xs font-bold">
                            {revealError}
                            <button onClick={() => window.location.href = '/buy-credits'} className="block mt-1 underline text-rose-700">Comprar créditos →</button>
                          </div>
                        )}
                        <div className="flex gap-3">
                          <button onClick={() => setShowRevealModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200">Cancelar</button>
                          <button
                            onClick={handleReveal}
                            disabled={revealLoading}
                            className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all"
                          >
                            {revealLoading ? 'Procesando...' : 'Confirmar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DOT INDICATOR */}
                  {hasMultiple && (
                    <div className="flex items-center gap-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{allImages.length} versiones</p>
                      <div className="flex gap-1.5">
                        {allImages.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => navigateTo(i)}
                            className={`rounded-full transition-all duration-200 ${
                              activeIndex === i ? 'w-5 h-2 bg-indigo-600' : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* KEYBOARD HINT */}
                  {hasMultiple && (
                    <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                      ← → navegar · L like · ESC cerrar
                    </p>
                  )}
                </>
              )}

              {activeRightTab === 'comments' && (
                <CommentsSection promptId={prompt.id} />
              )}

            </div>
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* FULLSCREEN OVERLAY                                  */}
      {/* ════════════════════════════════════════════════════ */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[2000] bg-black/98 backdrop-blur-2xl flex flex-col"
          onClick={() => setIsFullscreen(false)}
        >
          {/* TOP BAR */}
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="text-white font-black text-sm uppercase italic tracking-tighter">{prompt.title}</span>
              {hasMultiple && (
                <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  {activeIndex + 1} / {allImages.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest hidden md:block">← → navegar · ESC cerrar</span>
              <button onClick={() => setIsFullscreen(false)} className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors">
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* IMAGE */}
          <div className="flex-1 flex items-center justify-center relative px-16 min-h-0" onClick={e => e.stopPropagation()}>
            <img
              src={active.imageUrl}
              className={`max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
              alt={active.label}
            />
            {hasMultiple && (
              <>
                <button onClick={navigatePrev} className="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={navigateNext} className="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* THUMBNAILS */}
          {hasMultiple && (
            <div className="flex-shrink-0 px-6 py-5 flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{active.label}</span>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide max-w-2xl pb-1">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => navigateTo(i)}
                    className={`relative flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all duration-200 ${
                      activeIndex === i ? 'border-white scale-110 shadow-xl shadow-white/10' : 'border-white/10 opacity-50 hover:opacity-100 hover:border-white/40'
                    }`}
                  >
                    <img src={img.imageUrl} className="w-full h-full object-cover" alt={img.label} />
                    {i === 0 && <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[6px] text-white font-black text-center py-0.5 uppercase">BASE</div>}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => navigateTo(i)}
                    className={`rounded-full transition-all duration-200 ${activeIndex === i ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/20 hover:bg-white/40'}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PromptDetailModal;