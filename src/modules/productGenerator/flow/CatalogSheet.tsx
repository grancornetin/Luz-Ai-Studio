// Hoja inferior para partir desde un producto ya guardado en el catálogo.
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { ProductProfile } from '../../../types';

interface CatalogSheetProps {
  products: ProductProfile[];
  onPick: (product: ProductProfile) => void;
  onClose: () => void;
}

export const CatalogSheet: React.FC<CatalogSheetProps> = ({ products, onPick, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[950] flex items-end md:items-center justify-center bg-slate-900/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Elige un producto de tu catálogo"
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-lg max-h-[80vh] overflow-y-auto rounded-t-[28px] md:rounded-[28px] bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" />
        <div className="flex items-center justify-between mb-3">
          <b className="text-base text-slate-900">Tu catálogo</b>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {products.map((p) => {
            const cover = p.generatedImages?.find(Boolean) ?? p.baseImages?.find(Boolean);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p)}
                className="text-left rounded-[18px] overflow-hidden border border-slate-200 bg-white active:scale-[0.97] transition-transform duration-150"
              >
                <span className="block aspect-[4/5] bg-slate-200">
                  {cover && <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />}
                </span>
                <span className="block px-2.5 py-2 text-[13px] font-semibold text-slate-900 truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
};
