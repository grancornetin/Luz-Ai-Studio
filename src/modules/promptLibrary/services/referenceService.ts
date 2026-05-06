import { ReferenceSlot, PromptDNA, ReferencePriority } from '../types/promptTypes';
import { readAndCompressFile } from '../../../utils/imageUtils';

export const referenceService = {

  createInitialSlots(): ReferenceSlot[] {
    return [
      // ── PERSONA 1 + su outfit ──────────────────────────────
      { id: 'person-1', type: 'person', role: 'person1', imageUrl: null, label: 'Persona 1', priority: 'high', locked: false },
      { id: 'outfit-1', type: 'outfit', role: 'outfit1', personIndex: 1, imageUrl: null, label: 'Outfit · Persona 1', priority: 'high', locked: false },

      // ── PERSONA 2 + su outfit ──────────────────────────────
      { id: 'person-2', type: 'person', role: 'person2', imageUrl: null, label: 'Persona 2', priority: 'medium', locked: false },
      { id: 'outfit-2', type: 'outfit', role: 'outfit2', personIndex: 2, imageUrl: null, label: 'Outfit · Persona 2', priority: 'medium', locked: false },

      // ── PERSONA 3 + su outfit ──────────────────────────────
      { id: 'person-3', type: 'person', role: 'person3', imageUrl: null, label: 'Persona 3', priority: 'medium', locked: false },
      { id: 'outfit-3', type: 'outfit', role: 'outfit3', personIndex: 3, imageUrl: null, label: 'Outfit · Persona 3', priority: 'medium', locked: false },

      // ── PERSONA 4 + su outfit ──────────────────────────────
      { id: 'person-4', type: 'person', role: 'person4', imageUrl: null, label: 'Persona 4', priority: 'medium', locked: false },
      { id: 'outfit-4', type: 'outfit', role: 'outfit4', personIndex: 4, imageUrl: null, label: 'Outfit · Persona 4', priority: 'medium', locked: false },

      // ── PRODUCTOS ──────────────────────────────────────────
      { id: 'product-1', type: 'product', role: 'product1', imageUrl: null, label: 'Producto 1', priority: 'high', locked: false },
      { id: 'product-2', type: 'product', role: 'product2', imageUrl: null, label: 'Producto 2', priority: 'medium', locked: false },
      { id: 'product-3', type: 'product', role: 'product3', imageUrl: null, label: 'Producto 3', priority: 'medium', locked: false },
      { id: 'product-4', type: 'product', role: 'product4', imageUrl: null, label: 'Producto 4', priority: 'medium', locked: false },

      // ── ESCENA ─────────────────────────────────────────────
      { id: 'scene-1', type: 'scene', role: 'scene1', imageUrl: null, label: 'Escena / Ambiente', priority: 'medium', locked: false },
    ];
  },

  async processFile(file: File): Promise<string> {
    return readAndCompressFile(file);
  },

  buildReferenceDNA(slots: ReferenceSlot[]) {
    const dna: PromptDNA = { persons: [], products: [], styles: [] };
    const priorities: Record<string, number> = {};
    const locks: string[] = [];

    slots.forEach(slot => {
      if (!slot.imageUrl) return;

      if (slot.type === 'person') dna.persons?.push(slot.role || 'person1');
      if (slot.type === 'product') dna.products?.push(slot.role || 'product1');
      // outfit y scene se pasan como referencias visuales directas, no como tokens DNA

      const weight = this.priorityToWeight(slot.priority);
      priorities[slot.id] = weight;
      if (slot.locked) locks.push(slot.id);
    });

    return { dna, priorities, locks };
  },

  /**
   * Devuelve las referencias activas en el orden correcto para la API:
   * personas → outfits (ligados a su persona) → productos → escena al final.
   * Los outfits se insertan inmediatamente después de su persona para que
   * el modelo los asocie correctamente al generar.
   */
  buildOrderedReferences(slots: ReferenceSlot[]): string[] {
    const result: string[] = [];
    const personSlots  = slots.filter(s => s.type === 'person'  && s.imageUrl);
    const outfitSlots  = slots.filter(s => s.type === 'outfit'  && s.imageUrl);
    const productSlots = slots.filter(s => s.type === 'product' && s.imageUrl);
    const sceneSlots   = slots.filter(s => s.type === 'scene'   && s.imageUrl);

    // Persona + su outfit inmediatamente después
    personSlots.forEach(p => {
      result.push(p.imageUrl!);
      const pIdx = p.personIndex ?? (parseInt(p.role?.replace('person', '') || '1'));
      const outfit = outfitSlots.find(o => o.personIndex === pIdx);
      if (outfit) result.push(outfit.imageUrl!);
    });

    productSlots.forEach(p => result.push(p.imageUrl!));
    sceneSlots.forEach(s => result.push(s.imageUrl!));

    return result;
  },

  priorityToWeight(priority?: ReferencePriority): number {
    switch (priority) {
      case 'high':   return 1;
      case 'medium': return 0.7;
      case 'low':    return 0.4;
      default:       return 0.6;
    }
  },

};
