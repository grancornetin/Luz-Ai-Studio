// CloneImageModule.tsx
import React, { useMemo, useState } from "react";
import {
  cloneImageService,
  type AspectRatio,
  type CameraStyle,
  type CloneImageParams,
  type SubjectSelector,
} from "../services/cloneImageService";
import { generationHistoryService } from "../services/generationHistoryService";
import ModuleTutorial from "../components/shared/ModuleTutorial";
import { TUTORIAL_CONFIGS } from "../components/shared/tutorialConfigs";
import { useCreditGuard } from "../../hooks/useCreditGuard";
import NoCreditsModal from "../components/shared/NoCreditsModal";
import { CREDIT_COSTS } from "../services/creditConfig";

type Step = 1 | 2 | 3 | 4;

import { readAndCompressFile } from '../utils/imageUtils';

function readFileAsDataURL(file: File): Promise<string> {
  return readAndCompressFile(file);
}

function isDataUrl(s: string) {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test((s || "").trim());
}

function normalizeImageInput(input: string | null | undefined): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  if (isDataUrl(raw)) return raw;
  return `data:image/png;base64,${raw}`;
}

// --- COMPONENTS UI PRO ---

const ProHeader: React.FC<{ title: string; subtitle: string; icon: string }> = ({ title, subtitle, icon }) => (
  <div className="flex items-center gap-4 mb-6">
    <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-sm">
      <i className={`fa-solid ${icon} text-xl`}></i>
    </div>
    <div>
      <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{title}</h2>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{subtitle}</p>
    </div>
  </div>
);

const ProStepIndicator: React.FC<{ current: Step; setStep: (s: Step) => void; maxStep: number }> = ({ current, setStep, maxStep }) => (
  <div className="flex gap-1 mb-8 bg-slate-50 p-1 rounded-2xl border border-slate-100">
    {[1, 2, 3, 4].map((s) => {
      const step = s as Step;
      const isActive = current === step;
      const isUnlocked = step <= maxStep;
      
      let label = "";
      if (step === 1) label = "Target";
      if (step === 2) label = "Identidad";
      if (step === 3) label = "Base";
      if (step === 4) label = "Outfit";

      return (
        <button
          key={step}
          onClick={() => isUnlocked && setStep(step)}
          disabled={!isUnlocked}
          className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            isActive
              ? "bg-white text-brand-600 shadow-md border border-slate-100"
              : isUnlocked
              ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              : "text-slate-300 cursor-not-allowed"
          }`}
        >
          <span className="hidden md:inline">{step}. {label}</span>
          <span className="md:hidden">{step}</span>
        </button>
      );
    })}
  </div>
);

const ProUploadCard: React.FC<{
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  hint?: string;
  height?: string;
  icon?: string;
}> = ({ label, value, onChange, hint, height = "h-48", icon = "fa-image" }) => (
  <div className="group relative w-full">
    <div className={`relative w-full ${height} bg-slate-50 rounded-[24px] border-2 border-dashed border-slate-200 overflow-hidden transition-all hover:border-brand-300 hover:bg-brand-50/30`}>
      {value ? (
        <>
          <img src={value} alt="Preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
             <label className="cursor-pointer w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-lg hover:scale-110 transition-transform">
                <i className="fa-solid fa-rotate-right text-xs"></i>
                <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) onChange(await readFileAsDataURL(f));
                }} />
             </label>
             <button onClick={() => onChange(null)} className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                <i className="fa-solid fa-trash text-xs"></i>
             </button>
          </div>
        </>
      ) : (
        <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
             <i className={`fa-solid ${icon} text-slate-300 text-lg group-hover:text-brand-400 transition-colors`}></i>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
          <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) onChange(await readFileAsDataURL(f));
          }} />
        </label>
      )}
    </div>
    {hint && <p className="mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide text-center">{hint}</p>}
  </div>
);

const ProSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}> = ({ label, value, onChange, options }) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-2xl px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <i className="fa-solid fa-chevron-down text-xs"></i>
      </div>
    </div>
  </div>
);

const ProToggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }> = ({ checked, onChange, label, description }) => (
  <div 
    onClick={() => onChange(!checked)}
    className={`p-4 rounded-[24px] border-2 cursor-pointer transition-all ${checked ? 'border-brand-600 bg-brand-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
  >
    <div className="flex items-center justify-between">
       <div className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'border-brand-600 bg-brand-600' : 'border-slate-300'}`}>
             {checked && <i className="fa-solid fa-check text-white text-[10px]"></i>}
          </div>
          <div>
             <p className={`text-[10px] font-black uppercase tracking-widest ${checked ? 'text-brand-900' : 'text-slate-600'}`}>{label}</p>
             {description && <p className="text-[9px] font-medium text-slate-400 mt-0.5">{description}</p>}
          </div>
       </div>
    </div>
  </div>
);

// --- MAIN MODULE ---

export default function CloneImageModule() {
  // Navigation
  const [step, setStep] = useState<Step>(1);
  const [maxStep, setMaxStep] = useState<number>(1);

  // Settings
  const [cameraStyle, setCameraStyle] = useState<CameraStyle>("iphone_1x");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");

  // Assets
  const [targetImage, setTargetImage] = useState<string | null>(null);
  
  // Subject 1
  const [face1, setFace1] = useState<string | null>(null);
  const [body1, setBody1] = useState<string | null>(null);
  
  // Subject 2
  const [enableSecondSubject, setEnableSecondSubject] = useState(false);
  const [subject1Selector, setSubject1Selector] = useState<SubjectSelector>("auto");
  const [face2, setFace2] = useState<string | null>(null);
  const [body2, setBody2] = useState<string | null>(null);

  // Outfits
  const [replaceOutfit1, setReplaceOutfit1] = useState(false);
  const [outfit1, setOutfit1] = useState<string | null>(null);
  const [replaceOutfit2, setReplaceOutfit2] = useState(false);
  const [outfit2, setOutfit2] = useState<string | null>(null);

  // Outputs
  const [baseComposition, setBaseComposition] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // --- Logic Helpers ---

  const canGoToIdentity = !!targetImage;
  const canGoToBase = !!face1 && !!body1 && (!enableSecondSubject || (!!face2 && !!body2));
  const canGoToOutfit = !!baseComposition;

  // Auto-advance step unlock
  useMemo(() => {
    let m = 1;
    if (canGoToIdentity) m = 2;
    if (canGoToBase) m = 3;
    if (canGoToOutfit) m = 4;
    if (m > maxStep) setMaxStep(m);
  }, [canGoToIdentity, canGoToBase, canGoToOutfit, maxStep]);

  function resetDownstream(fromStep: Step) {
    if (fromStep <= 2) {
      setBaseComposition(null);
      setFinalImage(null);
      setMaxStep(Math.min(maxStep, 2));
    }
    if (fromStep === 3) {
      setFinalImage(null);
      setMaxStep(Math.min(maxStep, 3));
    }
  }

  // --- Actions ---

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal } = useCreditGuard();

  async function handleGenerateBase() {
    const ok = await checkAndDeduct(CREDIT_COSTS.CLONE_IMAGE);
    if (!ok) return;
    setError(null);
    setLoading(true);
    setStatusMsg("Analizando escena y geometría...");
    
    try {
      const payload: CloneImageParams = {
        targetImage: normalizeImageInput(targetImage)!,
        faceImage: normalizeImageInput(face1)!,
        bodyImage: normalizeImageInput(body1)!,
        replaceOutfit: false,
        cameraStyle,
        aspectRatio,
        enableSecondSubject,
        subject1Selector,
        faceImage2: enableSecondSubject ? normalizeImageInput(face2) : null,
        bodyImage2: enableSecondSubject ? normalizeImageInput(body2) : null,
        replaceOutfit2: false,
      };

      // Simulate step progression visually
      setTimeout(() => setStatusMsg("Inyectando identidad (Bio-Lock)..."), 2000);
      setTimeout(() => setStatusMsg("Sintetizando composición base..."), 5000);

      const img = await cloneImageService.cloneImage(payload);
      setBaseComposition(img);
      
      // Guardar en historial (background)
      generationHistoryService.save({
        imageUrl: img,
        module: 'scene_clone',
        moduleLabel: 'Scene Clone (Base)',
        creditsUsed: CREDIT_COSTS.CLONE_IMAGE,
        promptText: `Clonación de escena base con estilo ${cameraStyle}`
      }).catch(console.error);

      setStep(4);
    } catch (e: any) {
      setError(e?.message || "Error al generar.");
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  }

  async function handleApplyOutfits() {
    if (!baseComposition) return;
    setError(null);
    setLoading(true);
    setStatusMsg("Mapeando prendas sobre la composición...");

    try {
      const payload: CloneImageParams = {
        targetImage: normalizeImageInput(baseComposition)!, // Important: use Base as target
        faceImage: normalizeImageInput(face1)!,
        bodyImage: normalizeImageInput(body1)!,
        
        replaceOutfit: !!replaceOutfit1,
        outfitOverrideImage: replaceOutfit1 ? normalizeImageInput(outfit1) : null,
        
        cameraStyle,
        aspectRatio,
        enableSecondSubject,
        subject1Selector,
        
        faceImage2: enableSecondSubject ? normalizeImageInput(face2) : null,
        bodyImage2: enableSecondSubject ? normalizeImageInput(body2) : null,
        
        replaceOutfit2: enableSecondSubject ? !!replaceOutfit2 : false,
        outfitOverrideImage2: enableSecondSubject && replaceOutfit2 ? normalizeImageInput(outfit2) : null,
      };

      const img = await cloneImageService.cloneImage(payload);
      setFinalImage(img);

      // Guardar en historial (background)
      generationHistoryService.save({
        imageUrl: img,
        module: 'scene_clone',
        moduleLabel: 'Scene Clone (Final)',
        creditsUsed: 0, // Ya se cobró en la base o es parte del proceso
        promptText: `Clonación final con aplicación de outfits`
      }).catch(console.error);
    } catch (e: any) {
      setError(e?.message || "Error al aplicar outfit.");
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  }

  const activePreview = step === 1 ? targetImage 
                      : step === 3 ? (loading ? null : (baseComposition || targetImage)) 
                      : step === 4 ? (finalImage || baseComposition) 
                      : null;

  return (
    <>
    <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />
    <div className="max-w-7xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
      
      {/* --- HEADER --- */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4 pt-2">
        <div className="text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Clone <span className="text-brand-600">Master</span></h1>
          <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
            <p className="text-slate-500 font-bold uppercase text-[8px] md:text-[10px] tracking-[0.3em] italic">Identity & Scene Lock Protocol</p>
            <ModuleTutorial moduleId="sceneClone" steps={TUTORIAL_CONFIGS.sceneClone} />
          </div>
        </div>
        <div className="flex bg-white p-1 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm">
           <button onClick={() => { setStep(1); resetDownstream(1); setTargetImage(null); }} className="px-6 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-all">Reset</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 md:px-0">
        
        {/* --- LEFT CONTROL PANEL --- */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white p-6 md:p-8 rounded-[40px] border border-slate-100 shadow-sm">
            <ProStepIndicator current={step} setStep={setStep} maxStep={maxStep} />

            {/* STEP 1: TARGET */}
            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-left-4">
                <ProHeader title="Target Blueprint" subtitle="La escena a replicar" icon="fa-bullseye" />
                <ProUploadCard 
                  label="Subir Target" 
                  value={targetImage} 
                  onChange={(v) => { setTargetImage(v); resetDownstream(1); }} 
                  hint="Esta imagen define la pose, iluminación y encuadre."
                  height="h-64"
                />
                
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <ProSelect 
                    label="Formato" 
                    value={aspectRatio} 
                    onChange={(v) => setAspectRatio(v as AspectRatio)}
                    options={[
                      { label: "9:16 (Story)", value: "9:16" },
                      { label: "4:5 (Feed)", value: "4:5" },
                      { label: "1:1 (Cuadrado)", value: "1:1" },
                      { label: "16:9 (Cine)", value: "16:9" },
                    ]} 
                  />
                  <ProSelect 
                    label="Estilo Cámara" 
                    value={cameraStyle} 
                    onChange={(v) => setCameraStyle(v as CameraStyle)}
                    options={[
                      { label: "iPhone 1x", value: "iphone_1x" },
                      { label: "Ultra Wide 0.5x", value: "iphone_05x" },
                      { label: "Selfie Frontal", value: "iphone_selfie" },
                    ]} 
                  />
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => canGoToIdentity && setStep(2)} 
                    disabled={!canGoToIdentity}
                    className="w-full py-5 bg-brand-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continuar a Identidad
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: IDENTITIES */}
            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-left-4">
                <ProHeader title="Identidades" subtitle="Sujetos a inyectar" icon="fa-user-group" />
                
                {/* Subject 1 */}
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-brand-900 uppercase tracking-widest">Sujeto 1 (Principal)</label>
                    {enableSecondSubject && (
                      <div className="flex bg-slate-100 rounded-lg p-0.5">
                         {['left','auto','right'].map(s => (
                           <button 
                             key={s}
                             onClick={() => setSubject1Selector(s as SubjectSelector)}
                             className={`px-2 py-1 text-[8px] font-bold uppercase rounded-md transition-all ${subject1Selector === s ? 'bg-white shadow text-brand-600' : 'text-slate-400'}`}
                           >
                             {s === 'auto' ? 'Auto' : s === 'left' ? 'Izq' : 'Der'}
                           </button>
                         ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ProUploadCard label="Cara" value={face1} onChange={(v) => { setFace1(v); resetDownstream(2); }} height="h-32" icon="fa-face-smile" />
                    <ProUploadCard label="Cuerpo" value={body1} onChange={(v) => { setBody1(v); resetDownstream(2); }} height="h-32" icon="fa-person" />
                  </div>
                </div>

                {/* Multi-Subject Toggle */}
                <ProToggle 
                  checked={enableSecondSubject} 
                  onChange={(v) => { setEnableSecondSubject(v); resetDownstream(2); }} 
                  label="Habilitar 2º Persona" 
                  description="Si el target tiene dos personas visibles."
                />

                {/* Subject 2 */}
                {enableSecondSubject && (
                  <div className="space-y-3 animate-in fade-in">
                    <label className="text-[10px] font-black text-purple-900 uppercase tracking-widest">Sujeto 2</label>
                    <div className="grid grid-cols-2 gap-3">
                      <ProUploadCard label="Cara S2" value={face2} onChange={(v) => { setFace2(v); resetDownstream(2); }} height="h-32" icon="fa-face-smile" />
                      <ProUploadCard label="Cuerpo S2" value={body2} onChange={(v) => { setBody2(v); resetDownstream(2); }} height="h-32" icon="fa-person" />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button onClick={() => setStep(1)} className="px-6 py-4 bg-slate-100 text-slate-600 rounded-[20px] font-bold text-xs uppercase hover:bg-slate-200">
                    <i className="fa-solid fa-arrow-left"></i>
                  </button>
                  <button 
                    onClick={() => canGoToBase && setStep(3)} 
                    disabled={!canGoToBase}
                    className="flex-1 py-4 bg-brand-600 text-white rounded-[20px] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    Confirmar Identidad
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: GENERATE BASE */}
            {step === 3 && (
              <div className="space-y-6 animate-in slide-in-from-left-4">
                <ProHeader title="Generar Base" subtitle="Fusión de Escena + Identidad" icon="fa-wand-magic-sparkles" />
                
                <div className="p-6 bg-slate-50 rounded-[24px] border border-slate-200 text-center space-y-4">
                   <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-2xl">
                      🚀
                   </div>
                   <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase">Listo para procesar</h3>
                      <p className="text-[10px] text-slate-500 font-medium mt-1 leading-relaxed px-4">
                        La IA clonará la escena del target inyectando la identidad biométrica de tus referencias.
                      </p>
                   </div>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={handleGenerateBase} 
                    disabled={loading}
                    className="w-full py-6 bg-brand-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                  >
                    {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                    {loading ? "Procesando..." : "Generar Clonación"}
                  </button>
                </div>
                
                {baseComposition && !loading && (
                   <button onClick={() => setStep(4)} className="w-full py-4 bg-accent-50 text-accent-600 border border-accent-100 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-accent-100 transition-all">
                      Continuar a Outfit <i className="fa-solid fa-arrow-right ml-2"></i>
                   </button>
                )}
              </div>
            )}

            {/* STEP 4: OUTFIT (OPTIONAL) */}
            {step === 4 && (
              <div className="space-y-6 animate-in slide-in-from-left-4">
                <ProHeader title="Outfit Swap" subtitle="Personalización de vestuario" icon="fa-shirt" />
                
                <div className="space-y-4">
                  {/* Outfit S1 */}
                  <div className={`p-4 rounded-[24px] border transition-all ${replaceOutfit1 ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-200'}`}>
                     <div className="flex items-center justify-between mb-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-700">Cambiar Outfit S1</label>
                        <input type="checkbox" checked={replaceOutfit1} onChange={(e) => setReplaceOutfit1(e.target.checked)} className="w-5 h-5 accent-brand-600 cursor-pointer" />
                     </div>
                     {replaceOutfit1 && (
                        <ProUploadCard label="Ref. Outfit S1" value={outfit1} onChange={setOutfit1} height="h-32" icon="fa-shirt" />
                     )}
                  </div>

                  {/* Outfit S2 */}
                  {enableSecondSubject && (
                    <div className={`p-4 rounded-[24px] border transition-all ${replaceOutfit2 ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'}`}>
                       <div className="flex items-center justify-between mb-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-700">Cambiar Outfit S2</label>
                          <input type="checkbox" checked={replaceOutfit2} onChange={(e) => setReplaceOutfit2(e.target.checked)} className="w-5 h-5 accent-purple-600 cursor-pointer" />
                       </div>
                       {replaceOutfit2 && (
                          <ProUploadCard label="Ref. Outfit S2" value={outfit2} onChange={setOutfit2} height="h-32" icon="fa-shirt" />
                       )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                   <button onClick={() => setStep(3)} className="py-4 bg-white border border-slate-200 text-slate-600 rounded-[20px] font-black text-[10px] uppercase hover:bg-slate-50">
                      Volver a Base
                   </button>
                   <button 
                     onClick={handleApplyOutfits} 
                     disabled={loading}
                     className="py-4 bg-accent-600 text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-accent-700 active:scale-95 transition-all"
                   >
                     {loading ? "Aplicando..." : "Aplicar Cambios"}
                   </button>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-medium animate-in fade-in">
                <i className="fa-solid fa-circle-exclamation mr-2"></i> {error}
              </div>
            )}

          </section>
        </div>

        {/* --- RIGHT PREVIEW PANEL --- */}
        <div className="lg:col-span-8">
          <div className="bg-slate-900 rounded-[48px] p-8 md:p-12 min-h-[600px] md:min-h-[800px] flex flex-col shadow-2xl border-8 border-slate-800 relative overflow-hidden">
            
            {/* Top Bar */}
            <div className="flex justify-between items-center mb-8 relative z-10">
               <div>
                  <h3 className="text-white font-black text-2xl uppercase italic tracking-tighter">Visualizador</h3>
                  <p className="text-brand-400 text-[9px] font-black uppercase tracking-[0.3em]">
                    {step === 1 ? "TARGET INPUT" : step === 3 ? "BASE RESULT" : step === 4 ? "FINAL EDIT" : "CONFIGURANDO"}
                  </p>
               </div>
               {activePreview && (
                 <button onClick={() => setZoomedImage(activePreview)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all">
                    <i className="fa-solid fa-expand text-xs"></i>
                 </button>
               )}
            </div>

            {/* Main Display Area */}
            <div className="flex-1 relative rounded-[32px] overflow-hidden bg-slate-950/50 flex items-center justify-center border border-white/5 group">
               {loading ? (
                 <div className="text-center space-y-6 animate-pulse">
                    <div className="w-20 h-20 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto shadow-[0_0_30px_rgba(255,116,139,0.2)]"></div>
                    <div>
                       <h4 className="text-white font-black text-xl uppercase italic tracking-wider">{statusMsg || "Procesando..."}</h4>
                       <p className="text-brand-400 text-[10px] font-bold uppercase tracking-[0.4em] mt-2">Gemini Pro Engine Active</p>
                    </div>
                 </div>
               ) : activePreview ? (
                 <div className="relative w-full h-full p-4 md:p-8">
                    <img src={activePreview} className="w-full h-full object-contain drop-shadow-2xl" alt="Preview" />
                    <div className="absolute bottom-8 right-8 flex gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                       <a href={activePreview} download={`clone_result_${Date.now()}.png`} className="px-6 py-3 bg-white text-slate-900 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-transform flex items-center gap-2">
                          <i className="fa-solid fa-download"></i> Descargar
                       </a>
                    </div>
                 </div>
               ) : (
                 <div className="text-center space-y-4 opacity-30">
                    <i className="fa-regular fa-image text-6xl text-white"></i>
                    <p className="text-white text-xs font-bold uppercase tracking-widest">Esperando Input...</p>
                 </div>
               )}
            </div>

            {/* Comparison Mini-Bar (if Base exists in Step 4) */}
            {step === 4 && baseComposition && finalImage && (
               <div className="mt-6 flex gap-4 h-24">
                  <div className="w-20 rounded-xl overflow-hidden border border-white/20 cursor-pointer opacity-60 hover:opacity-100 transition-opacity" onClick={() => setFinalImage(null)}>
                     <img src={baseComposition} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 flex items-center">
                     <div className="h-0.5 w-full bg-white/10"></div>
                  </div>
                  <div className="w-20 rounded-xl overflow-hidden border-2 border-accent-500 cursor-pointer shadow-[0_0_15px_rgba(228,241,172,0.3)]">
                     <img src={finalImage} className="w-full h-full object-cover" />
                  </div>
               </div>
            )}

          </div>
        </div>

      </div>

      {/* ZOOM MODAL */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in" onClick={() => setZoomedImage(null)}>
           <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in" />
           <button className="absolute top-6 right-6 text-white text-4xl hover:text-slate-300 transition-colors"><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}

    </div>
    </>
  );
}