import React, { useEffect, useState } from 'react';
import { generationHistoryService, GenerationRecord, MODULE_LABELS } from '../services/generationHistoryService';
import { Clock, Download, Trash2, Image, Loader2, X, Filter, CheckCircle2, Circle, Square, CheckSquare, DownloadCloud } from 'lucide-react';
import { downloadAsZip } from '../utils/imageUtils';
import { ImageLightbox } from '../components/shared/ImageLightbox';
import { FloatingActionBar } from '../components/shared/FloatingActionBar';
import { useScrollFAB } from '../hooks/useScrollFAB';

// ──────────────────────────────────────────
// GenerationHistory — Vista de historial
// Ruta: /historial
// ──────────────────────────────────────────

const timeAgo = (isoDate: string): string => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'ahora';
  if (mins < 60)  return `hace ${mins}m`;
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
  const [records, setRecords]         = useState<GenerationRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMetadata, setLightboxMetadata] = useState<{ label: string }>({ label: '' });

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // FAB scroll detection (para acciones masivas)
  const { isVisible: fabVisible } = useScrollFAB({ threshold: 100, alwaysVisibleOnMobile: false });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await generationHistoryService.getAll();
      setRecords(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta imagen?')) return;
    setDeletingId(id);
    await generationHistoryService.delete(id);
    setRecords(prev => prev.filter(r => r.id !== id));
    setDeletingId(null);
    
    // Quitar de seleccionados si estaba
    const newSelected = new Set(selectedIds);
    newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.size} imágenes?`)) return;
    
    setIsBulkLoading(true);
    const idsArray = Array.from(selectedIds) as string[];
    await generationHistoryService.deleteBatch(idsArray);
    
    setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
    setSelectedIds(new Set());
    setIsBulkLoading(false);
  };

  const handleBulkDownload = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkLoading(true);
    
    try {
      const selectedRecords = records.filter(r => selectedIds.has(r.id));
      const imagesToZip = selectedRecords.map(r => r.imageUrl);
      await downloadAsZip(imagesToZip, `luzIA_generaciones_${Date.now()}.zip`, 'gen');
    } catch (err) {
      console.error('Error creating zip:', err);
      alert('Error al crear el archivo ZIP. Intenta descargar individualmente.');
    } finally {
      setIsBulkLoading(false);
    }
  };

  // Abrir lightbox con una imagen específica (y navegación por todas las del filtro)
  const openLightbox = (record: GenerationRecord, index: number) => {
    const allImages = filtered.map(r => r.imageUrl);
    const currentIdx = filtered.findIndex(r => r.id === record.id);
    setLightboxImages(allImages);
    setLightboxIndex(currentIdx >= 0 ? currentIdx : 0);
    setLightboxMetadata({ label: MODULE_LABELS[record.module] || record.module });
    setLightboxOpen(true);
  };

  // Filtros únicos de módulos usados
  const availableModules: string[] = Array.from(new Set(records.map(r => r.module)));

  const filtered = activeFilter
    ? records.filter(r => r.module === activeFilter)
    : records;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-32">

      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-1">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
            Mis <span className="text-indigo-600">Generaciones</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            {records.length} imagen{records.length !== 1 ? 'es' : ''} generada{records.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {filtered.length > 0 && (
          <button 
            onClick={toggleSelectAll}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            {selectedIds.size === filtered.length ? <CheckSquare size={14} className="text-indigo-600" /> : <Square size={14} />}
            {selectedIds.size === filtered.length ? 'Desmarcar todo' : 'Seleccionar todo'}
          </button>
        )}
      </header>

      {/* FILTERS */}
      {availableModules.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => { setActiveFilter(null); setSelectedIds(new Set()); }}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
              !activeFilter ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
            }`}
          >
            Todos
          </button>
          {availableModules.map(mod => (
            <button
              key={mod}
              onClick={() => { setActiveFilter(mod); setSelectedIds(new Set()); }}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                activeFilter === mod ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
              }`}
            >
              {(MODULE_LABELS as Record<string, string>)[mod] || mod}
            </button>
          ))}
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando historial...</p>
        </div>
      )}

      {/* EMPTY */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
          <Image className="w-12 h-12 text-slate-300" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest text-center">
            {activeFilter ? 'No hay imágenes en este módulo' : 'Aún no has generado imágenes'}
          </p>
        </div>
      )}

      {/* GRID */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((record, i) => {
            const isSelected = selectedIds.has(record.id);
            return (
              <div
                key={record.id}
                className={`group relative bg-white rounded-[24px] overflow-hidden border transition-all cursor-pointer ${
                  isSelected ? 'border-indigo-500 ring-2 ring-indigo-100 shadow-md' : 'border-slate-100 shadow-sm hover:shadow-lg hover:scale-[1.02]'
                }`}
                onClick={() => openLightbox(record, i)}
              >
                {/* SELECTION CHECKBOX */}
                <div 
                  className={`absolute top-3 left-3 z-20 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-white/80 backdrop-blur-md text-slate-300 opacity-0 group-hover:opacity-100'
                  }`}
                  onClick={(e) => toggleSelect(record.id, e)}
                >
                  {isSelected ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </div>

                {/* IMAGE */}
                <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden cursor-zoom-in">
                  <img
                    src={record.imageUrl}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    alt={`Generation ${i + 1}`}
                  />

                  {/* HOVER OVERLAY (desktop) */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 md:group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3 hidden md:flex">
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadImage(record.imageUrl, i); }}
                      className="w-full py-2 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Descargar
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
                      disabled={deletingId === record.id}
                      className="w-full py-2 bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-rose-500 transition-colors"
                    >
                      {deletingId === record.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Eliminar
                    </button>
                  </div>

                  {/* MOBILE ACTIONS OVERLAY (siempre visible) */}
                  <div className="absolute top-2 right-2 flex flex-col gap-2 md:hidden">
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadImage(record.imageUrl, i); }}
                      className="w-8 h-8 bg-black/40 backdrop-blur-md text-white rounded-lg flex items-center justify-center shadow-lg"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
                      disabled={deletingId === record.id}
                      className="w-8 h-8 bg-black/40 backdrop-blur-md text-white rounded-lg flex items-center justify-center shadow-lg"
                    >
                      {deletingId === record.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="p-3 space-y-1">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md">
                    {MODULE_LABELS[record.module] || record.module}
                  </span>
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-2.5 h-2.5" />
                    <span className="text-[10px] font-bold">{timeAgo(record.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FLOATING ACTION BAR (selección múltiple) */}
      {selectedIds.size > 0 && fabVisible && (
        <FloatingActionBar
          isVisible={true}
          selectedCount={selectedIds.size}
          onDownload={handleBulkDownload}
          onDelete={handleBulkDelete}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}

      {/* LIGHTBOX UNIVERSAL */}
      {lightboxOpen && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onDownload={(url, idx) => downloadImage(url, idx)}
          metadata={lightboxMetadata}
        />
      )}
    </div>
  );
};

export default GenerationHistory;