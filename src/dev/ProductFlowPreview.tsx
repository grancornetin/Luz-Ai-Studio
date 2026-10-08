// Vista previa SOLO de desarrollo (import.meta.env.DEV): muestra cada pantalla
// del flujo de Fotos de producto con datos de ejemplo, sin login ni escrituras.
// Uso: /__preview/producto?s=entry|product|style|review|generating|results&n=4
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EntryStep } from '../modules/productGenerator/flow/EntryStep';
import { ProductStep } from '../modules/productGenerator/flow/ProductStep';
import { StyleStep } from '../modules/productGenerator/flow/StyleStep';
import { ReviewStep } from '../modules/productGenerator/flow/ReviewStep';
import { GeneratingStep } from '../modules/productGenerator/flow/GeneratingStep';
import { ResultsStep } from '../modules/productGenerator/flow/ResultsStep';
import { STYLE_OPTIONS } from '../modules/productGenerator/flow/styleOptions';
import { INITIAL_WIZARD_STATE, type WizardState } from '../modules/productGenerator/wizardTypes';
import type { ModelId } from '../services/imageApiService';

const noop = () => {};
const imgs = STYLE_OPTIONS.map((s) => s.img);

const ProductFlowPreview: React.FC = () => {
  const [params] = useSearchParams();
  const screen = params.get('s') ?? 'entry';
  const n = Number(params.get('n') ?? 4);
  const [wizard, setWizard] = useState<WizardState>({
    ...INITIAL_WIZARD_STATE,
    product: { title: params.get('empty') ? '' : 'Botella térmica verde', desc: '', slots: [imgs[3], null, null, null] },
    style: { referenceImg: null, preset: 'natural' },
  });
  const [model, setModel] = useState<ModelId>('gemini');
  const shots = Array.from({ length: n }, (_, i) => (params.get('fail') && i === 1 ? 'error' : imgs[[4, 0, 2, 3, 1][i % 5]]));

  switch (screen) {
    case 'product':
      return <ProductStep state={wizard.product} onChange={(p) => setWizard({ ...wizard, product: p })} pickImage={noop} onBack={noop} onContinue={noop} />;
    case 'style':
      return <StyleStep state={wizard.style} pickImage={noop} onPickStyle={(s) => setWizard({ ...wizard, style: { referenceImg: null, preset: s } })} onPickReference={noop} onBack={noop} />;
    case 'review':
      return (
        <ReviewStep wizard={wizard} finalCount={4} cost={8} creditsAvailable={125} isAdmin={false} modelId={model} onModelChange={setModel}
          onChange={setWizard} onEditProduct={noop} onEditStyle={noop} onBack={noop} onCreate={noop}
          error={params.get('err') ? 'No pudimos crear tus fotos por un error. Ya te devolvimos los créditos.' : null} />
      );
    case 'generating':
      return <GeneratingStep shots={shots.map((s, i) => (i < Number(params.get('done') ?? 1) ? s : ''))} withCollage={false} aspectClass="aspect-[3/4]" statusText="Creando tus 4 fotos…" running onExit={noop} />;
    case 'results':
      return (
        <ResultsStep productTitle="Botella térmica verde" styleLabel="Natural" shots={shots} collage={null} aspectClass="aspect-[3/4]"
          retryingIndices={[]} isRetrying={false} isSavingToDevice={false} saveState={params.get('saveerr') ? 'error' : 'saved'}
          onRetrySave={noop} onRetryFailed={noop} onOpen={noop} onDownload={noop} onSaveToDevice={noop}
          onUseWithAvatar={noop} onMakeCampaign={noop} onOtherStyle={noop} onOtherProduct={noop} onDone={noop} />
      );
    default:
      return <EntryStep defaultCost={8} creditsAvailable={125} hasCatalog isPicking={false} onUpload={noop} onUseCatalog={noop} onOpenCatalog={noop} onClose={noop} />;
  }
};

export default ProductFlowPreview;
