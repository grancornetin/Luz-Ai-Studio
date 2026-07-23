/**
 * PromptStudioView.tsx
 * ─────────────────────────────────────────────────────────────
 * Hosts the Prompt Composer + wires the "Publicar" button
 * to PublishPromptModal → Firestore via promptService.publishPrompt.
 * ─────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Library, CheckCircle } from 'lucide-react';

import PromptComposer from '../modules/promptLibrary/PromptComposer';
import PublishPromptModal from '../modules/promptLibrary/components/PublishPromptModal';
import { PromptDNA } from '../modules/promptLibrary/types/promptTypes';
import { promptService } from '../modules/promptLibrary/services/promptService';
import { useAuth } from '../modules/auth/AuthContext';
import { usePromptLibrary } from '../modules/promptLibrary/hooks/usePromptLibrary';

const PromptStudioView: React.FC = () => {
  const location    = useLocation();
  const navigate    = useNavigate();
  const { user, profile } = useAuth();
  const { boards, createBoard, allTags } = usePromptLibrary();

  // ── Initial state from navigation (when "Recrear" is clicked) ──
  const [initialPrompt,  setInitialPrompt]  = useState<string | undefined>();
  const [initialDNA,     setInitialDNA]     = useState<PromptDNA | undefined>();
  const [originPromptId, setOriginPromptId] = useState<string | undefined>();

  // ── Copilot preset from URL params (set by ProjectCopilot) ──
  const [copilotPreset, setCopilotPreset] = useState<Record<string, string> | undefined>();
  const [copilotBanner, setCopilotBanner] = useState(false);

  useEffect(() => {
    const state = location.state as any;
    if (state) {
      if (state.initialPrompt)  setInitialPrompt(state.initialPrompt);
      if (state.initialDNA)     setInitialDNA(state.initialDNA);
      if (state.originPromptId) setOriginPromptId(state.originPromptId);
      window.history.replaceState({}, document.title);
    }

    // Read copilot preset from URL search params
    const params = new URLSearchParams(location.search);
    const mode   = params.get('mode');
    if (mode) {
      const preset: Record<string, string> = {};
      params.forEach((v, k) => { preset[k] = v; });
      setCopilotPreset(preset);
      setCopilotBanner(true);
      // Clean URL without reload
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location]);

  // ── Publish flow state ──────────────────────────────────────
  const [pendingPublish, setPendingPublish] = useState<{
    imageUrl: string;
    promptText: string;
    promptDNA: PromptDNA;
  } | null>(null);

  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishedId, setPublishedId]       = useState<string | null>(null);

  // Called by PromptComposer when user clicks "Publicar" on a generated image
  const handlePublishRequest = (imageUrl: string, promptText: string, promptDNA: PromptDNA) => {
    setPendingPublish({ imageUrl, promptText, promptDNA });
  };

  // Called by PublishPromptModal when user confirms
  const handlePublishConfirm = async (title: string, tags: string[], boardId?: string) => {
    if (!pendingPublish || !user) return;

    const id = await promptService.publishPrompt({
      imageUrl:       pendingPublish.imageUrl,
      promptText:     pendingPublish.promptText,
      promptDNA:      pendingPublish.promptDNA,
      title,
      tags,
      authorId:       user.uid,
      authorName:     profile?.displayName || user.displayName || 'Anonymous',
      authorPhotoURL: profile?.photoURL    || user.photoURL    || '',
      originPromptId,
    });

    // If a board was selected, also save it there
    if (id && boardId) {
      await promptService.addToBoard(user.uid, boardId, id);
    }

    setPublishedId(id);
    setPendingPublish(null);
    setPublishSuccess(true);

    // Auto-dismiss success toast after 4s
    setTimeout(() => setPublishSuccess(false), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">

      {/* ── HEADER compacto ────────────────────────────────── */}
      <header className="bg-white border-b border-slate-100 px-6 md:px-12 py-6 md:py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
                Crear una <span className="text-brand-600">imagen</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 hidden md:block">
                Describe tu idea y conviértela en una imagen
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/prompt-gallery')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md"
            >
              <Library className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ideas</span>
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Inicio</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── COPILOT BANNER ──────────────────────────────────── */}
      {copilotBanner && (
        <div className="bg-indigo-600 text-white px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs font-black uppercase tracking-widest">
              Configurado por tu copiloto — puedes ajustar antes de generar
            </p>
          </div>
          <button
            onClick={() => setCopilotBanner(false)}
            className="text-white/70 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors flex-shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ── MAIN ────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 py-8 md:py-10">
        <PromptComposer
          onPublish={handlePublishRequest}
          initialPrompt={initialPrompt}
          initialDNA={initialDNA}
          originPromptId={originPromptId}
          copilotPreset={copilotPreset}
        />
      </main>

      {/* ── PUBLISH MODAL ────────────────────────────────────── */}
      {pendingPublish && (
        <PublishPromptModal
          imageUrl={pendingPublish.imageUrl}
          promptText={pendingPublish.promptText}
          promptDNA={pendingPublish.promptDNA}
          boards={boards}
          existingTags={allTags}
          onClose={() => setPendingPublish(null)}
          onPublish={handlePublishConfirm}
          onCreateBoard={createBoard}
        />
      )}

      {/* ── SUCCESS TOAST ────────────────────────────────────── */}
      {publishSuccess && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest">¡Idea publicada!</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Ya está visible en la Galería
              </p>
            </div>
            <button
              onClick={() => navigate('/prompt-gallery')}
              className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors"
            >
              Ver galería
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default PromptStudioView;
