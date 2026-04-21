import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import PromptGallery from '../modules/promptLibrary/components/PromptGallery';
import PromptDetailModal from '../modules/promptLibrary/components/PromptDetailModal';
import { usePromptLibrary } from '../modules/promptLibrary/hooks/usePromptLibrary';
import { Prompt } from '../modules/promptLibrary/types/promptTypes';
import { useAuth } from '../modules/auth/AuthContext';

const PromptGalleryView: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

  const {
    prompts,
    allTags,
    searchQuery,
    setSearchQuery,
    activeTag,
    setActiveTag,
    sortBy,
    setSortBy,
    likePrompt,
    deletePrompt,
    loading
  } = usePromptLibrary();

  const handleRecreate = (prompt: Prompt) => {
    // Navegar al estudio con el prompt y DNA precargados
    navigate('/prompt-studio', {
      state: {
        initialPrompt: prompt.promptText,
        initialDNA: prompt.promptDNA,
        originPromptId: prompt.id
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <header className="bg-white border-b border-slate-100 px-6 md:px-12 py-12 md:py-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-50/50 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h1 className="text-3xl md:text-6xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
                  Prompt <span className="text-indigo-600">Gallery</span>
                </h1>
              </div>
              <p className="text-sm md:text-lg font-bold text-slate-400 uppercase tracking-widest max-w-2xl leading-relaxed">
                Comunidad de prompts · Inspiración · Recrea y genera
              </p>
              <button
                onClick={() => navigate('/prompt-studio')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                Ir al Generador
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <PromptGallery
          prompts={prompts}
          allTags={allTags}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeTag={activeTag}
          setActiveTag={setActiveTag}
          sortBy={sortBy}
          setSortBy={setSortBy}
          onPromptClick={setSelectedPrompt}
          onLike={likePrompt}
          onRecreate={handleRecreate}
          onDelete={deletePrompt}
          isAdmin={isAdmin}
        />
      </main>

      {selectedPrompt && (
        <PromptDetailModal
          prompt={selectedPrompt}
          onClose={() => setSelectedPrompt(null)}
          onLike={likePrompt}
          onRecreate={handleRecreate}
        />
      )}
    </div>
  );
};

export default PromptGalleryView;