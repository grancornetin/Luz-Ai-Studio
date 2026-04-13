import React from 'react';
import { Prompt } from '../types/promptTypes';
import { X, Copy, Play, Heart, ChevronLeft, ChevronRight, Maximize2, Minimize2, ZoomIn } from 'lucide-react';
import PromptDNAViewer from './PromptDNAViewer';

// ==============================
// 🔬 WORD-LEVEL DIFF ENGINE
// LCS-based, token-aware
// ==============================

type DiffToken = { text: string; type: 'equal' | 'added' | 'removed' };

// Tokenize: split by comma+space or just comma, preserving meaningful chunks
const tokenize = (text: string): string[] => {
  return text
    .split(/,\s*/)
    .map(t => t.trim())
    .filter(Boolean);
};

// LCS matrix
const buildLCS = (a: string[], b: string[]): number[][] => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
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
      result.unshift({ text: b[j - 1], type: 'equal' });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ text: b[j - 1], type: 'added' });
      j--;
    } else {
      result.unshift({ text: a[i - 1], type: 'removed' });
      i--;
    }
  }
  return result;
};

// ==============================
// 🎨 PROMPT DIFF RENDERER
// ==============================
interface PromptDiffProps {
  baseText: string;
  variantText: string;
}

const PromptDiff: React.FC<PromptDiffProps> = ({ baseText, variantText }) => {
  const tokens = React.useMemo(
    () => diffTokens(baseText, variantText),
    [baseText, variantText]
  );

  const addedCount = tokens.filter(t => t.type === 'added').length;
  const removedCount = tokens.filter(t => t.type === 'removed').length;
  const hasChanges = addedCount > 0 || removedCount > 0;

  return (
    <div className="space-y-3">
      {/* LEGEND */}
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
          {!hasChanges && (
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Sin cambios detectados
            </span>
          )}
        </div>
      )}

      {/* DIFF TEXT */}
      <p className="text-sm leading-relaxed font-medium text-slate-700">
        {tokens.map((token, i) => {
          const comma = i < tokens.length - 1 ? ', ' : '';
          if (token.type === 'added') {
            return (
              <React.Fragment key={i}>
                <mark className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-bold not-italic border border-emerald-200">
                  {token.text}
                </mark>
                {comma && <span className="text-slate-400">{comma}</span>}
              </React.Fragment>
            );
          }
          if (token.type === 'removed') {
            return (
              <React.Fragment key={i}>
                <span className="line-through decoration-rose-400 decoration-2 text-rose-400/80 bg-rose-50 px-1 py-0.5 rounded-md text-xs">
                  {token.text}
                </span>
                {comma && <span className="text-slate-400">{comma}</span>}
              </React.Fragment>
            );
          }
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

interface PromptDetailModalProps {
  prompt: Prompt;
  onClose: () => void;
  onLike: (id: string) => void;
  onRecreate: (prompt: Prompt) => void;
}

const PromptDetailModal: React.FC<PromptDetailModalProps> = ({
  prompt,
  onClose,
  onLike,
  onRecreate
}) => {

  // ==============================
  // 🧱 BUILD ALL IMAGES ARRAY
  // Base image first, then generations
  // ==============================
  const allImages = React.useMemo(() => [
    {
      imageUrl: prompt.imageUrl,
      promptText: prompt.promptText,
      promptDNA: prompt.promptDNA,
      label: 'Original'
    },
    ...(prompt.generations || []).map((gen, i) => ({
      imageUrl: gen.imageUrl,
      promptText: gen.promptText,
      promptDNA: gen.promptDNA,
      label: `Variación ${i + 1}`
    }))
  ], [prompt]);

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const thumbnailsRef = React.useRef<HTMLDivElement>(null);

  const active = allImages[activeIndex];
  const hasMultiple = allImages.length > 1;

  // ==============================
  // 🔄 NAVIGATE WITH TRANSITION
  // ==============================
  const navigateTo = React.useCallback((index: number) => {
    if (index === activeIndex || isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveIndex(index);
      setIsTransitioning(false);
    }, 150);
  }, [activeIndex, isTransitioning]);

  const navigatePrev = React.useCallback(() => {
    navigateTo(activeIndex > 0 ? activeIndex - 1 : allImages.length - 1);
  }, [activeIndex, allImages.length, navigateTo]);

  const navigateNext = React.useCallback(() => {
    navigateTo(activeIndex < allImages.length - 1 ? activeIndex + 1 : 0);
  }, [activeIndex, allImages.length, navigateTo]);

  // ==============================
  // ⌨️ KEYBOARD NAVIGATION
  // ==============================
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      }
      if (e.key === 'ArrowLeft' && hasMultiple) navigatePrev();
      if (e.key === 'ArrowRight' && hasMultiple) navigateNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen, hasMultiple, navigatePrev, navigateNext, onClose]);

  // ==============================
  // 📌 SCROLL THUMBNAIL INTO VIEW
  // ==============================
  React.useEffect(() => {
    if (!thumbnailsRef.current) return;
    const thumb = thumbnailsRef.current.children[activeIndex] as HTMLElement;
    if (thumb) {
      thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeIndex]);

  // Reset index when prompt changes
  React.useEffect(() => {
    setActiveIndex(0);
    setIsFullscreen(false);
  }, [prompt]);

  return (
    <>
      {/* ============================== */}
      {/* MAIN MODAL */}
      {/* ============================== */}
      <div
        className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-xl flex items-start md:items-center justify-center p-0 md:p-8 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white w-full max-w-6xl h-auto md:h-full md:max-h-[90vh] rounded-none md:rounded-[48px] overflow-hidden flex flex-col md:flex-row relative shadow-2xl min-h-screen md:min-h-0"
          onClick={(e) => e.stopPropagation()}
        >

          {/* MOBILE CLOSE BUTTON */}
          <button
            onClick={onClose}
            className="md:hidden fixed top-4 right-4 z-[1100] w-10 h-10 bg-black/40 backdrop-blur-md text-white rounded-xl flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ============================== */}
          {/* LEFT — IMAGE PANEL */}
          {/* ============================== */}
          <div className="md:w-1/2 h-1/2 md:h-full relative bg-slate-900 flex-shrink-0">

            {/* MAIN IMAGE */}
            <div className="relative w-full h-full overflow-hidden">
              <img
                src={active.imageUrl}
                className={`w-full h-full object-cover transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
                alt={active.label}
              />

              {/* FULLSCREEN BUTTON */}
              <button
                onClick={() => setIsFullscreen(true)}
                className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/40 backdrop-blur-md text-white rounded-xl flex items-center justify-center hover:bg-black/60 transition-colors"
                title="Ver en pantalla completa"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              {/* GENERATION COUNTER */}
              {hasMultiple && (
                <div className="absolute top-4 left-4 z-20 bg-black/50 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                  {activeIndex + 1} / {allImages.length}
                </div>
              )}

              {/* PREV / NEXT ARROWS — only if multiple */}
              {hasMultiple && (
                <>
                  <button
                    onClick={navigatePrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/40 backdrop-blur-md text-white rounded-xl flex items-center justify-center hover:bg-black/60 transition-all hover:scale-110 active:scale-95"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={navigateNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/40 backdrop-blur-md text-white rounded-xl flex items-center justify-center hover:bg-black/60 transition-all hover:scale-110 active:scale-95"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* CLICK TO FULLSCREEN HINT */}
              <div
                onClick={() => setIsFullscreen(true)}
                className="absolute inset-0 cursor-zoom-in z-10"
              />
            </div>

            {/* THUMBNAIL STRIP — only if multiple */}
            {hasMultiple && (
              <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-4 px-4">
                <div
                  ref={thumbnailsRef}
                  className="flex gap-2 overflow-x-auto scrollbar-hide"
                >
                  {allImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => navigateTo(i)}
                      className={`relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                        activeIndex === i
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/60'
                      }`}
                    >
                      <img
                        src={img.imageUrl}
                        className="w-full h-full object-cover"
                        alt={img.label}
                      />
                      {i === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[6px] text-white font-black text-center py-0.5 uppercase tracking-wider">
                          BASE
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* ============================== */}
          {/* RIGHT — CONTENT PANEL */}
          {/* ============================== */}
          <div className="md:w-1/2 h-1/2 md:h-full overflow-y-auto p-8 md:p-12 space-y-10">

            {/* HEADER */}
            <div className="flex justify-between items-start gap-4">

              <div className="space-y-1 flex-1 min-w-0">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">{prompt.title}</h2>

                {/* Active generation label */}
                {activeIndex > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-lg">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                    {active.label}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => onLike(prompt.id)}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50"
                >
                  <Heart className={`w-4 h-4 ${prompt.likes > 100 ? 'fill-red-500 text-red-500' : ''}`} />
                  <span className="text-[10px] font-bold">{prompt.likes}</span>
                </button>

                <button
                  onClick={onClose}
                  className="w-9 h-9 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

            </div>

            {/* DNA */}
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Prompt DNA {activeIndex > 0 ? `— ${active.label}` : '— Original'}
              </p>
              <PromptDNAViewer dna={active.promptDNA} />
            </div>

            {/* PROMPT TEXT — with visual diff for variations */}
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-3">

              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {activeIndex > 0 ? 'Diferencias vs Original' : 'Prompt Completo'}
                </p>
                {activeIndex > 0 && (
                  <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-50 px-2 py-1 rounded-lg">
                    Visual Diff
                  </span>
                )}
              </div>

              {activeIndex > 0 ? (
                <PromptDiff
                  baseText={allImages[0].promptText}
                  variantText={active.promptText}
                />
              ) : (
                <p className="text-sm text-slate-600 italic leading-relaxed">"{active.promptText}"</p>
              )}

            </div>

            {/* GENERATIONS DOT INDICATOR */}
            {hasMultiple && (
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {allImages.length} versiones
                </p>
                <div className="flex gap-1.5">
                  {allImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => navigateTo(i)}
                      className={`rounded-full transition-all duration-200 ${
                        activeIndex === i
                          ? 'w-5 h-2 bg-indigo-600'
                          : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ACTIONS */}
            <div className="grid grid-cols-2 gap-4">

              <button
                onClick={() =>
                  onRecreate({
                    ...prompt,
                    promptText: active.promptText,
                    promptDNA: active.promptDNA
                  })
                }
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-100"
              >
                <Play className="w-4 h-4 fill-current" />
                Recrear
              </button>

              <button
                onClick={() => navigator.clipboard.writeText(active.promptText)}
                className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Copy className="w-4 h-4" />
                Copiar
              </button>

            </div>

            {/* KEYBOARD HINT */}
            {hasMultiple && (
              <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                ← → para navegar · ESC para cerrar
              </p>
            )}

          </div>

        </div>
      </div>

      {/* ============================== */}
      {/* FULLSCREEN OVERLAY */}
      {/* ============================== */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-2xl flex flex-col"
          onClick={() => setIsFullscreen(false)}
        >

          {/* TOP BAR */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-white font-black text-sm uppercase italic tracking-tighter">{prompt.title}</span>
              {hasMultiple && (
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  {activeIndex + 1} / {allImages.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest hidden md:block">
                ← → navegar · ESC cerrar
              </span>
              <button
                onClick={() => setIsFullscreen(false)}
                className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MAIN FULLSCREEN IMAGE */}
          <div
            className="flex-1 flex items-center justify-center relative px-16 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >

            <img
              src={active.imageUrl}
              className={`max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
              alt={active.label}
            />

            {/* PREV */}
            {hasMultiple && (
              <button
                onClick={navigatePrev}
                className="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* NEXT */}
            {hasMultiple && (
              <button
                onClick={navigateNext}
                className="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

          </div>

          {/* BOTTOM — THUMBNAILS + ACTIVE LABEL */}
          {hasMultiple && (
            <div
              className="flex-shrink-0 px-6 py-5 flex flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >

              {/* Active label */}
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {active.label}
              </span>

              {/* Thumbnail strip */}
              <div className="flex gap-3 overflow-x-auto scrollbar-hide max-w-2xl pb-1">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => navigateTo(i)}
                    className={`relative flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all duration-200 ${
                      activeIndex === i
                        ? 'border-white scale-110 shadow-xl shadow-white/10'
                        : 'border-white/10 opacity-50 hover:opacity-100 hover:border-white/40'
                    }`}
                  >
                    <img src={img.imageUrl} className="w-full h-full object-cover" alt={img.label} />
                    {i === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[6px] text-white font-black text-center py-0.5 uppercase">
                        BASE
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Dot indicator */}
              <div className="flex gap-1.5">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => navigateTo(i)}
                    className={`rounded-full transition-all duration-200 ${
                      activeIndex === i
                        ? 'w-6 h-2 bg-white'
                        : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                    }`}
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
