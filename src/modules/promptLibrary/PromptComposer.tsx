import React from 'react';
import PromptInput from './components/PromptInput';
import PromptDNAPanel from './components/PromptDNAPanel';
import ReferenceSlots from './components/ReferenceSlots';
import GenerateButton from '../../components/shared/GenerateButton';
import GeneratedImages from './components/GeneratedImages';
import PromptTemplateSelector from './components/PromptTemplateSelector';
import PromptHistory, { historyStorage } from './components/PromptHistory';
import PromptVariations from './components/PromptVariations';
import NoCreditsModal from '../../components/shared/NoCreditsModal';

import { usePromptComposer } from './hooks/usePromptComposer';
import { PromptDNA } from './types/promptTypes';

import {
  Sparkles, ChevronDown,
  Settings, Layers, History, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { formatPrompt } from './utils/promptAutoFormatter';
import { ModelSelector } from '../../components/shared/ModelSelector';
import { useAuth } from '../../modules/auth/AuthContext';
import { imageCost } from '../../services/creditConfig';


interface PromptComposerProps {
  onPublish: (imageUrl: string, promptText: string, promptDNA: PromptDNA) => void;
  initialPrompt?: string;
  initialDNA?: PromptDNA;
  originPromptId?: string;
  /** Preset from ProjectCopilot via URL params — auto-applies mode and config */
  copilotPreset?: Record<string, string>;
}

const extractTokens = (text?: string): string[] => {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/@(\w+)/g);
  if (!matches) return [];
  return matches.map(t => t.replace('@', ''));
};

// ── Sección header reutilizable ─────────────────────────────────────
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: React.ReactNode;
}> = ({ icon, iconBg, title, subtitle }) => (
  <div className="flex items-start gap-3.5 mb-6">
    <div className={`w-11 h-11 flex-shrink-0 rounded-2xl flex items-center justify-center ${iconBg}`}>
      {icon}
    </div>
    <div className="flex-1 pt-0.5">
      <h3 className="text-[17px] font-bold text-slate-800 leading-tight tracking-tight">{title}</h3>
      {subtitle && <p className="text-[13px] text-slate-500 mt-1 leading-snug">{subtitle}</p>}
    </div>
  </div>
);

// ── Empty state panel derecho ────────────────────────────────────────
const EmptyOutputState: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-40">
    <div className="w-20 h-20 bg-white/5 border border-white/8 rounded-[32px] flex items-center justify-center mb-7">
      <Sparkles className="w-9 h-9 text-white" />
    </div>
    <h3 className="text-white text-[22px] font-extrabold italic uppercase tracking-tighter leading-none">
      Tu imagen aparecerá aquí
    </h3>
    <p className="text-slate-500 text-[11px] font-bold uppercase tracking-[0.3em] mt-4 max-w-[260px] leading-relaxed">
      Describe lo que quieres crear
    </p>
  </div>
);

// ── Error banner (panel izquierdo) ───────────────────────────────────
const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100">
    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-[12px] font-bold text-red-700">No pudimos crear la imagen</p>
      <p className="text-[11px] text-red-600 leading-relaxed mt-0.5">{message}</p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
      >
        <RefreshCw className="w-3 h-3" /> Reintentar
      </button>
    )}
  </div>
);

// ════════════════════════════════════════════════════════════════
// PromptComposer
// ════════════════════════════════════════════════════════════════
const PromptComposer: React.FC<PromptComposerProps> = ({
  onPublish,
  initialPrompt,
  initialDNA,
  originPromptId,
  copilotPreset,
}) => {
  const {
    promptText, setPromptText,
    dna, updateDNA, slots,
    uploadReference, removeReference, setPriority, toggleLock,
    generatedImages, isGenerating, error, generate,
    showNoCredits, closeNoCredits,
    modelId, setModelId,
  } = usePromptComposer();

  const { credits, isAdmin } = useAuth();

  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [activeTab, setActiveTab]       = React.useState<'inputs' | 'results'>('inputs');

  // Apply copilot preset on mount
  React.useEffect(() => {
    if (!copilotPreset) return;
    if (copilotPreset.prompt) {
      setPromptText(decodeURIComponent(copilotPreset.prompt));
    }
  }, [copilotPreset]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = credits?.plan ?? 'free';

  const safePromptText = typeof promptText === 'string' ? promptText : '';
  const usedTokens     = extractTokens(safePromptText);

  const activeReferenceUrls = React.useMemo(
    () => slots.filter(s => s.imageUrl).map(s => s.imageUrl as string),
    [slots],
  );

  React.useEffect(() => {
    if (initialPrompt) setPromptText(initialPrompt);
  }, [initialPrompt, setPromptText]);

  React.useEffect(() => {
    if (generatedImages.length === 0) return;
    historyStorage.push({ promptText: safePromptText, dna, imageUrl: generatedImages[0] });
  }, [generatedImages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAutoFormat = () => {
    const formatted = formatPrompt(safePromptText);
    if (formatted !== safePromptText) setPromptText(formatted);
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
    setPromptText(safePromptText.trim() ? `${safePromptText}, ${built}` : built);
  };

  const cost = imageCost(1, modelId);
  const hasEnoughCredits = isAdmin || (credits?.available ?? 0) >= cost;
  const creditsAfter = isAdmin ? undefined : (credits?.available ?? 0) - cost;

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeNoCredits} available={0} />

      <div className="space-y-5">

        {/* ── Mobile tabs ─────────────────────────────────── */}
        <div className="flex lg:hidden bg-slate-100 p-1 rounded-2xl gap-1">
          {(['inputs', 'results'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
              }`}
            >
              {tab === 'inputs' ? 'Configuración' : 'Resultado'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-7 items-start">

          {/* ══════════════ LEFT PANEL ══════════════ */}
          <div className={`space-y-5 ${activeTab === 'results' ? 'hidden lg:block' : 'block'}`}>

            {/* PROMPT EDITOR */}
            <section className="bg-white rounded-[48px] border border-slate-100 shadow-sm p-6 md:p-10 space-y-7">
              <SectionHeader
                icon={<Sparkles className="w-5 h-5" />}
                iconBg="bg-brand-50 text-brand-600"
                title="Describe tu idea"
                subtitle={
                  <>Escribe lo que quieres y menciona tus fotos con <code className="font-mono text-brand-600 text-[12px]">@</code> cuando quieras usarlas.</>
                }
              />

              {/* Templates */}
              <PromptTemplateSelector onApply={applyTemplate} />

              {/* Input con highlights */}
              <PromptInput
                value={safePromptText}
                onChange={setPromptText}
                onAutoFormat={handleAutoFormat}
              />

              {/* Modelo + Generar */}
              <div className="space-y-4">
                <ModelSelector value={modelId} onChange={setModelId} disabled={isGenerating} />
                <GenerateButton
                  onClick={generate}
                  loading={isGenerating}
                  disabled={!safePromptText.trim() || !hasEnoughCredits}
                  label="Crear imagen"
                  loadingLabel="Organizando tu idea…"
                  imageCount={1}
                  creditsAfter={creditsAfter}
                />
                {error && <ErrorBanner message={error} onRetry={generate} />}
              </div>
            </section>

            {/* REFERENCIAS */}
            <section className="bg-white rounded-[48px] border border-slate-100 shadow-sm p-6 md:p-10">
              <SectionHeader
                icon={<Layers className="w-5 h-5" />}
                iconBg="bg-emerald-50 text-emerald-600"
                title="Referencias visuales"
                subtitle={
                  <>Sube hasta 4 fotos y escribe <code className="font-mono text-brand-600 text-[12px]">@nombre</code> cuando quieras incluir una.</>
                }
              />
              <ReferenceSlots
                slots={slots}
                onUpload={uploadReference}
                onRemove={removeReference}
                usedTokens={usedTokens}
                onToggleLock={toggleLock}
                onSetPriority={setPriority}
              />
              {/* Tokens activos */}
              {usedTokens.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2 items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Referencias incluidas:</span>
                  {usedTokens.map(t => (
                    <span key={t} className="inline-flex items-center px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 font-mono text-[11px] font-semibold">
                      @{t}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* DNA AVANZADO */}
            <section className="bg-white rounded-[48px] border border-slate-100 shadow-sm p-6 md:p-10">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-[14px] font-bold text-slate-800 leading-none">
                      Editar la descripción por partes
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {showAdvanced ? '7 partes disponibles' : 'Cambia solo lo que necesites'}
                    </p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="mt-7 animate-in fade-in slide-in-from-top-2 duration-200">
                  <PromptDNAPanel dna={dna} onUpdate={updateDNA} />
                </div>
              )}
            </section>

            {/* VARIACIONES IA */}
            <section className="bg-white rounded-[48px] border border-slate-100 shadow-sm p-6 md:p-10">
              <PromptVariations
                promptText={safePromptText}
                dna={dna}
                onApply={(variantText) => setPromptText(variantText)}
              />
            </section>

            {/* HISTORIAL */}
            <section className="bg-white rounded-[48px] border border-slate-100 shadow-sm p-6 md:p-10">
              <SectionHeader
                icon={<History className="w-5 h-5" />}
                iconBg="bg-slate-100 text-slate-500"
                title="Historial"
                subtitle="Tus últimas descripciones."
              />
              <PromptHistory onRestore={(text) => setPromptText(text)} />
            </section>
          </div>

          {/* ══════════════ RIGHT PANEL (sticky) ══════════════ */}
          <div className={`lg:sticky lg:top-6 ${activeTab === 'inputs' ? 'hidden lg:block' : 'block'}`}>
            <div className="bg-slate-900 rounded-[56px] p-6 md:p-10 min-h-[600px] flex flex-col gap-5 shadow-2xl border-8 border-slate-800">
              {generatedImages.length === 0 && !isGenerating
                ? <EmptyOutputState />
                : <GeneratedImages
                    images={generatedImages}
                    onPublish={(img) => onPublish(img, safePromptText, dna)}
                  />
              }
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default PromptComposer;
