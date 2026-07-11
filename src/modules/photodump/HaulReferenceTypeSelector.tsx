/**
 * HaulReferenceTypeSelector.tsx
 * Selector compacto de tipo de referencia para la receta Haul.
 * Permite al usuario indicar qué tipo de ítem contiene cada imagen subida.
 * El valor viaja al pipeline y condiciona el shot planning y los prompts.
 */
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Info } from 'lucide-react';
import { HaulRefKind } from './types';

// ── Opciones del selector ─────────────────────────────────────

export interface HaulRefOption {
  value:       HaulRefKind;
  label:       string;
  emoji:       string;
  description: string;
}

const AUTO_OPTION: HaulRefOption = {
  value:       'auto',
  label:       'Auto',
  emoji:       '✦',
  description: 'Luz IA intenta detectar el tipo automáticamente según la imagen.',
};

// ── Opciones para el slot OUTFIT (prendas / looks) ──────────────
const OUTFIT_OPTIONS: HaulRefOption[] = [
  AUTO_OPTION,
  {
    value:       'look_completo',
    label:       'Look completo',
    emoji:       '👗',
    description: 'La imagen muestra un outfit armado para usarse junto — incluso si es flat lay o collage.',
  },
  {
    value:       'varios_items',
    label:       'Varios ítems',
    emoji:       '🗂',
    description: 'La imagen tiene múltiples productos que no necesariamente forman un solo outfit.',
  },
  {
    value:       'top',
    label:       'Top',
    emoji:       '👕',
    description: 'Prenda superior individual: blusa, remera, corset, camisa, camiseta.',
  },
  {
    value:       'bottom',
    label:       'Bottom',
    emoji:       '👖',
    description: 'Prenda inferior individual: pantalón, falda, short, jeans.',
  },
  {
    value:       'vestido',
    label:       'Vestido',
    emoji:       '👘',
    description: 'Vestido o maxi-vestido que cubre de hombros a muslos/pies.',
  },
  {
    value:       'enterizo',
    label:       'Enterizo / bodysuit',
    emoji:       '🩱',
    description: 'Enterizo, jumpsuit, mameluco, bodysuit o catsuit.',
  },
  {
    value:       'chaqueta',
    label:       'Chaqueta / abrigo',
    emoji:       '🧥',
    description: 'Outerwear: chaqueta, blazer, campera, saco, abrigo.',
  },
  {
    value:       'calzado',
    label:       'Calzado',
    emoji:       '👟',
    description: 'Calzado suelto: botín, sandalia, zapatilla, zapato, taco.',
  },
  {
    value:       'pantys',
    label:       'Pantys / medias',
    emoji:       '🧦',
    description: 'Pantys, medias, calcetas, leggings o lencería de capa base.',
  },
  // Un outfit también puede traer bolso/joyería/accesorio/beauty integrado al look —
  // se mantienen disponibles acá para ese caso, aunque su gramática visual dedicada
  // vive en las listas de accesorio/producto.
  {
    value:       'bolso',
    label:       'Bolso / cartera',
    emoji:       '👜',
    description: 'Bolso, cartera, tote, clutch o riñonera.',
  },
  {
    value:       'joyeria',
    label:       'Joyería (general)',
    emoji:       '💍',
    description: 'Joyería sin desglosar — usar si no aplica un tipo específico (aros, collar, anillo, pulsera).',
  },
  {
    value:       'accesorio',
    label:       'Accesorio (general)',
    emoji:       '🕶',
    description: 'Accesorio genérico sin desglosar — usar si no aplica un tipo específico.',
  },
  {
    value:       'maquillaje',
    label:       'Maquillaje',
    emoji:       '💄',
    description: 'Labial, sombra, base u otro producto de maquillaje.',
  },
  {
    value:       'skincare',
    label:       'Skincare',
    emoji:       '🧴',
    description: 'Sérum, crema u otro producto de cuidado de la piel.',
  },
];

// ── Opciones para el slot ACCESORIOS (nunca ropa) ───────────────
const ACCESORIO_OPTIONS: HaulRefOption[] = [
  AUTO_OPTION,
  {
    value:       'bolso',
    label:       'Bolso / cartera',
    emoji:       '👜',
    description: 'Bolso, cartera, tote, clutch o riñonera.',
  },
  {
    value:       'calzado',
    label:       'Calzado',
    emoji:       '👟',
    description: 'Calzado suelto: botín, sandalia, zapatilla, zapato, taco.',
  },
  {
    value:       'aros',
    label:       'Aros',
    emoji:       '💎',
    description: 'Aros o pendientes.',
  },
  {
    value:       'collar',
    label:       'Collar',
    emoji:       '📿',
    description: 'Collar o cadena.',
  },
  {
    value:       'anillo',
    label:       'Anillo',
    emoji:       '💍',
    description: 'Anillo.',
  },
  {
    value:       'pulsera',
    label:       'Pulsera / tobillera',
    emoji:       '⌚',
    description: 'Pulsera o tobillera.',
  },
  {
    value:       'cinturon',
    label:       'Cinturón',
    emoji:       '🥋',
    description: 'Cinturón.',
  },
  {
    value:       'panoleta',
    label:       'Pañoleta / bufanda',
    emoji:       '🧣',
    description: 'Pañoleta, bufanda o pañuelo.',
  },
  {
    value:       'scrunchie',
    label:       'Scrunchie',
    emoji:       '🎀',
    description: 'Scrunchie, cintillo u otro accesorio de pelo.',
  },
  {
    value:       'sombrero',
    label:       'Sombrero / gorra',
    emoji:       '👒',
    description: 'Sombrero o gorra.',
  },
  {
    value:       'gafas',
    label:       'Gafas',
    emoji:       '🕶',
    description: 'Gafas o lentes de sol.',
  },
  {
    value:       'joyeria',
    label:       'Joyería (general)',
    emoji:       '💍',
    description: 'Joyería sin desglosar — usar si no aplica aros/collar/anillo/pulsera.',
  },
  {
    value:       'accesorio',
    label:       'Accesorio (general)',
    emoji:       '🕶',
    description: 'Accesorio genérico sin desglosar — usar si no aplica un tipo específico.',
  },
];

// ── Opciones para el slot PRODUCTO (maquillaje/skincare/genérico) ──
const PRODUCTO_OPTIONS: HaulRefOption[] = [
  AUTO_OPTION,
  {
    value:       'maquillaje',
    label:       'Maquillaje',
    emoji:       '💄',
    description: 'Labial, sombra, base u otro producto de maquillaje.',
  },
  {
    value:       'skincare',
    label:       'Skincare',
    emoji:       '🧴',
    description: 'Sérum, crema u otro producto de cuidado de la piel.',
  },
  {
    value:       'gadget_tech',
    label:       'Gadget / Tech',
    emoji:       '📱',
    description: 'Dispositivo o gadget tecnológico — se sostiene y se usa activamente.',
  },
  {
    value:       'food_drink',
    label:       'Comida / Bebida',
    emoji:       '🥤',
    description: 'Alimento o bebida — se sostiene o se consume naturalmente.',
  },
  {
    value:       'wellness_item',
    label:       'Bienestar / Suplemento',
    emoji:       '💊',
    description: 'Suplemento, vitamina u otro producto de bienestar — se sostiene o exhibe.',
  },
  {
    value:       'producto_generico',
    label:       'Producto genérico',
    emoji:       '📦',
    description: 'Producto sin categoría específica — se sostiene o exhibe naturalmente.',
  },
  {
    value:       'acompanante',
    label:       'Acompañante',
    emoji:       '🧑‍🤝‍🧑',
    description: 'Foto de la persona que te acompaña — activa shots grupales en el set.',
  },
];

// Todas las opciones existentes (para lookup por valor, sin importar la categoría del slot)
export const HAUL_REF_OPTIONS: HaulRefOption[] = [
  ...OUTFIT_OPTIONS,
  ...ACCESORIO_OPTIONS.filter(o => !OUTFIT_OPTIONS.some(oo => oo.value === o.value)),
  ...PRODUCTO_OPTIONS.filter(o => !OUTFIT_OPTIONS.some(oo => oo.value === o.value)),
];

// Mapa rápido para lookup
export const HAUL_REF_MAP: Record<HaulRefKind, HaulRefOption> =
  Object.fromEntries(HAUL_REF_OPTIONS.map(o => [o.value, o])) as Record<HaulRefKind, HaulRefOption>;

// Opciones filtradas por categoría de slot — patch UI: cada slot muestra solo los tipos
// que le corresponden en vez de una lista única mezclada (antes aparecía ropa en el
// selector de accesorios).
export type HaulRefSlotCategory = 'outfit' | 'accesorio' | 'producto';

const OPTIONS_BY_CATEGORY: Record<HaulRefSlotCategory, HaulRefOption[]> = {
  outfit:    OUTFIT_OPTIONS,
  accesorio: ACCESORIO_OPTIONS,
  producto:  PRODUCTO_OPTIONS,
};

// ── Componente ────────────────────────────────────────────────

interface HaulReferenceTypeSelectorProps {
  value:     HaulRefKind;
  onChange:  (kind: HaulRefKind) => void;
  disabled?: boolean;
  // Categoría del slot — determina qué lista de tipos se muestra (patch UI: antes todos
  // los slots compartían la misma lista completa, por lo que aparecía ropa en el selector
  // de accesorios). Default 'outfit' para no romper callers existentes que no la pasen.
  category?: HaulRefSlotCategory;
}

const HaulReferenceTypeSelector: React.FC<HaulReferenceTypeSelectorProps> = ({
  value, onChange, disabled = false, category = 'outfit',
}) => {
  const [open, setOpen]             = useState(false);
  const [tooltipOpen, setTooltip]   = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef                = useRef<HTMLDivElement>(null);
  const triggerRef                  = useRef<HTMLButtonElement>(null);

  const options = OPTIONS_BY_CATEGORY[category] ?? OUTFIT_OPTIONS;

  // Calcular posición del dropdown relativa al viewport — se renderiza en un portal a
  // document.body para escapar de cualquier ancestro con overflow-hidden (los slots
  // acordeón lo tienen) y así nunca queda cortado ni sin scroll accesible.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) { setDropdownPos(null); return; }
    const updatePos = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const dropdownHeight = 240; // max-h-60
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
      setDropdownPos({
        top:   openUpward ? rect.top - Math.min(dropdownHeight, rect.top - 8) : rect.bottom + 4,
        left:  Math.min(rect.left, window.innerWidth - 192 - 8), // 192 = w-48
        width: Math.max(rect.width, 192),
      });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

  // Cerrar al hacer click fuera (trigger o dropdown portal)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('[data-haul-ref-dropdown]')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = HAUL_REF_MAP[value] ?? HAUL_REF_MAP['auto'];
  const isAuto   = value === 'auto';

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Trigger ──────────────────────────────────── */}
      <div className="flex items-center gap-1 w-full">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen(o => !o)}
          className={`
            flex-1 flex items-center gap-1.5 px-2 py-1 rounded-lg border text-left
            transition-all min-w-0
            ${disabled ? 'opacity-40 pointer-events-none cursor-default' : 'cursor-pointer hover:border-purple-300 hover:bg-purple-50/40'}
            ${open
              ? 'border-purple-300 bg-purple-50/40 shadow-sm'
              : isAuto
                ? 'border-slate-200 bg-slate-50/60'
                : 'border-purple-200 bg-purple-50/30'
            }
          `}
        >
          <span className="text-[11px] leading-none flex-shrink-0">{selected.emoji}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wide truncate ${isAuto ? 'text-slate-400' : 'text-purple-600'}`}>
            {selected.label}
          </span>
          <ChevronDown
            size={9}
            strokeWidth={2.5}
            className={`flex-shrink-0 ml-auto text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Tooltip trigger */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onMouseEnter={() => setTooltip(true)}
            onMouseLeave={() => setTooltip(false)}
            onClick={() => setTooltip(o => !o)}
            className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-slate-500 transition-colors"
          >
            <Info size={10} strokeWidth={2} />
          </button>
          {tooltipOpen && (
            <div className="absolute bottom-full right-0 mb-1.5 z-50 pointer-events-none">
              <div className="bg-slate-900 text-white text-[10px] leading-snug rounded-lg px-2.5 py-2 w-44 shadow-xl">
                <p className="font-bold text-purple-300 mb-0.5">{selected.label}</p>
                <p className="text-slate-300">{selected.description}</p>
              </div>
              <div className="absolute -bottom-1 right-2 w-2 h-2 bg-slate-900 rotate-45" />
            </div>
          )}
        </div>
      </div>

      {/* ── Dropdown — portal a document.body para no quedar cortado por
           overflow-hidden de ancestros (slots acordeón) ──────────────── */}
      {open && dropdownPos && createPortal(
        <div
          data-haul-ref-dropdown
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          className="z-[9999] max-h-60 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-y-auto overscroll-contain"
        >
          <div className="py-1">
            {options.map(opt => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`
                    w-full flex items-center gap-2 px-3 py-1.5 text-left
                    transition-colors hover:bg-purple-50
                    ${isSelected ? 'bg-purple-50' : ''}
                  `}
                >
                  <span className="text-[12px] leading-none flex-shrink-0">{opt.emoji}</span>
                  <span className={`text-[10px] font-semibold leading-tight flex-1 min-w-0 truncate ${isSelected ? 'text-purple-700' : 'text-slate-700'}`}>
                    {opt.label}
                  </span>
                  {isSelected && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-purple-600 flex-shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default HaulReferenceTypeSelector;
