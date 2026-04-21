import { ReferenceSlot, PromptDNA, ReferencePriority } from '../types/promptTypes';
import { readAndCompressFile } from '../../../utils/imageUtils';

export const referenceService = {

  createInitialSlots(): ReferenceSlot[] {

    return [

      // PERSON REFERENCES

      {
        id: 'person-1',
        type: 'person',
        role: 'person1',
        imageUrl: null,
        label: 'Person 1',
        priority: 'high',
        locked: false
      },

      {
        id: 'person-2',
        type: 'person',
        role: 'person2',
        imageUrl: null,
        label: 'Person 2',
        priority: 'medium',
        locked: false
      },

      {
        id: 'person-3',
        type: 'person',
        role: 'person3',
        imageUrl: null,
        label: 'Person 3',
        priority: 'medium',
        locked: false
      },

      {
        id: 'person-4',
        type: 'person',
        role: 'person4',
        imageUrl: null,
        label: 'Person 4',
        priority: 'medium',
        locked: false
      },

      // PRODUCT REFERENCES

      {
        id: 'product-1',
        type: 'product',
        role: 'product1',
        imageUrl: null,
        label: 'Product 1',
        priority: 'high',
        locked: false
      },

      {
        id: 'product-2',
        type: 'product',
        role: 'product2',
        imageUrl: null,
        label: 'Product 2',
        priority: 'medium',
        locked: false
      },

      {
        id: 'product-3',
        type: 'product',
        role: 'product3',
        imageUrl: null,
        label: 'Product 3',
        priority: 'medium',
        locked: false
      },

      {
        id: 'product-4',
        type: 'product',
        role: 'product4',
        imageUrl: null,
        label: 'Product 4',
        priority: 'medium',
        locked: false
      },

      // STYLE

      {
        id: 'style-1',
        type: 'style',
        role: 'style1',
        imageUrl: null,
        label: 'Style 1',
        priority: 'medium',
        locked: false
      }

    ];

  },

  async processFile(file: File): Promise<string> {
    return readAndCompressFile(file);
  },

  buildReferenceDNA(slots: ReferenceSlot[]) {

    const dna: PromptDNA = {
      persons: [],
      products: [],
      styles: []
    };

    const priorities: Record<string, number> = {};
    const locks: string[] = [];

    slots.forEach(slot => {

      if (!slot.imageUrl) return;

      if (slot.type === 'person') {
        dna.persons?.push(slot.role || 'person1');
      }

      if (slot.type === 'product') {
        dna.products?.push(slot.role || 'product1');
      }

      if (slot.type === 'style') {
        dna.styles?.push(slot.role || 'style1');
      }

      const weight = this.priorityToWeight(slot.priority);
      priorities[slot.id] = weight;

      if (slot.locked) {
        locks.push(slot.id);
      }

    });

    return {
      dna,
      priorities,
      locks
    };

  },

  priorityToWeight(priority?: ReferencePriority) {

    switch (priority) {

      case 'high':
        return 1

      case 'medium':
        return 0.7

      case 'low':
        return 0.4

      default:
        return 0.6

    }

  }

};