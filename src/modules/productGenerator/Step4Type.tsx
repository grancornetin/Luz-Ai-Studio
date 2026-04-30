import React, { useEffect } from 'react';
import { Check, Layers, Grid3x3 } from 'lucide-react';
import { MODEL_CREDIT_COST } from '../../services/creditConfig';
import type {
  GenMode,
  GridSize,
  PackCount,
  RefCount,
  WizardTypeState,
} from './wizardTypes';

interface Step4TypeProps {
  type: WizardTypeState;
  onChange: (next: WizardTypeState) => void;
  hasReference: boolean;
  productTitle: string;
  creditsAvailable: number;
}

// Cálculo informativo del prototipo (NO se conecta todavía a la generación real).
// El usuario lo enchufará después.
// Cálculo informativo del Paso 4. La fuente de verdad para el descuento real
// vive en ProductGeneratorModule (función computeCost compartida con la generación).
const calcCost = (t: WizardTypeState, hasRef: boolean): { cost: number; finalCount: number } => {
  const perImage = MODEL_CREDIT_COST.gemini;
  let finalCount: number;
  if (hasRef) {
    finalCount = t.refCount;
  } else if (t.mode === 'pack') {
    finalCount = t.packCount;
  } else {
    const [rows, cols] = t.gridSize.split('x').map((n) => parseInt(n, 10));
    finalCount = rows * cols;
  }
  // En modo grid: imágenes individuales + 1 collage final (cobra +1 cr).
  const gridExtra = !hasRef && t.mode === 'grid' ? 1 : 0;
  const cost = finalCount * perImage + gridExtra;
  return { cost, finalCount };
};

export const Step4Type: React.FC<Step4TypeProps> = ({
  type,
  onChange,
  hasReference,
  productTitle,
  creditsAvailable,
}) => {
  const { cost, finalCount } = calcCost(type, hasReference);

  useEffect(() => {
    if (type.computedCost !== cost || type.finalCount !== finalCount) {
      onChange({ ...type, computedCost: cost, finalCount });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cost, finalCount]);

  const set = (patch: Partial<WizardTypeState>) => onChange({ ...type, ...patch });

  const insufficient = creditsAvailable < cost;
  const remaining = Math.max(0, creditsAvailable - cost);

  return (
    <div className="fade-in p-4 md:p-8">
      <div className="max-w-[720px] mb-6">
        <div className="text-[10px] font-black text-pink-600 uppercase tracking-[0.18em]">
          Paso 4 · Tipo y cantidad
        </div>
        <h2 className="t-display text-[28px] md:text-[36px] text-slate-900 mt-2.5 leading-[1.05]">
          ¿Cómo <span className="text-pink-600 italic normal-case">generamos las fotos?</span>
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
          {hasReference
            ? 'Como hay referencia, vamos a recrear su estilo. Elegí solo cuántas imágenes querés.'
            : 'Elegí entre un pack de imágenes individuales o un grid con varios ángulos en una sola foto.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 md:gap-5 items-start">
        {/* LEFT: selección */}
        <div className="flex flex-col gap-3.5">
          {hasReference ? (
            // CASO 1: con referencia
            <div className="bg-white border-2 border-violet-600 rounded-2xl p-5 md:p-5.5 shadow-[0_16px_40px_rgba(124,58,237,0.12)]">
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="inline-flex items-center text-[10px] font-bold text-violet-600 bg-violet-100 px-2 py-1 rounded-full uppercase tracking-wider">
                  Modo automático
                </span>
                <div className="t-display text-[18px] text-slate-900 normal-case italic">
                  Recrear inspiración
                </div>
              </div>
              <p className="text-[13px] text-slate-500 leading-[1.55] mb-4">
                Generaremos imágenes basadas en tu referencia manteniendo el estilo original. Máximo 2 para no saturar.
              </p>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2.5">
                Cantidad
              </div>
              <div className="flex gap-2.5">
                {([1, 2] as RefCount[]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set({ refCount: n })}
                    className={`flex-1 py-4 md:py-[18px] rounded-2xl text-base font-bold transition-all ${
                      type.refCount === n
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {n}{' '}
                    <span className="text-[11px] font-medium opacity-70">
                      {n === 1 ? 'imagen' : 'imágenes'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // CASO 2: sin referencia
            <>
              {/* Tipo: Pack vs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  {
                    id: 'pack' as GenMode,
                    title: 'Pack automático',
                    desc: 'Varias imágenes listas para redes o ecommerce',
                    Icon: Layers,
                  },
                  {
                    id: 'grid' as GenMode,
                    title: 'Grid automático',
                    desc: 'Múltiples ángulos en una sola imagen',
                    Icon: Grid3x3,
                  },
                ]).map((o) => {
                  const sel = type.mode === o.id;
                  const Icon = o.Icon;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => set({ mode: o.id })}
                      className={`bg-white rounded-2xl p-4 md:p-[18px] text-left transition-all ${
                        sel
                          ? 'border-2 border-violet-600 shadow-[0_12px_28px_rgba(124,58,237,0.18)]'
                          : 'border border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            sel ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Icon size={20} strokeWidth={1.8} />
                        </div>
                        <div
                          className={`w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all ${
                            sel
                              ? 'bg-violet-600 text-white'
                              : 'bg-white border-2 border-slate-200 text-transparent'
                          }`}
                        >
                          {sel && <Check size={11} strokeWidth={3} />}
                        </div>
                      </div>
                      <div className="t-display text-base text-slate-900 normal-case italic leading-tight">
                        {o.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 leading-[1.5] normal-case">
                        {o.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* SUBCASO A — Pack */}
              {type.mode === 'pack' && (
                <div className="fade-in bg-white border border-slate-200 rounded-2xl p-4 md:p-[18px]">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
                    Cantidad de imágenes
                  </div>
                  <div className="flex gap-2.5">
                    {([1, 2, 4, 6] as PackCount[]).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => set({ packCount: n })}
                        className={`flex-1 py-4 rounded-xl flex flex-col items-center gap-0.5 transition-all ${
                          type.packCount === n
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <span className="text-lg font-bold">{n}</span>
                        <span className="text-[10px] font-medium opacity-65">imágenes</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* SUBCASO B — Grid */}
              {type.mode === 'grid' && (
                <div className="fade-in bg-white border border-slate-200 rounded-2xl p-4 md:p-[18px]">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
                    Estructura del grid
                  </div>
                  <div className="flex gap-2.5">
                    {(['1x2', '2x2', '3x3'] as GridSize[]).map((s) => {
                      const [r, c] = s.split('x').map((n) => parseInt(n, 10));
                      const cells = r * c;
                      const sel = type.gridSize === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => set({ gridSize: s })}
                          className={`flex-1 py-3.5 rounded-xl flex flex-col items-center gap-1.5 transition-all ${
                            sel
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <div
                            className="grid gap-[2px] w-6 h-6"
                            style={{ gridTemplateColumns: `repeat(${c}, 1fr)`, gridTemplateRows: `repeat(${r}, 1fr)` }}
                          >
                            {Array.from({ length: cells }).map((_, i) => (
                              <div
                                key={i}
                                className={`rounded-[1.5px] ${sel ? 'bg-white' : 'bg-slate-400'}`}
                              />
                            ))}
                          </div>
                          <span className="text-[13px] font-bold">{s}</span>
                          <span className="text-[9px] font-medium opacity-65">
                            {cells} celdas
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-3 leading-[1.5] italic">
                    Se generarán {(() => { const [r, c] = type.gridSize.split('x').map((n) => parseInt(n, 10)); return r * c; })()} imágenes individuales + 1 imagen final tipo grid.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT: cost panel sticky */}
        <div className="md:sticky md:top-4">
          <div className="relative bg-slate-900 text-white rounded-2xl p-5 md:p-5.5 overflow-hidden">
            {/* Glow */}
            <div
              className="absolute -top-10 -right-10 w-[140px] h-[140px] rounded-full pointer-events-none"
              style={{
                background: 'rgba(124,58,237,0.3)',
                filter: 'blur(40px)',
              }}
            />
            <div className="relative">
              <div className="text-[10px] font-bold text-pink-300 uppercase tracking-[0.14em] mb-3.5">
                Resumen del costo
              </div>

              <div className="flex flex-col gap-2 mb-3.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="opacity-70">Producto</span>
                  <span className="font-semibold max-w-[160px] truncate text-right">
                    {productTitle || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Modo</span>
                  <span className="font-semibold">
                    {hasReference ? 'Recrear' : type.mode === 'pack' ? 'Pack' : 'Grid'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Imágenes</span>
                  <span className="font-semibold">
                    {finalCount}
                    {!hasReference && type.mode === 'grid' ? ' + 1 grid' : ''}
                  </span>
                </div>
                <div className="h-px bg-white/10 my-1.5" />
                <div className="flex justify-between items-baseline">
                  <span className="opacity-85 text-[13px]">Total</span>
                  <span className="t-display text-[36px] tracking-tight leading-none normal-case not-italic">
                    {cost}{' '}
                    <span className="text-sm opacity-70 font-semibold normal-case">cr</span>
                  </span>
                </div>
              </div>

              <div
                className={`text-[11px] leading-[1.5] ${
                  insufficient ? 'text-rose-300' : 'opacity-70'
                }`}
              >
                {insufficient ? (
                  <strong>Créditos insuficientes. Te faltan {cost - creditsAvailable} cr.</strong>
                ) : (
                  <>
                    Te quedarán {remaining} cr · ~{Math.floor(remaining / MODEL_CREDIT_COST.gemini)} imágenes más
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-[11.5px] text-emerald-900 leading-[1.55] mt-3">
            <strong>Sin sorpresas.</strong> Solo se descuenta si la generación se completa. Reembolso automático si falla.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step4Type;
