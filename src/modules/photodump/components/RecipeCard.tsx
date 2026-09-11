/**
 * RecipeCard.tsx
 *
 * Card de receta para el paso 1 (elegir qué crear). Segunda versión (sep
 * 2026) — la primera era una fila tipo lista (icono+label+descripción); el
 * usuario pidió el patrón de card visual con imagen de resultado
 * protagonista + mini-stack de miniaturas simulando un carrusel + texto en
 * overlay sobre gradiente, mostrando de una qué tipo de contenido sale de
 * cada receta (referencia: card de "Image Generation" con mascota tigre,
 * imagen grande + 3 miniaturas + "+7").
 *
 * Imágenes reales: PENDIENTE — el usuario va a traer sets generados reales
 * por receta más adelante. Por ahora cada receta usa un gradiente propio
 * (placeholderGradient) para poder diferenciarse visualmente entre sí sin
 * tener that todavía. Cuando lleguen las imágenes reales, reemplazan el
 * placeholder vía la prop `previewImages` (array de URLs) sin cambiar la
 * estructura del componente.
 *
 * Paleta/tipografía: las del resto de la app (brand-*, slate-*,
 * font-display) — el nuevo prototipo NO define paleta/tipografía propia
 * (ver PLAN_INTEGRACION.md, decisión 3), el gradiente de placeholder es la
 * única excepción deliberada (es contenido, marca cada receta, no un
 * cambio de branding del módulo).
 */
import React from 'react';
import { Check } from 'lucide-react';

export type RecipeCardAccent = 'brand' | 'violet';

const ACCENT_RING: Record<RecipeCardAccent, string> = {
  brand:  'ring-brand-500',
  violet: 'ring-violet-500',
};

const ACCENT_BADGE: Record<RecipeCardAccent, string> = {
  brand:  'bg-brand-600',
  violet: 'bg-violet-600',
};

interface RecipeCardProps {
  icon:        React.ReactNode;
  label:       string;
  description: string;
  /** Ej. "Tu foto · Look completo" — resumen corto de qué se necesita. */
  need?:       string;
  selected:    boolean;
  onSelect:    () => void;
  accent?:     RecipeCardAccent;
  /**
   * Gradiente CSS para el placeholder visual mientras no hay imágenes
   * reales — clases Tailwind, ej. "from-rose-200 via-orange-200 to-amber-300".
   */
  placeholderGradient: string;
  /** Imágenes reales de ejemplo (cuando estén disponibles) — reemplaza el placeholder. */
  previewImages?: string[];
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  icon, label, description, need, selected, onSelect, accent = 'brand',
  placeholderGradient, previewImages,
}) => {
  const hasReal = !!previewImages && previewImages.length > 0;
  const mainImg = hasReal ? previewImages![0] : undefined;
  const stackImgs = hasReal ? previewImages!.slice(1, 3) : [];
  const extraCount = hasReal ? Math.max(0, previewImages!.length - 3) : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative text-left rounded-[22px] overflow-hidden transition-all border ${
        selected
          ? `border-transparent ring-2 ${ACCENT_RING[accent]} shadow-lg`
          : 'border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'
      }`}
    >
      {/* ── Imagen/gradiente protagonista ─────────────────────────── */}
      <div className={`relative aspect-[4/5] bg-gradient-to-br ${placeholderGradient} overflow-hidden`}>
        {mainImg && (
          <img src={mainImg} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        )}

        {/* Icono de la receta, esquina superior izquierda */}
        <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center text-slate-700 shadow-sm">
          {icon}
        </div>

        {/* Check de selección, esquina superior derecha */}
        <div className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
          selected ? `${ACCENT_BADGE[accent]} text-white` : 'bg-white/70 backdrop-blur-sm border border-white/60'
        }`}>
          {selected && <Check size={12} strokeWidth={3} />}
        </div>

        {/* Mini-stack de miniaturas simulando el carrusel de resultados */}
        <div className="absolute top-14 right-3 flex flex-col gap-1.5">
          {(hasReal ? stackImgs : [0, 1]).map((img, i) => (
            <div key={i} className="w-8 h-8 rounded-full ring-2 ring-white/80 overflow-hidden bg-white/30 backdrop-blur-sm">
              {typeof img === 'string' && (
                <img src={img} alt="" className="w-full h-full object-cover" />
              )}
            </div>
          ))}
          {(hasReal ? extraCount > 0 : true) && (
            <div className="w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm ring-2 ring-white/80 flex items-center justify-center text-[10px] font-bold text-slate-700">
              {hasReal ? `+${extraCount}` : '···'}
            </div>
          )}
        </div>

        {/* Overlay de texto — degradado hacia abajo para legibilidad */}
        <div className="absolute inset-x-0 bottom-0 p-3.5 pt-10 bg-gradient-to-t from-black/55 via-black/10 to-transparent">
          <p className="text-[13px] font-bold text-white leading-snug drop-shadow-sm">
            {label}
          </p>
          <p className="text-[11px] text-white/85 mt-0.5 leading-snug line-clamp-2 drop-shadow-sm">
            {description}
          </p>
        </div>
      </div>

      {/* ── Pie: "necesitás" ───────────────────────────────────────── */}
      {need && (
        <div className="px-3.5 py-2.5 bg-white flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selected ? ACCENT_BADGE[accent] : 'bg-slate-300'}`} />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.04em] truncate">
            {need}
          </span>
        </div>
      )}
    </button>
  );
};

export default RecipeCard;
