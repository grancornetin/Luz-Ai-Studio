import React from 'react';
import { Prompt } from '../types/promptTypes';
import PromptCard from './PromptCard';
import { Search, SlidersHorizontal, Shield, TrendingUp, Clock, Layers } from 'lucide-react';
import { SortOption } from '../hooks/usePromptLibrary';

interface PromptGalleryProps {
  prompts: Prompt[];
  allTags: string[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTag: string | null;
  setActiveTag: (tag: string | null) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  onPromptClick: (prompt: Prompt) => void;
  onLike: (id: string) => void;
  onRecreate: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: 'recent',     label: 'Recientes',   icon: <Clock className="w-3.5 h-3.5" /> },
  { value: 'likes',      label: 'Más likes',   icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { value: 'variations', label: 'Variaciones', icon: <Layers className="w-3.5 h-3.5" /> },
];

const PromptGallery: React.FC<PromptGalleryProps> = ({
  prompts, allTags, searchQuery, setSearchQuery,
  activeTag, setActiveTag, sortBy, setSortBy,
  onPromptClick, onLike, onRecreate, onDelete, isAdmin
}) => {

  const [showSortMenu, setShowSortMenu] = React.useState(false);
  const sortMenuRef = React.useRef<HTMLDivElement>(null);

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

  return (
    <div className="space-y-8">

      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">

        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar prompts..."
            className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none"
          />
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">

          {/* SORT */}
          <div className="relative" ref={sortMenuRef}>
            <button
              onClick={() => setShowSortMenu(prev => !prev)}
              className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                showSortMenu
                  ? 'bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-100'
                  : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {activeSortLabel}
            </button>

            {showSortMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 min-w-[160px] animate-in fade-in zoom-in-95 duration-150">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      sortBy === opt.value ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                    {sortBy === opt.value && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ADMIN BADGE — visible solo si role === admin */}
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
            Modo Admin activo · Haz click en el icono rojo de cada card para eliminar prompts.
          </p>
        </div>
      )}

      {/* TAG FILTERS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setActiveTag(null)}
          className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
            !activeTag ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
          }`}
        >
          Todos
        </button>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTag === tag ? 'bg-brand-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* RESULTS COUNT */}
      {(searchQuery || activeTag) && (
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {prompts.length} resultado{prompts.length !== 1 ? 's' : ''}
          {activeTag && <> en <span className="text-brand-500">#{activeTag}</span></>}
          {searchQuery && <> para <span className="text-brand-500">"{searchQuery}"</span></>}
        </p>
      )}

      {/* GRID */}
      {prompts.length === 0 ? (
        <div className="py-20 text-center space-y-4 opacity-40">
          <Search className="w-12 h-12 mx-auto text-slate-300" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No se encontraron prompts</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {prompts.map(prompt => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onClick={() => onPromptClick(prompt)}
              onLike={(e) => { e.stopPropagation(); onLike(prompt.id); }}
              onRecreate={(e) => { e.stopPropagation(); onRecreate(prompt); }}
              isAdmin={isAdmin}
              onDelete={(e, id) => { e.stopPropagation(); onDelete(id); }}
            />
          ))}
        </div>
      )}

    </div>
  );
};

export default PromptGallery;
