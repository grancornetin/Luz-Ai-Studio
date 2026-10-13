// Vista previa SOLO de desarrollo (import.meta.env.DEV): muestra cada pantalla
// del flujo de Fotos de producto con datos de ejemplo, sin login ni escrituras.
// Uso: /__preview/producto?s=entry|product|style|review|generating|results|library|catalog&n=4
// Extras: &sheet=1 (Más opciones abierta en review) · &empty=1 · &fail=1 · &err=1
//         &saveerr=1 · &done=N (generating) · &collage=1 · &frame=0 (sin marco de la app)
// El marco imita al de App.tsx (fondo, padding de <main>, botón de menú) para
// que las capturas de tableta y computador muestren el ancho real.
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { EntryStep } from '../modules/productGenerator/flow/EntryStep';
import { ProductStep } from '../modules/productGenerator/flow/ProductStep';
import { StyleStep } from '../modules/productGenerator/flow/StyleStep';
import { ReviewStep } from '../modules/productGenerator/flow/ReviewStep';
import { GeneratingStep } from '../modules/productGenerator/flow/GeneratingStep';
import { ResultsStep } from '../modules/productGenerator/flow/ResultsStep';
import { LibraryStep } from '../modules/productGenerator/flow/LibraryStep';
import { CatalogSheet } from '../modules/productGenerator/flow/CatalogSheet';
import { STYLE_OPTIONS } from '../modules/productGenerator/flow/styleOptions';
import { INITIAL_WIZARD_STATE, type WizardState } from '../modules/productGenerator/wizardTypes';
import type { ModelId } from '../services/imageApiService';
import type { ProductProfile } from '../types';

const noop = () => {};
const imgs = STYLE_OPTIONS.map((s) => s.img);
const NAMES = ['Botella térmica verde', 'Vela de soya', 'Crema de manos', 'Aros dorados', 'Bolso de lino', 'Taza de cerámica', 'Jabón de avena'];
const fakeProducts = (count: number): ProductProfile[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i),
    name: NAMES[i % NAMES.length],
    baseImages: [imgs[i % imgs.length]],
    generatedImages: Array.from({ length: (i % 3) + 2 }, (_, k) => imgs[(i + k) % imgs.length]),
    metadata: { style: STYLE_OPTIONS[i % STYLE_OPTIONS.length].id },
    createdAt: Date.now(),
  }) as unknown as ProductProfile);

const Frame: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) =>
  on ? (
    <div data-app-frame className="flex min-h-screen bg-slate-50 overflow-x-hidden">
      <div className="fixed top-5 left-5 z-[60] hidden md:block">
        <button type="button" aria-label="Menú" className="w-11 h-11 bg-white border border-slate-100 rounded-2xl shadow-xl flex items-center justify-center text-slate-600">
          <Menu size={20} />
        </button>
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <main data-app-main className="flex-1 p-4 md:py-10 md:pl-[88px] md:pr-24 overflow-x-hidden pb-24 md:pb-10">{children}</main>
      </div>
    </div>
  ) : <>{children}</>;

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
  const collage = params.get('collage') ? imgs[2] : null;

  let view: React.ReactNode;
  switch (screen) {
    case 'product':
      view = <ProductStep state={wizard.product} onChange={(p) => setWizard({ ...wizard, product: p })} pickImage={noop} dropImage={noop} onBack={noop} onContinue={noop} />;
      break;
    case 'style':
      view = (
        <StyleStep state={wizard.style} pickImage={noop} onPickStyle={(s) => setWizard({ ...wizard, style: { referenceImg: null, preset: s } })} onPickReference={noop} onBack={noop}
          productImg={wizard.product.slots[0]} productTitle={wizard.product.title} />
      );
      break;
    case 'review':
      view = (
        <ReviewStep wizard={wizard} finalCount={4} cost={8} creditsAvailable={125} isAdmin={false} modelId={model} onModelChange={setModel}
          onChange={setWizard} onEditProduct={noop} onEditStyle={noop} onBack={noop} onCreate={noop} initialOptionsOpen={!!params.get('sheet')}
          error={params.get('err') ? 'No pudimos crear tus fotos por un error. Ya te devolvimos los créditos.' : null} />
      );
      break;
    case 'generating':
      view = (
        <GeneratingStep shots={shots.map((s, i) => (i < Number(params.get('done') ?? 1) ? s : ''))} collage={null} withCollage={!!collage}
          aspectClass="aspect-[3/4]" statusText="Creando tus 4 fotos…" running onExit={noop} />
      );
      break;
    case 'results':
      view = (
        <ResultsStep productTitle="Botella térmica verde" styleLabel="Natural" shots={shots} collage={collage} aspectClass="aspect-[3/4]"
          retryingIndices={[]} isRetrying={false} isSavingToDevice={false} saveState={params.get('saveerr') ? 'error' : 'saved'}
          onRetrySave={noop} onRetryFailed={noop} onOpen={noop} onDownload={noop} onSaveToDevice={noop}
          onUseWithAvatar={noop} onMakeCampaign={noop} onOtherStyle={noop} onOtherProduct={noop} onDone={noop} />
      );
      break;
    case 'library':
      view = <LibraryStep products={params.get('empty') ? [] : fakeProducts(n)} styleLabelOf={() => 'Natural'} onBack={noop} onCreate={noop} onOpen={noop} />;
      break;
    case 'catalog':
      view = (
        <>
          <EntryStep defaultCost={8} creditsAvailable={125} hasCatalog isPicking={false} onUpload={noop} onUseCatalog={noop} onOpenCatalog={noop} onClose={noop} onDropPhoto={noop} />
          <CatalogSheet open products={fakeProducts(n)} onPick={noop} onClose={noop} />
        </>
      );
      break;
    default:
      view = <EntryStep defaultCost={8} creditsAvailable={125} hasCatalog isPicking={false} onUpload={noop} onUseCatalog={noop} onOpenCatalog={noop} onClose={noop} onDropPhoto={noop} />;
  }

  return <Frame on={params.get('frame') !== '0'}>{view}</Frame>;
};

export default ProductFlowPreview;
