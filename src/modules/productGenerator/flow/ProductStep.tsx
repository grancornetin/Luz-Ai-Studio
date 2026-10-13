// Tu producto: la foto principal y el nombre. Lo opcional queda plegado.
// Tableta: foto y campos en dos columnas. Computador: la foto llena el lienzo
// (con los ángulos extra debajo) y los campos van en el panel; Enter continúa
// y se puede soltar otra foto encima para reemplazarla.
import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Plus, RefreshCw, SunDim, X } from 'lucide-react';
import type { WizardProductState } from '../wizardTypes';
import { FlowShell } from '../../../components/shared/flow/FlowShell';
import { FieldLabel, FitGallery, Footnote, LargeTitle, PrimaryButton, TextField } from '../../../components/shared/flow/primitives';
import { useFlowLayout } from '../../../components/shared/flow/layout';

interface ProductStepProps {
  state: WizardProductState;
  onChange: (next: WizardProductState) => void;
  pickImage: (onPicked: (dataUrl: string) => void) => void;
  /** Foto soltada sobre la ventana (tableta/computador). */
  dropImage?: (file: File, onPicked: (dataUrl: string) => void) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const PRODUCT_FLOW_STEPS = ['Tu producto', 'Estilo', 'Revisa y crea'];

const EXTRA_ANGLES = [
  { idx: 1, label: 'Atrás' },
  { idx: 2, label: 'De lado' },
  { idx: 3, label: 'Detalle' },
];

// Revisión liviana en el teléfono (sin costo): ¿la foto está muy oscura?
function useBrightness(src: string | null): 'ok' | 'dark' | null {
  const [result, setResult] = useState<'ok' | 'dark' | null>(null);
  useEffect(() => {
    setResult(null);
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 24; canvas.height = 24;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 24, 24);
        const { data } = ctx.getImageData(0, 0, 24, 24);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (!cancelled) setResult(sum / (data.length / 4) < 60 ? 'dark' : 'ok');
      } catch { /* sin permiso de lectura: no mostramos nada */ }
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return result;
}

export const ProductStep: React.FC<ProductStepProps> = ({ state, onChange, pickImage, dropImage, onBack, onContinue }) => {
  const layout = useFlowLayout();
  const compact = layout === 'compact';
  const wide = layout === 'wide';
  const main = state.slots[0];
  const brightness = useBrightness(main);
  const extrasCount = EXTRA_ANGLES.filter((a) => state.slots[a.idx]).length + (state.desc.trim() ? 1 : 0);
  // Fuera del celular hay espacio: "Más detalles" parte abierto.
  const [moreOpen, setMoreOpen] = useState(extrasCount > 0 || !compact);
  const canContinue = !!main && state.title.trim().length > 0;

  const setSlot = (i: number, v: string | null) => {
    const next = [...state.slots];
    next[i] = v;
    onChange({ ...state, slots: next });
  };

  const changeButton = (
    <button
      type="button"
      onClick={() => pickImage((img) => setSlot(0, img))}
      className="flow-press absolute bottom-3 right-3 flex h-9 items-center gap-1.5 rounded-full bg-white/80 px-3.5 text-[15px] font-semibold text-[color:var(--text)] shadow-[0_1px_3px_rgba(0,0,0,0.18)] backdrop-blur-xl"
    >
      <RefreshCw size={15} strokeWidth={2.2} /> Cambiar
    </button>
  );

  const brightnessNote = brightness && (
    <Footnote
      className="mt-2 justify-center"
      icon={brightness === 'ok'
        ? <Check size={15} strokeWidth={2.6} className="text-[color:var(--ok-fg)]" />
        : <SunDim size={15} className="text-[color:var(--warn-fg)]" />}
    >
      {brightness === 'ok' ? 'La foto se ve bien' : 'Se ve algo oscura. Con más luz sale mejor.'}
    </Footnote>
  );

  const nameField = (
    <div className={compact ? 'mt-6' : 'mt-5'}>
      <FieldLabel htmlFor="pg-name">¿Cómo se llama?</FieldLabel>
      <TextField
        id="pg-name"
        value={state.title}
        onChange={(e) => onChange({ ...state, title: e.target.value })}
        placeholder="Ej: Botella térmica verde"
        autoCapitalize="sentences"
        enterKeyHint="done"
        autoFocus={wide && !state.title}
        onKeyDown={(e) => { if (compact && e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      <Footnote className="mt-2">Con 2 o 3 palabras basta.</Footnote>
    </div>
  );

  const descField = (onWhite: boolean) => (
    <>
      <FieldLabel htmlFor="pg-desc" optional={wide}>¿Algo que no se vea en la foto?</FieldLabel>
      <TextField
        id="pg-desc"
        value={state.desc}
        onChange={(e) => onChange({ ...state, desc: e.target.value })}
        placeholder="Ej: mide 20 cm, es de acero mate"
        autoCapitalize="sentences"
        enterKeyHint="done"
        className={onWhite ? 'bg-white' : ''}
        onKeyDown={(e) => { if (compact && e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      <Footnote className="mt-2">Tamaño, material o textura. Así sale del tamaño correcto y con la terminación real.</Footnote>
    </>
  );

  const angleSlots = (cls: string) => EXTRA_ANGLES.map(({ idx, label }) => {
    const img = state.slots[idx];
    return img ? (
      <div key={idx} className={`relative overflow-hidden rounded-[12px] bg-white ${cls}`}>
        <img src={img} alt={`Foto ${label}`} className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={() => setSlot(idx, null)}
          aria-label={`Quitar foto ${label}`}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-[color:var(--text)] shadow-[0_1px_3px_rgba(0,0,0,0.18)] backdrop-blur-xl"
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
    ) : (
      <button
        key={idx}
        type="button"
        onClick={() => pickImage((v) => setSlot(idx, v))}
        className={`flow-press flow-hover-fill flex flex-col items-center justify-center gap-1.5 rounded-[12px] bg-white text-[13px] font-semibold tracking-normal text-[color:var(--text-2)] ${cls}`}
      >
        <Plus size={20} className="text-[color:var(--action)]" />
        {label}
      </button>
    );
  });

  const details = (
    <div className="mt-6 rounded-[12px] bg-[color:var(--fill)]">
      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        aria-expanded={moreOpen}
        className="flex min-h-[52px] w-full items-center justify-between px-4 text-left"
      >
        <span className="text-[16px]">
          Más detalles <span className="text-[color:var(--text-2)]">· opcional</span>
        </span>
        <ChevronDown size={18} className={`text-[color:var(--placeholder)] transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
      </button>
      {moreOpen && (
        <div className="border-t border-[color:var(--separator)] px-4 pb-4 pt-3">
          {descField(true)}
          <p className="mt-5 mb-2 text-[15px] font-semibold">Otros ángulos</p>
          <div className="grid grid-cols-3 gap-2">{angleSlots('aspect-[3/4]')}</div>
          <Footnote className="mt-2">Más ángulos ayudan a que tu producto salga igualito desde todos lados.</Footnote>
        </div>
      )}
    </div>
  );

  // Computador: la foto llena el lienzo; los ángulos extra van debajo.
  const stage = wide ? (
    <>
      <FitGallery
        ratio={0.8}
        items={[
          <div key="main" className="relative h-full w-full overflow-hidden rounded-[24px] bg-[color:var(--fill)] shadow-[0_1px_2px_rgba(15,15,18,0.06)]">
            {main && <img src={main} alt="Foto de tu producto" className="h-full w-full object-cover" />}
            {changeButton}
          </div>,
        ]}
      />
      {brightnessNote}
      <div className="mt-5 flex shrink-0 items-end justify-center gap-4">
        <div>
          <p className="mb-2 text-[13px] font-semibold tracking-normal text-[color:var(--text-2)]">Otros ángulos · opcional</p>
          <div className="flex gap-2.5">{angleSlots('h-[104px] w-[78px]')}</div>
        </div>
      </div>
    </>
  ) : undefined;

  const photo = (
    <div className={`relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-[24px] bg-[color:var(--fill)] ${compact ? 'mt-3 max-w-[calc(44dvh*0.8)]' : ''}`}>
      {main && <img src={main} alt="Foto de tu producto" className="h-full w-full object-cover" />}
      {changeButton}
    </div>
  );

  return (
    <FlowShell
      title="Tu producto"
      leading={{ kind: 'back', onPress: onBack }}
      progress={1 / 3}
      steps={{ labels: PRODUCT_FLOW_STEPS, current: 0 }}
      aside={stage}
      onEnter={canContinue ? onContinue : undefined}
      onDropFile={dropImage ? (file) => dropImage(file, (img) => setSlot(0, img)) : undefined}
      actions={<PrimaryButton onClick={onContinue} disabled={!canContinue}>Continuar</PrimaryButton>}
    >
      <LargeTitle>Tu producto</LargeTitle>

      {compact && (
        <>
          {photo}
          {brightnessNote}
          {nameField}
          {details}
        </>
      )}

      {/* Tableta: foto y campos lado a lado */}
      {layout === 'regular' && (
        <div className="mt-4 grid grid-cols-2 items-start gap-8">
          <div>
            {photo}
            {brightnessNote}
          </div>
          <div className="-mt-5">
            {nameField}
            {details}
          </div>
        </div>
      )}

      {wide && (
        <>
          {nameField}
          <div className="mt-6">{descField(false)}</div>
        </>
      )}
    </FlowShell>
  );
};
