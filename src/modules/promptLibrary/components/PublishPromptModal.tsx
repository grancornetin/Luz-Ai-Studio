import React, { useState } from 'react';
import { X, Share2, Tag } from 'lucide-react';
import { PromptDNA } from '../types/promptTypes';

interface PublishPromptModalProps {
  imageUrl: string;
  promptText: string;
  promptDNA: PromptDNA;
  onClose: () => void;
  onPublish: (title: string, tags: string[]) => void;
}

const PublishPromptModal: React.FC<PublishPromptModalProps> = ({ imageUrl, promptText, promptDNA, onClose, onPublish }) => {
  const [title, setTitle] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-xl flex items-start justify-center p-4 md:p-8 overflow-y-auto animate-in fade-in">
      <div
        className="bg-white w-full max-w-lg md:max-w-2xl rounded-[32px] md:rounded-[48px] overflow-hidden shadow-2xl animate-in zoom-in duration-300 my-4 md:my-auto"
        onClick={e => e.stopPropagation()}
      >

        <div className="p-6 md:p-12 space-y-6 md:space-y-8">

          {/* HEADER */}

          <header className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-tight">
                Publicar en la Comunidad
              </h2>

              <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                Comparte tu Prompt DNA con otros creadores
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-10 h-10 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-all flex-shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* CONTENIDO */}

          <div className="flex flex-col md:flex-row gap-6 md:gap-8">

            {/* IMAGEN */}

            <div className="w-full md:w-1/3 aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border border-slate-100 flex-shrink-0">
              <img src={imageUrl} className="w-full h-full object-cover" alt="To publish" referrerPolicy="no-referrer" />
            </div>

            {/* FORM */}

            <div className="flex-1 space-y-5">

              {/* TITLE */}

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Título de la Obra
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Luxury Lipstick Campaign"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* TAGS */}

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Etiquetas (Tags)
                </label>

                <div className="flex gap-2">

                  <div className="relative flex-1">

                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      placeholder="belleza, minimal..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />

                  </div>

                  <button
                    onClick={addTag}
                    className="px-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-colors"
                  >
                    Añadir
                  </button>

                </div>

                {/* TAG LIST */}

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

              </div>

            </div>
          </div>

          {/* ACTIONS */}

          <div className="space-y-3">
            <button
              onClick={() => onPublish(title, tags)}
              disabled={!title || tags.length === 0}
              className={`w-full py-5 md:py-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl ${
                !title || tags.length === 0
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
              }`}
            >
              <Share2 className="w-5 h-5" />
              Publicar Prompt
            </button>

            <button
              onClick={onClose}
              className="w-full py-4 md:hidden text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
            >
              Cancelar y Volver
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PublishPromptModal;