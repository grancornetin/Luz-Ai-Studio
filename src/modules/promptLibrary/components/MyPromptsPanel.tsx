/**
 * MyPromptsPanel.tsx
 * Shows prompts created by the current logged-in user.
 */
import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Prompt } from '../types/promptTypes';
import { promptService } from '../services/promptService';
import { useAuth } from '../../auth/AuthContext';

interface MyPromptsPanelProps {
  onPromptClick: (p: Prompt) => void;
  onRecreate: (p: Prompt) => void;
  onDelete: (id: string) => void;
}

const MyPromptsPanel: React.FC<MyPromptsPanelProps> = ({
  onPromptClick, onRecreate, onDelete,
}) => {
  const { user, isAdmin } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    promptService.getUserPrompts(user.uid)
      .then(setPrompts)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-[28px] overflow-hidden border border-slate-100 animate-pulse">
            <div className="aspect-[3/4] bg-slate-200" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-slate-200 rounded-lg w-3/4" />
              <div className="h-3 bg-slate-100 rounded-lg w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="w-20 h-20 bg-slate-100 rounded-[32px] flex items-center justify-center mx-auto opacity-40">
          <Sparkles className="w-10 h-10 text-slate-300" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
          Aún no has publicado prompts
        </p>
        <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">
          Ve al generador, crea una imagen y publícala en la comunidad
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {prompts.length} prompt{prompts.length !== 1 ? 's' : ''} publicados
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {prompts.map(prompt => (
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
              {/* Author badge */}
              <div className="absolute top-3 left-3 z-10 bg-indigo-600/80 backdrop-blur-sm text-white px-2 py-1 rounded-xl">
                <span className="text-[9px] font-black uppercase tracking-widest">Tuyo</span>
              </div>

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
                    onClick={e => { e.stopPropagation(); onDelete(prompt.id); }}
                    className="w-9 h-9 bg-rose-500 text-white rounded-xl flex items-center justify-center hover:bg-rose-600 transition-colors"
                    title="Eliminar"
                  >
                    <span className="text-[10px] font-black">✕</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight line-clamp-2">
                {prompt.title}
              </h4>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {prompt.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">
                      #{tag}
                    </span>
                  ))}
                </div>
                <span className="text-[9px] font-bold text-slate-300">
                  ♥ {prompt.likes}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyPromptsPanel;