import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvatarProfile } from '../types';
import ModuleTutorial from './shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from './shared/tutorialConfigs';

interface AvatarLibraryProps {
  avatars: AvatarProfile[];
}

const AvatarLibrary: React.FC<AvatarLibraryProps> = ({ avatars }) => {
  const navigate = useNavigate();
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarProfile | null>(null);
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

  const deleteAvatar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Seguro que quieres eliminar este modelo permanentemente?")) {
      alert("Operación de borrado activada para: " + id);
      // Implement actual delete logic here with dbService.deleteAvatar(id)
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
            <p className="text-slate-400 font-medium italic text-xs md:text-sm">Gestiona tus modelos digitales.</p>
            <ModuleTutorial moduleId="avatarLibrary" steps={TUTORIAL_CONFIGS.avatarLibrary} />
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => navigate('/crear/clonar')} className="flex-1 md:flex-none px-5 md:px-6 py-3 md:py-4 bg-brand-600 text-white rounded-[16px] md:rounded-[20px] text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all">Nueva Clonación</button>
          <button onClick={() => navigate('/crear/manual')} className="flex-1 md:flex-none px-5 md:px-6 py-3 md:py-4 bg-slate-900 text-white rounded-[16px] md:rounded-[20px] text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all">Crear ADN</button>
        </div>
      </header>


      {avatars.length === 0 ? (
        <div className="bg-white p-12 md:p-24 rounded-[40px] md:rounded-[64px] border-2 border-dashed border-slate-100 text-center">
           <i className="fa-solid fa-user-astronaut text-5xl md:text-7xl text-slate-100 mb-6 md:mb-8"></i>
           <p className="text-slate-400 font-black uppercase text-xs md:text-sm tracking-[0.2em]">No hay modelos registrados</p>
           <p className="text-slate-300 text-[10px] md:text-xs mt-3 italic">Usa el laboratorio para crear tu primera identidad digital.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
          {avatars.map(avatar => (
            <div 
              key={avatar.id} 
              className="bg-white p-5 md:p-6 rounded-[40px] md:rounded-[56px] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group cursor-pointer"
              onClick={() => setSelectedAvatar(avatar)}
            >
              <div 
                className="aspect-[3/4] rounded-[32px] md:rounded-[44px] overflow-hidden bg-slate-50 mb-6 md:mb-8 relative shadow-inner cursor-zoom-in group-hover:scale-105 transition-transform duration-700"
                onClick={(e) => { e.stopPropagation(); openZoomModal(avatar.baseImages, imgIdx[avatar.id] || 0); }}
              >
                 <img 
                    src={avatar.baseImages[imgIdx[avatar.id] || 0]} 
                    alt={avatar.name} 
                    className="w-full h-full object-contain" 
                 />
                 {/* Zoom Overlay on hover */}
                 <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                   <i className="fa-solid fa-magnifying-glass-plus text-3xl md:text-4xl"></i>
                 </div>
                 {/* Navigation dots */}
                 <div className="absolute bottom-6 inset-x-6 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {avatar.baseImages.map((_, i) => (
                      <button 
                        key={i} 
                        onClick={(e) => { e.stopPropagation(); setImgIdx({...imgIdx, [avatar.id]: i}); }} 
                        className={`h-1.5 rounded-full transition-all ${ (imgIdx[avatar.id] || 0) === i ? 'w-8 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'}`} 
                      />
                    ))}
                 </div>
                 {/* Type badges */}
                 <div className="absolute top-6 left-6 flex gap-2">
                   <span className={`px-4 py-1.5 text-[8px] md:text-[9px] font-black rounded-full text-white border border-white/20 backdrop-blur-md ${avatar.type === 'reference' ? 'bg-brand-500/60' : 'bg-accent-500/60'}`}>
                      {avatar.type === 'reference' ? 'PROT. CLON' : 'ADN MASTER'}
                   </span>
                 </div>
                 {/* Delete button */}
                 <button onClick={(e) => deleteAvatar(avatar.id, e)} className="absolute top-6 right-6 w-8 h-8 bg-red-50/80 backdrop-blur-md text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white">
                   <i className="fa-solid fa-trash-can text-xs"></i>
                 </button>
              </div>
              <div className="px-3 md:px-4 space-y-4 md:space-y-5"> {/* Increased mobile px */}
                 <div className="flex justify-between items-start">
                    <div>
                       <h4 className="text-lg md:text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{avatar.name}</h4> {/* Adjusted mobile text size */}
                       <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">{avatar.metadata.personality}</p> {/* Adjusted mobile text size */}
                    </div>
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 group-hover:bg-brand-50 group-hover:text-brand-500 transition-all">
                       <i className="fa-solid fa-chevron-right text-xs"></i>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="bg-slate-50 p-2 md:p-3 rounded-xl md:rounded-2xl border border-slate-100 text-center">
                       <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Etnia</p> {/* Adjusted mobile text size */}
                       <p className="text-[10px] md:text-sm font-black text-slate-800 uppercase tracking-tighter truncate">{avatar.metadata.ethnicity}</p> {/* Adjusted mobile text size */}
                    </div>
                    <div className="bg-slate-50 p-2 md:p-3 rounded-xl md:rounded-2xl border border-slate-100 text-center">
                       <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Edad Aprox.</p> {/* Adjusted mobile text size */}
                       <p className="text-[10px] md:text-sm font-black text-slate-800">{avatar.metadata.age}</p> {/* Adjusted mobile text size */}
                    </div>
                 </div>
              </div>
            </div>
          ))}
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
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Master Asset Set (Base)</h3>
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
                       <span className="px-2 md:px-3 py-1 bg-brand-50 text-brand-500 text-[7px] md:text-[8px] font-black uppercase rounded-full border border-brand-100 tracking-widest">Digital Model ID: {selectedAvatar.id.slice(-6)}</span>
                       <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-accent-500 rounded-full"></span>
                        <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest">Estado: Activo en Cloud</span>
                       </div>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{selectedAvatar.name}</h2>
                 </header>

                 <div className="space-y-8 md:space-y-12 animate-in fade-in duration-500">
                    <section className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                       {[
                         { label: 'Etnia / ADN', value: selectedAvatar.metadata.ethnicity, icon: 'fa-dna' },
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
                       <h4 className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Descripción Física Narrativa (IA)</h4>
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