import React, { useEffect, useState } from 'react';
import { generationHistoryService, GenerationRecord, MODULE_LABELS } from '../services/generationHistoryService';
import { Clock, Download, Trash2, Image, Loader2, X, CheckSquare, Square, DownloadCloud, Zap } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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
  link.href = img; link.download = `luzIA_${index + 1}.png`; link.click();
};

const MODULE_COLORS: Record<string, string> = {
  prompt_studio:      'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
  scene_clone:        'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  model_dna:          'text-violet-400 bg-violet-500/10 border-violet-500/20',
  content_studio:     'text-pink-400 bg-pink-500/10 border-pink-500/20',
  content_studio_pro: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  outfit_extractor:   'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  outfit_kit:         'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  catalog:            'text-sky-400 bg-sky-500/10 border-sky-500/20',
  campaign:           'text-amber-400 bg-amber-500/10 border-amber-500/20',
  photodump:          'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

const GenerationHistory: React.FC = () => {
  const [records, setRecords]           = useState<GenerationRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage]   = useState<GenerationRecord | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [selectMode, setSelectMode]     = useState(false);

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
    if (!confirm('¿Eliminar esta imagen?')) return;
    setDeletingId(id);
    await generationHistoryService.delete(id);
    setRecords(prev => prev.filter(r => r.id !== id));
    setDeletingId(null);
    if (zoomedImage?.id === id) setZoomedImage(null);
    const newSelected = new Set(selectedIds);
    newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(r => r.id)));
  };

  const handleBulkDelete = async () => {
    if (!confirm(`¿Eliminar ${selectedIds.size} imágenes?`)) return;
    setIsBulkLoading(true);
    await generationHistoryService.deleteBatch(Array.from(selectedIds) as string[]);
    setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
    setSelectedIds(new Set()); setSelectMode(false); setIsBulkLoading(false);
  };

  const handleBulkDownload = async () => {
    setIsBulkLoading(true);
    try {
      const zip = new JSZip();
      const sel = records.filter(r => selectedIds.has(r.id));
      sel.forEach((record, i) => {
        const base64Data = record.imageUrl.split(',')[1];
        zip.file(`luzIA_gen_${i + 1}.png`, base64Data, { base64: true });
      });
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `luzIA_generaciones_${Date.now()}.zip`);
    } catch {
      alert('Error al crear el ZIP. Intenta descargar individualmente.');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const availableModules: string[] = Array.from(new Set(records.map(r => r.module)));
  const filtered = activeFilter ? records.filter(r => r.module === activeFilter) : records;

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-32 md:pb-16">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-7">

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-5 bg-gradient-to-b from-fuchsia-500 to-violet-500 rounded-full" />
              <span className="text-2xs font-black text-white/25 uppercase tracking-[0.4em]">Historial</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic">
              Mis <span className="gradient-text-violet">Generaciones</span>
            </h1>
            <p className="text-xs text-white/30 font-medium">
              {records.length} imagen{records.length !== 1 ? 'es' : ''} generada{records.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <>
                {selectMode && (
                  <button onClick={toggleSelectAll}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/[0.08] rounded-xl text-2xs font-black text-white/50 hover:text-white/80 uppercase tracking-wider transition-all touch-target"
                  >
                    {selectedIds.size === filtered.length
                      ? <CheckSquare size={13} className="text-violet-400" />
                      : <Square size={13} />
                    }
                    {selectedIds.size === filtered.length ? 'Desmarcar' : 'Todo'}
                  </button>
                )}
                <button
                  onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                  className={`px-4 py-2.5 border rounded-xl text-2xs font-black uppercase tracking-wider transition-all touch-target ${
                    selectMode ? 'bg-violet-500/15 border-violet-500/30 text-violet-300' : 'bg-white/5 border-white/[0.08] text-white/50 hover:text-white/80'
                  }`}
                >
                  {selectMode ? 'Cancelar' : 'Seleccionar'}
                </button>
              </>
            )}
          </div>
        </div>

        {availableModules.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-5 px-5 md:mx-0 md:px-0">
            <button
              onClick={() => { setActiveFilter(null); setSelectedIds(new Set()); }}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-2xs font-black uppercase tracking-wider transition-all touch-target ${
                !activeFilter ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/30' : 'bg-white/5 text-white/40 border border-white/[0.06] hover:bg-white/[0.08]'
              }`}
            >
              Todos
            </button>
            {availableModules.map(mod => (
              <button key={mod}
                onClick={() => { setActiveFilter(mod); setSelectedIds(new Set()); }}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-2xs font-black uppercase tracking-wider transition-all touch-target ${
                  activeFilter === mod ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-white/5 text-white/40 border border-white/[0.06] hover:bg-white/[0.08]'
                }`}
              >
                {(MODULE_LABELS as Record<string, string>)[mod] || mod}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-2xs font-black text-white/25 uppercase tracking-[0.3em]">Cargando historial...</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <Image className="w-8 h-8 text-white/15" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-black text-white/30 uppercase tracking-widest">
                {activeFilter ? 'Sin resultados en este módulo' : 'Aún no tienes generaciones'}
              </p>
              <p className="text-xs text-white/15">
                {activeFilter ? 'Prueba otro filtro' : 'Genera tu primera imagen desde cualquier módulo'}
              </p>
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((record) => {
              const isSelected = selectedIds.has(record.id);
              const moduleColor = MODULE_COLORS[record.module] || 'text-white/40 bg-white/5 border-white/10';

              return (
                <div
                  key={record.id}
                  onClick={() => selectMode ? toggleSelect(record.id) : setZoomedImage(record)}
                  className={`group relative rounded-2xl overflow-hidden cursor-pointer border transition-all duration-200 ${
                    isSelected ? 'border-violet-500/60 ring-2 ring-violet-500/30 scale-[0.97]' : 'border-white/[0.06] hover:border-white/[0.15] hover:scale-[1.02]'
                  }`}
                >
                  <div className="aspect-[3/4] bg-white/[0.03]">
                    <img src={record.imageUrl} alt={record.moduleLabel} className="w-full h-full object-cover" loading="lazy" />
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="absolute bottom-0 inset-x-0 p-2.5 space-y-2">
                      <div className="flex gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadImage(record.imageUrl, 0); }}
                          className="flex-1 py-2 bg-white/15 backdrop-blur-sm text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 hover:bg-white/25 transition-all touch-target"
                        >
                          <Download size={11} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
                          disabled={deletingId === record.id}
                          className="flex-1 py-2 bg-rose-500/20 backdrop-blur-sm text-rose-300 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 hover:bg-rose-500/40 transition-all touch-target"
                        >
                          {deletingId === record.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectMode && (
                    <div className={`absolute top-2 left-2 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-violet-600 border-violet-600' : 'bg-black/40 border-white/30 backdrop-blur-sm'
                    }`}>
                      {isSelected && <CheckSquare size={12} className="text-white" />}
                    </div>
                  )}

                  <div className="absolute top-2 right-2">
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border ${moduleColor}`}>
                      {(MODULE_LABELS as Record<string, string>)[record.module]?.split(' ')[0] || record.module}
                    </span>
                  </div>

                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[8px] font-bold text-white/60 flex items-center gap-0.5">
                      <Clock size={8} />{timeAgo(record.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-2.5rem)] max-w-lg">
          <div className="bg-[#0D0D14]/95 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-3.5 shadow-2xl shadow-black/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-violet-900/40 flex-shrink-0">
                {selectedIds.size}
              </div>
              <div>
                <p className="text-2xs font-black text-white uppercase tracking-widest">Seleccionadas</p>
                <button onClick={() => { setSelectedIds(new Set()); setSelectMode(false); }}
                  className="text-[9px] font-bold text-white/30 hover:text-white/60 transition-colors uppercase tracking-wider">
                  Cancelar
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleBulkDownload} disabled={isBulkLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-slate-900 rounded-xl text-2xs font-black uppercase tracking-wider hover:bg-white/90 transition-all disabled:opacity-50 touch-target">
                {isBulkLoading ? <Loader2 size={13} className="animate-spin" /> : <DownloadCloud size={13} />} ZIP
              </button>
              <button onClick={handleBulkDelete} disabled={isBulkLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500 text-white rounded-xl text-2xs font-black uppercase tracking-wider hover:bg-rose-600 transition-all disabled:opacity-50 shadow-lg shadow-rose-900/40 touch-target">
                {isBulkLoading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomedImage && (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <div className="relative w-full max-w-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <button onClick={() => setZoomedImage(null)}
              className="absolute -top-3 -right-3 z-10 w-10 h-10 bg-[#0D0D14] border border-white/[0.12] rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-all touch-target">
              <X size={18} />
            </button>
            <div className="rounded-2xl overflow-hidden border border-white/[0.08]">
              <img src={zoomedImage.imageUrl} alt={zoomedImage.moduleLabel} className="w-full max-h-[70dvh] object-contain bg-[#0A0A0F]" />
            </div>
            <div className="mt-3 bg-[#0D0D14] border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-2xs font-black uppercase px-2 py-0.5 rounded-lg border ${MODULE_COLORS[zoomedImage.module] || 'text-white/40 bg-white/5 border-white/10'}`}>
                      {zoomedImage.moduleLabel}
                    </span>
                    <span className="text-2xs text-white/25 flex items-center gap-1"><Clock size={10} />{timeAgo(zoomedImage.createdAt)}</span>
                    <span className="text-2xs text-white/25 flex items-center gap-1"><Zap size={10} className="text-violet-400" />{zoomedImage.creditsUsed} cr usados</span>
                  </div>
                  {zoomedImage.promptText && (
                    <p className="text-[10px] text-white/30 leading-relaxed line-clamp-2 max-w-xs">{zoomedImage.promptText}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => downloadImage(zoomedImage.imageUrl, 0)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-2xs font-black uppercase tracking-wider hover:opacity-90 transition-all touch-target shadow-lg shadow-violet-900/30">
                    <Download size={13} /> Descargar
                  </button>
                  <button onClick={() => handleDelete(zoomedImage.id)} disabled={deletingId === zoomedImage.id}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/[0.08] text-white/40 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 rounded-xl text-2xs font-black uppercase tracking-wider transition-all touch-target">
                    {deletingId === zoomedImage.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerationHistory;
