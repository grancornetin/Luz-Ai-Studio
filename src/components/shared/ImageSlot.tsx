import React, { useRef, useState } from 'react';
import { Upload, X, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { readAndCompressFile } from '../../utils/imageUtils';

interface ImageSlotProps {
  value: string | null;
  onChange: (base64: string | null) => void;
  label?: string;
  hint?: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

const aspectClasses = {
  square: 'aspect-square',
  video: 'aspect-video',
  portrait: 'aspect-[3/4]',
  auto: 'aspect-auto',
};

export const ImageSlot: React.FC<ImageSlotProps> = ({
  value,
  onChange,
  label,
  hint,
  aspectRatio = 'square',
  required = false,
  disabled = false,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const compressed = await readAndCompressFile(file);
      onChange(compressed);
    } catch (error) {
      console.error('Error al procesar la imagen:', error);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleChangeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleEmptyClick = () => {
    if (!disabled) fileInputRef.current?.click();
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        onClick={handleEmptyClick}
        className={`
          relative group w-full overflow-hidden rounded-2xl border-2 transition-all
          ${value
            ? 'border-slate-200 bg-slate-50'
            : 'border-dashed border-slate-300 bg-slate-50/50 hover:border-brand-400 hover:bg-slate-50 cursor-pointer'
          }
          ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
          ${aspectClasses[aspectRatio]}
        `}
      >
        {value ? (
          <>
            {/* Imagen preview */}
            <img
              src={value}
              alt={label || 'Preview'}
              className="w-full h-full object-cover"
            />

            {/* Overlay hover (desktop) + siempre visible en mobile? No: usamos md:opacity-0 para que en mobile sea visible siempre */}
            <div className="absolute inset-0 bg-black/50 opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                onClick={handleChangeClick}
                className="p-3 bg-white rounded-full text-slate-700 hover:bg-slate-100 transition-colors shadow-lg"
                aria-label="Cambiar imagen"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <RefreshCw size={20} />
              </button>
              <button
                onClick={handleClear}
                className="p-3 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors shadow-lg"
                aria-label="Eliminar imagen"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Botón de borrado SIEMPRE visible en mobile (no usa md: prefijo) */}
            <button
              onClick={handleClear}
              className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white shadow-md md:hidden"
              aria-label="Eliminar imagen"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <X size={18} />
            </button>

            {/* Indicador de carga (si se está reemplazando) */}
            {isLoading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            {isLoading ? (
              <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-400" strokeWidth={1.5} />
                <div className="text-sm font-medium text-slate-500">
                  {hint || 'Click para subir imagen'}
                </div>
                {!hint && (
                  <div className="text-[10px] text-slate-400">
                    JPG, PNG • max 1024px
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {hint && !value && (
        <p className="text-[10px] text-slate-400 mt-1.5">{hint}</p>
      )}
    </div>
  );
};