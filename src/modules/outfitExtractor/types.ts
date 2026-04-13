
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
}
