
export enum ContentType {
  UGC = 'UGC',
  STUDIO = 'STUDIO',
  CINEMATIC = 'CINEMATIC',
  EDITORIAL = 'EDITORIAL',
  COMERCIAL = 'COMERCIAL',
  ARTISTICO = 'ARTISTICO'
}

export type FocusType = 'avatar' | 'product' | 'outfit' | 'scene';

export interface Shot {
  id: string;
  name: string;
  prompt: string;
  negativePrompt: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  imageUrl?: string;
}

export interface GenerationSet {
  id: string;
  avatarId: string;
  productId?: string;
  focus: FocusType;
  style: string;
  scenePrompt: string;
  shots: Shot[];
  createdAt: number;
}

export interface OutfitItem {
  id: string;
  name: string;
  category: 'main_garment' | 'top' | 'bottom' | 'footwear' | 'bag' | 'accessory';
  description: string;
  visualDescription: string;
  ghostPrompt: string;
  originalDescription?: string;
  imageUrl?: string | null;
  status: 'pending' | 'generating' | 'done' | 'error';
  selected: boolean;
}

export interface AvatarProfile {
  id: string;
  name: string;
  type: 'reference' | 'scratch';
  identityPrompt: string;
  physicalDescription: string;
  negativePrompt: string;
  baseImages: string[]; 
  metadata: {
    gender: 'hombre' | 'mujer';
    age: string;
    build: string;
    ethnicity: string;
    eyes: string;
    hairColor: string;
    hairType: string;
    hairLength: string;
    personality: string;
    expression: string;
    outfit: string;
    vibe?: string;
  };
  createdAt: number;
}

export interface ProductProfile {
  id: string;
  name: string;
  category: 'clothing' | 'jewelry' | 'electronics' | 'other';
  baseImages: string[]; 
  generatedImages: string[]; 
  productPrompt: string;
  technicalDescription: string;
  commercialDescription: string;
  metadata: {
    material: string;
    color: string;
    style: 'comercial' | 'organico';
  };
  createdAt: number;
}


