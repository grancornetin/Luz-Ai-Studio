/**
 * SlotCard.tsx
 *
 * Envoltorio visual nuevo para un slot de referencia — NO reemplaza
 * ImageSlot (components/shared/ImageSlot.tsx), lo envuelve. ImageSlot ya
 * resuelve upload/drag&drop/compresión/consentimiento de subida de imagen;
 * ese motor se conserva intacto. Lo que cambia acá es la presentación:
 * icono en badge redondeado + label + badge "Necesario/Recomendado/
 * Opcional" + estado subido con check, tomado del nuevo prototipo (ver
 * PLAN_INTEGRACION.md, Fase 2, punto 3).
 *
 * OJO — dos SlotType sin relación en el código: el de ImageSlot.tsx (icono
 * contextual de upload: 'avatar' | 'outfit' | ...) y el de
 * photodump/slotCatalog.ts (catálogo semántico con maxCount/color/
 * modelHint). Este componente toma valores YA RESUELTOS (icon, label,
 * requirement) desde donde sea que el caller los arme — no asume cuál de
 * los dos catálogos los originó.
 */
import React from 'react';
import { Check } from 'lucide-react';

export type SlotRequirement = 'required' | 'recommended' | 'optional';

const REQUIREMENT_LABEL: Record<SlotRequirement, string> = {
  required:    'Necesario',
  recommended: 'Recomendado',
  optional:    'Opcional',
};

const REQUIREMENT_DOT: Record<SlotRequirement, string> = {
  required:    'bg-brand-500',
  recommended: 'bg-amber-400',
  optional:    'bg-slate-300',
};

interface SlotCardProps {
  icon:        React.ReactNode;
  label:       string;
  requirement: SlotRequirement;
  /** true si ya hay una imagen cargada en este slot. */
  uploaded:    boolean;
  onClick:     () => void;
  /** Miniatura de la imagen ya subida, si hay una — se muestra de fondo con overlay. */
  thumbnailUrl?: string;
}

export const SlotCard: React.FC<SlotCardProps> = ({
  icon, label, requirement, uploaded, onClick, thumbnailUrl,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-left rounded-2xl p-3 min-h-[92px] transition-all overflow-hidden ${
        uploaded
          ? 'border border-emerald-300 bg-emerald-50'
          : 'border border-dashed border-slate-300 bg-slate-50 hover:border-slate-400'
      }`}
    >
      {uploaded && thumbnailUrl && (
        <img src={thumbnailUrl} alt={label} className="absolute inset-0 w-full h-full object-cover opacity-25" />
      )}
      <div className="relative">
        <span className="text-lg block mb-2">{uploaded ? '🖼️' : icon}</span>
        <b className="text-[12px] font-bold text-slate-800 block">
          {uploaded ? 'Referencia cargada' : label}
        </b>
        <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${REQUIREMENT_DOT[requirement]}`} />
          {REQUIREMENT_LABEL[requirement]}
        </span>
      </div>
      {uploaded && (
        <span className="absolute top-2 right-2 w-[18px] h-[18px] rounded-full bg-emerald-500 text-white flex items-center justify-center">
          <Check size={10} strokeWidth={3} />
        </span>
      )}
    </button>
  );
};

export default SlotCard;
