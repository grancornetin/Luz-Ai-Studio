import React from 'react';
import { Wand2, Lock, Unlock, Sparkles, Loader2, AlertCircle, Check, ChevronDown } from 'lucide-react';
import { PromptDNA } from '../types/promptTypes';
import { variationsService, PromptVariation, MODIFIABLE_LAYERS, LAYER_LABELS, LAYER_COLORS } from '../services/variationsService';

interface PromptVariationsProps {
  promptText: string;
  dna: PromptDNA;
  onApply: (promptText: string, dna: PromptDNA) => void;
}

// ── Color map for layer badges ──
const BADGE_CLASSES: Record<string, string> = {
  styles:      'bg-brand-100 text-brand-700 border-brand-200',
  lighting:    'bg-amber-100 text-amber-700 border-amber-200',
  background:  'bg-accent-100 text-accent-700 border-accent-200',
  composition: 'bg-purple-100 text-purple-700 border-purple-200',
  details:     'bg-sky-100 text-sky-700 border-sky-200',
};

const LOCK_ACTIVE   = 'bg-slate-900 text-white border-slate-900';
const LOCK_INACTIVE = 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700';

const PromptVariations: React.FC<PromptVariationsProps> = ({
  promptText,
  dna,
  onApply
}) => {

  const [isOpen, setIsOpen]             = React.useState(false);
  const [lockedLayers, setLockedLayers] = React.useState<string[]>([]);
  const [variations, setVariations]     = React.useState<PromptVariation[]>([]);
  const [isLoading, setIsLoading]       = React.useState(false);
  const [error, setError]               = React.useState<string | null>(null);
  const [appliedId, setAppliedId]       = React.useState<string | null>(null);

  const toggleLock = (layer: string) => {
    setLockedLayers(prev =>
      prev.includes(layer)
        ? prev.filter(l => l !== layer)
        : [...prev, layer]
    );
  };

  const handleGenerate = async () => {
    if (!promptText.trim()) return;

    setIsLoading(true);
    setError(null);
    setVariations([]);
    setAppliedId(null);

    try {
      const result = await variationsService.generate(promptText, dna, lockedLayers);
      setVariations(result);
    } catch (err: any) {
      setError(err?.message || 'Error generando variaciones.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (variation: PromptVariation) => {
    setAppliedId(variation.id);
    onApply(variation.promptText, variation.dna);
  };

  const availableCount = MODIFIABLE_LAYERS.length - lockedLayers.length;
  const canGenerate    = promptText.trim().length > 0 && availableCount > 0 && !isLoading;

  return (
    <div>

      {/* ── TOGGLE HEADER ── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center justify-between w-full group"
      >
        <div className="flex items-center gap-3">
          <Wand2 className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-700 transition-colors">
            Variaciones IA
          </span>
          <span className="bg-brand-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            Sprint 4
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── PANEL ── */}
      {isOpen && (
        <div className="mt-6 space-y-6">

          {/* ── STYLE LOCK ── */}
          <div className="space-y-3">

            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Style Lock — Bloquear capas
              </span>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Las capas bloqueadas no serán modificadas por la IA.
            </p>

            <div className="flex flex-wrap gap-2">
              {MODIFIABLE_LAYERS.map(layer => {
                const locked = lockedLayers.includes(layer);
                return (
                  <button
                    key={layer}
                    onClick={() => toggleLock(layer)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${locked ? LOCK_ACTIVE : LOCK_INACTIVE}`}
                  >
                    {locked
                      ? <Lock className="w-2.5 h-2.5" />
                      : <Unlock className="w-2.5 h-2.5" />
                    }
                    {LAYER_LABELS[layer]}
                  </button>
                );
              })}
            </div>

            {lockedLayers.length > 0 && (
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {lockedLayers.length} bloqueada{lockedLayers.length !== 1 ? 's' : ''} ·{' '}
                {availableCount} disponible{availableCount !== 1 ? 's' : ''} para variar
              </p>
            )}

          </div>

          <div className="h-px bg-slate-100" />

          {/* ── GENERATE BUTTON ── */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${
              !canGenerate
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-brand-600 to-violet-600 text-white hover:from-brand-700 hover:to-violet-700 shadow-lg shadow-brand-100 hover:scale-[1.01] active:scale-[0.99]'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analizando DNA...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generar 3 Variaciones con IA
              </>
            )}
          </button>

          {/* ── ERROR ── */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 p-4 rounded-2xl text-red-600">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold uppercase tracking-tight leading-relaxed">{error}</p>
            </div>
          )}

          {/* ── VARIATIONS CARDS ── */}
          {variations.length > 0 && (
            <div className="space-y-4">

              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                3 variaciones generadas — click para aplicar
              </p>

              {variations.map((variation, idx) => {
                const isApplied  = appliedId === variation.id;
                const badgeClass = BADGE_CLASSES[variation.changedLayer] || BADGE_CLASSES.styles;

                return (
                  <div
                    key={variation.id}
                    onClick={() => handleApply(variation)}
                    className={`group/var relative p-5 rounded-2xl border cursor-pointer transition-all ${
                      isApplied
                        ? 'bg-brand-50 border-brand-300 shadow-md shadow-brand-50'
                        : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-brand-200 hover:shadow-md'
                    }`}
                  >

                    {/* HEADER ROW */}
                    <div className="flex items-start justify-between gap-3 mb-3">

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* NUMBER */}
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          #{idx + 1}
                        </span>
                        {/* CHANGED LAYER BADGE */}
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest ${badgeClass}`}>
                          {variation.changedLayerLabel}
                        </span>
                      </div>

                      {/* APPLY INDICATOR */}
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0 ${
                        isApplied
                          ? 'bg-brand-600 text-white'
                          : 'bg-white text-slate-400 border border-slate-200 opacity-0 group-hover/var:opacity-100'
                      }`}>
                        {isApplied
                          ? <><Check className="w-2.5 h-2.5" /> Aplicado</>
                          : 'Aplicar'
                        }
                      </div>

                    </div>

                    {/* DESCRIPTION */}
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                      {variation.description}
                    </p>

                    {/* PROMPT PREVIEW */}
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed italic">
                      "{variation.promptText}"
                    </p>

                  </div>
                );
              })}

              <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                Aplica una variación y genera en el compositor
              </p>

            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default PromptVariations;
