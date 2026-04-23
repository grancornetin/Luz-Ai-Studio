/**
 * ImageSlot.tsx — UPDATED
 * Punto 4: iconos visuales contextuales según el tipo de slot.
 * Cada slot ahora comunica claramente qué debe subirse.
 */
import React, { useRef, useState } from 'react';
import { Upload, X, RefreshCw, User, Package, Shirt, Palette, Image as ImageIcon, Camera, Layers } from 'lucide-react';
import { readAndCompressFile } from '../../utils/imageUtils';
import UploadConsentModal from './UploadConsentModal';
import { getAuth } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

const CONSENT_LS_KEY = 'luz_upload_consent_v1';

function hasConsented(): boolean {
  try { return !!localStorage.getItem(CONSENT_LS_KEY); } catch { return false; }
}

async function saveConsentToFirestore() {
  try {
    const user = getAuth().currentUser;
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'consents', 'uploadTerms'), {
      accepted:   true,
      acceptedAt: serverTimestamp(),
      version:    'v1',
      userAgent:  navigator.userAgent,
    }, { merge: true });
    localStorage.setItem(CONSENT_LS_KEY, new Date().toISOString());
  } catch { /* no bloquear la UI si falla */ }
}

export type SlotType =
  | 'person'      // foto de persona / modelo
  | 'product'     // foto de producto
  | 'outfit'      // foto de outfit / prendas
  | 'style'       // imagen de referencia de estilo
  | 'scene'       // foto de escena / fondo
  | 'face'        // close-up de rostro
  | 'body'        // foto de cuerpo completo
  | 'generic';    // sin tipo específico

interface SlotConfig {
  icon: React.ReactNode;
  label: string;
  hint: string;
  color: string;
  bgColor: string;
}

const SLOT_CONFIGS: Record<SlotType, SlotConfig> = {
  person: {
    icon: <User className="w-7 h-7" strokeWidth={1.5} />,
    label: 'Persona',
    hint: 'Foto de persona o modelo',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-50/60 hover:bg-indigo-50 hover:border-indigo-300',
  },
  product: {
    icon: <Package className="w-7 h-7" strokeWidth={1.5} />,
    label: 'Producto',
    hint: 'Foto de tu producto',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-50/60 hover:bg-emerald-50 hover:border-emerald-300',
  },
  outfit: {
    icon: <Shirt className="w-7 h-7" strokeWidth={1.5} />,
    label: 'Outfit',
    hint: 'Foto del outfit o prenda',
    color: 'text-purple-400',
    bgColor: 'bg-purple-50/60 hover:bg-purple-50 hover:border-purple-300',
  },
  style: {
    icon: <Palette className="w-7 h-7" strokeWidth={1.5} />,
    label: 'Estilo',
    hint: 'Imagen de referencia de estilo',
    color: 'text-amber-400',
    bgColor: 'bg-amber-50/60 hover:bg-amber-50 hover:border-amber-300',
  },
  scene: {
    icon: <Layers className="w-7 h-7" strokeWidth={1.5} />,
    label: 'Escena',
    hint: 'Foto de escena o fondo',
    color: 'text-blue-400',
    bgColor: 'bg-blue-50/60 hover:bg-blue-50 hover:border-blue-300',
  },
  face: {
    icon: <Camera className="w-7 h-7" strokeWidth={1.5} />,
    label: 'Rostro',
    hint: 'Close-up del rostro',
    color: 'text-rose-400',
    bgColor: 'bg-rose-50/60 hover:bg-rose-50 hover:border-rose-300',
  },
  body: {
    icon: <User className="w-7 h-7" strokeWidth={1.5} />,
    label: 'Cuerpo',
    hint: 'Foto de cuerpo completo',
    color: 'text-violet-400',
    bgColor: 'bg-violet-50/60 hover:bg-violet-50 hover:border-violet-300',
  },
  generic: {
    icon: <Upload className="w-7 h-7" strokeWidth={1.5} />,
    label: 'Imagen',
    hint: 'Haz click para subir',
    color: 'text-slate-400',
    bgColor: 'bg-slate-50/60 hover:bg-slate-50 hover:border-slate-300',
  },
};

interface ImageSlotProps {
  value: string | null;
  onChange: (base64: string | null) => void;
  label?: string;
  hint?: string;
  slotType?: SlotType;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  required?: boolean;
  disabled?: boolean;
  className?: string;
  iconless?: boolean;   // oculta el ícono y muestra solo texto centrado (para slots pequeños)
}

const aspectClasses = {
  square:   'aspect-square',
  video:    'aspect-video',
  portrait: 'aspect-[3/4]',
  auto:     'aspect-auto',
};

export const ImageSlot: React.FC<ImageSlotProps> = ({
  value,
  onChange,
  label,
  hint,
  slotType = 'generic',
  aspectRatio = 'square',
  required = false,
  disabled = false,
  className = '',
  iconless = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [isDragging, setIsDragging]     = useState(false);
  const [showConsent, setShowConsent]   = useState(false);

  const config = SLOT_CONFIGS[slotType];

  const processFile = async (file: File) => {
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (hasConsented()) {
      await processFile(file);
    } else {
      pendingFileRef.current = file;
      setShowConsent(true);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (hasConsented()) {
      await processFile(file);
    } else {
      pendingFileRef.current = file;
      setShowConsent(true);
    }
  };

  const handleConsentAccept = async () => {
    setShowConsent(false);
    await saveConsentToFirestore();
    if (pendingFileRef.current) {
      await processFile(pendingFileRef.current);
      pendingFileRef.current = null;
    }
  };

  const handleConsentCancel = () => {
    setShowConsent(false);
    pendingFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <>
    {showConsent && (
      <UploadConsentModal onAccept={handleConsentAccept} onCancel={handleConsentCancel} />
    )}
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        onClick={() => !disabled && fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative group w-full overflow-hidden rounded-2xl border-2 transition-all
          ${value
            ? 'border-slate-200 bg-slate-50'
            : `border-dashed ${isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'} ${config.bgColor} cursor-pointer`
          }
          ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
          ${aspectClasses[aspectRatio]}
        `}
      >
        {value ? (
          <>
            <img
              src={value}
              alt={label || 'Preview'}
              className="w-full h-full object-cover"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="p-3 bg-white rounded-full text-slate-700 hover:bg-slate-100 transition-colors shadow-lg"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <RefreshCw size={20} />
              </button>
              <button
                onClick={handleClear}
                className="p-3 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors shadow-lg"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <X size={20} />
              </button>
            </div>
            {/* Mobile clear button */}
            <button
              onClick={handleClear}
              className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white shadow-md md:hidden"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <X size={18} />
            </button>
            {isLoading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center select-none">
            {isLoading ? (
              <div className="w-6 h-6 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
            ) : iconless ? (
              // Modo solo texto — para slots pequeños como los del Content Studio
              <>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wide leading-tight px-1">
                  {label || hint || config.hint}
                </p>
                <p className="text-[8px] text-slate-300 font-medium">
                  {isDragging ? 'Suelta ↓' : 'Click'}
                </p>
              </>
            ) : (
              <>
                {/* Contextual icon */}
                <div className={`${config.color} transition-transform duration-200 group-hover:scale-110`}>
                  {config.icon}
                </div>

                {/* Label */}
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    {hint || config.hint}
                  </p>
                  <p className="text-[9px] text-slate-400 font-medium">
                    {isDragging ? 'Suelta aquí ↓' : 'Click o arrastra'}
                  </p>
                </div>
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
    </div>
    </>
  );
};

export default ImageSlot;