// src/modules/ManualCreatorModule.tsx
import React, { useState } from 'react';
import { avatarService } from '../services/avatarService';
import { generationHistoryService } from '../services/generationHistoryService';
import { AvatarProfile } from '../types';
import ModuleTutorial from '../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../components/shared/tutorialConfigs';
import { useCreditGuard } from '../hooks/useCreditGuard';
import NoCreditsModal from '../components/shared/NoCreditsModal';
import { CREDIT_COSTS, MODEL_CREDIT_COST } from '../services/creditConfig';
import { downloadAsZip } from '../utils/imageUtils';
import { useAuth } from '../modules/auth/AuthContext';
import { GenerateButton } from '../components/shared/GenerateButton';
import { ModelSelector } from '../components/shared/ModelSelector';
import { useModelSelection } from '../hooks/useModelSelection';
import { 
  ETHNICITY_OPTIONS, AGE_OPTIONS, BUILD_OPTIONS, OUTFITS_MUJER, OUTFITS_HOMBRE, 
  EYE_COLORS, HAIR_COLORS, HAIR_TYPES, HAIR_LENGTHS, PERSONALITY_OPTIONS, EXPRESSION_OPTIONS 
} from '../constants';

// Nuevos componentes base
import { ImageLightbox } from '../components/shared/ImageLightbox';
import { FloatingActionBar } from '../components/shared/FloatingActionBar';
import { useScrollFAB } from '../hooks/useScrollFAB';

interface ManualCreatorModuleProps {
  onSave: (avatar: AvatarProfile) => void;
}

const ManualCreatorModule: React.FC<ManualCreatorModuleProps> = ({ onSave }) => {
  const { credits } = useAuth();
  const { modelId, setModelId } = useModelSelection();
  const [name, setName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  const [pendingAvatarData, setPendingAvatarData] = useState<AvatarProfile | null>(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // FAB scroll detection
  const { isVisible: fabVisible } = useScrollFAB({ threshold: 100, alwaysVisibleOnMobile: false });

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

  const totalCost = CREDIT_COSTS.CREATE_MODEL_MANUAL;
  const creditsAfter = Math.max(0, credits.available - totalCost);

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

  const handleSaveToLibrary = () => {
    if (pendingAvatarData) {
      onSave(pendingAvatarData);
      setPreviews([]);
      setPendingAvatarData(null);
      setName('');
      alert("Identidad guardada en la biblioteca con éxito.");
    }
  };

  const handleCreate = async () => {
    if (!name) return alert("Nombre de identidad requerido.");
    const ok = await checkAndDeduct(CREDIT_COSTS.CREATE_MODEL_MANUAL);
    if (!ok) return;
    setIsProcessing(true);
    setPreviews([]);
    setPendingAvatarData(null);
    setStatus('Sintetizando ADN Maestro...');

    try {
      const identityPrompt = `A ${data.gender}, ${data.age}, ${data.ethnicity}, ${data.build} build. Eyes: ${data.eyes}. Hair: ${data.hairLength}, ${data.hairType}, ${data.hairColor}. Style: ${data.personality}. Expression: ${data.expression}. Wearing ${data.outfit}.`;
      
      setStatus('Renderizando Set de Consistencia (4 planos)...');
      
      const shots = await avatarService.generateMasterSet(
        identityPrompt, 
        "blurry, low quality, distorted face, messy background", 
        data.gender, 
        data.outfit,
        data.personality,
        data.expression
      );
      
      setPreviews(shots);
      
      // Guardar en historial
      shots.forEach((img, idx) => {
        const labels = ["Frontal Master", "Trasero 180°", "Lateral 90°", "Rostro 1:1"];
        generationHistoryService.save({
          imageUrl: img,
          module: 'model_dna',
          moduleLabel: `Model DNA (${labels[idx]})`,
          creditsUsed: idx === 0 ? CREDIT_COSTS.CREATE_MODEL_MANUAL : 0,
          promptText: identityPrompt
        }).catch(console.error);
      });
      
      const physicalDescription = `Identidad digital de género ${data.gender}, edad ${data.age}, etnia ${data.ethnicity}, con complexión ${data.build}. Presenta ojos ${data.eyes} y cabello ${data.hairColor}, estilo ${data.hairLength} ${data.hairType}. Personalidad: ${data.personality}, con expresión: ${data.expression}.`;

      const newAvatar: AvatarProfile = {
        id: Date.now().toString(),
        name,
        type: 'scratch',
        identityPrompt,
        physicalDescription,
        negativePrompt: "blurry, low quality",
        baseImages: shots,
        metadata: data as any,
        createdAt: Date.now()
      };

      setPendingAvatarData(newAvatar);
      setStatus('Identidad sintetizada correctamente.');
    } catch (e: any) {
      alert("Error en síntesis de ADN: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const reset = () => {
    setPreviews([]);
    setPendingAvatarData(null);
    setName('');
    setStatus('');
    setIsProcessing(false);
  };

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500 pb-20">
        {/* Panel izquierdo: formulario */}
        <div className="space-y-6">
          <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
            <header className="border-b pb-4">
              <h2 className="text-xl font-black text-slate-900 uppercase italic">Model DNA <span className="text-brand-600">· From Scratch</span></h2>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-slate-400 text-xs font-medium">Crea una identidad digital 100% nueva desde cero.</p>
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

            <ModelSelector
              value={modelId}
              onChange={setModelId}
              disabled={isProcessing}
            />

            <div className="pt-4">
              <GenerateButton
                onClick={handleCreate}
                loading={isProcessing}
                disabled={!name || isProcessing}
                label="Sintetizar ADN Maestro"
                loadingLabel={status || 'Sintetizando...'}
                imageCount={1}
                creditsAfter={creditsAfter}
                className="py-5 rounded-[24px]"
              />
            </div>
          </section>

          {isProcessing && (
            <div className="bg-brand-900 p-6 rounded-[32px] text-white flex items-center gap-4 animate-pulse">
              <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-widest">{status}</p>
            </div>
          )}
        </div>

        {/* Panel derecho: resultados */}
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
                    onClick={() => downloadAsZip(previews, `Avatar_DNA_${name}_MasterSet.zip`, `avatar_dna_${name}`)}
                    className="flex-1 sm:flex-none px-5 py-3 bg-white/10 text-white rounded-xl text-[9px] font-black uppercase border border-white/5 hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-file-zipper"></i> ZIP SET
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
                  <div 
                    key={i} 
                    className="group relative aspect-[3/4] rounded-[32px] overflow-hidden bg-white shadow-xl transition-transform hover:scale-[1.02] duration-300 cursor-zoom-in" 
                    onClick={() => openLightbox(i)}
                  >
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

        {/* Lightbox universal */}
        {lightboxOpen && previews.length > 0 && (
          <ImageLightbox
            images={previews}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
            onDownload={(url, idx) => {
              const link = document.createElement('a');
              link.href = url;
              link.download = `avatar_dna_${name}_plano_${idx + 1}.png`;
              link.click();
            }}
            metadata={{ label: `ADN: ${name}` }}
          />
        )}

        {/* Floating Action Bar (FAB) contextual */}
        <FloatingActionBar
          isVisible={previews.length > 0 && fabVisible && !isProcessing}
          primaryAction={{
            label: 'Descargar ZIP',
            icon: <i className="fa-solid fa-download text-sm"></i>,
            onClick: () => downloadAsZip(previews, `Avatar_DNA_${name}_MasterSet.zip`, `avatar_dna_${name}`),
          }}
          onClearSelection={reset}
          selectedCount={0}
        />
      </div>
    </>
  );
};

export default ManualCreatorModule;