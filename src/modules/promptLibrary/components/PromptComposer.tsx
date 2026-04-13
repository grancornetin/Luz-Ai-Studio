import React from 'react';
import PromptInput from './PromptInput';
import PromptDNAAnalyzer from './PromptDNAAnalyzer';
import PromptDNAEditor from './PromptDNAEditor';
import ReferenceSlots from './ReferenceSlots';
import GenerateControls from './GenerateControls';
import GeneratedImages from './GeneratedImages';
import PromptTemplateSelector from './PromptTemplateSelector';
import PromptHistory, { historyStorage } from './PromptHistory';
import PromptVariations from './PromptVariations';
import CampaignGenerator from './CampaignGenerator';
import PhotodumpMode from './PhotodumpMode';
import NoCreditsModal from '../../../components/shared/NoCreditsModal';

import { usePromptComposer } from '../hooks/usePromptComposer';
import { PromptDNA } from '../types/promptTypes';

import { AlertCircle, Sparkles, ChevronDown, Zap, Megaphone, Images } from 'lucide-react';

// ──────────────────────────────────────────
// PromptComposer Sprint 4
// Modos: Standard | Campaign | Photodump
// Nuevo panel izquierdo: Variaciones IA (Style Lock incluido)
// ──────────────────────────────────────────

type OutputMode = 'standard' | 'campaign' | 'photodump';

interface PromptComposerProps {
  onPublish: (imageUrl: string, promptText: string, promptDNA: PromptDNA) => void;
  initialPrompt?: string;
  initialDNA?: PromptDNA;
}

const extractTokens = (text?: string): string[] => {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/@(\w+)/g);
  if (!matches) return [];
  return matches.map(token => token.replace('@', ''));
};

const PromptComposer: React.FC<PromptComposerProps> = ({
  onPublish,
  initialPrompt,
  initialDNA
}) => {

  const {
    promptText,
    setPromptText,
    dna,
    slots,
    uploadReference,
    removeReference,
    setPriority,
    toggleLock,
    generatedImages,
    isGenerating,
    error,
    generate,
    showNoCredits,
    closeNoCredits,
  } = usePromptComposer();

  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [outputMode, setOutputMode]     = React.useState<OutputMode>('standard');
  const [activeTab, setActiveTab]       = React.useState<'inputs' | 'results'>('inputs');

  const safePromptText = typeof promptText === 'string' ? promptText : '';
  const usedTokens     = extractTokens(safePromptText);

  // Referencias activas como array de URLs (Campaign + Photodump)
  const activeReferenceUrls = React.useMemo(() => {
    return slots
      .filter(s => s.imageUrl)
      .map(s => s.imageUrl as string);
  }, [slots]);

  React.useEffect(() => {
    if (initialPrompt) setPromptText(initialPrompt);
  }, [initialPrompt, setPromptText]);

  React.useEffect(() => {
    if (generatedImages.length === 0) return;
    historyStorage.push({
      promptText: safePromptText,
      dna,
      imageUrl: generatedImages[0]
    });
  }, [generatedImages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRestoreFromHistory = (restoredText: string, restoredDNA: PromptDNA) => {
    setPromptText(restoredText);
  };

  const handleApplyVariation = (variantText: string, variantDNA: PromptDNA) => {
    setPromptText(variantText);
  };

  const applyTemplate = (templateDNA: PromptDNA) => {
    const parts: string[] = [];
    if (templateDNA.styles)      parts.push(...templateDNA.styles);
    if (templateDNA.persons)     parts.push(...templateDNA.persons);
    if (templateDNA.products)    parts.push(...templateDNA.products);
    if (templateDNA.lighting)    parts.push(...templateDNA.lighting);
    if (templateDNA.background)  parts.push(...templateDNA.background);
    if (templateDNA.composition) parts.push(...templateDNA.composition);
    if (templateDNA.details)     parts.push(...templateDNA.details);
    const built = parts.join(', ');
    setPromptText(safePromptText.trim().length > 0 ? `${safePromptText}, ${built}` : built);
  };

  return (
    <>
    <NoCreditsModal isOpen={showNoCredits} onClose={closeNoCredits} available={0} />
    <div className="space-y-6">
      {/* Mobile Tabs */}
      <div className="flex lg:hidden bg-slate-100 p-1 rounded-2xl gap-1 mb-4">
        <button
          onClick={() => setActiveTab('inputs')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'inputs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
          }`}
        >
          Configuración
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'results' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
          }`}
        >
          Resultado
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ══════════════════════ LEFT ══════════════════════ */}
        <div className={`lg:col-span-6 space-y-6 ${activeTab === 'results' ? 'hidden lg:block' : 'block'}`}>

          {/* PROMPT COMPOSER */}
          <section className="bg-white p-5 md:p-10 rounded-[48px] border border-slate-100 shadow-sm space-y-8">
            <header className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic leading-none">
                  Prompt Composer
                </h2>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">
                  Visual Prompt Engineering Studio
                </p>
              </div>
            </header>

            <PromptTemplateSelector onApply={applyTemplate} />

            <div className="space-y-6">
              <PromptInput value={safePromptText} onChange={setPromptText} />

              {outputMode === 'standard' && (
                <GenerateControls
                  onGenerate={generate}
                  isGenerating={isGenerating}
                  disabled={!safePromptText.trim()}
                />
              )}

              {error && outputMode === 'standard' && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
                </div>
              )}
            </div>
          </section>

          {/* REFERENCES */}
          <section className="bg-white p-5 md:p-10 rounded-[48px] border border-slate-100 shadow-sm">
            <ReferenceSlots
              slots={slots}
              onUpload={uploadReference}
              onRemove={removeReference}
              usedTokens={usedTokens}
              onToggleLock={toggleLock}
              onSetPriority={setPriority}
            />
          </section>

          {/* DNA ADVANCED */}
          <section className="bg-white p-5 md:p-10 rounded-[48px] border border-slate-100 shadow-sm">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full"
            >
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                Advanced Prompt Structure
              </span>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
            {showAdvanced && (
              <div className="space-y-8 mt-8">
                <PromptDNAAnalyzer dna={dna} />
                <div className="h-px bg-slate-100" />
                <PromptDNAEditor dna={dna} onUpdate={() => {}} />
              </div>
            )}
          </section>

          {/* VARIACIONES IA — Sprint 4 */}
          <section className="bg-white p-5 md:p-10 rounded-[48px] border border-slate-100 shadow-sm">
            <PromptVariations
              promptText={safePromptText}
              dna={dna}
              onApply={handleApplyVariation}
            />
          </section>

          {/* PROMPT HISTORY */}
          <section className="bg-white p-5 md:p-10 rounded-[48px] border border-slate-100 shadow-sm">
            <PromptHistory onRestore={handleRestoreFromHistory} />
          </section>

        </div>

        {/* ══════════════════════ RIGHT ══════════════════════ */}
        <div className={`lg:col-span-6 ${activeTab === 'inputs' ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-slate-900 rounded-[56px] p-6 md:p-10 min-h-[600px] flex flex-col shadow-2xl border-8 border-slate-800 gap-6">

            {/* OUTPUT MODE TABS */}
            <div className="flex bg-slate-800/80 p-1.5 rounded-2xl gap-1 flex-shrink-0">

              <button
                onClick={() => setOutputMode('standard')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  outputMode === 'standard' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Standard</span>
              </button>

              <button
                onClick={() => setOutputMode('campaign')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  outputMode === 'campaign' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Campaign</span>
              </button>

              <button
                onClick={() => setOutputMode('photodump')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  outputMode === 'photodump' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Images className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Photodump</span>
              </button>

            </div>

            {/* STANDARD */}
            {outputMode === 'standard' && (
              <>
                {generatedImages.length === 0 && !isGenerating ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-30">
                    <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center mb-8">
                      <Sparkles className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-white text-xl font-black uppercase italic tracking-tighter leading-none">
                      Waiting for Generation
                    </h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em] mt-4 max-w-xs leading-relaxed">
                      Write a prompt and generate an image
                    </p>
                  </div>
                ) : (
                  <GeneratedImages
                    images={generatedImages}
                    onPublish={(img) => onPublish(img, safePromptText, dna)}
                  />
                )}
              </>
            )}

            {/* CAMPAIGN */}
            {outputMode === 'campaign' && (
              <div className="flex-1 overflow-y-auto">
                <CampaignGenerator
                  basePrompt={safePromptText}
                  dna={dna}
                  references={activeReferenceUrls}
                />
              </div>
            )}

            {/* PHOTODUMP */}
            {outputMode === 'photodump' && (
              <div className="flex-1 overflow-y-auto">
                <PhotodumpMode
                  basePrompt={safePromptText}
                  dna={dna}
                  references={activeReferenceUrls}
                />
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
    </>
  );
};

export default PromptComposer;