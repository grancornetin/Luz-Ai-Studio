import React from 'react';
import { Check } from 'lucide-react';
import { ImageSlot } from '../../components/shared/ImageSlot';
import type { StylePreset, WizardStyleState } from './wizardTypes';

import imgMinimal   from '../../data/media/estilos de foto producto/minimal.png';
import imgPremium   from '../../data/media/estilos de foto producto/premium.png';
import imgLifestyle from '../../data/media/estilos de foto producto/lifestyle.png';
import imgDark      from '../../data/media/estilos de foto producto/dark.png';
import imgNatural   from '../../data/media/estilos de foto producto/natural.png';

interface Step3StyleProps {
  state: WizardStyleState;
  onChange: (next: WizardStyleState) => void;
}

interface PresetDef {
  id: StylePreset;
  title: string;
  desc: string;
  // Atributos visuales que ve la IA (los mismos que buildMasterContext)
  bgLabel: string;   // tipo de fondo
  lightLabel: string; // tipo de luz
  toneLabel: string;  // tono de color
  // Visual de la tarjeta
  bgGradient: string;
  mockBgColor: string;   // color de fondo del producto simulado
  mockLightPos: 'left' | 'right' | 'top' | 'soft'; // dirección de luz simulada
  imgSrc: string;
}

const PRESETS: PresetDef[] = [
  {
    id: 'minimal',
    title: 'Minimalista',
    desc: 'Foco total en el producto. Sin distracciones.',
    bgLabel: 'Blanco / off-white',
    lightLabel: 'Difusa de estudio',
    toneLabel: 'Neutro exacto',
    bgGradient: 'from-slate-50 to-slate-200',
    mockBgColor: '#f1f5f9',
    mockLightPos: 'soft',
    imgSrc: imgMinimal,
  },
  {
    id: 'premium',
    title: 'Premium',
    desc: 'Lujo discreto, iluminación de alta gama.',
    bgLabel: 'Superficie elegante',
    lightLabel: 'Acabado profesional',
    toneLabel: 'Cálido-neutro refinado',
    bgGradient: 'from-stone-700 to-stone-950',
    mockBgColor: '#1c1917',
    mockLightPos: 'right',
    imgSrc: imgPremium,
  },
  {
    id: 'lifestyle',
    title: 'En uso',
    desc: 'Producto en contexto real y situaciones de vida.',
    bgLabel: 'Ambiente real',
    lightLabel: 'Luz natural de ventana',
    toneLabel: 'Cálido orgánico',
    bgGradient: 'from-amber-300 to-pink-400',
    mockBgColor: '#fef3c7',
    mockLightPos: 'left',
    imgSrc: imgLifestyle,
  },
  {
    id: 'dark',
    title: 'Oscuro',
    desc: 'Alto contraste, atmósfera dramática y profunda.',
    bgLabel: 'Fondo oscuro mate',
    lightLabel: 'Direccional con sombras',
    toneLabel: 'Contraste profundo',
    bgGradient: 'from-indigo-900 to-slate-950',
    mockBgColor: '#0f172a',
    mockLightPos: 'right',
    imgSrc: imgDark,
  },
  {
    id: 'natural',
    title: 'Natural',
    desc: 'Luz suave, materiales orgánicos y texturas reales.',
    bgLabel: 'Superficie texturada',
    lightLabel: 'Luz natural suave',
    toneLabel: 'Cálido natural',
    bgGradient: 'from-amber-100 to-lime-100',
    mockBgColor: '#fef9c3',
    mockLightPos: 'left',
    imgSrc: imgNatural,
  },
];

// Componente de preview del estilo
const StyleMockup: React.FC<{ preset: PresetDef; isSelected: boolean }> = ({ preset, isSelected }) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  const isDark = ['premium', 'dark'].includes(preset.id);

  return (
    <div className={`relative aspect-[4/3] overflow-hidden rounded-t-[12px] bg-gradient-to-br ${preset.bgGradient}`}>

      {/* Imagen real — ocupa todo el espacio */}
      {!imgFailed && (
        <img
          src={preset.imgSrc}
          alt={`Ejemplo ${preset.title}`}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      )}

      {/* Fallback cuando no hay imagen: producto simulado centrado */}
      {imgFailed && (
        <>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative w-[38px] h-[50px] rounded-md shadow-[0_6px_18px_rgba(0,0,0,0.3)]"
              style={{ background: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.75)', backdropFilter: 'blur(2px)', border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.06)' }}
            >
              <div className="absolute inset-x-2 top-2 bottom-3 rounded-sm opacity-40"
                style={{ background: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(100,100,100,0.15)' }} />
            </div>
            <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 w-9 h-1 bg-black/20 rounded-full blur-sm" />
          </div>
        </>
      )}

      {/* Overlay seleccionado */}
      {isSelected && (
        <div className="absolute inset-0 bg-violet-600/15 pointer-events-none" />
      )}

      {/* Check seleccionado */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-[0_3px_8px_rgba(124,58,237,0.5)]">
          <Check size={10} strokeWidth={3.5} />
        </div>
      )}
    </div>
  );
};

export const Step3Style: React.FC<Step3StyleProps> = ({ state, onChange }) => {
  const hasRef = !!state.referenceImg;

  const setRef = (v: string | null) =>
    onChange({ referenceImg: v, preset: v ? null : state.preset });

  const setPreset = (id: StylePreset) => {
    if (hasRef) return;
    onChange({ ...state, preset: id });
  };

  return (
    <div className="fade-in p-4 md:p-8">
      <div className="max-w-[720px] mb-6">
        <div className="text-[10px] font-black text-pink-600 uppercase tracking-[0.18em]">
          Paso 3 · Estilo
        </div>
        <h2 className="t-display text-[28px] md:text-[36px] text-slate-900 mt-2.5 leading-[1.05]">
          Elige <span className="text-pink-600 italic normal-case">cómo quieres que se vean tus fotos.</span>
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
          Sube una foto que te inspire <strong>o</strong> elige un estilo.{' '}
          <strong>No se pueden combinar</strong> — la referencia siempre gana.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">

        {/* ── ZONA A: Subir referencia ─────────────────────────────── */}
        <div className="md:col-span-5">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2.5">
            A · Usar imagen de referencia
          </div>

          <div className="relative">
            <ImageSlot
              value={state.referenceImg}
              onChange={(v) => setRef(v)}
              slotType="style"
              aspectRatio="portrait"
              hint="Tipo Pinterest"
              iconless={false}
            />
            {hasRef && (
              <div className="absolute top-3 left-3 bg-white text-slate-900 text-[9px] font-bold tracking-[0.12em] uppercase px-2.5 py-1.5 rounded-full shadow-md pointer-events-none">
                ✓ Referencia activa
              </div>
            )}
            {hasRef && (
              <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur rounded-xl px-3.5 py-2.5 text-xs text-slate-700 leading-[1.5] pointer-events-none">
                <strong className="text-violet-600">Modo recrear inspiración activo.</strong>{' '}
                Usaremos esta imagen como guía visual de escena, luz y composición.
              </div>
            )}
          </div>

          {!hasRef && (
            <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3.5">
              <p className="text-[11px] text-slate-500 leading-[1.55]">
                <strong className="text-slate-700">¿Qué hace la referencia?</strong><br/>
                Usaremos la escena, la luz y la composición como inspiración, pero mostraremos <em>tu producto</em>.
              </p>
            </div>
          )}
        </div>

        {/* ── ZONA B: Estilos rápidos ──────────────────────────────── */}
        <div
          className={`md:col-span-7 transition-opacity duration-300 ${
            hasRef ? 'opacity-35 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="flex justify-between items-baseline mb-2.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em]">
              B · Estilos rápidos
            </div>
            {hasRef && (
              <div className="text-[10px] text-slate-400 italic">Desactivado por referencia</div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {PRESETS.map((p) => {
              const sel = state.preset === p.id && !hasRef;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`bg-white rounded-[14px] overflow-hidden text-left transition-all border-2 ${
                    sel
                      ? 'border-violet-600 shadow-[0_10px_24px_rgba(124,58,237,0.2)]'
                      : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
                  }`}
                >
                  <StyleMockup preset={p} isSelected={sel} />

                  {/* Info del estilo */}
                  <div className="p-2.5 pt-2">
                    <div className="t-display text-[13px] text-slate-900 normal-case italic leading-tight mb-1.5">
                      {p.title}
                    </div>
                    <div className="text-[10.5px] text-slate-500 leading-[1.4] normal-case mb-2">
                      {p.desc}
                    </div>
                    {/* Tres pills: fondo / luz / tono */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-400 normal-case leading-[1.3]">
                        <span className="text-slate-300">▣</span> {p.bgLabel}
                      </span>
                      <span className="text-[9px] text-slate-400 normal-case leading-[1.3]">
                        <span className="text-slate-300">◎</span> {p.lightLabel}
                      </span>
                      <span className="text-[9px] text-slate-400 normal-case leading-[1.3]">
                        <span className="text-slate-300">◐</span> {p.toneLabel}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3Style;
