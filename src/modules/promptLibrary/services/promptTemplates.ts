import { PromptDNA } from '../types/promptTypes';

export type PromptTemplate = {
  id: string;
  label: string;
  description: string;
  dna: PromptDNA;
};

export const PROMPT_TEMPLATES: PromptTemplate[] = [

  {
    id: 'fashion-editorial',
    label: 'Fashion Editorial',
    description: 'Editorial fashion photography',
    dna: {
      styles: ['editorial fashion photography'],
      persons: ['fashion model portrait'],
      lighting: ['soft studio lighting'],
      background: ['neutral studio backdrop'],
      composition: ['professional fashion composition'],
      details: ['high fashion aesthetic']
    }
  },

  {
    id: 'luxury-product',
    label: 'Luxury Product',
    description: 'High-end product photography',
    dna: {
      styles: ['luxury product photography'],
      products: ['premium product'],
      lighting: ['dramatic studio lighting'],
      background: ['minimalist luxury background'],
      composition: ['commercial product composition'],
      details: ['high-end advertising aesthetic']
    }
  },

  {
    id: 'beauty-campaign',
    label: 'Beauty Campaign',
    description: 'Cosmetics commercial photography',
    dna: {
      styles: ['beauty campaign photography'],
      persons: ['cosmetic model'],
      products: ['beauty product'],
      lighting: ['soft beauty lighting'],
      background: ['clean beauty backdrop'],
      composition: ['cosmetics commercial composition'],
      details: ['glossy beauty advertising style']
    }
  },

  {
    id: 'streetwear',
    label: 'Streetwear',
    description: 'Urban fashion photography',
    dna: {
      styles: ['urban streetwear photography'],
      persons: ['streetwear model'],
      lighting: ['natural urban lighting'],
      background: ['city street background'],
      composition: ['dynamic street photography'],
      details: ['urban fashion aesthetic']
    }
  },

  {
    id: 'tech-product',
    label: 'Tech Product',
    description: 'Technology product shot',
    dna: {
      styles: ['tech product photography'],
      products: ['modern technology product'],
      lighting: ['clean studio lighting'],
      background: ['minimal tech background'],
      composition: ['technology advertising composition'],
      details: ['sleek modern aesthetic']
    }
  },

  {
    id: 'ugc-influencer',
    label: 'Influencer UGC',
    description: 'iPhone selfie / social media aesthetic',
    dna: {
      styles: ['ugc lifestyle photography', 'social media influencer aesthetic'],
      persons: ['selfie portrait', 'lifestyle influencer'],
      lighting: ['natural window light', 'uncontrolled real lighting'],
      background: ['real indoor environment', 'lived-in room background'],
      composition: ['handheld selfie framing', 'front camera perspective'],
      details: [
        'iphone selfie look',
        'front camera wide angle',
        'slight lens distortion',
        'natural skin texture',
        'visible pores',
        'subtle imperfections',
        'instagram style realism'
      ]
    }
  }

];