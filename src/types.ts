export interface AvatarProfile {
  id: string;
  name: string;
  type: 'reference' | 'clone' | 'manual';
  identityPrompt: string;
  physicalDescription: string;
  negativePrompt: string;
  baseImages: string[];
  metadata: {
    gender: string;
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
    [key: string]: any;
  };
  createdAt: number;
  [key: string]: any;
}

export interface ProductProfile {
  id: string;
  name: string;
  category: string;
  baseImages: string[];
  generatedImages: string[];
  productPrompt: string;
  technicalDescription: string;
  commercialDescription: string;
  metadata: {
    material: string;
    color: string;
    style: string;
    [key: string]: any;
  };
  createdAt: number;
  [key: string]: any;
}

export type FocusType = 'avatar' | 'product' | 'outfit' | 'scene' | string;

export interface Shot {
  id: string;
  name: string;
  prompt: string;
  negativePrompt: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  imageUrl?: string;
  [key: string]: any;
}

export interface GenerationSet {
  id: string;
  name?: string;
  images?: string[];
  shots?: Shot[];
  focus?: FocusType;
  style?: string;
  avatarId?: string;
  scenePrompt?: string;
  createdAt: number;
  [key: string]: any;
}
