// Hoja inferior para partir desde un producto ya guardado en el catálogo.
import React from 'react';
import type { ProductProfile } from '../../../types';
import { BottomSheet } from '../../../components/shared/flow/primitives';

interface CatalogSheetProps {
  open: boolean;
  products: ProductProfile[];
  onPick: (product: ProductProfile) => void;
  onClose: () => void;
}

export const CatalogSheet: React.FC<CatalogSheetProps> = ({ open, products, onPick, onClose }) => (
  <BottomSheet open={open} onClose={onClose} title="Elige un producto">
    <div className="grid grid-cols-2 gap-x-3 gap-y-4 pb-2 md:grid-cols-3">
      {products.map((p) => {
        const cover = p.generatedImages?.find(Boolean) ?? p.baseImages?.find(Boolean);
        return (
          <button key={p.id} type="button" onClick={() => onPick(p)} className="flow-press text-left">
            <span className="block aspect-[4/5] overflow-hidden rounded-[16px] bg-[color:var(--fill)]">
              {cover && <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />}
            </span>
            <span className="mt-2 block truncate text-[15px] font-semibold">{p.name}</span>
          </button>
        );
      })}
    </div>
  </BottomSheet>
);
