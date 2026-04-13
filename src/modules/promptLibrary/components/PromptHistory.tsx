import React from 'react';
import { History, RotateCcw, ChevronDown, Clock, Layers, X } from 'lucide-react';
import { PromptDNA } from '../types/promptTypes';

// ──────────────────────────────────────────
// Storage logic inline — sin archivos externos
// ──────────────────────────────────────────

const HISTORY_KEY = 'luz_ia_prompt_history';
const MAX_ITEMS = 30;

export interface PromptHistoryItem {
  id: string;
  promptText: string;
  dna: PromptDNA;
  imageUrl?: string;
  createdAt: string;
}

export const historyStorage = {
  getAll(): PromptHistoryItem[] {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  push(item: Omit<PromptHistoryItem, 'id' | 'createdAt'>): void {
    try {
      const current = this.getAll();
      if (current.length > 0 && current[0].promptText === item.promptText) return;
      const newItem: PromptHistoryItem = {
        ...item,
        id: `h_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      const next = [newItem, ...current].slice(0, MAX_ITEMS);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // silencioso si quota exceeded
    }
  },

  delete(id: string): PromptHistoryItem[] {
    try {
      const next = this.getAll().filter(item => item.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    } catch {
      return this.getAll();
    }
  },

  clear(): void {
    try { localStorage.removeItem(HISTORY_KEY); } catch { }
  }
};

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

const timeAgo = (isoDate: string): string => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'ahora';
  if (mins < 60)  return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
};

const dnaSummary = (dna: PromptDNA): string => {
  const parts: string[] = [];
  if (dna?.styles?.length)     parts.push(dna.styles[0]);
  if (dna?.lighting?.length)   parts.push(dna.lighting[0]);
  if (dna?.background?.length) parts.push(dna.background[0]);
  return parts.slice(0, 2).join(' · ');
};

// ──────────────────────────────────────────
// Component
// ──────────────────────────────────────────

interface PromptHistoryProps {
  onRestore: (promptText: string, dna: PromptDNA) => void;
}

const PromptHistory: React.FC<PromptHistoryProps> = ({ onRestore }) => {

  const [isOpen, setIsOpen]           = React.useState(false);
  const [items, setItems]             = React.useState<PromptHistoryItem[]>([]);
  const [confirmClear, setConfirmClear] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) setItems(historyStorage.getAll());
  }, [isOpen]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setItems(historyStorage.delete(id));
  };

  const handleClear = () => {
    historyStorage.clear();
    setItems([]);
    setConfirmClear(false);
  };

  const handleRestore = (item: PromptHistoryItem) => {
    onRestore(item.promptText, item.dna);
    setIsOpen(false);
  };

  return (
    <div>

      {/* ── TOGGLE ── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center justify-between w-full group"
      >
        <div className="flex items-center gap-3">
          <History className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-700 transition-colors">
            Prompt History
          </span>
          {items.length > 0 && (
            <span className="bg-indigo-100 text-indigo-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              {items.length}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* ── PANEL ── */}
      {isOpen && (
        <div className="mt-6 space-y-4">

          {/* EMPTY STATE */}
          {items.length === 0 && (
            <div className="py-10 flex flex-col items-center gap-3 opacity-40">
              <Clock className="w-8 h-8 text-slate-300" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                El historial aparece aquí<br />después de generar imágenes
              </p>
            </div>
          )}

          {/* ITEMS */}
          {items.length > 0 && (
            <>
              <div className="flex justify-end">
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">¿Limpiar todo?</span>
                    <button onClick={handleClear} className="text-[9px] font-black text-white bg-rose-500 hover:bg-rose-600 px-2.5 py-1 rounded-lg uppercase tracking-wider transition-colors">Sí</button>
                    <button onClick={() => setConfirmClear(false)} className="text-[9px] font-black text-slate-400 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg uppercase tracking-wider transition-colors">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmClear(true)} className="text-[9px] font-black text-slate-300 hover:text-rose-400 uppercase tracking-widest transition-colors">
                    Limpiar historial
                  </button>
                )}
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleRestore(item)}
                    className="group/item flex gap-3 p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-2xl cursor-pointer transition-all"
                  >
                    {item.imageUrl && (
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100">
                        <img src={item.imageUrl} className="w-full h-full object-cover" alt="thumb" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-xs font-bold text-slate-700 line-clamp-2 leading-relaxed group-hover/item:text-indigo-700 transition-colors">
                        {item.promptText}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-wider">
                          <Clock className="w-2.5 h-2.5" />{timeAgo(item.createdAt)}
                        </span>
                        {dnaSummary(item.dna) && (
                          <>
                            <span className="text-slate-200">·</span>
                            <span className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-wider">
                              <Layers className="w-2.5 h-2.5" />{dnaSummary(item.dna)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between flex-shrink-0 gap-2">
                      <div className="md:opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1 bg-indigo-600 text-white px-2 py-1 rounded-lg">
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span className="text-[8px] font-black uppercase tracking-wider">Restaurar</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, item.id)}
                        className="md:opacity-0 group-hover/item:opacity-100 w-8 h-8 md:w-6 md:h-6 rounded-lg bg-slate-200 hover:bg-rose-100 hover:text-rose-500 text-slate-400 flex items-center justify-center transition-all"
                      >
                        <X className="w-4 h-4 md:w-3 md:h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
};

export default PromptHistory;
