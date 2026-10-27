export * from '@repo/modules/piloto/services/catalogService?real';
import { catalogService as real } from '@repo/modules/piloto/services/catalogService?real';
import { ph, qaState } from './qa';

export const catalogService = {
  ...real,
  async list() {
    const s = qaState();
    if (s === 'error') throw new Error('No se pudo cargar tu catálogo. Revisa tu conexión.');
    if (s === 'empty-catalog') return [];
    const names = ['Aros gota verde', 'Collar luna', 'Anillo trenzado', 'Pulsera cadena fina', 'Aros argolla mini', 'Collar con nombre muy largo para probar el corte de texto'];
    return names.map((name, i) => ({
      id: `c${i}`, name, category: ['aros', 'collares', 'anillos', 'pulseras', 'aros', 'collares'][i], material: 'resina', color: 'verde', priceCLP: 8990 + i * 1000,
      role: i === 0 ? 'ancla' : 'normal', originalPhotos: [{ url: ph(i), path: 'p' }, { url: ph(i + 1), path: 'p' }], aiTags: ['liviano'],
      photoQuality: { score: i === 3 ? 45 : 85, tips: i === 3 ? ['Más luz: acércate a una ventana o usa luz de día.'] : [] },
      analysisSource: 'ai', createdAt: 100 - i, updatedAt: 100 - i,
    }));
  },
  async create(_u: string, d: any, _files: File[]) { return { ...d, id: 'new', originalPhotos: [], createdAt: 1, updatedAt: 1 }; },
};
