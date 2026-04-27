/**
 * PromptGallery.tsx — masonry grid with all Pinterest-like actions
 */
import React from 'react';
import { Prompt } from '../types/promptTypes';
import PromptCard from './PromptCard';
import { Search, SlidersHorizontal, Shield, TrendingUp, Clock, Layers, Sparkles } from 'lucide-react';
import { SortOption } from '../hooks/usePromptLibrary';

interface PromptGalleryProps {
  prompts: Prompt[];
  allTags: string[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeTag: string | null;
  setActiveTag: (t: string | null) => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
  onPromptClick: (p: Prompt) => void;
  onLike: (id: string) => void;
  onRecreate: (p: Prompt) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string, changes: { title?: string; tags?: string[] }) => Promise<void>;
  onSave?: (id: string) => void;
  isAdmin: boolean;
  savedIds?: Set<string>;
  likedIds?: Set<string>;
  loading?: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: 'recent',     label: 'Recientes',   icon: <Clock className="w-3.5 h-3.5" /> },
  { value: 'likes',      label: 'Más likes',   icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { value: 'variations', label: 'Variaciones', icon: <Layers className="w-3.5 h-3.5" /> },
];

// Skeleton card
const SkeletonCard = () => (
  <div className="bg-white rounded-[28px] overflow-hidden border border-slate-100 animate-pulse">
    <div className="aspect-[3/4] bg-slate-200" />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-slate-200 rounded-lg w-3/4" />
      <div className="h-3 bg-slate-100 rounded-lg w-1/2" />
      <div className="flex gap-1">
        <div className="h-5 w-12 bg-slate-100 rounded-md" />
        <div className="h-5 w-16 bg-slate-100 rounded-md" />
      </div>
    </div>
  </div>
);

const ITEMS_PER_PAGE = 20;

const PromptGallery: React.FC<PromptGalleryProps> = ({
  prompts, allTags, searchQuery, setSearchQuery,
  activeTag, setActiveTag, sortBy, setSortBy,
  onPromptClick, onLike, onRecreate, onDelete, onEdit, onSave,
  isAdmin, savedIds = new Set(), likedIds = new Set(),
  loading = false,
}) => {
  const [showSortMenu, setShowSortMenu] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(ITEMS_PER_PAGE);
  const sortMenuRef = React.useRef<HTMLDivElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);

  // Reset visibleCount cuando cambian filtros/búsqueda
  React.useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [searchQuery, activeTag, sortBy]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Recientes';

  const visiblePrompts = prompts.slice(0, visibleCount);
  const hasMore = visibleCount < prompts.length;
  const isAtEnd = !hasMore && prompts.length > 0 && !loading;

  return (
    <div className="space-y-8" ref={topRef}>

      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">

        {/* SEARCH */}
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar prompts, tags, estilos..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-6 py-3.5 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all outline-none"
          />
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* SORT */}
          <div className="relative" ref={sortMenuRef}>
            <button
              onClick={() => setShowSortMenu(p => !p)}
              className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm ${
                showSortMenu
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100'
                  : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {activeSortLabel}
            </button>

            {showSortMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 min-w-[160px]">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      sortBy === opt.value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                    {sortBy === opt.value && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ADMIN BADGE */}
          {isAdmin && (
            <div className="flex items-center gap-2 px-4 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-rose-500 text-white shadow-lg shadow-rose-100">
              <Shield className="w-3.5 h-3.5" />
              Admin
            </div>
          )}
        </div>
      </div>

      {/* ADMIN BANNER */}
      {isAdmin && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-600 px-6 py-4 rounded-2xl">
          <Shield className="w-4 h-4 flex-shrink-0" />
          <p className="text-[10px] font-black uppercase tracking-widest">
            Modo Admin · Puedes eliminar cualquier prompt. Hover en la card para ver el botón rojo.
          </p>
        </div>
      )}

      {/* TAG FILTERS */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
              !activeTag ? 'bg-violet-600 text-white shadow-md shadow-violet-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todo
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                activeTag === tag ? 'bg-violet-600 text-white shadow-md shadow-violet-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* RESULTS COUNT */}
      {(searchQuery || activeTag) && !loading && (
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {prompts.length} resultado{prompts.length !== 1 ? 's' : ''}
          {activeTag && <> en <span className="text-indigo-500">#{activeTag}</span></>}
          {searchQuery && <> para <span className="text-indigo-500">"{searchQuery}"</span></>}
        </p>
      )}

      {/* GRID */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : prompts.length === 0 ? (
        <div className="py-24 text-center space-y-4">
          <div className="w-20 h-20 bg-slate-100 rounded-[32px] flex items-center justify-center mx-auto opacity-40">
            <Sparkles className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
            No se encontraron prompts
          </p>
          <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">
            {searchQuery || activeTag ? 'Prueba otra búsqueda o tag' : 'Sé el primero en publicar'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visiblePrompts.map(prompt => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onClick={() => onPromptClick(prompt)}
                onLike={e => { e.stopPropagation(); onLike(prompt.id); }}
                onRecreate={e => { e.stopPropagation(); onRecreate(prompt); }}
                onSave={onSave ? e => { e.stopPropagation(); onSave(prompt.id); } : undefined}
                isAdmin={isAdmin}
                onDelete={(e, id) => { e.stopPropagation(); onDelete(id); }}
                onEdit={onEdit}
                isSaved={savedIds.has(prompt.id)}
                isLiked={likedIds.has(prompt.id)}
              />
            ))}
          </div>

          {/* Cargar más */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setVisibleCount(c => c + ITEMS_PER_PAGE)}
                className="px-8 py-3.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
              >
                Ver más ({prompts.length - visibleCount} restantes)
              </button>
            </div>
          )}

          {/* Fin de galería */}
          {isAtEnd && prompts.length >= ITEMS_PER_PAGE && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-[24px] flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-indigo-300" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">¡Has llegado al final!</p>
                <p className="text-xs text-slate-300 font-bold">Has visto todos los prompts publicados</p>
              </div>
              <button
                onClick={() => {
                  setVisibleCount(ITEMS_PER_PAGE);
                  topRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
              >
                Volver al inicio
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PromptGallery;