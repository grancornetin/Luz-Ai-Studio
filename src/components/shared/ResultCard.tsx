/**
 * ResultCard — tarjeta estándar de resultado para la biblioteca de cualquier módulo.
 *
 * Muestra un mosaico de imágenes (hasta 3), metadatos del item, referencias que
 * usó el usuario, y botones de acción. El contenido interno es completamente
 * definido por el módulo a través de props — este componente solo provee el
 * esqueleto visual.
 *
 * Uso mínimo:
 *   <ResultCard images={[url1, url2]} title="Mi resultado" />
 *
 * Uso completo:
 *   <ResultCard
 *     images={[url1, url2, url3]}
 *     title="Campaña primavera"
 *     subtitle="Editorial · 6 piezas"
 *     date={set.createdAt}
 *     badge={{ label: 'Completada', color: 'green' }}
 *     refSlots={[{ label: 'Producto', src: base64 }, { label: 'Modelo', src: base64 }]}
 *     pills={['6 piezas', '7 días', '3 canales']}
 *     accentColor="fuchsia"
 *     actions={[...]}
 *     onClick={() => openDetail(set)}
 *   />
 */

import React from 'react';
import { Trash2, Download, ExternalLink } from 'lucide-react';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type BadgeColor = 'green' | 'fuchsia' | 'blue' | 'amber' | 'slate';
export type AccentColor = 'fuchsia' | 'blue' | 'green' | 'amber' | 'violet';

export interface ResultCardRef {
  label: string;
  src:   string;
  extra?: string;        // texto opcional: "+2", "UGC", etc.
}

export interface ResultCardAction {
  label:     string;
  icon?:     React.ReactNode;
  onClick:   (e: React.MouseEvent) => void;
  variant?:  'primary' | 'secondary' | 'danger' | 'ghost';
  loading?:  boolean;
  disabled?: boolean;
  title?:    string;
}

export interface ResultCardProps {
  // Imágenes — se muestran en mosaico (1, 2 o 3+)
  images:       string[];
  imageAspect?: '1:1' | '3:4' | '9:16' | '4:3';  // default '3:4'

  // Texto
  title:     string;
  subtitle?: string;
  date?:     number;      // timestamp ms

  // Badge encima del título
  badge?: {
    label: string;
    color: BadgeColor;
  };

  // Imágenes de referencia (slots) que usó el usuario
  refSlots?: ResultCardRef[];

  // Chips informativos (ej: "6 piezas", "7 días")
  pills?: string[];

  // Barra de acento arriba de la tarjeta
  accentColor?: AccentColor;

  // Acciones (botones en el footer de la tarjeta)
  actions?: ResultCardAction[];

  // Click en la tarjeta (no en botones)
  onClick?: () => void;

  // Callback rápido de eliminar (genera acción danger automáticamente si actions está vacío)
  onDelete?: (e: React.MouseEvent) => void;
  deleting?: boolean;

  // Selección múltiple (opt-in — el módulo decide cuándo mostrar el
  // checkbox, ej. tras activar un "modo selección" con un botón propio).
  // Sin selectable, la tarjeta se comporta exactamente igual que antes.
  selectable?:      boolean;
  selected?:        boolean;
  onToggleSelect?:  (e: React.MouseEvent) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACCENT_STRIP: Record<AccentColor, string> = {
  fuchsia: 'bg-brand-600',
  blue:    'bg-blue-500',
  green:   'bg-emerald-500',
  amber:   'bg-amber-500',
  violet:  'bg-violet-500',
};

const BADGE_STYLE: Record<BadgeColor, string> = {
  green:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  fuchsia: 'bg-brand-50 text-brand-700 border-brand-200',
  blue:    'bg-blue-50 text-blue-700 border-blue-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  slate:   'bg-slate-100 text-slate-600 border-slate-200',
};

const ACTION_STYLE: Record<NonNullable<ResultCardAction['variant']>, string> = {
  primary:   'bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100',
  secondary: 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300',
  danger:    'bg-rose-50 text-rose-500 border-rose-100 hover:bg-rose-100 hover:text-rose-700',
  ghost:     'bg-transparent text-slate-500 border-slate-200 hover:bg-slate-50',
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000)   return 'ahora';
  if (diff < 3_600_000) return `hace ${Math.round(diff / 60_000)} min`;
  if (diff < 86_400_000) return `hace ${Math.round(diff / 3_600_000)} h`;
  if (diff < 7 * 86_400_000) return `hace ${Math.round(diff / 86_400_000)} días`;
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

// ── Mosaico de imágenes ───────────────────────────────────────────────────────

function ImageMosaic({ images, aspect }: { images: string[]; aspect: string }) {
  const [img0, img1, img2] = images;
  const overflow = images.length > 3 ? images.length - 3 : 0;

  if (images.length === 0) {
    return (
      <div className="w-full h-40 bg-slate-50 flex items-center justify-center text-3xl text-slate-200 border-b border-slate-100">
        🖼️
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className="w-full h-40 border-b border-slate-100 overflow-hidden bg-slate-100">
        <img src={img0} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 grid-rows-2 h-40 border-b border-slate-100 overflow-hidden">
      {/* Imagen grande izquierda — ocupa 2 filas */}
      <div className="row-span-2 overflow-hidden border-r border-white/20 bg-slate-100">
        <img src={img0} alt="" className="w-full h-full object-cover" />
      </div>
      {/* Top derecha */}
      <div className="overflow-hidden border-b border-white/20 bg-slate-100">
        {img1
          ? <img src={img1} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-slate-100" />}
      </div>
      {/* Bottom derecha */}
      <div className="overflow-hidden relative bg-slate-100">
        {img2
          ? <img src={img2} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-slate-200" />}
        {overflow > 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-[13px] font-black">+{overflow}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export const ResultCard: React.FC<ResultCardProps> = ({
  images,
  imageAspect = '3:4',
  title,
  subtitle,
  date,
  badge,
  refSlots,
  pills,
  accentColor = 'fuchsia',
  actions,
  onClick,
  onDelete,
  deleting,
  selectable,
  selected,
  onToggleSelect,
}) => {
  const resolvedActions: ResultCardAction[] = actions ?? (onDelete ? [{
    label: '', icon: <Trash2 size={12} />, onClick: onDelete,
    variant: 'danger', loading: deleting, title: 'Eliminar',
  }] : []);

  // En modo selección, el click en la tarjeta selecciona en vez de abrir —
  // mismo patrón que la galería de fotos del sistema operativo (tap para
  // marcar, no para abrir, mientras el modo está activo).
  const handleCardClick = selectable ? onToggleSelect : onClick;

  return (
    <div
      className={`relative bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${selected ? 'border-brand-400 ring-2 ring-brand-200' : 'border-slate-200'} ${handleCardClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-brand-200 group' : ''}`}
      onClick={handleCardClick}
    >
      {selectable && (
        <div className="absolute top-2.5 left-2.5 z-10">
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? 'bg-brand-600 border-brand-600' : 'bg-white/90 border-slate-300 backdrop-blur-sm'}`}>
            {selected && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 6L4.8 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Barra de acento superior */}
      <div className={`h-1 ${ACCENT_STRIP[accentColor]}`} />

      {/* Mosaico */}
      <ImageMosaic images={images} aspect={imageAspect} />

      {/* Body */}
      <div className="p-4">
        {/* Badge + fecha */}
        <div className="flex items-center justify-between mb-2">
          {badge
            ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${BADGE_STYLE[badge.color]}`}>{badge.label}</span>
            : <span />}
          {date && <span className="text-[10px] text-slate-400">{formatDate(date)}</span>}
        </div>

        {/* Título + subtítulo */}
        <p className="font-black italic text-[14px] text-slate-900 leading-tight mb-0.5 line-clamp-2"
          style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
          {title}
        </p>
        {subtitle && <p className="text-[11px] text-slate-400 mb-3 line-clamp-1">{subtitle}</p>}

        {/* Referencias del usuario */}
        {refSlots && refSlots.length > 0 && (
          <div className="mb-3">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Referencias</p>
            <div className="flex gap-1.5 flex-wrap">
              {refSlots.map((ref, i) => (
                <div key={i} title={ref.label} className="relative flex-shrink-0">
                  <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-100">
                    <img src={ref.src} alt={ref.label} className="w-full h-full object-cover" />
                  </div>
                  {ref.extra && (
                    <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-slate-700 text-white rounded-full px-1 leading-tight">
                      {ref.extra}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pills informativas */}
        {pills && pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {pills.map((pill, i) => (
              <span key={i} className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                {pill}
              </span>
            ))}
          </div>
        )}

        {/* Acciones */}
        {resolvedActions.length > 0 && (
          <div className="flex gap-1.5 pt-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>
            {resolvedActions.map((action, i) => (
              <button
                key={i}
                type="button"
                title={action.title}
                disabled={action.disabled || action.loading}
                onClick={action.onClick}
                className={`${action.label ? 'flex-1' : 'w-8 flex-shrink-0'} py-1.5 rounded-xl text-[11px] font-semibold border flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-wait ${ACTION_STYLE[action.variant ?? 'secondary']}`}
              >
                {action.loading
                  ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultCard;
