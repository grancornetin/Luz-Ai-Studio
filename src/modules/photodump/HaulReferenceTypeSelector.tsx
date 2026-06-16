/**
 * HaulReferenceTypeSelector.tsx
 * Selector compacto de tipo de referencia para la receta Haul.
 * Permite al usuario indicar qué tipo de ítem contiene cada imagen subida.
 * El valor viaja al pipeline y condiciona el shot planning y los prompts.
 */
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { HaulRefKind } from './types';

// ── Opciones del selector ─────────────────────────────────────

export interface HaulRefOption {
  value:       HaulRefKind;
  label:       string;
  emoji:       string;
  description: string;
}

export const HAUL_REF_OPTIONS: HaulRefOption[] = [
  {
    value:       'auto',
    label:       'Auto',
    emoji:       '✦',
    description: 'Luz IA intenta detectar el tipo automáticamente según la imagen.',
  },
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
  {
    value:       'bolso',
    label:       'Bolso / cartera',
    emoji:       '👜',
    description: 'Bolso, cartera, tote, clutch o riñonera.',
  },
  {
    value:       'joyeria',
    label:       'Joyería',
    emoji:       '💍',
    description: 'Joyería: aros, collar, anillo, pulsera, tobillera.',
  },
  {
    value:       'accesorio',
    label:       'Accesorio',
    emoji:       '🕶',
    description: 'Accesorio genérico: cinturón, sombrero, gorra, gafas, bufanda, pañuelo.',
  },
];

// Mapa rápido para lookup
export const HAUL_REF_MAP: Record<HaulRefKind, HaulRefOption> =
  Object.fromEntries(HAUL_REF_OPTIONS.map(o => [o.value, o])) as Record<HaulRefKind, HaulRefOption>;

// ── Componente ────────────────────────────────────────────────

interface HaulReferenceTypeSelectorProps {
  value:    HaulRefKind;
  onChange: (kind: HaulRefKind) => void;
  disabled?: boolean;
}

const HaulReferenceTypeSelector: React.FC<HaulReferenceTypeSelectorProps> = ({
  value, onChange, disabled = false,
}) => {
  const [open, setOpen]             = useState(false);
  const [tooltipOpen, setTooltip]   = useState(false);
  const containerRef                = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

      {/* ── Dropdown ─────────────────────────────────── */}
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 min-w-[11rem] w-max max-h-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-y-auto overscroll-contain">
          <div className="py-1">
            {HAUL_REF_OPTIONS.map(opt => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`
                    w-full flex items-start gap-2 px-3 py-1.5 text-left
                    transition-colors hover:bg-purple-50
                    ${isSelected ? 'bg-purple-50' : ''}
                  `}
                >
                  <span className="text-[12px] leading-none mt-0.5 flex-shrink-0">{opt.emoji}</span>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-bold leading-tight ${isSelected ? 'text-purple-700' : 'text-slate-700'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[9px] text-slate-400 leading-tight mt-0.5 line-clamp-2">
                      {opt.description}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="ml-auto flex-shrink-0 mt-0.5">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-purple-600">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default HaulReferenceTypeSelector;
