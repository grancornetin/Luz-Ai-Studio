import { useState, useCallback } from 'react';
import { generationHistoryService } from '../../../services/generationHistoryService';
import { PromptDNA } from '../types/promptTypes';
import { generationService } from '../services/generationService';
import { usePromptParser } from './usePromptParser';
import { useReferences } from './useReferences';
import { promptParserService } from '../services/promptParserService';
import { promptBuilder } from '../services/promptBuilder';
import { payloadValidator } from '../services/payloadValidator';
import { useAuth } from '../../auth/AuthContext';
import { CREDIT_COSTS, imageCost } from '../../../services/creditConfig';
import { useModelSelection } from '../../../hooks/useModelSelection';

const mergeDNA = (baseDNA: PromptDNA, referenceDNA: PromptDNA): PromptDNA => {
  const unique = (arr?: string[]) => Array.from(new Set(arr || []));

  return {
    persons: unique([...(baseDNA.persons || []), ...(referenceDNA.persons || [])]),
    products: unique([...(baseDNA.products || []), ...(referenceDNA.products || [])]),
    styles: unique([...(baseDNA.styles || []), ...(referenceDNA.styles || [])]),
    lighting: unique(baseDNA.lighting),
    background: unique(baseDNA.background),
    composition: unique(baseDNA.composition),
    details: unique(baseDNA.details)
  };
};

const buildOptimizedPrompt = (
  text: string,
  dna: PromptDNA
) => {
  const rebuilt = promptParserService.rebuild(dna);

  if (!rebuilt) return text;

  return `${text}, ${rebuilt}, high detail, professional photography`;
};

export const usePromptComposer = () => {

  const {
    promptText,
    setPromptText,
    dna,
    setDna,
    updateDNA
  } = usePromptParser();

  const {
    slots,
    uploadReference,
    removeReference,
    setPriority,
    toggleLock,
    getActiveReferences,
    buildDNA,
    resetReferences
  } = useReferences();

  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [lastGeneration, setLastGeneration] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNoCredits, setShowNoCredits] = useState(false);

  const { credits, isAdmin, deductCredits } = useAuth();
  const { modelId, setModelId } = useModelSelection();

  const generate = useCallback(async () => {

    if (!promptText.trim()) return;

    // Costo dinámico según el modelo (Gemini = 2 créditos, Seedream = 1 crédito)
    const creditCost = imageCost(1, modelId);

    // Verificar y descontar créditos
    if (!isAdmin) {
      if (credits.available < creditCost) {
        setShowNoCredits(true);
        return;
      }
      const ok = await deductCredits(creditCost);
      if (!ok) { setShowNoCredits(true); return; }
    }

    setIsGenerating(true);
    setError(null);

    try {

      const validation = payloadValidator.validateGeneration(
        promptText,
        slots
      );

      if (!validation.valid) {
        throw new Error(validation.errors.join(' | '));
      }

      const activeReferences = getActiveReferences();

      const references = activeReferences
        .map(slot => slot.imageUrl)
        .filter((img): img is string => Boolean(img));

      const { dna: referenceDNA } = buildDNA();

      const mergedDNA = mergeDNA(dna, referenceDNA);

      const optimizedPrompt = buildOptimizedPrompt(
        promptText,
        mergedDNA
      );

      const finalPrompt = promptBuilder.buildPrompt(
        optimizedPrompt,
        slots,
        mergedDNA
      );

      const negativePrompt = promptBuilder.buildNegativePrompt();

      const image = await generationService.generateImage(
        finalPrompt,
        references,
        negativePrompt,
        false, // ya no se usa el flag de persona, el costo se calculó arriba
        { modelId },
      );

      // 🧠 Guardamos metadata de generación
      setLastGeneration({
        prompt: finalPrompt,
        negativePrompt,
        references,
        dna: mergedDNA,
        timestamp: Date.now()
      });

      setGeneratedImages(prev => [image, ...prev]);

      // Guardar en historial automáticamente
      generationHistoryService.save({
        imageUrl:    image,
        module:      'prompt_studio',
        moduleLabel: 'AI Generator',
        creditsUsed: creditCost,
        promptText:  finalPrompt,
      }).catch(console.error);

    } catch (err: any) {
      setError(err?.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }

  }, [promptText, dna, slots, getActiveReferences, buildDNA, modelId, credits.available, isAdmin, deductCredits]);

  const reset = useCallback(() => {

    setPromptText('');

    setDna({
      persons: [],
      products: [],
      styles: [],
      lighting: [],
      background: [],
      composition: [],
      details: []
    });

    setGeneratedImages([]);
    setLastGeneration(null);
    setError(null);
    resetReferences();

  }, [setPromptText, setDna, resetReferences]);

  return {
    promptText,
    setPromptText,
    dna,
    updateDNA,
    slots,
    uploadReference,
    removeReference,
    setPriority,
    toggleLock,
    generatedImages,
    lastGeneration,
    isGenerating,
    error,
    generate,
    reset,
    showNoCredits,
    closeNoCredits: () => setShowNoCredits(false),
    modelId,
    setModelId,
  };

};