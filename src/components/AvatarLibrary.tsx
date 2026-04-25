import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvatarProfile } from '../types';
import ModuleTutorial from './shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from './shared/tutorialConfigs';
import { dbService } from '../services/dbService';
import { Download, Trash2, X, ChevronLeft, ChevronRight, Plus, User, Zap } from 'lucide-react';

interface AvatarLibraryProps {
  avatars: AvatarProfile[];
  onSave?: (avatar: AvatarProfile) => void;
}

const TYPE_STYLES: Record<string, string> = {
  reference: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  scratch:   'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/20',
};

const TYPE_LABELS: Record<string, string> = {
  reference: 'DNA · Fotos',
  scratch:   'DNA · Manual',
};

const META_FIELDS = (a: AvatarProfile) => [
  { label: 'Género',      value: a.metadata?.gender },
  { label: 'Edad',        value: a.metadata?.age },
  { label: 'Etnia',       value: a.metadata?.ethnicity },
  { label: 'Complexión',  value: a.metadata?.build },
  { label: 'Ojos',        value: a.metadata?.eyes },
  { label: 'Cabello',     value: `${a.metadata?.hairLength} ${a.metadata?.hairType} ${a.metadata?.hairColor}` },
];

const AvatarLibrary: React.FC<AvatarLibraryProps> = ({ avatars }) => {
  const navigate = useNavigate();
  const [selected, setSelected]         = useState<AvatarProfile | null>(null);
  const [slideIdx, setSlideIdx]         = useState<Record<string, number>>({});
  const [zoomedImages, setZoomedImages] = useState<string[]>([]);
  const [zoomedIdx, setZoomedIdx]       = useState<number | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [confirmId, setConfirmId]       = useState<string | null>(null);

  const getSlide = (id: string) => slideIdx[id] ?? 0;

  const cycleSlide = (id: string, images: string[], dir: 1 | -1, e: React.MouseEvent) => {
    e.stopPropagation();
    const len = images.length;
    setSlideIdx(prev => ({ ...prev, [id]: ((prev[id] ?? 0) + dir + len) % len }));
  };

  const openZoom = (images: string[], i: number) => { setZoomedImages(images); setZoomedIdx(i); };
  const closeZoom = () => { setZoomedImages([]); setZoomedIdx(null); };

  const navZoom = (dir: 'prev' | 'next') => {
    if (zoomedIdx === null) return;
    const len = zoomedImages.length;
    setZoomedIdx(dir === 'next' ? (zoomedIdx + 1) % len : (zoomedIdx - 1 + len) % len);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmId !== id) { setConfirmId(id); return; }
    setDeletingId(id);
    try {
      await dbService.deleteAvatar?.(id);
      if (selected?.id === id) setSelected(null);
    } catch { alert('Error al eliminar el modelo.'); }
    finally { setDeletingId(null); setConfirmId(null); }
  };

  const downloadImage = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-28 md:pb-12">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-8">

        <header className="flex flex-col md:flex-row items-start md:items-end justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-5 bg-gradient-to-b from-violet-500 to-fuchsia-500 rounded-full" />
              <span className="text-2xs font-black text-white/25 uppercase tracking-[0.4em]">Identidades</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
              Biblioteca <span className="gradient-text-violet">de Identidades</span>
            </h1>
            <p className="text-xs text-white/30 font-medium">{avatars.length} modelo{avatars.length !== 1 ? 's' : ''} guardado{avatars.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="flex items-center gap-2">
            <ModuleTutorial moduleId="avatarLibrary" steps={TUTORIAL_CONFIGS.avatarLibrary} />
            <button
              onClick={() => navigate('/crear/clonar')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-2xs font-black uppercase tracking-wider shadow-lg shadow-violet-900/30 hover:opacity-90 transition-all touch-target"
            >
              <Plus size={13} /> From Photos
            </button>
            <button
              onClick={() => navigate('/crear/manual')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/[0.08] text-white/50 hover:text-white/80 rounded-xl text-2xs font-black uppercase tracking-wider transition-all touch-target"
            >
              <Plus size={13} /> From Scratch
            </button>
          </div>
        </header>

        {avatars.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-24 h-24 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <User className="w-10 h-10 text-white/10" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-black text-white/25 uppercase italic tracking-tight">Biblioteca vacía</p>
              <p className="text-xs text-white/15 max-w-xs mx-auto leading-relaxed">Crea tu primer modelo digital usando Model DNA · Fotos o Model DNA · Manual</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate('/crear/clonar')} className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg hover:opacity-90 transition-all touch-target">
                Model DNA · Fotos
              </button>
              <button onClick={() => navigate('/crear/manual')} className="px-6 py-3 bg-white/5 border border-white/[0.08] text-white/50 rounded-xl text-xs font-black uppercase tracking-wider hover:text-white/80 transition-all touch-target">
                From Scratch
              </button>
            </div>
          </div>
        )}

        {avatars.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {avatars.map(avatar => {
              const images = avatar.baseImages || [];
              const slide  = getSlide(avatar.id);
              const img    = images[slide] || images[0];

              return (
                <div
                  key={avatar.id}
                  onClick={() => setSelected(avatar)}
                  className="group relative rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.15] cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                >
                  <div className="aspect-[3/4] bg-white/[0.03]">
                    {img
                      ? <img src={img} className="w-full h-full object-cover" loading="lazy" alt={avatar.name} />
                      : <div className="w-full h-full flex items-center justify-center"><User className="w-8 h-8 text-white/10" /></div>
                    }
                  </div>

                  {images.length > 1 && (
                    <>
                      <button onClick={e => cycleSlide(avatar.id, images, -1, e)}
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 backdrop-blur-sm text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity touch-target">
                        <ChevronLeft size={14} />
                      </button>
                      <button onClick={e => cycleSlide(avatar.id, images, 1, e)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 backdrop-blur-sm text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity touch-target">
                        <ChevronRight size={14} />
                      </button>
                      <div className="absolute bottom-10 inset-x-0 flex justify-center gap-1">
                        {images.map((_, i) => (
                          <div key={i} className={`rounded-full transition-all ${i === slide ? 'w-3 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30'}`} />
                        ))}
                      </div>
                    </>
                  )}

                  <div className="absolute top-2 left-2">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border ${TYPE_STYLES[avatar.type] || TYPE_STYLES.scratch}`}>
                      {TYPE_LABELS[avatar.type] || 'DNA'}
                    </span>
                  </div>

                  <button
                    onClick={e => handleDelete(avatar.id, e)}
                    disabled={deletingId === avatar.id}
                    className={`absolute top-2 right-2 w-7 h-7 backdrop-blur-sm rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all touch-target ${
                      confirmId === avatar.id ? 'bg-rose-500 text-white opacity-100' : 'bg-black/50 text-white/60 hover:text-white'
                    }`}
                  >
                    <Trash2 size={11} />
                  </button>

                  <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-[10px] font-black uppercase tracking-tight truncate">{avatar.name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[400] bg-black/75 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative w-full md:max-w-3xl bg-[#0D0D14] border-t md:border border-white/[0.08] rounded-t-[28px] md:rounded-3xl shadow-2xl shadow-black/80 overflow-hidden animate-slide-up md:animate-scale-in max-h-[92dvh] overflow-y-auto scrollbar-hide"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 md:hidden">
              <div className="w-10 h-1 bg-white/10 rounded-full" />
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${TYPE_STYLES[selected.type] || TYPE_STYLES.scratch}`}>
                      {TYPE_LABELS[selected.type]}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">{selected.name}</h2>
                  <p className="text-xs text-white/30 mt-0.5">Creado {new Date(selected.createdAt).toLocaleDateString('es-CL')}</p>
                </div>
                <button onClick={() => setSelected(null)}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/80 transition-all touch-target flex-shrink-0">
                  <X size={16} />
                </button>
              </div>

              {selected.baseImages?.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {selected.baseImages.map((img, i) => (
                    <div key={i}
                      className="aspect-[3/4] rounded-xl overflow-hidden border border-white/[0.08] cursor-zoom-in hover:border-white/[0.2] transition-all"
                      onClick={() => openZoom(selected.baseImages, i)}
                    >
                      <img src={img} className="w-full h-full object-cover" loading="lazy" alt={`Vista ${i + 1}`} />
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {META_FIELDS(selected).map(field => field.value && (
                  <div key={field.label} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">
                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">{field.label}</p>
                    <p className="text-[10px] font-black text-white/70 uppercase mt-0.5 truncate">{field.value}</p>
                  </div>
                ))}
              </div>

              {selected.physicalDescription && (
                <div className="bg-gradient-to-br from-violet-600/8 to-fuchsia-600/5 border border-violet-500/15 rounded-2xl p-4">
                  <p className="text-[9px] font-black text-violet-300/60 uppercase tracking-widest mb-2">Descripción física IA</p>
                  <p className="text-xs text-white/40 leading-relaxed italic">"{selected.physicalDescription}"</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate('/prompt-library')}
                  className="py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-all flex items-center justify-center gap-2 touch-target shadow-lg shadow-violet-900/30"
                >
                  <Zap size={13} /> Usar en AI Generator
                </button>
                <button
                  onClick={() => selected.baseImages?.[0] && downloadImage(selected.baseImages[0], `${selected.name}_bodymaster.png`)}
                  className="py-3.5 bg-white/5 border border-white/[0.08] text-white/50 hover:text-white/80 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 touch-target"
                >
                  <Download size={13} /> Descargar
                </button>
              </div>
              <div className="h-safe-bottom md:hidden" />
            </div>
          </div>
        </div>
      )}

      {zoomedIdx !== null && zoomedImages.length > 0 && (
        <div
          className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={closeZoom}
          onKeyDown={e => { if (e.key === 'Escape') closeZoom(); if (e.key === 'ArrowLeft') navZoom('prev'); if (e.key === 'ArrowRight') navZoom('next'); }}
          tabIndex={0}
        >
          <div className="relative max-w-xl w-full" onClick={e => e.stopPropagation()}>
            <div className="rounded-3xl overflow-hidden border border-white/[0.08]">
              <img src={zoomedImages[zoomedIdx]} className="w-full max-h-[80dvh] object-contain bg-[#0A0A0F]" alt="" />
            </div>
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{zoomedIdx + 1} / {zoomedImages.length}</span>
            </div>
            <button onClick={closeZoom} className="absolute top-4 right-4 w-10 h-10 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-all touch-target"><X size={18} /></button>
            {zoomedImages.length > 1 && <>
              <button onClick={e => { e.stopPropagation(); navZoom('prev'); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-all touch-target"><ChevronLeft size={18} /></button>
              <button onClick={e => { e.stopPropagation(); navZoom('next'); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-all touch-target"><ChevronRight size={18} /></button>
            </>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarLibrary;
