// ──────────────────────────────────────────
// generationHistoryService - MOCKED FOR LOCAL TESTING
// ──────────────────────────────────────────

export interface GenerationRecord {
  id: string;
  imageUrl: string;           // base64 data URL
  module: string;             // 'prompt_studio' | 'scene_clone' | 'model_dna' | 'content_studio' | 'outfit_kit' | 'catalog'
  moduleLabel: string;        // Nombre legible para mostrar en UI
  promptText?: string;        // Prompt usado (opcional)
  creditsUsed: number;        // Cuántos créditos costó
  createdAt: string;          // ISO string
}

export const MODULE_LABELS: Record<string, string> = {
  prompt_studio:      'AI Generator',
  scene_clone:        'Scene Clone',
  model_dna:          'Model DNA',
  content_studio:     'Content Studio',
  content_studio_pro: 'Content Studio Pro',
  outfit_extractor:   'Outfit Extractor',
  outfit_kit:         'Outfit Kit',
  catalog:            'Catálogo',
  campaign:           'Campaign',
  photodump:          'Photodump',
};

const MAX_HISTORY = 500;
const getUid = () => 'local-admin-uid';

const getLocal = (key: string) => {
  try { return JSON.parse(localStorage.getItem(`luz_${key}`) || '[]'); } catch { return []; }
};
const setLocal = (key: string, data: any) => {
  localStorage.setItem(`luz_${key}`, JSON.stringify(data));
};

export const generationHistoryService = {

  async save(record: Omit<GenerationRecord, 'id' | 'createdAt'>): Promise<void> {
    const uid = getUid();
    const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString()
    };
    
    const history = getLocal(`history_${uid}`);
    history.unshift(newRecord);
    
    if (history.length > MAX_HISTORY) {
      history.length = MAX_HISTORY;
    }
    
    setLocal(`history_${uid}`, history);
  },

  async getAll(): Promise<GenerationRecord[]> {
    const uid = getUid();
    return getLocal(`history_${uid}`);
  },

  async delete(id: string): Promise<void> {
    const uid = getUid();
    const history = getLocal(`history_${uid}`);
    setLocal(`history_${uid}`, history.filter((r: any) => r.id !== id));
  },

  async deleteBatch(ids: string[]): Promise<void> {
    const uid = getUid();
    const history = getLocal(`history_${uid}`);
    setLocal(`history_${uid}`, history.filter((r: any) => !ids.includes(r.id)));
  },

  async trimHistory(uid: string): Promise<void> {
    // Handled in save
  }

};
