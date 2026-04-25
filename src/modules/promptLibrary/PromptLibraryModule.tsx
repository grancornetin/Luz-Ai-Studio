import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Sparkles, Library, PlusCircle } from 'lucide-react';
import PromptGallery from './components/PromptGallery';
import PromptComposer from './components/PromptComposer';
import PromptDetailModal from './components/PromptDetailModal';
import PublishPromptModal from './components/PublishPromptModal';
import { usePromptLibrary } from './hooks/usePromptLibrary';
import { Prompt, PromptDNA } from './types/promptTypes';
import { useAuth } from '../auth/AuthContext';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';

const PromptLibraryModule: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab]         = useState<'gallery' | 'composer'>('gallery');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

  const [publishData, setPublishData] = useState<{
    imageUrl: string;
    promptText: string;
    promptDNA: PromptDNA;
    originPromptId?: string;
  } | null>(null);

  const [recreatePrompt, setRecreatePrompt]   = useState<string | undefined>();
  const [recreateDNA, setRecreateDNA]         = useState<PromptDNA | undefined>();
  const [recreateOriginId, setRecreateOriginId] = useState<string | undefined>();

  const {
    prompts, allTags, searchQuery, setSearchQuery,
    activeTag, setActiveTag, sortBy, setSortBy,
    likePrompt, deletePrompt, publishPrompt, loading,
  } = usePromptLibrary();

  const handleRecreate = (prompt: Prompt) => {
    setRecreatePrompt(prompt.promptText);
    setRecreateDNA(prompt.promptDNA);
    setRecreateOriginId(prompt.originPromptId || prompt.id);
    setActiveTab('composer');
    setSelectedPrompt(null);
  };

  const handlePublish = async (title?: string, tags?: string[]) => {
    if (!publishData || !user) return;
    const isRecreated = !!publishData.originPromptId;
    const newPrompt: Prompt = {
      id: Date.now().toString(),
      title: isRecreated ? '' : title || 'Untitled',
      promptText: publishData.promptText,
      promptDNA: publishData.promptDNA,
      imageUrl: publishData.imageUrl,
      authorId: user.uid,
      likes: 0,
      tags: isRecreated ? [] : (tags || []),
      createdAt: new Date().toISOString(),
      originPromptId: publishData.originPromptId,
      generations: [],
    };
    await publishPrompt(newPrompt);
    setPublishData(null);
    setRecreateOriginId(undefined);
    setActiveTab('gallery');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F]">

      <header className="relative overflow-hidden border-b border-white/[0.06] bg-[#0D0D14]">
        <div className="absolute top-0 right-0 w-96 h-48 bg-fuchsia-600/8 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute top-0 left-1/3 w-64 h-32 bg-violet-600/8 rounded-full blur-[60px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-gradient-to-b from-fuchsia-500 to-violet-500 rounded-full" />
                <span className="text-2xs font-black text-white/25 uppercase tracking-[0.4em]">Generar Contenido</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-fuchsia-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-fuchsia-900/40 flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter italic leading-none">AI Generator</h1>
                  <p className="text-xs md:text-sm font-bold text-white/25 uppercase tracking-widest mt-1.5">Visual Prompt Engineering & Community DNA</p>
                </div>
              </div>
              <ModuleTutorial moduleId="aiGenerator" steps={TUTORIAL_CONFIGS.aiGenerator} label="¿Cómo funciona?" />
            </div>

            <div className="flex bg-white/[0.04] border border-white/[0.06] p-1.5 rounded-2xl w-full md:w-auto shadow-inner">
              <button
                onClick={() => setActiveTab('gallery')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 md:px-8 py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === 'gallery'
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                <Library size={13} />
                Biblioteca
                {prompts.length > 0 && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${activeTab === 'gallery' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/30'}`}>
                    {prompts.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('composer')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 md:px-8 py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === 'composer'
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                <PlusCircle size={13} />
                Crear DNA
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8 pb-28 md:pb-12">
        <AnimatePresence mode="wait">
          {activeTab === 'gallery' ? (
            <div key="gallery">
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
            </div>
          ) : (
            <div key="composer">
              <PromptComposer
                initialPrompt={recreatePrompt}
                initialDNA={recreateDNA}
                onPublish={(imageUrl, promptText, promptDNA) => {
                  if (recreateOriginId) { handlePublish(undefined, undefined); return; }
                  setPublishData({ imageUrl, promptText, promptDNA });
                }}
              />
            </div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {selectedPrompt && (
          <PromptDetailModal
            prompt={selectedPrompt}
            onClose={() => setSelectedPrompt(null)}
            onLike={likePrompt}
            onRecreate={handleRecreate}
          />
        )}
        {publishData && !publishData.originPromptId && (
          <PublishPromptModal
            imageUrl={publishData.imageUrl}
            promptText={publishData.promptText}
            promptDNA={publishData.promptDNA}
            onClose={() => setPublishData(null)}
            onPublish={handlePublish}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default PromptLibraryModule;
