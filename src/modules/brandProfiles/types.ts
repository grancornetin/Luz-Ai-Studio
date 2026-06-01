export interface BrandColor {
  id: string;
  hex: string;
  label: string;
  role: 'primary' | 'secondary' | 'accent' | 'lightBackground' | 'darkBackground' | 'text' | 'support' | 'other';
  order: number;
}

export interface BrandAsset {
  id: string;
  type: 'logo' | 'alternateLogo' | 'icon' | 'palette' | 'typography' | 'packaging' | 'reference' | 'manual' | 'other';
  name: string;
  url: string;
  path: string;
  fileName: string;
  mimeType: string;
  uploadedAt: number;
  notes?: string;
}

export interface BrandSocialInsights {
  instagramHandle: string;
  followers: string;
  reachDiagnosis: string;
  reelsInsight: string;
  carouselInsight: string;
  bestTime: string;
  notes: string;
  updatedAt: number;
}

export type BusinessModel =
  | 'self_made_products'
  | 'supplier_products'
  | 'own_brand_third_party_manufacturing'
  | 'services'
  | 'client_content_creator'
  | 'starting'
  | 'other';

export type BrandStatus = 'incomplete' | 'basic' | 'complete' | 'advanced';

export type BusinessStageKey = 'launching' | 'growing' | 'consistent' | 'scaling' | 'community' | 'unknown';

export interface BusinessStage {
  key: BusinessStageKey;
  label: string;
  followerRange?: string;
  description: string;
}

export interface BrandProfile {
  id: string;
  userId: string;
  createdAt: number;
  updatedAt: number;

  status: BrandStatus;
  completionScore: number;
  isDefault: boolean;

  brandName: string;
  country: string;
  businessModel: BusinessModel;
  mainCategory: string;
  shortDescription: string;

  targetCustomer: {
    genderFocus: string;
    ageRange: string;
    buyingMotivation: string[];
    mainPain: string;
    customerDoubts: string[];
    lifestyle: string;
    freeDescription: string;
  };

  positioning: {
    perceivedLevel: string;
    mainDifferentiators: string[];
    mainDifferentiatorText: string;
    brandPromise: string;
    competitorAlternatives: string[];
  };

  voice: {
    toneKeywords: string[];
    formality: string;
    emojiLevel: string;
    preferredWords: string[];
    forbiddenWords: string[];
  };

  visualIdentity: {
    visualStyle: string[];
    contentMood: string[];
    avoidVisuals: string[];
    colors: BrandColor[];
    assets: BrandAsset[];
  };

  commercialRules: {
    mainSalesChannels: string[];
    preferredCTA: string[];
    businessStage: BusinessStage;
    trustBuilders: string[];
    customerDoubts: string[];
  };

  socialInsights?: BrandSocialInsights;

  aiSummary: {
    brandEssence: string;
    targetCustomerSummary: string;
    positioningSummary: string;
    voiceGuidelines: string;
    visualGuidelines: string;
    salesGuidelines: string;
    contentDo: string[];
    contentDont: string[];
  };
}

export type BrandProfileDraft = Partial<BrandProfile> & {
  brandName: string;
  userId: string;
};

export const EMPTY_BRAND_PROFILE: Omit<BrandProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  status: 'incomplete',
  completionScore: 0,
  isDefault: false,
  brandName: '',
  country: '',
  businessModel: 'starting',
  mainCategory: '',
  shortDescription: '',
  targetCustomer: {
    genderFocus: '',
    ageRange: '',
    buyingMotivation: [],
    mainPain: '',
    customerDoubts: [],
    lifestyle: '',
    freeDescription: '',
  },
  positioning: {
    perceivedLevel: '',
    mainDifferentiators: [],
    mainDifferentiatorText: '',
    brandPromise: '',
    competitorAlternatives: [],
  },
  voice: {
    toneKeywords: [],
    formality: '',
    emojiLevel: '',
    preferredWords: [],
    forbiddenWords: [],
  },
  visualIdentity: {
    visualStyle: [],
    contentMood: [],
    avoidVisuals: [],
    colors: [
      { id: '1', hex: '#F72C5B', label: 'Principal',     role: 'primary',         order: 0 },
      { id: '2', hex: '#E65D74', label: 'Secundario',    role: 'secondary',       order: 1 },
      { id: '3', hex: '#B32F46', label: 'Acento',        role: 'accent',          order: 2 },
      { id: '4', hex: '#FFD6DF', label: 'Fondo suave',   role: 'lightBackground', order: 3 },
      { id: '5', hex: '#F8FAFC', label: 'Neutral claro', role: 'lightBackground', order: 4 },
      { id: '6', hex: '#E4F1AC', label: 'Apoyo',         role: 'support',         order: 5 },
      { id: '7', hex: '#000000', label: 'Texto',         role: 'text',            order: 6 },
    ],
    assets: [],
  },
  commercialRules: {
    mainSalesChannels: [],
    preferredCTA: [],
    businessStage: {
      key: 'unknown',
      label: 'No estoy segura',
      description: 'Luz IA puede ayudarte a identificar tu etapa.',
    },
    trustBuilders: [],
    customerDoubts: [],
  },
  aiSummary: {
    brandEssence: '',
    targetCustomerSummary: '',
    positioningSummary: '',
    voiceGuidelines: '',
    visualGuidelines: '',
    salesGuidelines: '',
    contentDo: [],
    contentDont: [],
  },
};
