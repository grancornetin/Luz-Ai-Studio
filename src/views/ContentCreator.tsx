
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { GenerationSet, Shot, FocusType, AvatarProfile, ProductProfile } from '../types';
import { geminiService } from '../services/geminiService';
import { generationHistoryService } from '../services/generationHistoryService';
import JSZip from 'jszip';
import { readAndCompressFile } from '../utils/imageUtils';

// Sesión optimizada a 4 disparos derivados + 1 Maestro (Total 5) según Instrucción Maestra
const UGC_SESSION_SHOTS: Record<FocusType, { name: string, prompt: string, focusRule: string }[]> = {
  avatar: [
    { name: "Direct Portrait 1x", prompt: "Master frontal portrait of REF_FACE. 1x iPhone lens. Professional lighting but natural skin texture.", focusRule: "IDENTITY OVERRIDE. Face must occupy 60% of frame. Strict 1:1 fidelity." },
    { name: "3/4 Biometric Profile", prompt: "Candid look 45 degrees. Highlight jawline and eyes from REF_FACE. Natural hair flow.", focusRule: "BIOMETRIC LOCK. Reconstruct features exactly from identity source." },
    { name: "Macro Detail Face", prompt: "Extreme close-up on eyes and skin texture of REF_FACE. Macro lens style.", focusRule: "DETAIL LOCK. High-resolution skin pores and iris detail." },
    { name: "Studio Headshot", prompt: "Clean headshot in REF_SCENE. Soft rim lighting on hair. Identity is the only hero.", focusRule: "EDITORIAL FOCUS. Zero background noise. Face is priority." }
  ],
  product: [
    { name: "Product Macro 0.5x", prompt: "Extreme macro of REF_PRODUCT. Ultra-wide 0.5x iPhone lens perspective. Show real textures and micro-details.", focusRule: "PRODUCT DOMINANCE. EXTREME CLOSE-UP. Product must occupy 80% of frame." },
    { name: "Handheld Interaction", prompt: "Candid moment holding REF_PRODUCT naturally. Real skin texture, natural window lighting.", focusRule: "PHYSICAL INTERACTION MANDATORY. Product must be firmly held, not floating." },
    { name: "Mirror Detail Check", prompt: "Mirror selfie showing REF_PRODUCT integrated on body. Flash reflection on mirror.", focusRule: "REALISTIC REFLECTION. Product and Identity 1:1." },
    { name: "Product & Portrait", prompt: "Medium shot. REF_PRODUCT held near the face of REF_FACE. 1x iPhone lens.", focusRule: "IDENTITY + PRODUCT BALANCE. Biometric 1:1." }
  ],
  outfit: [
    { name: "Full Outfit Check", prompt: "Full body head-to-toe showing REF_OUTFIT perfectly. 1x lens perspective.", focusRule: "OUTFIT DOMINANCE. Entire fit visible. No cropping." },
    { name: "Fabric Texture Macro", prompt: "Close-up of the fabric and seams of REF_OUTFIT on character's body.", focusRule: "MATERIAL FIDELITY. Macro details of outfit construction." },
    { name: "Mirror Fashion Selfie", prompt: "Casual mirror check. Focus on silhouette and styling of REF_OUTFIT.", focusRule: "CASUAL FASHION. Body fit 1:1." },
    { name: "Outfit & Scene Match", prompt: "Editorial pose in REF_SCENE. Highlight the outfit in the environment.", focusRule: "CONTEXT SYNERGY. Aesthetic framing." }
  ],
  scene: [
    { name: "Wide Atmosphere", prompt: "Environment (REF_SCENE) is dominant. 0.5x ultra-wide lens.", focusRule: "SCENE DOMINANCE. 90% Scene, 10% Subject." },
    { name: "Integrated Lifestyle", prompt: "Subject naturally placed in a corner of REF_SCENE. Atmospheric lighting.", focusRule: "SPACE DOMINANCE. Balanced composition." },
    { name: "Depth of Field Scene", prompt: "Focus on the depth and textures of the REF_SCENE elements.", focusRule: "CINEMATIC VIBE. Subject blends with space." },
    { name: "Golden Hour Scene", prompt: "Best lighting moment in REF_SCENE. Subject integrated perfectly.", focusRule: "MOOD PERSISTENCE." }
  ]
};

const ContentCreator: React.FC<{ avatars: AvatarProfile[], products: ProductProfile[], saveSet: (set: GenerationSet) => void }> = ({ avatars, products, saveSet }) => {
  const location = useLocation();
  const [refs, setRefs] = useState<{ [key: string]: string | null }>({
    face: null,
    product: null,
    outfit: null,
    scene: null
  });

  const [focus, setFocus] = useState<FocusType>('product');
  const [workflowStep, setWorkflowStep] = useState<'setup' | 'preview_master' | 'generating_session' | 'completed'>('setup');
  const [masterImage, setMasterImage] = useState<string | null>(null);
  const [currentSet, setCurrentSet] = useState<GenerationSet | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [isModifiedInCheckpoint, setIsModifiedInCheckpoint] = useState(false);

  useEffect(() => {
    const state = location.state as any;
    if (state) {
      if (state.preSelectedAvatarId) {
        const avatar = avatars.find(a => a.id === state.preSelectedAvatarId);
        if (avatar) setRefs(prev => ({ ...prev, face: avatar.baseImages[3] || avatar.baseImages[0] }));
      }
      if (state.preSelectedProductId) {
        const product = products.find(p => p.id === state.preSelectedProductId);
        if (product) setRefs(prev => ({ ...prev, product: product.generatedImages[0] || product.baseImages[0] }));
      }
    }
  }, [location.state, avatars, products]);

  const handleFileUpload = async (key: string, file: File) => {
    const compressed = await readAndCompressFile(file);
    setRefs(prev => ({ ...prev, [key]: compressed }));
    if (workflowStep === 'preview_master') {
      setIsModifiedInCheckpoint(true);
    }
  };

  const clearSlot = (key: string) => {
    setRefs(prev => ({ ...prev, [key]: null }));
    if (workflowStep === 'preview_master') {
      setIsModifiedInCheckpoint(true);
    }
  };

  const isMandatoryReady = !!refs.face;

  const getDnaStack = (isPhase2: boolean, master?: string) => {
    const dna: (string | null)[] = [];
    const map: string[] = [];

    if (isPhase2 && master) {
      dna.push(master);
      map.push("REF0=MASTER_IMAGE (Identity Anchor)");
    } else {
      dna.push(refs.face!); 
      map.push("REF0=IDENTITY_REDUNDANCY");
    }

    dna.push(refs.face!);
    map.push("REF1=FACE_MASTER (Absolute Biometric Truth)");

    if (refs.product) {
      dna.push(refs.product);
      map.push("REF2=[CONTEXT REF] PRODUCT ONLY. High priority material extraction.");
    } else {
      dna.push(null);
      map.push("REF2=EMPTY");
    }

    if (refs.outfit) {
      dna.push(refs.outfit);
      map.push("REF3=[CONTEXT REF] OUTFIT ONLY.");
    } else {
      dna.push(null);
      map.push("REF3=EMPTY");
    }

    if (refs.scene) {
      dna.push(refs.scene);
      map.push("REF4=[CONTEXT REF] SCENE ONLY.");
    } else {
      dna.push(null);
      map.push("REF4=EMPTY");
    }

    return { dna, mapInfo: map.join(' | ') };
  };

  const generateMasterImage = async () => {
    if (!isMandatoryReady) return;
    setWorkflowStep('preview_master');
    setMasterImage(null);
    setIsModifiedInCheckpoint(false);
    setStatus('Sintetizando Master Anchor...');

    const { dna, mapInfo } = getDnaStack(false);

    const masterPrompt = `
      [ULTRA-STRICT IDENTITY ANCHOR]
      Identity (REF1) is ABSOLUTE. 
      Reconstruct the person from REF1 with 1:1 biometric fidelity.
      
      [PHASE 1: SESSION START]
      [REFERENCE MAP: ${mapInfo}]

      [OBJECTIVE]
      Integrate all uploaded assets into ONE perfect master image.
      Face from REF1. Product from REF2. Outfit from REF3. Scene from REF4.
      Focus: ${focus.toUpperCase()}.
    `;

    try {
      const img = await geminiService.generateImage(masterPrompt, "generic model face, different person", true, '1K', dna);
      setMasterImage(img);
      
      // Guardar en historial (background)
      generationHistoryService.save({
        imageUrl: img,
        module: 'content_studio',
        moduleLabel: 'Content Studio (Master)',
        creditsUsed: 0, // Se cobra en la sesión completa o es parte del flujo
        promptText: masterPrompt.trim()
      }).catch(console.error);

      setStatus('');
    } catch (e) {
      alert("Error en síntesis base.");
      setWorkflowStep('setup');
    }
  };

  const startSession = async () => {
    if (!masterImage) return;
    setWorkflowStep('generating_session');
    setIsSaved(false);
    const setId = Date.now().toString();

    const shotsMeta = UGC_SESSION_SHOTS[focus];
    const initialShots: Shot[] = shotsMeta.map((s, idx) => ({
      id: `${setId}-${idx}`,
      name: s.name,
      prompt: s.prompt,
      negativePrompt: "altered identity, face drift, reinterpreted face",
      status: 'pending'
    }));

    setCurrentSet({ id: setId, avatarId: 'dna_v8.3_pro', focus, style: 'UGC', scenePrompt: 'Identity Locked Session', shots: initialShots, createdAt: Date.now() });

    const updatedShots = [...initialShots];
    for (let i = 0; i < updatedShots.length; i++) {
      updatedShots[i].status = 'generating';
      setStatus(`Capturando Shot ${i+1}/4: ${updatedShots[i].name}...`);
      setCurrentSet(prev => prev ? { ...prev, shots: [...updatedShots] } : null);

      const shotConfig = shotsMeta[i];
      const { dna, mapInfo } = getDnaStack(true, masterImage);

      const sessionPrompt = `
        [IDENTITY LOCK ACTIVE] 
        FACE_MASTER (REF1) and MASTER_IMAGE (REF0) are the only identity sources.
        
        [PHASE 2: PROGRESSIVE SHOT]
        [MAP: ${mapInfo}]

        [DERIVATION]
        - Maintain identity and assets IDENTICAL to MASTER_IMAGE.
        
        [SHOT CONFIG]
        NAME: ${shotConfig.name}
        RULE: ${shotConfig.focusRule}
        ACTION: ${shotConfig.prompt}
      `;

      try {
        const img = await geminiService.generateImage(sessionPrompt, updatedShots[i].negativePrompt, true, '1K', dna);
        updatedShots[i].imageUrl = img;
        updatedShots[i].status = 'completed';

        // Guardar en historial (background)
        generationHistoryService.save({
          imageUrl: img,
          module: 'content_studio',
          moduleLabel: `Content Studio (${updatedShots[i].name})`,
          creditsUsed: 0,
          promptText: sessionPrompt.trim()
        }).catch(console.error);

      } catch (e) {
        updatedShots[i].status = 'error';
      }
      setCurrentSet(prev => prev ? { ...prev, shots: [...updatedShots] } : null);
    }
    setWorkflowStep('completed');
    setStatus('');
  };

  const downloadAllZip = async () => {
    if (!currentSet || !masterImage) return;
    const zip = new JSZip();
    zip.file('0_Master_Anchor.png', masterImage.split(',')[1], { base64: true });
    currentSet.shots.forEach((shot, i) => {
      if (shot.imageUrl) {
        zip.file(`${i + 1}_${shot.name.replace(/\s+/g, '_')}.png`, shot.imageUrl.split(',')[1], { base64: true });
      }
    });
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sesion_Studio_${currentSet.id}.zip`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-32 animate-in fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Studio <span className="text-indigo-600">DNA Pro</span></h1>
          <p className="text-slate-500 font-bold uppercase text-[9px] tracking-[0.3em] mt-2 italic">Hierarchy of Identity Protocol v8.4</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {workflowStep === 'completed' && (
            <>
              <button onClick={downloadAllZip} className="w-full sm:w-auto px-6 md:px-8 py-3 rounded-2xl text-[10px] font-black uppercase bg-white border border-slate-200 text-slate-900 shadow-sm hover:bg-slate-50">
                Descargar ZIP completo
              </button>
              <button onClick={() => { saveSet(currentSet!); setIsSaved(true); }} disabled={isSaved} className={`w-full sm:w-auto px-6 md:px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${isSaved ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-900 text-white shadow-xl hover:bg-black'}`}>
                {isSaved ? 'Sesión Guardada' : 'Guardar en Historial'}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-2 md:px-0">
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white p-6 md:p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
            
            {/* 1. ROSTRO MAESTRO */}
            <div className={`space-y-4 ${workflowStep !== 'setup' ? 'opacity-40 pointer-events-none' : ''}`}>
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                1. Rostro Maestro (ADN)
                <span className="text-[8px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Obligatorio</span>
              </h2>
              <div className="p-4 rounded-3xl border-2 transition-all border-indigo-500 bg-indigo-50/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center bg-indigo-600 text-white overflow-hidden shadow-lg">
                    {refs.face ? <img src={refs.face!} className="w-full h-full object-cover" /> : <i className="fa-solid fa-face-smile"></i>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase text-slate-900 truncate">Face Master</p>
                    <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-tighter">{refs.face ? 'ADN Bloqueado' : 'Subir Rostro'}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {refs.face && <button onClick={() => clearSlot('face')} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-trash-can text-xs"></i></button>}
                    <label className="cursor-pointer">
                      <input type="file" hidden onChange={e => e.target.files?.[0] && handleFileUpload('face', e.target.files[0])} />
                      <span className="text-[10px] font-black text-indigo-600 uppercase underline">Cargar</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. FOCO DE SESIÓN */}
            <div className={`space-y-4 ${workflowStep !== 'setup' ? 'opacity-40 pointer-events-none' : ''}`}>
               <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">2. Comportamiento (Foco)</h2>
               <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
                  {[
                    { id: 'avatar', label: 'Retratos', icon: 'fa-user-circle' },
                    { id: 'product', label: 'Producto', icon: 'fa-gem' },
                    { id: 'outfit', label: 'Outfit', icon: 'fa-shirt' },
                    { id: 'scene', label: 'Escenario', icon: 'fa-image' }
                  ].map(item => (
                    <button 
                      key={item.id}
                      onClick={() => setFocus(item.id as FocusType)}
                      className={`p-3 md:p-4 rounded-2xl border text-center transition-all ${focus === item.id ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                    >
                      <i className={`fa-solid ${item.icon} mb-2 block text-base md:text-lg`}></i>
                      <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">{item.label}</p>
                    </button>
                  ))}
               </div>
            </div>

            {/* 3. ACTIVOS DE REFERENCIA */}
            <div className={`space-y-4 ${workflowStep !== 'setup' ? 'opacity-40 pointer-events-none' : ''}`}>
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">3. Activos de Referencia</h2>
              <div className="grid grid-cols-1 gap-3">
                 {[
                   { id: 'product', label: 'Producto', icon: 'fa-gem' },
                   { id: 'outfit', label: 'Outfit', icon: 'fa-shirt' },
                   { id: 'scene', label: 'Escenario', icon: 'fa-image' }
                 ].map(slot => (
                   <div key={slot.id} className={`p-4 rounded-3xl border transition-all ${refs[slot.id] ? 'border-emerald-500 bg-emerald-50/30' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${refs[slot.id] ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-200 shadow-sm'}`}>
                          {refs[slot.id] ? <img src={refs[slot.id]!} className="w-full h-full object-cover rounded-xl" /> : <i className={`fa-solid ${slot.icon}`}></i>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black uppercase text-slate-900 truncate">{slot.label}</p>
                          <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">{refs[slot.id] ? 'Referencia Activa' : 'Sin Cargar'}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                           {refs[slot.id] && <button onClick={() => clearSlot(slot.id)} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-trash-can text-xs"></i></button>}
                           <label className="cursor-pointer">
                             <input type="file" hidden onChange={e => e.target.files?.[0] && handleFileUpload(slot.id, e.target.files[0])} />
                             <span className="text-[9px] font-black text-indigo-600 uppercase underline">Cargar</span>
                           </label>
                        </div>
                      </div>
                   </div>
                 ))}
              </div>
            </div>

            {workflowStep === 'setup' ? (
              <button onClick={generateMasterImage} disabled={!isMandatoryReady} className="w-full py-5 md:py-6 bg-indigo-600 text-white rounded-[24px] font-black text-[10px] md:text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all">
                Sintetizar Master Anchor
              </button>
            ) : (
              <button onClick={() => { setWorkflowStep('setup'); setMasterImage(null); }} className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600">
                Reiniciar Configuración
              </button>
            )}
          </section>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-slate-900 rounded-[40px] md:rounded-[56px] p-6 md:p-12 min-h-[500px] md:min-h-[750px] flex flex-col shadow-2xl relative border-4 md:border-8 border-slate-800">
            {workflowStep === 'setup' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 md:p-12 opacity-40">
                <i className="fa-solid fa-dna text-5xl md:text-7xl text-white/5 mb-8"></i>
                <h3 className="text-white text-lg md:text-xl font-black uppercase italic tracking-tighter leading-none">Identity Anchor Enabled</h3>
                <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] mt-4 max-w-xs leading-relaxed">Configura el DNA maestro para iniciar la sesión con bloqueo biométrico 1:1.</p>
              </div>
            )}

            {workflowStep === 'preview_master' && (
              <div className="flex-1 flex flex-col space-y-8 animate-in fade-in">
                <header className="flex justify-between items-center border-b border-white/10 pb-6">
                   <div>
                     <h3 className="text-white font-black text-xl md:text-2xl uppercase italic tracking-tighter">Fase 1: Imagen Maestra</h3>
                     <p className="text-indigo-400 text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] mt-1 italic">Paso Crítico de Validación</p>
                   </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                  {/* Vista Previa de Imagen */}
                  <div className="md:col-span-7 flex flex-col items-center justify-center">
                    {masterImage ? (
                      <div className="w-full space-y-6">
                        <div className="aspect-[3/4] bg-slate-800 rounded-[30px] md:rounded-[40px] overflow-hidden shadow-2xl border-2 md:border-4 border-white/10 relative group">
                          <img src={masterImage} className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 bg-gradient-to-t from-black/90 to-transparent text-center">
                            <p className="text-white text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em]">CHECKPOINT DE FIDELIDAD</p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <button onClick={generateMasterImage} className="flex-1 py-4 md:py-5 bg-white/5 text-white rounded-2xl md:rounded-3xl font-black text-[9px] md:text-[10px] uppercase border border-white/10 hover:bg-white/10 transition-all">
                            {isModifiedInCheckpoint ? 'Resintetizar Ajustes' : 'Regenerar Versión'}
                          </button>
                          <button onClick={startSession} disabled={isModifiedInCheckpoint} className={`flex-1 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black text-[9px] md:text-[10px] uppercase shadow-2xl transition-all ${isModifiedInCheckpoint ? 'bg-slate-700 text-slate-500' : 'bg-indigo-500 text-white hover:bg-indigo-400'}`}>
                            {isModifiedInCheckpoint ? 'Sintetiza para Aprobar' : 'Aprobar y Crear Sesión'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[400px] md:h-[500px] flex-1 w-full flex flex-col items-center justify-center gap-6">
                        <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-white/5 border-t-indigo-500 rounded-full animate-spin"></div>
                        <p className="text-white text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">{status || 'Sintetizando Identidad...'}</p>
                      </div>
                    )}
                  </div>

                  {/* Panel de Gestión Hot-Swap */}
                  <div className="md:col-span-5 bg-white/5 rounded-[30px] md:rounded-[40px] border border-white/10 p-5 md:p-6 space-y-6">
                    <h4 className="text-[9px] md:text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-white/5 pb-4">Gestión de Activos</h4>
                    <div className="space-y-3 md:space-y-4">
                      {[
                        { id: 'face', label: 'Face ADN', icon: 'fa-face-smile', mandatory: true },
                        { id: 'product', label: 'Producto', icon: 'fa-gem' },
                        { id: 'outfit', label: 'Outfit', icon: 'fa-shirt' },
                        { id: 'scene', label: 'Escenario', icon: 'fa-image' }
                      ].map(slot => (
                        <div key={slot.id} className={`p-3 md:p-4 rounded-2xl border transition-all ${refs[slot.id] ? 'bg-white/10 border-white/10' : 'bg-white/5 border-dashed border-white/5 opacity-50'}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-800 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center text-[10px] text-white/40">
                              {refs[slot.id] ? <img src={refs[slot.id]!} className="w-full h-full object-cover" /> : <i className={`fa-solid ${slot.icon}`}></i>}
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-[8px] md:text-[9px] font-black text-white uppercase truncate">{slot.label}</p>
                               <p className="text-[7px] text-slate-500 font-bold uppercase">{refs[slot.id] ? 'Activa' : 'Sin Cargar'}</p>
                            </div>
                            <div className="flex gap-3 flex-shrink-0">
                               {refs[slot.id] && <button onClick={() => clearSlot(slot.id)} className="text-red-400 hover:text-red-300 transition-colors"><i className="fa-solid fa-trash-can text-xs"></i></button>}
                               <label className="cursor-pointer text-indigo-400 hover:text-indigo-300">
                                  <input type="file" hidden onChange={e => e.target.files?.[0] && handleFileUpload(slot.id, e.target.files[0])} />
                                  <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
                                </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-indigo-900/20 p-4 rounded-2xl border border-indigo-500/10">
                       <p className="text-[7px] md:text-[8px] text-indigo-300 font-bold uppercase leading-relaxed text-center">
                         <i className="fa-solid fa-circle-info mr-2"></i>
                         Si realizas cambios arriba, haz clic en "Resintetizar" para actualizar.
                       </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(workflowStep === 'generating_session' || workflowStep === 'completed') && (
              <div className="space-y-8 md:space-y-10 animate-in fade-in">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6 md:pb-8">
                   <div>
                     <h3 className="text-white font-black text-xl md:text-2xl uppercase italic tracking-tighter">Sesión Progresiva: {focus.toUpperCase()}</h3>
                     <p className="text-emerald-400 text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] mt-1 italic">Fidelidad 1:1 Garantizada</p>
                   </div>
                   {workflowStep === 'completed' && (
                     <button onClick={() => window.location.reload()} className="w-full sm:w-auto px-6 py-3 bg-white/10 text-white rounded-xl text-[9px] font-black uppercase border border-white/10 hover:bg-white/20 transition-all">Nueva Producción</button>
                   )}
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 pb-12">
                  {currentSet?.shots.map((shot, idx) => (
                    <div key={shot.id} className="bg-white/5 p-3 md:p-4 rounded-[30px] md:rounded-[48px] border border-white/5 space-y-4 group">
                      <div className="aspect-[3/4] rounded-[24px] md:rounded-[36px] bg-slate-800 overflow-hidden relative cursor-pointer" onClick={() => shot.imageUrl && setSelectedImage(shot.imageUrl)}>
                        {shot.status === 'generating' && (
                          <div className="absolute inset-0 bg-indigo-950/60 backdrop-blur-md flex flex-col items-center justify-center p-6 md:p-8 text-center">
                            <div className="w-8 h-8 md:w-10 md:h-10 border-4 border-white/10 border-t-white rounded-full animate-spin mb-4"></div>
                            <p className="text-[8px] md:text-[9px] font-black text-white uppercase tracking-widest italic">Capturando {idx+1}/4</p>
                          </div>
                        )}
                        {shot.imageUrl && <img src={shot.imageUrl} className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110" />}
                        <div className="absolute top-4 left-4 md:top-6 md:left-6 px-3 md:px-4 py-1.5 md:py-2 bg-black/60 backdrop-blur-xl text-white text-[7px] md:text-[8px] font-black rounded-full border border-white/10 uppercase tracking-widest">
                          {shot.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 md:p-6 animate-in fade-in" onClick={() => setSelectedImage(null)}>
           <div className="relative max-w-4xl w-full h-full flex flex-col items-center justify-center gap-6" onClick={e => e.stopPropagation()}>
              <img src={selectedImage} className="max-w-full max-h-[75vh] md:max-h-[85vh] object-contain rounded-[30px] md:rounded-[56px] shadow-2xl border-4 md:border-8 border-white/5 animate-in zoom-in" />
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                 <button onClick={() => { const l=document.createElement('a'); l.href=selectedImage; l.download='shot_session.png'; l.click(); }} className="w-full sm:w-auto px-8 md:px-12 py-4 md:py-5 bg-white text-slate-900 rounded-2xl md:rounded-3xl font-black text-[9px] md:text-[10px] uppercase tracking-widest shadow-2xl hover:scale-105 transition-all">Descargar Foto</button>
                 <button onClick={() => setSelectedImage(null)} className="w-full sm:w-auto px-8 md:px-12 py-4 md:py-5 bg-white/10 text-white rounded-2xl md:rounded-3xl font-black text-[9px] md:text-[10px] uppercase tracking-widest border border-white/10 backdrop-blur-md">Cerrar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ContentCreator;
