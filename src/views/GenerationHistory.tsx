/**
 * GenerationHistory.tsx — FIXED (sin secondaryActions)
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  generationHistoryService,
  GenerationRecord,
  MODULE_LABELS
} from '../services/generationHistoryService';
import {
  Clock, Download, Trash2, Image, Loader2, X,
  Filter, CheckSquare, Square, DownloadCloud, AlertCircle, RefreshCw
} from 'lucide-react';
import { downloadAsZip } from '../utils/imageUtils';
import { ImageLightbox } from '../components/shared/ImageLightbox';
import { FloatingActionBar } from '../components/shared/FloatingActionBar';
import { useScrollFAB } from '../hooks/useScrollFAB';

// localStorage fallback
const LS_KEY = 'luz_generation_history';

function loadFromLocalStorage(): GenerationRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

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
  link.click();
};

const GenerationHistory: React.FC = () => {
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMeta, setLightboxMeta] = useState<{ label: string }>({ label: '' });

  const { isVisible: fabVisible } = useScrollFAB({ threshold: 100, alwaysVisibleOnMobile: false });

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setApiError(false);
    setUsingFallback(false);
    try {
      const timeoutPromise = new Promise<GenerationRecord[]>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      );
      const apiPromise = generationHistoryService.getAll(200);
      const data = await Promise.race([apiPromise, timeoutPromise]);
      setRecords(data);
      setLoading(false);
      return;
    } catch (err: any) {
      console.warn('[GenerationHistory] API failed, using localStorage fallback');
      setApiError(true);
    }
    const local = loadFromLocalStorage();
    setRecords(local);
    setUsingFallback(true);
    setLoading(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const filtered = activeFilter
    ? records.filter(r => r.module === activeFilter)
    : records;

  const allModules = Array.from(new Set(records.map(r => r.module)));

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
    if (!confirm('¿Eliminar esta imagen del historial?')) return;
    setDeletingId(id);
    if (!usingFallback) {
      await generationHistoryService.delete(id).catch(console.error);
    }
    setRecords(prev => {
      const updated = prev.filter(r => r.id !== id);
      if (usingFallback) localStorage.setItem(LS_KEY, JSON.stringify(updated));
      return updated;
    });
    setDeletingId(null);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedIds.size} imágenes?`)) return;
    setIsBulkLoading(true);
    if (!usingFallback) {
      await generationHistoryService.deleteBatch(Array.from(selectedIds)).catch(console.error);
    }
    setRecords(prev => {
      const updated = prev.filter(r => !selectedIds.has(r.id));
      if (usingFallback) localStorage.setItem(LS_KEY, JSON.stringify(updated));
      return updated;
    });
    setSelectedIds(new Set());
    setIsBulkLoading(false);
  };

  const handleBulkDownload = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkLoading(true);
    try {
      const selected = records.filter(r => selectedIds.has(r.id));
      await downloadAsZip(selected.map(r => r.imageUrl), `luzIA_${Date.now()}.zip`, 'gen');
    } catch { alert('Error al crear ZIP. Descarga individualmente.'); }
    finally { setIsBulkLoading(false); }
  };

  const openLightbox = (record: GenerationRecord, idx: number) => {
    const filteredImages = filtered.map(r => r.imageUrl);
    setLightboxImages(filteredImages);
    setLightboxIndex(idx);
    setLightboxMeta({ label: MODULE_LABELS[record.module] || record.module });
    setLightboxOpen(true);
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
                Mis Generaciones
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

      {usingFallback && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-700 px-5 py-4 rounded-2xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black uppercase tracking-tight">Historial local</p>
            <p className="text-xs font-bold text-amber-600 mt-0.5">
              No se pudo conectar con el servidor. Mostrando historial guardado en este dispositivo.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando historial...</p>
        </div>
      )}

      {!loading && records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-50">
          <div className="w-16 h-16 bg-slate-100 rounded-[24px] flex items-center justify-center">
            <Image className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Sin generaciones aún</p>
          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Las imágenes que generes aparecerán aquí
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
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); downloadImage(record.imageUrl, idx); }}
                        className="p-2 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(record.id); }}
                        className="p-2 bg-red-500/80 text-white rounded-xl hover:bg-red-600 transition-colors"
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
                  </div>
                  <div className="p-3 space-y-1">
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md">
                      {MODULE_LABELS[record.module] || record.module}
                    </span>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      {timeAgo(record.createdAt)}
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
        />
      )}

      {/* FAB — usando onDelete y onDownload directamente */}
      {selectedIds.size > 0 && fabVisible && (
        <FloatingActionBar
          isVisible={true}
          selectedCount={selectedIds.size}
          onDownload={handleBulkDownload}
          onDelete={handleBulkDelete}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  );
};

export default GenerationHistory;