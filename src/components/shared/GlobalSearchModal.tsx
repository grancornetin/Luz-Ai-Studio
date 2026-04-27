// src/components/shared/GlobalSearchModal.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Folder, Image, FileText, User, Shirt } from 'lucide-react';
import { useGlobalSearch, type SearchableItem } from '../../hooks/useGlobalSearch';

const TYPE_CONFIG: Record<SearchableItem['type'], { icon: React.ElementType; label: string; color: string }> = {
  project: { icon: Folder,   label: 'Proyectos',          color: 'text-blue-500 bg-blue-50' },
  image:   { icon: Image,    label: 'Imágenes generadas', color: 'text-violet-500 bg-violet-50' },
  prompt:  { icon: FileText, label: 'Prompts',            color: 'text-emerald-500 bg-emerald-50' },
  avatar:  { icon: User,     label: 'Modelos',            color: 'text-rose-500 bg-rose-50' },
  outfit:  { icon: Shirt,    label: 'Outfits',            color: 'text-amber-500 bg-amber-50' },
};

const TYPE_ORDER: SearchableItem['type'][] = ['project', 'avatar', 'image', 'prompt', 'outfit'];

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { search, isLoading } = useGlobalSearch();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on open
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    } else {
      setQuery('');
      setDebouncedQuery('');
    }
  }, [isOpen]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  const results = useMemo(() => search(debouncedQuery), [debouncedQuery, search]);

  // Group by type, preserving TYPE_ORDER
  const grouped = useMemo(() => {
    const map: Partial<Record<SearchableItem['type'], SearchableItem[]>> = {};
    results.forEach(r => {
      if (!map[r.type]) map[r.type] = [];
      map[r.type]!.push(r);
    });
    return TYPE_ORDER.filter(t => map[t] && map[t]!.length > 0).map(t => ({ type: t, items: map[t]! }));
  }, [results]);

  const handleSelect = (item: SearchableItem) => {
    onClose();
    navigate(item.url);
  };

  if (!isOpen) return null;

  const showResults = debouncedQuery.trim().length >= 2;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-16 md:pt-28 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Busca proyectos, imágenes, modelos, prompts..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 outline-none text-slate-800 text-sm placeholder:text-slate-400 bg-transparent"
            autoComplete="off"
          />
          {isLoading && (
            <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin flex-shrink-0" />
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Results */}
        {showResults && (
          <div className="max-h-[60vh] overflow-y-auto">
            {grouped.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-slate-400 text-sm font-medium">Sin resultados para "{debouncedQuery}"</p>
                <p className="text-slate-300 text-xs">Prueba con otro término</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {grouped.map(({ type, items }) => {
                  const cfg = TYPE_CONFIG[type];
                  return (
                    <div key={type}>
                      <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {cfg.label}
                      </div>
                      {items.map(item => {
                        const Icon = cfg.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                          >
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-100"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                              {item.subtitle && (
                                <p className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                              )}
                            </div>
                            <span className="text-slate-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">↵</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state when no query */}
        {!showResults && query.length === 0 && (
          <div className="px-4 py-6 flex items-center justify-center gap-4 text-slate-300">
            {TYPE_ORDER.map(t => {
              const Icon = TYPE_CONFIG[t].icon;
              return <Icon key={t} className="w-5 h-5" />;
            })}
          </div>
        )}

        {/* Footer hint */}
        <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[10px] text-slate-300 font-medium">Escribe al menos 2 caracteres</span>
          <div className="flex items-center gap-3 text-[10px] text-slate-300 font-medium">
            <span><kbd className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold">↵</kbd> Abrir</span>
            <span><kbd className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold">Esc</kbd> Cerrar</span>
          </div>
        </div>
      </div>
    </div>
  );
};
