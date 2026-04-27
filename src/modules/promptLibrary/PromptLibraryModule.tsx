import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [activeTab, setActiveTab] = useState<'gallery' | 'composer'>('gallery');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

  const [publishData, setPublishData] = useState<{
    imageUrl: string
    promptText: string
    promptDNA: PromptDNA
    originPromptId?: string
  } | null>(null);

  const [recreatePrompt, setRecreatePrompt] = useState<string | undefined>();
  const [recreateDNA, setRecreateDNA] = useState<PromptDNA | undefined>();
  const [recreateOriginId, setRecreateOriginId] = useState<string | undefined>();

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
    publishPrompt,
    loading
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

    await publishPrompt(
      publishData.imageUrl,
      publishData.promptText,
      publishData.promptDNA,
      isRecreated ? '' : (title || 'Untitled'),
      isRecreated ? [] : (tags || []),
      publishData.originPromptId
    );

    setPublishData(null);
    setRecreateOriginId(undefined);
    setActiveTab('gallery');
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 md:pb-0">

      {/* HEADER */}
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
                  Prompt Library <span className="text-indigo-600">Studio</span>
                </h1>

              </div>

              <p className="text-sm md:text-lg font-bold text-slate-400 uppercase tracking-widest max-w-2xl leading-relaxed">
                Generador con IA · Galería de la comunidad.
              </p>

              <ModuleTutorial moduleId="aiGenerator" steps={TUTORIAL_CONFIGS.aiGenerator} label="¿Cómo funciona?" />

            </div>

            {/* TABS */}
            <div className="flex bg-slate-100 p-1.5 md:p-2 rounded-[28px] md:rounded-[32px] shadow-inner w-full md:w-auto">

              <button
                onClick={() => setActiveTab('gallery')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-4 rounded-[20px] md:rounded-[24px] text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === 'gallery'
                    ? 'bg-white text-slate-900 shadow-xl'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Library className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Explorar
              </button>

              <button
                onClick={() => setActiveTab('composer')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-4 rounded-[20px] md:rounded-[24px] text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === 'composer'
                    ? 'bg-white text-slate-900 shadow-xl'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Crear DNA
              </button>

            </div>

          </div>

        </div>

      </header>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-12">

        <AnimatePresence mode="wait">

          {activeTab === 'gallery' ? (

            <motion.div key="gallery">

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

            </motion.div>

          ) : (

            <motion.div key="composer">

              <PromptComposer
                initialPrompt={recreatePrompt}
                initialDNA={recreateDNA}
                onPublish={(imageUrl, promptText, promptDNA) => {

                  // 🔥 SI ES RECREATE → publicar directo sin modal
                  if (recreateOriginId) {
                    setPublishData({
                      imageUrl,
                      promptText,
                      promptDNA,
                      originPromptId: recreateOriginId,
                    });
                    // Publicar inmediatamente (sin modal de título/tags)
                    publishPrompt(imageUrl, promptText, promptDNA, '', [], recreateOriginId)
                      .then(() => {
                        setRecreateOriginId(undefined);
                        setActiveTab('gallery');
                      });
                    return;
                  }

                  // 🆕 SI ES NUEVO → abrir modal para título y tags
                  setPublishData({
                    imageUrl,
                    promptText,
                    promptDNA
                  });

                }}
              />

            </motion.div>

          )}

        </AnimatePresence>

      </main>

      {/* MODALS */}
      <AnimatePresence>

        {selectedPrompt && (

          <PromptDetailModal
            prompt={selectedPrompt}
            onClose={() => setSelectedPrompt(null)}
            onLike={likePrompt}
            onRecreate={handleRecreate}
          />

        )}

        {/* 🔴 SOLO PARA NUEVOS PROMPTS */}
        {publishData && !publishData.originPromptId && (

          <PublishPromptModal
            imageUrl={publishData.imageUrl}
            promptText={publishData.promptText}
            promptDNA={publishData.promptDNA}
            existingTags={allTags}
            onClose={() => setPublishData(null)}
            onPublish={handlePublish}
          />

        )}

      </AnimatePresence>

    </div>
  );
};

export default PromptLibraryModule;