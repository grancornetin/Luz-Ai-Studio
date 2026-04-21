import React, { useEffect, useState } from 'react';
import { generationHistoryService, GenerationRecord, MODULE_LABELS } from '../services/generationHistoryService';
import { Clock, Download, Trash2, Image, Loader2, X, Filter, CheckCircle2, Circle, Square, CheckSquare, DownloadCloud } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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
  const [zoomedImage, setZoomedImage] = useState<GenerationRecord | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  
  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

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
    if (zoomedImage?.id === id) setZoomedImage(null);
    
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
      const zip = new JSZip();
      const selectedRecords = records.filter(r => selectedIds.has(r.id));
      
      for (let i = 0; i < selectedRecords.length; i++) {
        const record = selectedRecords[i];
        const base64Data = record.imageUrl.split(',')[1];
        zip.file(`luzIA_gen_${i + 1}.png`, base64Data, { base64: true });
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `luzIA_generaciones_${Date.now()}.zip`);
    } catch (err) {
      console.error('Error creating zip:', err);
      alert('Error al crear el archivo ZIP. Intenta descargar individualmente.');
    } finally {
      setIsBulkLoading(false);
    }
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
                onClick={() => setZoomedImage(record)}
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
                <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
                  <img
                    src={record.imageUrl}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    alt={`Generation ${i + 1}`}
                  />

                  {/* HOVER OVERLAY */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 md:group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3 hidden md:flex">
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadImage(record.imageUrl, i); }}
                      className="w-full py-2 bg-white text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Descargar
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
                      disabled={deletingId === record.id}
                      className="w-full py-2 bg-white/20 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-rose-500 transition-colors"
                    >
                      {deletingId === record.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Eliminar
                    </button>
                  </div>

                  {/* MOBILE ACTIONS OVERLAY */}
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
                  <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md">
                    {MODULE_LABELS[record.module] || record.module}
                  </span>
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-2.5 h-2.5" />
                    <span className="text-[8px] font-bold">{timeAgo(record.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BULK ACTIONS BAR */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[80] w-[90%] max-w-lg bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-[32px] p-4 shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-10 duration-500">
          <div className="flex items-center gap-3 pl-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-500/20">
              {selectedIds.size}
            </div>
            <div>
              <p className="text-[10px] font-black text-white uppercase tracking-widest">Seleccionados</p>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="text-[9px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDownload}
              disabled={isBulkLoading}
              className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              {isBulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
              ZIP
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkLoading}
              className="flex items-center gap-2 px-6 py-3 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-50 shadow-lg shadow-rose-500/20"
            >
              {isBulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Borrar
            </button>
          </div>
        </div>
      )}

      {/* ZOOM MODAL */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="bg-white rounded-[40px] overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col md:flex-row shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            {/* MOBILE CLOSE BUTTON */}
            <button
              onClick={() => setZoomedImage(null)}
              className="md:hidden absolute top-4 right-4 z-[1100] w-10 h-10 bg-black/40 backdrop-blur-md text-white rounded-xl flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            {/* IMAGE */}
            <div className="md:w-1/2 aspect-[3/4] md:aspect-auto bg-slate-100 flex-shrink-0">
              <img src={zoomedImage.imageUrl} className="w-full h-full object-cover" alt="Generation" />
            </div>

            {/* INFO */}
            <div className="flex-1 p-6 md:p-8 space-y-5 overflow-y-auto">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-lg">
                    {MODULE_LABELS[zoomedImage.module] || zoomedImage.module}
                  </span>
                  <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-2">
                    <Clock className="w-3 h-3" />
                    {timeAgo(zoomedImage.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setZoomedImage(null)}
                  className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {zoomedImage.promptText && (
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Prompt</p>
                  <p className="text-xs text-slate-600 italic leading-relaxed">"{zoomedImage.promptText}"</p>
                </div>
              )}

              <div className="flex items-center gap-2 text-slate-500">
                <span className="text-[9px] font-black uppercase tracking-widest">{zoomedImage.creditsUsed} crédito{zoomedImage.creditsUsed !== 1 ? 's' : ''} usados</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => downloadImage(zoomedImage.imageUrl, 0)}
                  className="py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </button>
                <button
                  onClick={() => handleDelete(zoomedImage.id)}
                  disabled={deletingId === zoomedImage.id}
                  className="py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                >
                  {deletingId === zoomedImage.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GenerationHistory;
