/**
 * recipes/weeklyFavoritesV2/promptBuilder.ts
 *
 * Arma el texto de instrucciones para el generador de imágenes a partir
 * ÚNICAMENTE del contrato de la foto y sus referencias ya resueltas — nunca
 * lee el catálogo completo ni ningún otro estado.
 *
 * Deliberadamente corto: sin bloques gigantes repetidos, sin listas de
 * negativos redundantes. Un texto claro y específico de lo que esta foto
 * necesita, nada más.
 */
import { NEGATIVE_SHORT } from '../shared';
import type { ShotContract, AnchorContract, RoutedReferences } from './types';
import type { AppliedIntelligence } from './intelligenceLayer';

function anchorModeLine(anchor: AnchorContract): string {
  switch (anchor.mode) {
    case 'person_with_explicit_base_outfit':
      return 'The person wears the exact outfit shown in their reference photo — do not change it.';
    case 'person_with_style_matched_outfit':
      return `The person wears a new, generic outfit in this style: ${anchor.styleDetection?.styleDescription || 'consistent with the uploaded references'}. Do not copy any specific garment from the reference images — only match the general style.`;
    case 'person_with_safe_fallback_outfit':
      return 'The person wears a simple, neutral everyday outfit that does not compete visually with any product or accessory.';
    case 'world_only':
      return 'No person in frame — environment and lighting only.';
    default:
      return '';
  }
}

function roleInstruction(contract: ShotContract): string {
  const itemLabel = contract.activeItem?.label ?? 'the selected items';
  switch (contract.role) {
    case 'outfit_hero':
      return `Full outfit shot. The person wears ${itemLabel} as the main look of this photo.`;
    case 'outfit_integrated':
      return `Full outfit shot. The person wears ${itemLabel} as the main look, paired naturally with ${contract.secondaryItems.map(it => it.label).join(', ')}.`;
    case 'bag':
      return `The person holds or wears ${itemLabel}, shown clearly as the focus of the photo.`;
    case 'footwear':
      return `${itemLabel} shown clearly, worn or presented as the focus of the photo.`;
    case 'jewelry':
      return `${itemLabel} shown as a close, clear detail — worn naturally.`;
    case 'makeup_applied':
      return `${itemLabel} shown applied, as a close beauty detail shot.`;
    case 'skincare_product_only':
      return `${itemLabel} shown on its own, product-focused, no person in frame.`;
    case 'skincare_in_hand':
      return `${itemLabel} shown held or in use by the person.`;
    case 'product_texture':
      return `${itemLabel} shown as a macro technical detail — texture, color and packaging fidelity only.`;
    case 'overview':
      return 'An arranged overview of the selected items together — flatlay or styled table, no person in frame.';
    case 'mixed':
    default:
      return `${itemLabel} shown as the focus of this photo.`;
  }
}

function forbiddenLine(contract: ShotContract): string {
  if (contract.forbiddenItems.length === 0) return '';
  const labels = contract.forbiddenItems.map(it => it.label).join(', ');
  return `Do not include: ${labels}.`;
}

export interface BuiltPrompt {
  prompt:    string;
  negative:  string;
}

export function buildShotPrompt(
  contract:      ShotContract,
  anchor:        AnchorContract,
  routed:        RoutedReferences,
  intelligence:  AppliedIntelligence,
): BuiltPrompt {
  const lines = [
    roleInstruction(contract),
    contract.role !== 'overview' && contract.role !== 'product_texture' && contract.role !== 'skincare_product_only'
      ? anchorModeLine(anchor)
      : '',
    forbiddenLine(contract),
    intelligence.ugcBlock,
    intelligence.hpiBlock,
    'Natural iPhone quality, candid UGC feel. One photo, not a collage.',
  ].filter(Boolean);

  const negative = intelligence.hpiNegatives.length > 0
    ? `${NEGATIVE_SHORT}\n${intelligence.hpiNegatives.join(', ')}`
    : NEGATIVE_SHORT;

  return {
    prompt: lines.join('\n'),
    negative,
  };
}
