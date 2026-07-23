import React, { useRef, useState } from 'react';
import { Upload, X, Check, AlertCircle, Image } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../../firebase';
import type { BrandAsset } from '../types';

interface Props {
  userId: string;
  brandId: string;
  assets: BrandAsset[];
  onChange: (assets: BrandAsset[]) => void;
  allowedTypes?: BrandAsset['type'][];
  maxAssets?: number;
  label?: string;
  hint?: string;
  assetType?: BrandAsset['type'];
}

const TYPE_LABELS: Record<BrandAsset['type'], string> = {
  logo:           'Logo principal',
  alternateLogo:  'Logo alternativo',
  icon:           'Isotipo / Ícono',
  palette:        'Paleta exportada',
  typography:     'Tipografía / fuente',
  packaging:      'Packaging',
  reference:      'Referencia visual',
  manual:         'Manual de marca',
  other:          'Otro recurso',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

interface AssetCardProps {
  asset: BrandAsset;
  onRemove: () => void;
}

function AssetCard({ asset, onRemove }: AssetCardProps) {
  const isImage = asset.mimeType.startsWith('image/');
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {isImage ? (
          <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <Image size={20} className="text-slate-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-700 truncate">{asset.name}</p>
        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{TYPE_LABELS[asset.type]}</p>
        {asset.notes && <p className="text-[10px] text-slate-400 italic truncate">{asset.notes}</p>}
      </div>
      <button
        onClick={onRemove}
        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0"
        title="Eliminar asset"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export const BrandAssetUploader: React.FC<Props> = ({
  userId,
  brandId,
  assets,
  onChange,
  allowedTypes,
  maxAssets = 20,
  label = 'Subir archivo',
  hint = 'PNG, JPG, SVG o PDF',
  assetType = 'other',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (assets.length >= maxAssets) {
      setError(`Máximo ${maxAssets} archivos permitidos.`);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    const file = files[0];

    // Tamaño máximo 10 MB
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo no debe superar 10 MB.');
      setUploading(false);
      return;
    }

    const folder = assetType === 'logo' || assetType === 'alternateLogo' || assetType === 'icon'
      ? 'logos'
      : 'assets';

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `users/${userId}/brandProfiles/${brandId}/${folder}/${Date.now()}_${sanitizedName}`;
    const storageRef = ref(storage, storagePath);

    try {
      const task = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          resolve,
        );
      });

      const url = await getDownloadURL(storageRef);

      const newAsset: BrandAsset = {
        id:         String(Date.now()),
        type:       assetType,
        name:       file.name,
        url,
        path:       storagePath,
        fileName:   file.name,
        mimeType:   file.type,
        uploadedAt: Date.now(),
      };

      onChange([...assets, newAsset]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('[BrandAssetUploader] upload error:', err);
      setError('No se pudo subir el archivo. Verifica tu conexión e inténtalo de nuevo.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (asset: BrandAsset) => {
    // Eliminar referencia del array (UI inmediata)
    onChange(assets.filter(a => a.id !== asset.id));

    // Intentar eliminar de Storage — si falla, el path quedó en Firestore para reintentos futuros
    // TODO: implementar borrado en Storage en fase 2 si el archivo sigue accesible
    if (asset.path) {
      try {
        await deleteObject(ref(storage, asset.path));
      } catch {
        // No romper la UI — el archivo ya no se ve en el perfil
        console.warn('[BrandAssetUploader] No se pudo eliminar el archivo de Storage:', asset.path);
      }
    }
  };

  const filteredAssets = allowedTypes
    ? assets.filter(a => allowedTypes.includes(a.type))
    : assets;

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          uploading
            ? 'border-[#F72C5B] bg-rose-50'
            : 'border-slate-200 bg-slate-50 hover:border-[#F72C5B] hover:bg-rose-50/30'
        }`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.svg"
          onChange={e => handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <>
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <Upload size={18} className="text-[#F72C5B] animate-bounce" />
              </div>
              <p className="text-xs font-bold text-[#F72C5B]">Subiendo... {progress}%</p>
              <div className="w-full max-w-40 h-1.5 bg-rose-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, background: '#F72C5B' }}
                />
              </div>
            </>
          ) : success ? (
            <>
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Check size={18} className="text-green-600" />
              </div>
              <p className="text-xs font-bold text-green-600">Archivo guardado.</p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <Upload size={18} className="text-slate-500" />
              </div>
              <p className="text-xs font-bold text-slate-700">{label}</p>
              <p className="text-[10px] text-slate-400">{hint} · Máx. 10 MB</p>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl">
          <AlertCircle size={14} className="text-rose-500 flex-shrink-0" />
          <p className="text-xs text-rose-600">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Lista de assets */}
      {filteredAssets.length > 0 && (
        <div className="space-y-2">
          {filteredAssets.map(asset => (
            <AssetCard key={asset.id} asset={asset} onRemove={() => handleRemove(asset)} />
          ))}
        </div>
      )}
    </div>
  );
};
