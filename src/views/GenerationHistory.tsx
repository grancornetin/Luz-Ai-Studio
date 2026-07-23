import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  generationHistoryService,
  GenerationRecord,
  MODULE_LABELS,
} from '../services/generationHistoryService';
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  Download,
  DownloadCloud,
  Image,
  Loader2,
  PackagePlus,
  RefreshCw,
  Square,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { downloadAsZip } from '../utils/imageUtils';
import { ImageLightbox } from '../components/shared/ImageLightbox';
import { FloatingActionBar } from '../components/shared/FloatingActionBar';
import { AddToProjectButton } from '../components/shared/AddToProjectButton';
import { useScrollFAB } from '../hooks/useScrollFAB';
import { dbService } from '../services/dbService';
import type { AvatarProfile, ProductProfile } from '../types';

const timeAgo = (isoDate: string): string => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days}d`;
};

const downloadImage = (img: string, index: number) => {
  const link = document.createElement('a');
  link.href = img;
  link.download = `luzIA_${index + 1}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const isModelRecord = (record: GenerationRecord): boolean =>
  record.module.includes('model_dna') ||
  record.module.includes('avatar') ||
  record.moduleLabel.toLowerCase().includes('model dna');

const readableName = (record: GenerationRecord): string => {
  const fromMetadata = record.metadata?.name || record.metadata?.productTitle || record.metadata?.title;
  if (fromMetadata) return String(fromMetadata);
  const label = MODULE_LABELS[record.module] || record.moduleLabel || 'Generacion';
  return `${label} ${new Date(record.createdAt).toLocaleDateString()}`;
};

const promptSnippet = (record: GenerationRecord): string => {
  const prompt = record.promptText?.replace(/\s+/g, ' ').trim();
  if (!prompt) return 'Sin descripción guardada';
  return prompt.length > 110 ? `${prompt.slice(0, 110)}...` : prompt;
};

const GenerationHistory: React.FC = () => {
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMeta, setLightboxMeta] = useState<{ label: string }>({ label: '' });

  const { isVisible: fabVisible } = useScrollFAB({ threshold: 100, alwaysVisibleOnMobile: false });

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await generationHistoryService.getAll(200);
      setRecords(data);
    } catch (err) {
      console.warn('[GenerationHistory] load failed', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const filtered = useMemo(
    () => activeFilter ? records.filter(r => r.module === activeFilter) : records,
    [activeFilter, records],
  );

  const allModules = useMemo(
    () => Array.from(new Set(records.map(r => r.module))),
    [records],
  );

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === filtered.length
      ? new Set()
      : new Set(filtered.map(r => r.id))
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Quieres eliminar esta imagen de tus creaciones?')) return;
    setDeletingId(id);
    try {
      await generationHistoryService.delete(id).catch(console.error);
      setRecords(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Quieres eliminar ${selectedIds.size} imágenes? Esta acción no se puede deshacer.`)) return;
    setIsBulkLoading(true);
    try {
      await generationHistoryService.deleteBatch(Array.from(selectedIds)).catch(console.error);
      setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkLoading(true);
    try {
      const selected = records.filter(r => selectedIds.has(r.id));
      await downloadAsZip(selected.map(r => r.imageUrl), `luzIA_${Date.now()}.zip`, 'gen');
    } catch {
      alert('No pudimos preparar la descarga. Puedes descargar las imágenes una por una.');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const openLightbox = (record: GenerationRecord, idx: number) => {
    setLightboxImages(filtered.map(r => r.imageUrl));
    setLightboxIndex(idx);
    setLightboxMeta({ label: MODULE_LABELS[record.module] || record.moduleLabel || record.module });
    setLightboxOpen(true);
  };

  const copyPrompt = async (record: GenerationRecord) => {
    const text = record.promptText || '';
    if (!text) {
      showToast('Esta imagen no tiene una descripción guardada');
      return;
    }
    await navigator.clipboard?.writeText(text);
    showToast('Descripción copiada');
  };

  const saveToCatalog = async (record: GenerationRecord) => {
    const refs = (record.references || [])
      .map(ref => ref.imageUrl)
      .filter((url): url is string => !!url);

    const product: ProductProfile = {
      id: `history_product_${Date.now()}`,
      name: readableName(record),
      category: 'other',
      baseImages: refs,
      generatedImages: [record.imageUrl],
      productPrompt: record.promptText || '',
      technicalDescription: record.metadata?.technicalDescription || 'Guardado desde historial.',
      commercialDescription: record.metadata?.commercialDescription || 'Imagen recuperada desde historial.',
      metadata: {
        material: record.metadata?.material || '',
        color: record.metadata?.color || '',
        style: record.config?.modelId || record.module,
      },
      createdAt: Date.now(),
    };

    await dbService.saveProduct(product);
    showToast('Producto guardado en tu catálogo');
  };

  const saveToModelLibrary = async (record: GenerationRecord) => {
    const avatar: AvatarProfile = {
      id: `history_avatar_${Date.now()}`,
      name: readableName(record),
      type: record.module === 'model_dna_manual' ? 'manual' : 'clone',
      identityPrompt: record.promptText || '',
      physicalDescription: record.metadata?.physicalDescription || 'Identidad recuperada desde historial.',
      negativePrompt: record.config?.negative || '',
      baseImages: [record.imageUrl],
      metadata: {
        gender: record.metadata?.gender || '',
        age: record.metadata?.age || '',
        build: record.metadata?.build || '',
        ethnicity: record.metadata?.ethnicity || '',
        eyes: record.metadata?.eyes || '',
        hairColor: record.metadata?.hairColor || '',
        hairType: record.metadata?.hairType || '',
        hairLength: record.metadata?.hairLength || '',
        personality: record.metadata?.personality || '',
        expression: record.metadata?.expression || '',
        outfit: record.metadata?.outfit || '',
        source: 'generation_history',
      },
      createdAt: Date.now(),
    };

    await dbService.saveAvatar(avatar);
    showToast('Modelo guardado en Tus modelos');
  };

  return (
    <div className="space-y-8 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
                Mis creaciones
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                {loading ? 'Cargando...' : `${records.length} imágenes guardadas`}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={loadHistory}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </header>

      {loadError && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-700 px-5 py-4 rounded-2xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black uppercase tracking-tight">Historial local activo</p>
            <p className="text-xs font-bold text-amber-600 mt-0.5">
              No pudimos actualizar tus creaciones en línea. Mientras tanto, puedes ver la copia guardada en este dispositivo.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando tus creaciones...</p>
        </div>
      )}

      {!loading && records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-50">
          <div className="w-16 h-16 bg-slate-100 rounded-[24px] flex items-center justify-center">
            <Image className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Aún no tienes creaciones</p>
          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Elige una herramienta para comenzar. Tus imágenes aparecerán aquí.
          </p>
        </div>
      )}

      {!loading && records.length > 0 && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setActiveFilter(null)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  !activeFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                Todos ({records.length})
              </button>
              {allModules.map(mod => (
                <button
                  key={mod}
                  onClick={() => setActiveFilter(mod)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    activeFilter === mod ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {MODULE_LABELS[mod] || mod} ({records.filter(r => r.module === mod).length})
                </button>
              ))}
            </div>

            {filtered.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors flex-shrink-0"
              >
                {selectedIds.size === filtered.length
                  ? <CheckSquare className="w-3.5 h-3.5" />
                  : <Square className="w-3.5 h-3.5" />}
                {selectedIds.size === filtered.length ? 'Deseleccionar' : 'Seleccionar todo'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((record, idx) => {
              const isSelected = selectedIds.has(record.id);
              const isDeleting = deletingId === record.id;
              const moduleLabel = MODULE_LABELS[record.module] || record.moduleLabel || record.module;

              return (
                <div
                  key={record.id}
                  className={`group relative bg-white rounded-2xl overflow-hidden border-2 shadow-sm hover:shadow-lg transition-all cursor-pointer ${
                    isSelected ? 'border-indigo-500 shadow-indigo-100' : 'border-transparent'
                  }`}
                  onClick={() => openLightbox(record, idx)}
                >
                  <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
                    {record.imageUrl ? (
                      <img
                        src={record.imageUrl}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        alt="Generated"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-8 h-8 text-slate-200" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 flex-wrap p-3">
                      <button
                        onClick={e => { e.stopPropagation(); downloadImage(record.imageUrl, idx); }}
                        className="p-2 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-colors"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); copyPrompt(record); }}
                        className="p-2 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-colors"
                        title="Copiar descripción"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {isModelRecord(record) ? (
                        <button
                          onClick={e => { e.stopPropagation(); saveToModelLibrary(record).catch(err => showToast(err.message)); }}
                          className="p-2 bg-emerald-500/90 text-white rounded-xl hover:bg-emerald-500 transition-colors"
                          title="Guardar en biblioteca de modelos"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); saveToCatalog(record).catch(err => showToast(err.message)); }}
                          className="p-2 bg-emerald-500/90 text-white rounded-xl hover:bg-emerald-500 transition-colors"
                          title="Guardar en catálogo"
                        >
                          <PackagePlus className="w-4 h-4" />
                        </button>
                      )}
                      <AddToProjectButton
                        imageUrl={record.imageUrl}
                        type="result"
                        module={record.module}
                        metadata={{
                          promptText: record.promptText,
                          moduleLabel,
                          historyId: record.id,
                          config: record.config,
                        }}
                        className="rounded-xl bg-white/90"
                      />
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(record.id); }}
                        className="p-2 bg-red-500/85 text-white rounded-xl hover:bg-red-600 transition-colors"
                        title="Eliminar"
                      >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>

                    <button
                      onClick={e => toggleSelect(record.id, e)}
                      className={`absolute top-2 left-2 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white opacity-100'
                          : 'bg-black/40 text-white opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    </button>
                    {record.references?.length ? (
                      <span className="absolute top-2 right-2 bg-black/50 text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase">
                        {record.references.length} refs
                      </span>
                    ) : null}
                  </div>

                  <div className="p-3 space-y-2">
                    <span className="inline-flex text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md max-w-full truncate">
                      {moduleLabel}
                    </span>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      {timeAgo(record.createdAt)}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-500 leading-snug line-clamp-2">
                      {promptSnippet(record)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {lightboxOpen && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onDownload={(url, idx) => downloadImage(url, idx)}
          metadata={lightboxMeta}
          extraButton={filtered.some(record => !!record.promptText) ? {
            label: 'Copiar descripción',
            icon: <Copy className="w-4 h-4" />,
            onClick: (_url, idx) => {
              const record = filtered[idx];
              if (record) copyPrompt(record);
            },
          } : undefined}
        />
      )}

      {selectedIds.size > 0 && fabVisible && (
        <FloatingActionBar
          isVisible={true}
          selectedCount={selectedIds.size}
          onDownload={handleBulkDownload}
          onDelete={handleBulkDelete}
          onClearSelection={() => setSelectedIds(new Set())}
          primaryAction={{
            label: isBulkLoading ? 'Procesando...' : 'Descargar ZIP',
            icon: isBulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />,
            onClick: handleBulkDownload,
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold z-[20001] flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
          {toast}
        </div>
      )}
    </div>
  );
};

export default GenerationHistory;
