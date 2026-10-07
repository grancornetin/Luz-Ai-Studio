import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Loader2 } from 'lucide-react';
import { AvatarProfile } from '../types';
import ModuleTutorial from './shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from './shared/tutorialConfigs';
import { ResultCard } from './shared/ResultCard';
import { ResultLibraryGrid } from './shared/ResultLibraryGrid';

interface AvatarLibraryProps {
  avatars: AvatarProfile[];
  onDelete: (avatarId: string) => Promise<void>;
}

const AvatarLibrary: React.FC<AvatarLibraryProps> = ({ avatars, onDelete }) => {
  const navigate = useNavigate();
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarProfile | null>(null);
  // Confirmación de borrado dentro de la página (sin confirm/alert del navegador)
  const [pendingDelete, setPendingDelete] = useState<AvatarProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState<Record<string, number>>({});
  // Tutorial: ahora usa ModuleTutorial

  // States for Zoom Gallery Modal
  const [zoomedImages, setZoomedImages] = useState<string[]>([]);
  const [zoomedImageIndex, setZoomedImageIndex] = useState<number | null>(null);

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const askDelete = (avatar: AvatarProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteError(null);
    setPendingDelete(avatar);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(pendingDelete.id);
      if (selectedAvatar?.id === pendingDelete.id) setSelectedAvatar(null);
      setPendingDelete(null);
    } catch (err) {
      console.error('[AvatarLibrary] Error al eliminar el modelo:', err);
      setDeleteError('No pudimos eliminar el modelo. Inténtalo de nuevo.');
    } finally {
      setDeleting(false);
    }
  };

  // Zoom Gallery Modal functions
  const openZoomModal = (images: string[], index: number) => {
    setZoomedImages(images);
    setZoomedImageIndex(index);
  };

  const closeZoomModal = () => {
    setZoomedImages([]);
    setZoomedImageIndex(null);
  };

  const navigateZoom = (direction: 'prev' | 'next') => {
    if (zoomedImageIndex === null || zoomedImages.length === 0) return;
    let newIndex = zoomedImageIndex;
    if (direction === 'prev') {
      newIndex = (zoomedImageIndex - 1 + zoomedImages.length) % zoomedImages.length;
    } else {
      newIndex = (zoomedImageIndex + 1) % zoomedImages.length;
    }
    setZoomedImageIndex(newIndex);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-10">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-1">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Biblioteca <span className="text-brand-600">· Modelos guardados</span></h2>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-slate-400 font-medium italic text-xs md:text-sm">Encuentra y descarga los modelos que creaste.</p>
            <ModuleTutorial moduleId="avatarLibrary" steps={TUTORIAL_CONFIGS.avatarLibrary} />
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => navigate('/crear/clonar')} className="flex-1 md:flex-none min-h-12 px-5 md:px-6 py-3 md:py-4 bg-brand-600 text-white rounded-[16px] md:rounded-[20px] text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all">Crear desde fotos</button>
          <button onClick={() => navigate('/crear/manual')} className="flex-1 md:flex-none min-h-12 px-5 md:px-6 py-3 md:py-4 bg-slate-900 text-white rounded-[16px] md:rounded-[20px] text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all">Diseñar un modelo</button>
        </div>
      </header>


      <ResultLibraryGrid
        stats={[
          { label: 'Modelos', value: avatars.length, sub: 'guardados' },
          { label: 'Clonados', value: avatars.filter(a => a.type === 'reference' || a.type === 'clone').length, sub: 'desde foto', color: 'text-brand-600' },
          { label: 'Desde cero', value: avatars.filter(a => a.type === 'manual').length, sub: 'creados' },
        ]}
        searchTexts={avatars.map(a => `${a.name} ${a.metadata?.ethnicity ?? ''} ${a.metadata?.personality ?? ''} ${a.type}`)}
        emptyTitle="Sin modelos guardados"
        emptyDescription="Crea tu primer modelo para encontrarlo aquí."
        emptyCtaLabel="Crear desde fotos"
        onEmpty={() => navigate('/crear/clonar')}
      >
        {avatars.map(avatar => (
          <ResultCard
            key={avatar.id}
            images={avatar.baseImages.slice(0, 3)}
            title={avatar.name}
            subtitle={avatar.metadata?.personality ?? ''}
            date={avatar.createdAt}
            badge={{
              label: avatar.type === 'reference' || avatar.type === 'clone' ? 'Desde fotos' : 'Desde cero',
              color: avatar.type === 'manual' ? 'violet' as any : 'fuchsia',
            }}
            pills={[
              avatar.metadata?.ethnicity,
              avatar.metadata?.age,
              avatar.metadata?.gender,
            ].filter(Boolean) as string[]}
            accentColor={avatar.type === 'manual' ? 'violet' : 'fuchsia'}
            onClick={() => setSelectedAvatar(avatar)}
            actions={[
              { label: 'Ver modelo', onClick: e => { e.stopPropagation(); setSelectedAvatar(avatar); }, variant: 'primary' },
              { label: '', icon: <i className="fa-solid fa-trash text-xs" />, onClick: e => askDelete(avatar, e), variant: 'danger', title: 'Eliminar' },
            ]}
          />
        ))}
      </ResultLibraryGrid>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-[10001] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => { if (!deleting) setPendingDelete(null); }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-avatar-title"
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
              <Trash2 size={20} />
            </div>
            <h3 id="delete-avatar-title" className="text-lg font-bold text-slate-900">¿Eliminar a {pendingDelete.name}?</h3>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
              El modelo y sus fotos base se borrarán de tu biblioteca. Esto no se puede deshacer.
            </p>
            {deleteError && <p role="alert" className="text-sm text-rose-600 mt-3">{deleteError}</p>}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="flex-1 min-h-12 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="flex-1 min-h-12 rounded-2xl bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting ? <><Loader2 size={16} className="animate-spin" /> Eliminando...</> : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedAvatar && (
        <div className="fixed inset-0 z-[10000] bg-slate-900/98 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-7xl h-full max-h-[90vh] rounded-[40px] md:rounded-[64px] overflow-hidden flex flex-col md:flex-row shadow-2xl relative animate-in zoom-in duration-300">
              
              <button 
                onClick={() => setSelectedAvatar(null)} 
                className="absolute top-6 right-6 md:top-10 md:right-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-600 text-white flex items-center justify-center z-50 hover:bg-red-700 transition-all"
              >
                <i className="fa-solid fa-xmark text-lg md:text-xl"></i>
              </button>

              <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-100 flex flex-col p-6 md:p-12 overflow-y-auto custom-scrollbar">
                 <div className="aspect-[3/4] rounded-[32px] md:rounded-[48px] overflow-hidden shadow-2xl mb-8 md:mb-10 border-4 border-white">
                    <img 
                      src={selectedAvatar.baseImages[0]} 
                      alt={selectedAvatar.name} 
                      className="w-full h-full object-contain cursor-zoom-in" 
                      onClick={() => openZoomModal(selectedAvatar.baseImages, 0)}
                    />
                 </div>
                 <div className="space-y-4 md:space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Fotos base del modelo</h3>
                    <div className="grid grid-cols-3 gap-2 md:gap-3">
                       {selectedAvatar.baseImages.map((img, i) => (
                         <div key={i} className="group aspect-square rounded-xl md:rounded-2xl overflow-hidden relative border border-slate-200 cursor-pointer shadow-sm">
                            <img 
                              src={img} 
                              alt={`${selectedAvatar.name} plano ${i+1}`} 
                              className="w-full h-full object-contain" 
                              onClick={() => openZoomModal(selectedAvatar.baseImages, i)}
                            />
                            <button 
                              onClick={(e) => { e.stopPropagation(); downloadImage(img, `${selectedAvatar.name}_master_${i}.png`); }}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                            >
                              <i className="fa-solid fa-download"></i>
                            </button>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="flex-1 flex flex-col p-6 md:p-16 overflow-y-auto custom-scrollbar">
                 <header className="mb-8 md:mb-12">
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-2">
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{selectedAvatar.name}</h2>
                 </header>

                 <div className="space-y-8 md:space-y-12 animate-in fade-in duration-500">
                    <section className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                       {[
                         { label: 'Etnia', value: selectedAvatar.metadata.ethnicity, icon: 'fa-earth-americas' },
                         { label: 'Edad Aparente', value: selectedAvatar.metadata.age, icon: 'fa-user-clock' },
                         { label: 'Complexión', value: selectedAvatar.metadata.build, icon: 'fa-person' },
                         { label: 'Ojos / Mirada', value: selectedAvatar.metadata.eyes, icon: 'fa-eye' },
                         { label: 'Cabello', value: `${selectedAvatar.metadata.hairColor} (${selectedAvatar.metadata.hairType})`, icon: 'fa-scissors' },
                         { label: 'Personalidad', value: selectedAvatar.metadata.personality, icon: 'fa-brain' },
                         { label: 'Expresión', value: selectedAvatar.metadata.expression, icon: 'fa-face-smile' },
                         { label: 'Vibe Sugerido', value: selectedAvatar.metadata.vibe || 'Neutral', icon: 'fa-sparkles' },
                       ].map((item, i) => (
                         <div key={i} className="p-3 md:p-5 bg-slate-50 rounded-[20px] md:rounded-[28px] border border-slate-100 space-y-1 md:space-y-2">
                            <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <i className={`fa-solid ${item.icon} opacity-30`}></i> {item.label}
                            </p>
                            <p className="text-[10px] md:text-xs font-bold text-slate-800 uppercase truncate">{item.value}</p>
                         </div>
                       ))}
                    </section>

                    <section className="space-y-4 md:space-y-6">
                       <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Descripción del modelo</h4>
                       <div className="bg-brand-50/30 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-brand-100/50">
                          <p className="text-xs md:text-base text-slate-700 leading-relaxed font-medium italic">
                             "{selectedAvatar.physicalDescription}"
                          </p>
                       </div>
                    </section>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Zoom Gallery Modal - Replicated from other modules */}
      {zoomedImageIndex !== null && zoomedImages.length > 0 && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300"
          onClick={closeZoomModal}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeZoomModal();
            if (e.key === 'ArrowLeft') navigateZoom('prev');
            if (e.key === 'ArrowRight') navigateZoom('next');
          }}
          tabIndex={0}
        >
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={zoomedImages[zoomedImageIndex]} 
              alt={`Avatar Preview ${zoomedImageIndex + 1}`} 
              className="max-w-full max-h-[90vh] object-contain rounded-[40px] md:rounded-[56px] shadow-2xl animate-in zoom-in-50 transition-transform duration-300" 
              style={{ cursor: 'zoom-in' }}
            />

            {/* Close Button */}
            <button 
              onClick={closeZoomModal} 
              className="absolute top-4 right-4 md:top-8 md:right-8 w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:bg-red-700 transition-all z-10"
              aria-label="Cerrar galería"
            >
              <i className="fa-solid fa-xmark text-lg md:text-xl"></i>
            </button>

            {/* Download Button */}
            <button
                onClick={(e) => { e.stopPropagation(); downloadImage(zoomedImages[zoomedImageIndex], `avatar_plano_ampliado_${zoomedImageIndex + 1}.png`); }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-auto px-6 py-3 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all z-10 text-[10px] font-black uppercase"
                aria-label="Descargar imagen"
            >
                <i className="fa-solid fa-download mr-2"></i> Descargar Foto
            </button>


            {/* Navigation Arrows */}
            <button 
              onClick={(e) => { e.stopPropagation(); navigateZoom('prev'); }} 
              className="absolute left-4 md:left-8 w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center text-xl md:text-2xl opacity-80 hover:opacity-100 transition-all hover:scale-110"
              aria-label="Imagen anterior"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); navigateZoom('next'); }} 
              className="absolute right-4 md:right-8 w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center text-xl md:text-2xl opacity-80 hover:opacity-100 transition-all hover:scale-110"
              aria-label="Imagen siguiente"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarLibrary;
