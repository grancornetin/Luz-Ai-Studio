import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Library } from 'lucide-react';
import PromptComposer from '../modules/promptLibrary/PromptComposer';
import { PromptDNA } from '../modules/promptLibrary/types/promptTypes';

const PromptStudioView: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>();
  const [initialDNA, setInitialDNA] = useState<PromptDNA | undefined>();
  const [originPromptId, setOriginPromptId] = useState<string | undefined>();

  useEffect(() => {
    const state = location.state as any;
    if (state) {
      if (state.initialPrompt) setInitialPrompt(state.initialPrompt);
      if (state.initialDNA) setInitialDNA(state.initialDNA);
      if (state.originPromptId) setOriginPromptId(state.originPromptId);
      // Limpiar el estado para no reutilizarlo en futuras navegaciones
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handlePublish = () => {
    // Después de publicar, se puede navegar a la galería o mostrar mensaje
    // El componente PromptComposer ya maneja la publicación a través de onPublish
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <header className="bg-white border-b border-slate-100 px-6 md:px-12 py-12 md:py-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-50/50 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-brand-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-brand-200">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h1 className="text-3xl md:text-6xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
                  Prompt <span className="text-brand-600">Studio</span>
                </h1>
              </div>
              <p className="text-sm md:text-lg font-bold text-slate-400 uppercase tracking-widest max-w-2xl leading-relaxed">
                Visual Prompt Engineering · DNA Lock · IA Generativa
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/prompt-gallery')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
                >
                  <Library className="w-4 h-4" />
                  Explorar Galería
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver al Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <PromptComposer
          onPublish={handlePublish}
          initialPrompt={initialPrompt}
          initialDNA={initialDNA}
          originPromptId={originPromptId}
        />
      </main>
    </div>
  );
};

export default PromptStudioView;