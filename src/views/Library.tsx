import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GenerationSet, AvatarProfile } from '../types';
import { dbService } from '../services/dbService';
import { downloadAsZip } from '../utils/imageUtils';
import { ImageLightbox } from '../components/shared/ImageLightbox';

interface LibraryProps {
  sets: GenerationSet[];
}

const Library: React.FC<LibraryProps> = ({ sets: initialSets }) => {
  const navigate = useNavigate();
  const [sets, setSets] = useState<GenerationSet[]>(initialSets);
  const [avatars, setAvatars] = useState<AvatarProfile[]>([]);
  const [isZipping, setIsZipping] = useState<string | null>(null);
  
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMetadata, setLightboxMetadata] = useState<{ label: string }>({ label: '' });

  useEffect(() => {
    setSets(initialSets);
    dbService.getAvatars().then(setAvatars);
  }, [initialSets]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que quieres eliminar esta producción permanentemente?")) return;
    await dbService.deleteSet(id);
    setSets(prev => prev.filter(s => s.id !== id));
  };

  const handleZip = async (set: GenerationSet) => {
    setIsZipping(set.id);
    try {
      const imagesToZip: string[] = [];
      for (let i = 0; i < set.shots.length; i++) {
        if (set.shots[i].imageUrl) {
          imagesToZip.push(set.shots[i].imageUrl!);
        }
      }
      if (imagesToZip.length === 0) return;
      await downloadAsZip(imagesToZip, `Campaña_${set.id.slice(-4)}.zip`, `shot_${set.id.slice(-4)}`);
    } catch (e) { 
      alert("Error al crear ZIP"); 
    } finally { 
      setIsZipping(null); 
    }
  };

  const handleReRun = (set: GenerationSet) => {
    navigate('/studio', { state: { 
      preSelectedAvatarId: set.avatarId, 
      preSelectedProductId: set.productId,
      reRun: { scenePrompt: set.scenePrompt }
    }});
  };

  // Abrir lightbox con todas las imágenes del set
  const openLightbox = (set: GenerationSet, initialIndex: number) => {
    const images: string[] = [];
    set.shots.forEach(shot => {
      if (shot.imageUrl) images.push(shot.imageUrl);
    });
    if (images.length === 0) return;
    setLightboxImages(images);
    setLightboxIndex(initialIndex);
    setLightboxMetadata({ label: `Set #${set.id.slice(-4)}` });
    setLightboxOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-32 animate-in fade-in duration-700">
      <header className="px-1 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Historial de <span className="text-brand-600">Producción</span></h1>
          <p className="text-slate-500 font-medium italic mt-2 text-sm">Gestiona tus campañas y activos publicitarios.</p>
        </div>
      </header>

      {sets.length === 0 ? (
        <div className="bg-white p-32 rounded-[64px] border-2 border-dashed border-slate-100 text-center">
           <i className="fa-solid fa-box-open text-7xl text-slate-100 mb-6"></i>
           <p className="text-slate-400 font-black uppercase text-sm tracking-[0.2em]">Sin actividad reciente</p>
           <button onClick={() => navigate('/studio')} className="mt-6 text-brand-600 font-black uppercase text-xs hover:underline">Iniciar primera producción</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-12">
           {sets.map(set => {
             const avatar = avatars.find(a => a.id === set.avatarId);
             return (
               <section key={set.id} className="bg-white p-8 md:p-10 rounded-[56px] border border-slate-100 shadow-sm hover:shadow-2xl transition-all space-y-10 group overflow-hidden">
                  <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                     <div className="flex items-center gap-6">
                        <div onClick={() => navigate('/modelos')} className="w-16 h-16 rounded-[20px] overflow-hidden border-2 border-slate-50 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                           <img src={avatar?.baseImages[0]} className="w-full h-full object-cover" title={`Ver ficha de ${avatar?.name}`} />
                        </div>
                        <div>
                           <div className="flex items-center gap-3">
                              <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Set #{set.id.slice(-4)}</h3>
                              <span className="px-3 py-1 bg-brand-50 text-brand-500 text-[10px] font-black rounded-full border border-brand-100 uppercase">DNA Lock Validado</span>
                           </div>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                              Model: {avatar?.name || 'Manual'} • {new Date(set.createdAt).toLocaleDateString()}
                           </p>
                        </div>
                     </div>
                     <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => handleReRun(set)} className="flex-1 md:flex-none px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800"><i className="fa-solid fa-rotate-right mr-2"></i>Re-Shoot</button>
                        <button onClick={() => handleZip(set)} disabled={!!isZipping} className="flex-1 md:flex-none px-6 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-50">
                           {isZipping === set.id ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-file-zipper mr-2"></i>} Export (.zip)
                        </button>
                        <button onClick={() => handleDelete(set.id)} className="w-14 py-4 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><i className="fa-solid fa-trash-can"></i></button>
                     </div>
                  </header>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                     {set.shots.map((shot, idx) => (
                       <div 
                         key={shot.id} 
                         className="relative aspect-[3/4] rounded-[32px] overflow-hidden shadow-sm bg-slate-50 group/shot cursor-zoom-in"
                         onClick={() => openLightbox(set, idx)}
                       >
                          {shot.imageUrl ? (
                            <>
                              <img src={shot.imageUrl} className="w-full h-full object-cover group-hover/shot:scale-110 transition-transform duration-700" />
                              {/* Overlay hover (desktop) con acciones */}
                              <div className="absolute inset-0 bg-black/60 opacity-0 md:group-hover/shot:opacity-100 flex items-center justify-center text-white transition-opacity p-6 text-center">
                                 <div>
                                    <p className="text-[10px] font-black uppercase mb-4 tracking-widest">{shot.name}</p>
                                    <div className="flex gap-2">
                                       <button 
                                         onClick={(e) => { e.stopPropagation(); const link = document.createElement('a'); link.href = shot.imageUrl!; link.download = `${shot.name}.png`; link.click(); }} 
                                         className="w-10 h-10 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
                                       ><i className="fa-solid fa-download"></i></button>
                                       <button 
                                         onClick={(e) => { e.stopPropagation(); navigate('/modelos'); }} 
                                         className="w-10 h-10 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
                                       ><i className="fa-solid fa-user-tag text-[10px]"></i></button>
                                    </div>
                                 </div>
                              </div>
                              {/* Botones de acción siempre visibles en mobile */}
                              <div className="absolute bottom-4 right-4 flex gap-2 md:hidden">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); const link = document.createElement('a'); link.href = shot.imageUrl!; link.download = `${shot.name}.png`; link.click(); }} 
                                  className="w-8 h-8 bg-white/90 text-slate-900 rounded-full flex items-center justify-center shadow-md"
                                ><i className="fa-solid fa-download text-[10px]"></i></button>
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-200"><i className="fa-solid fa-triangle-exclamation text-2xl mb-2"></i><span className="text-[10px] font-black uppercase">Error de Render</span></div>
                          )}
                          <div className="absolute top-4 left-4"><span className="px-3 py-1 bg-black/40 backdrop-blur-sm text-white text-[10px] font-black rounded-full border border-white/10">PLANO {idx+1}</span></div>
                       </div>
                     ))}
                  </div>

                  {set.scenePrompt && (
                    <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Prompt de Escenario Archivada</p>
                       <p className="text-xs font-bold text-slate-700 italic">"{set.scenePrompt}"</p>
                    </div>
                  )}
               </section>
             );
           })}
        </div>
      )}

      {/* LIGHTBOX UNIVERSAL */}
      {lightboxOpen && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onDownload={(url, idx) => {
            const link = document.createElement('a');
            link.href = url;
            link.download = `shot_${idx + 1}.png`;
            link.click();
          }}
          metadata={lightboxMetadata}
        />
      )}
    </div>
  );
};

export default Library;