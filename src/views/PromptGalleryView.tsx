/**
 * PromptGalleryView.tsx
 * Main view: tabs for Discover / Saved / My Prompts
 * Pinterest masonry grid, real-time likes, save to board.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Bookmark, User, Globe } from 'lucide-react';
import PromptGallery from '../modules/promptLibrary/components/PromptGallery';
import PromptDetailModal from '../modules/promptLibrary/components/PromptDetailModal';
import { usePromptLibrary } from '../modules/promptLibrary/hooks/usePromptLibrary';
import { Prompt } from '../modules/promptLibrary/types/promptTypes';
import { useAuth } from '../modules/auth/AuthContext';
import SavedPromptsPanel from '../modules/promptLibrary/components/SavedPromptsPanel';
import MyPromptsPanel from '../modules/promptLibrary/components/MyPromptsPanel';

type GalleryTab = 'discover' | 'saved' | 'mine';

const PromptGalleryView: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [activeTab, setActiveTab] = useState<GalleryTab>('discover');

  const {
    prompts, allTags, searchQuery, setSearchQuery,
    activeTag, setActiveTag, sortBy, setSortBy,
    likePrompt, deletePrompt, loading,
    toggleSave, savedIds, boards, createBoard,
    isLiked, isSaved,
  } = usePromptLibrary();

  const handleRecreate = (prompt: Prompt) => {
    navigate('/prompt-studio', {
      state: {
        initialPrompt: prompt.promptText,
        initialDNA: prompt.promptDNA,
        originPromptId: prompt.id,
      },
    });
  };

  const tabs: { key: GalleryTab; label: string; icon: React.ReactNode }[] = [
    { key: 'discover', label: 'Descubrir', icon: <Globe className="w-4 h-4" /> },
    { key: 'saved',    label: 'Guardados',  icon: <Bookmark className="w-4 h-4" /> },
    { key: 'mine',     label: 'Mis Prompts', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-100 px-6 md:px-12 py-10 md:py-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-50/50 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
                    Prompt <span className="text-indigo-600">Gallery</span>
                  </h1>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    Comunidad · Inspiración · Creatividad
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/prompt-studio')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg flex-shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              Crear Prompt
            </button>
          </div>

          {/* TABS */}
          <div className="flex items-center gap-1 mt-8 bg-slate-100 p-1 rounded-2xl w-fit">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-10">

        {activeTab === 'discover' && (
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
            onSave={(id) => toggleSave(id)}
            isAdmin={isAdmin}
            savedIds={savedIds}
            likedIds={new Set(prompts.filter(p => isLiked(p.id)).map(p => p.id))}
            loading={loading}
          />
        )}

        {activeTab === 'saved' && (
          <SavedPromptsPanel
            boards={boards}
            savedIds={savedIds}
            onPromptClick={setSelectedPrompt}
            onRecreate={handleRecreate}
            onUnsave={(id) => toggleSave(id)}
            onCreateBoard={createBoard}
          />
        )}

        {activeTab === 'mine' && (
          <MyPromptsPanel
            onPromptClick={setSelectedPrompt}
            onRecreate={handleRecreate}
            onDelete={deletePrompt}
          />
        )}
      </main>

      {/* DETAIL MODAL */}
      {selectedPrompt && (
        <PromptDetailModal
          prompt={selectedPrompt}
          onClose={() => setSelectedPrompt(null)}
          onLike={likePrompt}
          onRecreate={handleRecreate}
          isSaved={isSaved(selectedPrompt.id)}
          isLiked={isLiked(selectedPrompt.id)}
          onSave={() => toggleSave(selectedPrompt.id)}
          boards={boards}
          onAddToBoard={(boardId) => {
            // handled inside SavedPromptsPanel via promptService
            const { promptService } = require('../modules/promptLibrary/services/promptService');
            // We import here to avoid circular deps in the view
          }}
        />
      )}
    </div>
  );
};

export default PromptGalleryView;