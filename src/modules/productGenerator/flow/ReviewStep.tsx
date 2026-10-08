// Revisa y crea: el control antes de cobrar. Lo común ya viene marcado;
// lo experto vive en la hoja "Más opciones".
import React, { useState } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import type { ModelId } from '../../../services/imageApiService';
import type { WizardState, PackCount } from '../wizardTypes';
import type { ProductGridType, ProductObjective } from '../productDirectorService';
import { STYLE_OPTIONS, USE_OPTIONS, styleTitle } from './styleOptions';
import { FlowShell } from '../../../components/shared/flow/FlowShell';
import {
  ActionCaption, BottomSheet, ChoiceList, FieldLabel, Footnote, GroupedList, GroupedRow, InlineBanner,
  LargeTitle, PrimaryButton, SegmentedControl, Switch, TextButton,
} from '../../../components/shared/flow/primitives';

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
  error?: string | null;
  disabled?: boolean;
}

const QUALITY: { value: ModelId; label: string; hint: string }[] = [
  { value: 'gemini',   label: 'Mayor fidelidad', hint: 'Tu producto sale igualito.' },
  { value: 'gptimage', label: 'Más creativa',    hint: 'Más libertad con la escena.' },
];

const GRID_OPTIONS: { value: ProductGridType; label: string }[] = [
  { value: '1x2', label: '2' },
  { value: '2x2', label: '4' },
  { value: '3x3', label: '9' },
];

export const ReviewStep: React.FC<ReviewStepProps> = ({
  wizard, finalCount, cost, creditsAvailable, isAdmin, modelId, onModelChange,
  onChange, onEditProduct, onEditStyle, onBack, onCreate, error, disabled,
}) => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const hasRef = !!wizard.style.referenceImg;
  const isCollage = !hasRef && wizard.type.mode === 'grid';
  const styleImg = hasRef ? wizard.style.referenceImg! : STYLE_OPTIONS.find((s) => s.id === wizard.style.preset)?.img;
  const setType = (patch: Partial<WizardState['type']>) => onChange({ ...wizard, type: { ...wizard.type, ...patch } });
  const left = creditsAvailable - cost;
  const createLabel = isCollage
    ? `Crear collage de ${finalCount} fotos`
    : finalCount === 1 ? 'Crear mi foto' : `Crear mis ${finalCount} fotos`;

  const thumb = (src?: string | null) => (
    <span className="my-2 block h-[60px] w-12 overflow-hidden rounded-[8px] bg-white">
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
    </span>
  );

  return (
    <FlowShell
      title="Todo listo"
      leading={{ kind: 'back', onPress: onBack }}
      progress={1}
      actions={
        <>
          <PrimaryButton onClick={onCreate} disabled={disabled}>{createLabel}</PrimaryButton>
          <ActionCaption>
            {isAdmin ? 'Sin costo (admin)' : left < 0 ? `${cost} créditos · te faltan ${-left}` : `${cost} créditos · te quedan ${left}`}
          </ActionCaption>
        </>
      }
    >
      <LargeTitle>Todo listo</LargeTitle>
      {error && (
        <div className="mt-3">
          <InlineBanner tone="danger" icon={<AlertCircle size={20} />}>{error}</InlineBanner>
        </div>
      )}

      <GroupedList className="mt-4">
        <GroupedRow
          inset={12}
          leading={thumb(wizard.product.slots[0])}
          title={wizard.product.title || 'Tu producto'}
          subtitle="Producto"
          trailing={<TextButton onClick={onEditProduct} className="-mr-2 text-[15px]">Cambiar</TextButton>}
        />
        <GroupedRow
          inset={12}
          last
          leading={thumb(styleImg)}
          title={hasRef ? 'Tu foto de inspiración' : styleTitle(wizard.style.preset)}
          subtitle="Estilo"
          trailing={<TextButton onClick={onEditStyle} className="-mr-2 text-[15px]">Cambiar</TextButton>}
        />
      </GroupedList>

      <div className="mt-8">
        <FieldLabel>{isCollage ? '¿Cuántas fotos en el collage?' : '¿Cuántas fotos?'}</FieldLabel>
        {hasRef ? (
          <SegmentedControl
            ariaLabel="Cantidad de fotos"
            options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]}
            value={wizard.type.refCount}
            onChange={(v) => setType({ refCount: v as 1 | 2 })}
          />
        ) : isCollage ? (
          <SegmentedControl
            ariaLabel="Fotos en el collage"
            options={GRID_OPTIONS}
            value={wizard.type.gridSize}
            onChange={(v) => setType({ gridSize: v })}
          />
        ) : (
          <SegmentedControl
            ariaLabel="Cantidad de fotos"
            options={([1, 2, 4, 6] as PackCount[]).map((n) => ({ value: n, label: String(n) }))}
            value={wizard.type.packCount}
            onChange={(v) => setType({ packCount: v as PackCount })}
          />
        )}
        {hasRef && <Footnote className="mt-2">Con foto de inspiración se crean hasta 2, muy fieles a esa foto.</Footnote>}
        {isCollage && <Footnote className="mt-2">Recibes cada foto por separado y además el collage con todas.</Footnote>}
      </div>

      <div className="mt-8">
        <FieldLabel>¿Dónde las vas a usar?</FieldLabel>
        <ChoiceList
          options={USE_OPTIONS.map((u) => ({ value: u.id, title: u.title, hint: u.hint === 'vertical' ? 'Foto vertical' : 'Foto cuadrada' }))}
          value={wizard.goal}
          onChange={(v) => onChange({ ...wizard, goal: v as ProductObjective })}
        />
      </div>

      <GroupedList className="mt-8">
        <GroupedRow
          last
          onPress={() => setOptionsOpen(true)}
          chevron
          title="Más opciones"
          trailing={<span className="text-[16px] text-[color:var(--text-2)]">{QUALITY.find((q) => q.value === modelId)?.label}</span>}
        />
      </GroupedList>

      <Footnote className="mt-4" icon={<ShieldCheck size={15} />}>
        Si alguna foto no se logra crear por un error, te devolvemos sus créditos automáticamente.
      </Footnote>

      <BottomSheet open={optionsOpen} onClose={() => setOptionsOpen(false)} title="Más opciones">
        <FieldLabel>Calidad</FieldLabel>
        <SegmentedControl
          ariaLabel="Calidad"
          options={QUALITY.map((q) => ({ value: q.value, label: q.label }))}
          value={modelId}
          onChange={onModelChange}
        />
        <Footnote className="mt-2">{QUALITY.find((q) => q.value === modelId)?.hint}</Footnote>
        {!hasRef && (
          <GroupedList className="mt-6">
            <GroupedRow
              last
              title="Collage además de las fotos"
              subtitle="Todas juntas en una imagen · +1 crédito"
              trailing={<Switch checked={isCollage} onChange={(on) => setType({ mode: on ? 'grid' : 'pack' })} label="Collage" />}
            />
          </GroupedList>
        )}
        <PrimaryButton className="mt-6" onClick={() => setOptionsOpen(false)}>Listo</PrimaryButton>
      </BottomSheet>
    </FlowShell>
  );
};
