import React from 'react';
import { ImageSlot } from '../../components/shared/ImageSlot';
import UploadDisclaimer from '../../components/shared/UploadDisclaimer';
import type { WizardProductState } from './wizardTypes';

interface Step1ProductProps {
  state: WizardProductState;
  onChange: (next: WizardProductState) => void;
  disabled?: boolean;
}

const SLOT_DEFS = [
  { idx: 0, label: 'Frontal',          hint: 'Vista principal',         primary: true  },
  { idx: 1, label: 'Trasera',          hint: 'Opcional',                primary: false },
  { idx: 2, label: 'Lateral',          hint: 'Opcional',                primary: false },
  { idx: 3, label: 'Detalle/Superior', hint: 'Texturas, etiquetas',     primary: false },
];

export const Step1Product: React.FC<Step1ProductProps> = ({ state, onChange, disabled }) => {
  const filled = state.slots.filter(Boolean).length;
  const status: 'empty' | 'warning' | 'optimal' =
    filled >= 2 ? 'optimal' : filled === 1 ? 'warning' : 'empty';

  const setSlot = (i: number, v: string | null) => {
    const next = [...state.slots];
    next[i] = v;
    onChange({ ...state, slots: next });
  };

  return (
    <div className="fade-in p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-9 items-start">
        {/* LEFT: copy + form */}
        <div className="md:col-span-6 order-2 md:order-1">
          <div className="text-[10px] font-black text-pink-600 uppercase tracking-[0.18em]">
            Paso 1 · Producto
          </div>
          <h2 className="t-display text-[28px] md:text-[36px] text-slate-900 mt-2.5 leading-[1.05]">
            Cuéntanos qué <span className="text-pink-600 italic normal-case">vamos a fotografiar.</span>
          </h2>
          <p className="text-sm text-slate-500 mt-2 leading-[1.55] max-w-[540px]">
            Sube de 2 a 4 fotos desde distintos ángulos. Más vistas = mejor resultado, porque mantenemos forma y detalles del producto.
          </p>

          <div className="mt-5 flex flex-col gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
                Título del producto <span className="text-pink-600">*</span>
              </label>
              <input
                type="text"
                value={state.title}
                onChange={(e) => onChange({ ...state, title: e.target.value })}
                placeholder="Ej: Crema Aura · Frasco 50ml"
                disabled={disabled}
                autoComplete="off"
                autoCapitalize="words"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-[15px] font-semibold text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
                Descripción{' '}
                <span className="text-slate-400 font-medium normal-case tracking-normal">
                  (opcional)
                </span>
              </label>
              <textarea
                value={state.desc}
                onChange={(e) => onChange({ ...state, desc: e.target.value })}
                placeholder="Material, color, ingredientes, lo que la IA debería saber…"
                rows={3}
                disabled={disabled}
                autoComplete="off"
                autoCapitalize="sentences"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all resize-y leading-[1.5] disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* RIGHT: image slots */}
        <div className="md:col-span-6 order-1 md:order-2">
          <div className="flex justify-between items-baseline mb-3">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em]">
              Fotos del producto
            </div>
            <span
              className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full ${
                status === 'optimal'
                  ? 'bg-emerald-50 text-emerald-600'
                  : status === 'warning'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {status === 'optimal'
                ? `✓ Óptimo · ${filled}/4`
                : status === 'warning'
                ? '⚠ 1 más, idealmente'
                : `${filled}/4`}
            </span>
          </div>

          {/* Mobile: 2x2 cuadrados de tamaño decente */}
          <div className="grid grid-cols-2 gap-2.5 md:hidden">
            {[0, 1, 2, 3].map((idx) => (
              <ImageSlot
                key={idx}
                value={state.slots[idx]}
                onChange={(v) => setSlot(idx, v)}
                slotType="product"
                aspectRatio="square"
                hint={idx === 0 ? SLOT_DEFS[0].label : SLOT_DEFS[idx].label}
                disabled={disabled}
              />
            ))}
          </div>

          {/* Desktop: layout asimétrico (slot 0 grande row-span-2, slot 3 banda ancha) */}
          <div
            className="hidden md:grid grid-cols-3 gap-2.5"
            style={{ gridAutoRows: '120px' }}
          >
            <div className="row-span-2 h-full">
              <ImageSlot
                value={state.slots[0]}
                onChange={(v) => setSlot(0, v)}
                slotType="product"
                aspectRatio="auto"
                hint={SLOT_DEFS[0].hint}
                disabled={disabled}
                iconless
                className="h-full [&>div:last-child]:h-full"
              />
            </div>
            <ImageSlot
              value={state.slots[1]}
              onChange={(v) => setSlot(1, v)}
              slotType="product"
              aspectRatio="auto"
              hint={SLOT_DEFS[1].label}
              disabled={disabled}
              iconless
              className="h-full [&>div:last-child]:h-full"
            />
            <ImageSlot
              value={state.slots[2]}
              onChange={(v) => setSlot(2, v)}
              slotType="product"
              aspectRatio="auto"
              hint={SLOT_DEFS[2].label}
              disabled={disabled}
              iconless
              className="h-full [&>div:last-child]:h-full"
            />
            <div className="col-span-2 h-full">
              <ImageSlot
                value={state.slots[3]}
                onChange={(v) => setSlot(3, v)}
                slotType="product"
                aspectRatio="auto"
                hint={SLOT_DEFS[3].hint}
                disabled={disabled}
                iconless
                className="h-full [&>div:last-child]:h-full"
              />
            </div>
          </div>

          {/* Hint box */}
          <div
            className={`mt-3.5 px-3.5 py-3 rounded-xl border text-xs leading-[1.55] ${
              status === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : status === 'optimal'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {status === 'optimal' ? (
              <>
                <strong>Excelente.</strong> Con {filled} ángulo{filled > 1 ? 's' : ''} vamos a mantener forma, color y detalles con alta fidelidad.
              </>
            ) : status === 'warning' ? (
              <>
                <strong>Sumá una vista más.</strong> Con una sola foto la IA puede perder detalle del reverso o lateral.
              </>
            ) : (
              <>
                <strong>Sube al menos 2 fotos</strong> desde distintos ángulos para mejores resultados.
              </>
            )}
          </div>

          <div className="mt-3">
            <UploadDisclaimer />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step1Product;
