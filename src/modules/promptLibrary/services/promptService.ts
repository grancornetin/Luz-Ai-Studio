import { Prompt, PromptDNA, PromptGeneration } from '../types/promptTypes';

const COLLECTION_NAME = 'prompts';
const MAX_PROMPTS = 50;

const emptyDNA = (): PromptDNA => ({
  persons: [],
  personLayers: [],
  products: [],
  styles: [],
  lighting: [],
  background: [],
  composition: [],
  details: []
});

const normalizeDNA = (dna: any): PromptDNA => {
  if (!dna) return emptyDNA();

  return {
    persons: Array.isArray(dna.persons) ? dna.persons : Array.isArray(dna.person) ? dna.person : [],
    personLayers: Array.isArray(dna.personLayers) ? dna.personLayers : [],
    products: Array.isArray(dna.products) ? dna.products : Array.isArray(dna.product) ? dna.product : [],
    styles: Array.isArray(dna.styles) ? dna.styles : Array.isArray(dna.style) ? dna.style : [],
    lighting: Array.isArray(dna.lighting) ? dna.lighting : [],
    background: Array.isArray(dna.background) ? dna.background : [],
    composition: Array.isArray(dna.composition) ? dna.composition : [],
    details: Array.isArray(dna.details) ? dna.details : []
  };
};

const normalizeGeneration = (generation: any): PromptGeneration => ({
  id: generation?.id || Date.now().toString(),
  imageUrl: generation?.imageUrl || '',
  promptText: generation?.promptText || '',
  promptDNA: normalizeDNA(generation?.promptDNA || generation?.dna),
  authorId: generation?.authorId || 'anonymous',
  createdAt: generation?.createdAt || new Date().toISOString()
});

const normalizePrompt = (prompt: any): Prompt => ({
  id: prompt?.id,
  title: prompt?.title || 'Untitled Prompt',
  promptText: prompt?.promptText || '',
  promptDNA: normalizeDNA(prompt?.promptDNA),
  imageUrl: prompt?.imageUrl || '',
  authorId: prompt?.authorId || 'anonymous',
  tags: Array.isArray(prompt?.tags) ? prompt.tags : [],
  likes: typeof prompt?.likes === 'number' ? prompt.likes : 0,
  createdAt: prompt?.createdAt || new Date().toISOString(),
  originPromptId: prompt?.originPromptId || prompt?.id,
  generations: Array.isArray(prompt?.generations)
    ? prompt.generations.map(normalizeGeneration)
    : []
});

const getLocal = (key: string) => {
  try { return JSON.parse(localStorage.getItem(`luz_${key}`) || '[]'); } catch { return []; }
};
const setLocal = (key: string, data: any) => {
  localStorage.setItem(`luz_${key}`, JSON.stringify(data));
};

export const promptService = {
  subscribeToPrompts(callback: (prompts: Prompt[]) => void) {
    const prompts = getLocal(COLLECTION_NAME);
    callback(prompts);
    return () => {}; // Mock unsubscribe
  },

  async getPrompts(): Promise<Prompt[]> {
    return getLocal(COLLECTION_NAME);
  },

  async savePrompt(prompt: Prompt): Promise<void> {
    const normalized = normalizePrompt(prompt);
    const prompts = getLocal(COLLECTION_NAME);
    const index = prompts.findIndex((p: any) => p.id === normalized.id);
    if (index >= 0) prompts[index] = normalized;
    else prompts.unshift(normalized);
    
    if (prompts.length > MAX_PROMPTS) prompts.length = MAX_PROMPTS;
    setLocal(COLLECTION_NAME, prompts);
  },

  async deletePrompt(id: string): Promise<void> {
    const prompts = getLocal(COLLECTION_NAME);
    setLocal(COLLECTION_NAME, prompts.filter((p: any) => p.id !== id));
  },

  async likePrompt(id: string): Promise<void> {
    const prompts = getLocal(COLLECTION_NAME);
    const prompt = prompts.find((p: any) => p.id === id);
    if (prompt) {
      prompt.likes = (prompt.likes || 0) + 1;
      setLocal(COLLECTION_NAME, prompts);
    }
  },

  toggleLike(id: string): Promise<void> {
    return this.likePrompt(id);
  }
};
