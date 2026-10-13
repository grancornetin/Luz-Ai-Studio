// Mi catálogo: los productos guardados.
// Celular: 2 columnas y barra de acción. Tableta: 3 columnas. Computador:
// columnas automáticas a todo el ancho; el botón principal va en la barra
// superior, como en una app de fotos de escritorio.
import React from 'react';
import { Package, Plus } from 'lucide-react';
import type { ProductProfile } from '../../../types';
import { FlowShell } from '../../../components/shared/flow/FlowShell';
import { LargeTitle, PrimaryButton } from '../../../components/shared/flow/primitives';
import { useFlowLayout } from '../../../components/shared/flow/layout';

interface LibraryStepProps {
  products: ProductProfile[];
  /** "Natural", "Premium"… del estilo con que se crearon. */
  styleLabelOf: (product: ProductProfile) => string;
  onBack: () => void;
  onCreate: () => void;
  onOpen: (product: ProductProfile) => void;
}

export const LibraryStep: React.FC<LibraryStepProps> = ({ products, styleLabelOf, onBack, onCreate, onOpen }) => {
  const layout = useFlowLayout();
  const compact = layout === 'compact';
  const empty = products.length === 0;
  const createButton = (
    <PrimaryButton onClick={onCreate} icon={<Plus size={compact ? 20 : 18} />}>
      Crear fotos de un producto
    </PrimaryButton>
  );

  const grid = compact
    ? 'mt-4 grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4'
    : layout === 'regular'
      ? 'mt-5 grid grid-cols-3 gap-x-4 gap-y-6'
      : 'mt-6 grid grid-cols-[repeat(auto-fill,minmax(208px,1fr))] gap-x-5 gap-y-7';

  return (
    <FlowShell
      title="Mi catálogo"
      wide
      layout="gallery"
      leading={{ kind: 'back', onPress: onBack }}
      // Fuera del celular, con el catálogo vacío el botón va al centro, no arriba.
      actions={compact || !empty ? createButton : undefined}
    >
      <LargeTitle subtitle={!empty ? `${products.length} ${products.length === 1 ? 'producto' : 'productos'}` : undefined}>
        Mi catálogo
      </LargeTitle>
      {empty ? (
        <div className={`flex flex-col items-center text-center ${compact ? 'mt-10' : 'mt-[12vh]'}`}>
          <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[color:var(--tint)] text-[color:var(--action)]">
            <Package size={26} />
          </span>
          <p className="mt-4 text-[17px] font-semibold">Todavía no hay productos</p>
          <p className="mt-1 max-w-[30ch] text-[15px] leading-5 text-[color:var(--text-2)]">Crea las fotos de tu primer producto y quedarán guardadas aquí.</p>
          {!compact && <div className="mt-6 w-full max-w-[340px]">{createButton}</div>}
        </div>
      ) : (
        <div className={grid}>
          {products.map((product) => {
            const cover = (product.generatedImages ?? []).find(Boolean);
            const n = product.generatedImages?.length ?? 0;
            return (
              <button key={product.id} type="button" onClick={() => onOpen(product)} className="flow-press flow-card text-left">
                <span className="block aspect-[4/5] overflow-hidden rounded-[16px] bg-[color:var(--fill)]">
                  {cover && <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </span>
                <span className="mt-2 block truncate text-[15px] font-semibold">{product.name}</span>
                <span className="block text-[13px] tracking-normal text-[color:var(--text-2)]">
                  {n} {n === 1 ? 'foto' : 'fotos'} · {styleLabelOf(product)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </FlowShell>
  );
};
