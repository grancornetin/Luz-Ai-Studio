
import { PromptDNA } from '../types/promptTypes';

export const promptHelpers = {
  validatePrompt(text: string): boolean {
    return text.trim().length >= 50;
  },

  formatDNAKey(key: string): string {
    return key.toUpperCase();
  },

  getDNABlocks(dna: PromptDNA): { key: keyof PromptDNA; label: string; value: string }[] {
    const formatValue = (val: string[] | undefined) => (val && val.length > 0 ? val.join(', ') : '');
    
    return [
      { key: 'styles', label: 'STYLE', value: formatValue(dna.styles) },
      { key: 'persons', label: 'PERSON', value: formatValue(dna.persons) },
      { key: 'products', label: 'PRODUCT', value: formatValue(dna.products) },
      { key: 'lighting', label: 'LIGHTING', value: formatValue(dna.lighting) },
      { key: 'background', label: 'BACKGROUND', value: formatValue(dna.background) },
      { key: 'composition', label: 'COMPOSITION', value: formatValue(dna.composition) },
      { key: 'details', label: 'DETAILS', value: formatValue(dna.details) },
    ];
  }
};
