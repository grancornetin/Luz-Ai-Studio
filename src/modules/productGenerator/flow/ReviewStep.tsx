// Revisa y crea: el control antes de cobrar. Lo común ya viene marcado;
// lo experto queda plegado en "Más opciones".
import React, { useState } from 'react';
import { ChevronDown, ShieldCheck, Info, Sparkles } from 'lucide-react';
import type { ModelId } from '../../../services/imageApiService';
import type { WizardState, PackCount } from '../wizardTypes';
import type { ProductGridType, ProductObjective } from '../productDirectorService';
import { STYLE_OPTIONS, USE_OPTIONS, styleTitle } from './styleOptions';
import { Chip, FieldLabel, FlowTopBar, Hint, PrimaryButton, StickyActions } from './ui';

interface ReviewStepProps {
  wizard: WizardState;
  finalCount: number;
  cost: number;
  creditsAvailable: number;
  isAdmin: boolean;
  modelId: ModelId;
  onModelChange: (m: ModelId) => void;
  onChange: (next: WizardState) => void;
  onEditProduct: () => void;
  onEditStyle: () => void;
  onBack: () => void;
  onCreate: () => void;
  disabled?: boolean;
}

const QUALITY: { id: ModelId; title: string; hint: string }[] = [
  { id: 'gemini',   title: 'Mayor fidelidad', hint: 'tu producto igualito' },
  { id: 'gptimage', title: 'Más creativa',    hint: 'más libre con la escena' },
];

const GRID_OPTIONS: { id: ProductGridType; count: number }[] = [
  { id: '1x2', count: 2 },
  { id: '2x2', count: 4 },
  { id: '3x3', count: 9 },
];

export const ReviewStep: React.FC<ReviewStepProps> = ({
  wizard, finalCount, cost, creditsAvailable, isAdmin, modelId, onModelChange,
  onChange, onEditProduct, onEditStyle, onBack, onCreate, disabled,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const hasRef = !!wizard.style.referenceImg;
  const isCollage = !hasRef && wizard.type.mode === 'grid';
  const styleImg = hasRef ? wizard.style.referenceImg! : STYLE_OPTIONS.find((s) => s.id === wizard.style.preset)?.img;
  const setType = (patch: Partial<WizardState['type']>) => onChange({ ...wizard, type: { ...wizard.type, ...patch } });
  const left = creditsAvailable - cost;
  const createLabel = isCollage
    ? `Crear mi collage de ${finalCount} fotos`
    : finalCount === 1 ? 'Crear mi foto' : `Crear mis ${finalCount} fotos`;

  return (
    <div className="flex flex-col gap-5">
      <FlowTopBar title="Revisa y crea" onBack={onBack} />

      <div className="rounded-[20px] border border-slate-200 bg-white divide-y divide-slate-100">
        {[
          { label: 'Producto', value: wizard.product.title || 'Tu producto', img: wizard.product.slots[0], onEdit: onEditProduct },
          { label: 'Estilo', value: hasRef ? 'Tu foto de inspiración' : styleTitle(wizard.style.preset), img: styleImg, onEdit: onEditStyle },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-[52px] h-16 shrink-0 rounded-xl overflow-hidden bg-slate-200">
              {row.img && <img src={row.img} alt="" className="w-full h-full object-cover" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11.5px] font-semibold text-slate-500">{row.label}</span>
              <b className="block text-[14.5px] text-slate-900 truncate">{row.value}</b>
            </span>
            <button type="button" onClick={row.onEdit} className="px-2 py-2 text-[13px] font-bold text-brand-800">Cambiar</button>
          </div>
        ))}
      </div>

      <div>
        <FieldLabel>{isCollage ? '¿Cuántas fotos en el collage?' : '¿Cuántas fotos?'}</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {hasRef && ([1, 2] as const).map((n) => (
            <Chip key={n} selected={wizard.type.refCount === n} onClick={() => setType({ refCount: n })}>{n}</Chip>
          ))}
          {!hasRef && !isCollage && ([1, 2, 4, 6] as PackCount[]).map((n) => (
            <Chip key={n} selected={wizard.type.packCount === n} onClick={() => setType({ packCount: n })}>{n}</Chip>
          ))}
          {isCollage && GRID_OPTIONS.map((g) => (
            <Chip key={g.id} selected={wizard.type.gridSize === g.id} onClick={() => setType({ gridSize: g.id })}>{g.count}</Chip>
          ))}
        </div>
        {hasRef && <Hint icon={<Info size={14} />}>Con foto de inspiración se crean hasta 2, muy fieles a esa foto.</Hint>}
        {isCollage && <Hint icon={<Info size={14} />}>Recibes cada foto por separado y además el collage con todas.</Hint>}
      </div>

      <div>
        <FieldLabel>¿Dónde las vas a usar?</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {USE_OPTIONS.map((u) => (
            <Chip
              key={u.id}
              selected={wizard.goal === u.id}
              hint={u.hint}
              onClick={() => onChange({ ...wizard, goal: u.id as ProductObjective })}
            >
              {u.title}
            </Chip>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-1">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className="w-full min-h-11 flex items-center justify-between text-sm font-semibold text-slate-700"
        >
          Más opciones
          <ChevronDown size={18} className={`transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
        </button>
        {moreOpen && (
          <div className="flex flex-col gap-4 pt-1 pb-1">
            <div>
              <FieldLabel>Calidad</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {QUALITY.map((q) => (
                  <Chip key={q.id} selected={modelId === q.id} onClick={() => onModelChange(q.id)}>{q.title}</Chip>
                ))}
              </div>
              <Hint icon={<Sparkles size={14} />}>{QUALITY.find((q) => q.id === modelId)?.hint ?? QUALITY[0].hint}</Hint>
            </div>
            {!hasRef && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-900">
                  Un collage además de las fotos sueltas
                  <span className="block text-xs text-slate-500">Todas tus fotos juntas en una imagen · +1 crédito</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isCollage}
                  aria-label="Collage"
                  onClick={() => setType({ mode: isCollage ? 'pack' : 'grid' })}
                  className={`relative w-[46px] h-7 shrink-0 rounded-full transition-colors duration-150 ${isCollage ? 'bg-brand-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute left-[3px] top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-transform duration-200 ${isCollage ? 'translate-x-[18px]' : ''}`} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 items-start rounded-[14px] bg-emerald-50 px-3 py-2.5 text-[12.5px] font-semibold text-emerald-800">
        <ShieldCheck size={16} className="shrink-0" />
        Si alguna foto no se logra crear por un error, te devolvemos sus créditos automáticamente.
      </div>

      <StickyActions>
        <PrimaryButton onClick={onCreate} disabled={disabled}>{createLabel}</PrimaryButton>
        <p className="text-center text-[13px] text-slate-500">
          {isAdmin ? 'Sin costo (admin)' : (
            <>{cost} créditos · <b className={`tabular-nums ${left < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {left < 0 ? `te faltan ${-left}` : `te quedan ${left}`}
            </b></>
          )}
        </p>
      </StickyActions>
    </div>
  );
};
