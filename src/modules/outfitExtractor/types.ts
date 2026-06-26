export type OutfitItemCategory = 'main_garment' | 'top' | 'bottom' | 'footwear' | 'bag' | 'accessory';

export type OutfitLayerRole =
  | 'base_upper'
  | 'mid_upper'
  | 'outerwear'
  | 'bottom'
  | 'footwear'
  | 'bag'
  | 'accessory'
  | 'one_piece';

export type OutfitFit = 'tight' | 'regular' | 'relaxed' | 'oversized' | 'wide';
export type OutfitCoverage = 'cropped' | 'waist' | 'hip' | 'thigh' | 'knee' | 'calf' | 'ankle' | 'full_length';
export type OutfitOpening = 'open_front' | 'closed_front' | 'pullover' | 'zipper' | 'buttoned' | 'wrap';
export type OutfitLegShape = 'skinny' | 'straight' | 'wide' | 'flare' | 'bootcut' | 'short';
export type OutfitFootwearHeight = 'low' | 'ankle' | 'mid_calf' | 'knee' | 'over_knee';

export interface OutfitLayerMetadata {
  layerRole: OutfitLayerRole;
  garmentType: string;
  bodyZones: string[];
  fit?: OutfitFit;
  coverage?: OutfitCoverage;
  opening?: OutfitOpening;
  legShape?: OutfitLegShape;
  footwearHeight?: OutfitFootwearHeight;
  wearingRules: string[];
}

export interface OutfitItem {
  id: string;
  name: string;
  category: OutfitItemCategory;
  description: string;
  visualDescription: string;
  ghostPrompt: string;
  layerMetadata?: OutfitLayerMetadata;
  originalDescription?: string;
  imageUrl?: string | null;
  status: 'pending' | 'generating' | 'done' | 'error';
  renderAttempts?: number;
  lastError?: string | null;
  selected: boolean;
  confidenceScore: number;
  coordinates: {
    x: number; // 0-1000 normalizado
    y: number; // 0-1000 normalizado
  };
}

export interface OutfitKit {
  id: string;
  createdAt: number;
  originalImage: string;
  items: OutfitItem[];
  finalCompositionUrl?: string | null;
  finalKitUrl?: string | null;
  inputType: 'COLLAGE' | 'REAL_PHOTO';
} // <--- Faltaba esta llave

export interface SavedOutfitItem {
  id: string;
  kitId: string;
  name: string;
  category: OutfitItemCategory;
  description: string;
  visualDescription: string;
  layerMetadata?: OutfitLayerMetadata;
  imageUrl: string;
  createdAt: number;
}

export interface OutfitCombination {
  id: string;
  name: string;
  items: SavedOutfitItem[];
  finalImageUrl?: string | null;
  createdAt: number;
}
