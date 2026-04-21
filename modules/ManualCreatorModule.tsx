import React, { useState } from 'react';
import { AvatarProfile } from '../types';
import { startClone, waitForCloneComplete } from '../services/avatarCloneService';
import { useCreditGuard } from '../hooks/useCreditGuard';
import NoCreditsModal from '../components/shared/NoCreditsModal';
import { CREDIT_COSTS } from '../services/creditConfig';
import JSZip from 'jszip';
import ModuleTutorial from '../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../components/shared/tutorialConfigs';
import { 
  ETHNICITY_OPTIONS, AGE_OPTIONS, BUILD_OPTIONS, OUTFITS_MUJER, OUTFITS_HOMBRE, 
  EYE_COLORS, HAIR_COLORS, HAIR_TYPES, HAIR_LENGTHS, PERSONALITY_OPTIONS, EXPRESSION_OPTIONS 
} from '../src/constants';

interface ManualCreatorModuleProps {
  onSave: (avatar: AvatarProfile) => void;
}

const ManualCreatorModule: React.FC<ManualCreatorModuleProps> = ({ onSave }) => {
  const [name, setName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  const [isZipping, setIsZipping] = useState(false);
  const [zoomedImageIndex, setZoomedImageIndex] = useState<number | null>(null);

  const [data, setData] = useState<AvatarProfile['metadata']>({
    gender: 'mujer',
    age: 'joven',
    build: 'tonificada',
    ethnicity: 'latina',
    eyes: 'marron',
    hairColor: 'castaño oscuro',
    hairType: 'liso perfecto',
    hairLength: 'melena',
    personality: 'Profesional y elegante',
    expression: 'natural',
    outfit: OUTFITS_MUJER[0]
  });

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal } = useCreditGuard();

  const handleGenderChange = (gender: 'mujer' | 'hombre') => {
    setData({
      ...data,
      gender,
      outfit: gender === 'mujer' ? OUTFITS_MUJER[0] : OUTFITS_HOMBRE[0]
    });
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllZip = async () => {
    if (previews.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      previews.forEach((p, i) => {
        const base64 = p.split(',')[1];
        zip.file(`avatar_dna_${name.replace(/\s+/g, '_')}_plano_${i + 1}.png`, base64, { base64: true });
      });
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Avatar_DNA_${name}_MasterSet.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error al crear el archivo ZIP");
    } finally {
      setIsZipping(false);
    }
  };

  const handleSaveToLibrary = () => {
    if (previews.length === 0) return;
    // Construir el prompt de identidad y la descripción física
    const identityPrompt = `A ${data.gender}, ${data.age}, ${data.ethnicity}, ${data.build} build. Eyes: ${data.eyes}. Hair: ${data.hairLength}, ${data.hairType}, ${data.hairColor}. Style: ${data.personality}. Expression: ${data.expression}. Wearing ${data.outfit}.`;
    const physicalDescription = `Identidad digital de género ${data.gender}, edad ${data.age}, etnia ${data.ethnicity}, con complexión ${data.build}. Presenta ojos ${data.eyes} y cabello ${data.hairColor}, estilo ${data.hairLength} ${data.hairType}. Personalidad: ${data.personality}, con expresión: ${data.expression}.`;

    const newAvatar: AvatarProfile = {
      id: Date.now().toString(),
      name,
      type: 'scratch',
      identityPrompt,
      physicalDescription,
      negativePrompt: "blurry, low quality, distorted face, messy background",
      baseImages: previews,
      metadata: data as any,
      createdAt: Date.now()
    };
    onSave(newAvatar);
    setPreviews([]);
    setName('');
    alert("Identidad guardada en la biblioteca con éxito.");
  };

  const handleCreate = async () => {
    if (!name) return alert("Nombre de identidad requerido.");
    const ok = await checkAndDeduct(CREDIT_COSTS.CREATE_MODEL_MANUAL);
    if (!ok) return;

    setIsProcessing(true);
    setStatus('Iniciando creación asíncrona...');
    setPreviews([]);

    try {
      // Construir el prompt de identidad con todos los campos seleccionados
      const identityPrompt = `A ${data.gender}, ${data.age}, ${data.ethnicity}, ${data.build} build. Eyes: ${data.eyes}. Hair: ${data.hairLength}, ${data.hairType}, ${data.hairColor}. Style: ${data.personality}. Expression: ${data.expression}. Wearing ${data.outfit}.`;
      const negativePrompt = "blurry, low quality, distorted face, messy background, extra limbs, bad anatomy";

      // Usar el mismo servicio asíncrono que para clonación, pero con mode='manual'
      const { jobId } = await startClone({
        mode: 'manual',
        name,
        identityPrompt,
        negativePrompt,
        gender: data.gender,
        personality: data.personality,
        expression: data.expression,
      });

      setStatus('Procesando en segundo plano...');
      const images = await waitForCloneComplete(jobId, (jobStatus, result) => {
        if (jobStatus === 'processing') setStatus('Generando activos maestros...');
        if (result && result.length === 4) setPreviews(result);
      });

      setPreviews(images);
      setStatus('Identidad sintetizada correctamente.');
    } catch (err: any) {
      alert("Error en síntesis de ADN: " + err.message);
      setStatus('Error');
    } finally {
      setIsProcessing(false);
    }
  };

  const openZoomModal = (index: number) => setZoomedImageIndex(index);
  const closeZoomModal = () => setZoomedImageIndex(null);
  const navigateZoom = (direction: 'prev' | 'next') => {
    if (zoomedImageIndex === null) return;
    let newIndex = zoomedImageIndex;
    if (direction === 'prev') newIndex = (zoomedImageIndex - 1 + previews.length) % previews.length;
    else newIndex = (zoomedImageIndex + 1) % previews.length;
    setZoomedImageIndex(newIndex);
  };

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500 pb-20">
        <div className="space-y-6">
          <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
            <header className="border-b pb-4">
              <h2 className="text-xl font-black text-slate-900 uppercase italic">Diseñador de ADN Maestro</h2>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-slate-400 text-xs font-medium">Configura cada rasgo para crear una identidad digital 100% nueva.</p>
                <ModuleTutorial moduleId="modelDnaManual" steps={TUTORIAL_CONFIGS.modelDnaManual} compact />
              </div>
            </header>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Nombre de la Identidad</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    autoComplete="off"
                    autoCapitalize="words"
                    className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-800 text-base md:text-sm" 
                    placeholder="Ej: Alpha v1" 
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Género</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => handleGenderChange('mujer')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${data.gender === 'mujer' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}>Mujer</button>
                    <button onClick={() => handleGenderChange('hombre')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${data.gender === 'hombre' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}>Hombre</button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Edad</label>
                  <select value={data.age} onChange={e => setData({...data, age: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base md:text-xs font-bold">
                    {AGE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Etnia</label>
                  <select value={data.ethnicity} onChange={e => setData({...data, ethnicity: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base md:text-xs font-bold">
                    {ETHNICITY_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Complexión Física</label>
                  <select value={data.build} onChange={e => setData({...data, build: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base md:text-xs font-bold">
                    {BUILD_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Color de Cabello</label>
                  <select value={data.hairColor} onChange={e => setData({...data, hairColor: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base md:text-xs font-bold">
                    {HAIR_COLORS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Largo de Pelo</label>
                  <select value={data.hairLength} onChange={e => setData({...data, hairLength: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base md:text-xs font-bold">
                    {HAIR_LENGTHS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Tipo de Pelo</label>
                  <select value={data.hairType} onChange={e => setData({...data, hairType: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base md:text-xs font-bold">
                    {HAIR_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Color de Ojos</label>
                  <select value={data.eyes} onChange={e => setData({...data, eyes: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base md:text-xs font-bold">
                    {EYE_COLORS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Personalidad</label>
                  <select value={data.personality} onChange={e => setData({...data, personality: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base md:text-xs font-bold">
                    {PERSONALITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Expresión</label>
                  <select value={data.expression} onChange={e => setData({...data, expression: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base md:text-xs font-bold">
                    {EXPRESSION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 block">Outfit Inicial</label>
                  <select value={data.outfit} onChange={e => setData({...data, outfit: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base md:text-xs font-bold">
                    {(data.gender === 'mujer' ? OUTFITS_MUJER : OUTFITS_HOMBRE).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button 
                onClick={handleCreate} 
                disabled={isProcessing} 
                className="w-full py-5 bg-brand-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {isProcessing ? status : 'Sintetizar ADN Maestro'}
              </button>
            </div>
          </section>

          {isProcessing && (
            <div className="bg-brand-900 p-6 rounded-[32px] text-white flex items-center gap-4 animate-pulse">
              <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-widest">{status}</p>
            </div>
          )}
        </div>

        <div className="bg-slate-900 rounded-[56px] p-8 min-h-[600px] flex flex-col shadow-2xl relative">
          {previews.length > 0 ? (
            <div className="space-y-6 animate-in zoom-in duration-500">
              <header className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-white/10 pb-6">
                <div>
                  <h3 className="text-white font-black text-xl uppercase italic tracking-tighter">{name}</h3>
                  <p className="text-brand-400 text-[8px] font-black uppercase tracking-widest">Sintetizado via ADN</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={downloadAllZip} 
                    disabled={isZipping}
                    className="flex-1 sm:flex-none px-5 py-3 bg-white/10 text-white rounded-xl text-[9px] font-black uppercase border border-white/5 hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isZipping ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-file-zipper"></i>}
                    ZIP SET
                  </button>
                  <button 
                    onClick={handleSaveToLibrary}
                    className="flex-1 sm:flex-none px-6 py-3 bg-brand-500 text-white rounded-xl text-[9px] font-black uppercase shadow-lg hover:bg-brand-400 transition-all"
                  >
                    Guardar
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-2 gap-4">
                {previews.map((p, i) => (
                  <div key={i} className={`group relative aspect-[3/4] rounded-[32px] overflow-hidden bg-white shadow-xl transition-transform hover:scale-[1.02] duration-300 cursor-pointer`} onClick={() => openZoomModal(i)}>
                    <img src={p} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); downloadImage(p, `avatar_dna_${name}_plano_${i+1}.png`); }}
                        className="w-10 h-10 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                      >
                        <i className="fa-solid fa-download"></i>
                      </button>
                    </div>
                    <div className="absolute top-4 left-4 px-3 py-1 bg-black/40 text-white text-[8px] font-black rounded-full uppercase border border-white/10 backdrop-blur-sm">
                      {["P1: Frontal Master", "P2: Trasero 180°", "P3: Lateral 90°", "P4: Rostro 1:1"][i]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center text-4xl text-white/10 border border-white/10">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
              </div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Vista ADN Master</h3>
              <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto italic leading-relaxed">
                Configura los rasgos a la izquierda para sintetizar el set maestro. <br/> Podrás guardar el personaje y usarlo en tus campañas publicitarias.
              </p>
            </div>
          )}
        </div>

        {/* Zoom Gallery Modal */}
        {zoomedImageIndex !== null && (
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
                src={previews[zoomedImageIndex]} 
                alt={`Avatar Preview ${zoomedImageIndex + 1}`} 
                className="max-w-full max-h-[90vh] object-contain rounded-[40px] md:rounded-[56px] shadow-2xl animate-in zoom-in-50 transition-transform duration-300" 
                style={{ cursor: 'zoom-in' }}
              />
              <button 
                onClick={closeZoomModal} 
                className="absolute top-4 right-4 md:top-8 md:right-8 w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:bg-red-700 transition-all z-10"
                aria-label="Cerrar galería"
              >
                <i className="fa-solid fa-xmark text-lg md:text-xl"></i>
              </button>
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
    </>
  );
};

export default ManualCreatorModule;