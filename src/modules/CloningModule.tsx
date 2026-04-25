// src/modules/CloningModule.tsx — v2.0 Dark AI-Native Theme
import React, { useState } from 'react';
import { geminiService } from '../services/geminiService';
import { avatarService } from '../services/avatarService';
import { generationHistoryService } from '../services/generationHistoryService';
import { AvatarProfile } from '../types';
import JSZip from 'jszip';
import ModuleTutorial from '../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../components/shared/tutorialConfigs';
import { useCreditGuard } from '../hooks/useCreditGuard';
import NoCreditsModal from '../components/shared/NoCreditsModal';
import { CREDIT_COSTS } from '../services/creditConfig';
import { Download, CheckCircle2, AlertCircle, X, ChevronLeft, ChevronRight, Zap, RotateCcw } from 'lucide-react';

interface CloningModuleProps {
  onSave: (avatar: AvatarProfile) => void;
}

type WorkflowStep =
  | 'idle' | 'analyzing' | 'generating_bodymaster'
  | 'validating_bodymaster' | 'generating_technical_set'
  | 'validating_facemaster' | 'completed';

const STEP_META: Record<WorkflowStep, { label: string; index: number }> = {
  idle:                     { label: 'Configurar',   index: 0 },
  analyzing:                { label: 'Analizando',   index: 1 },
  generating_bodymaster:    { label: 'Bodymaster',   index: 1 },
  validating_bodymaster:    { label: 'Checkpoint 1', index: 2 },
  generating_technical_set: { label: 'Set 360°',     index: 3 },
  validating_facemaster:    { label: 'Checkpoint 2', index: 4 },
  completed:                { label: 'Guardado',     index: 5 },
};

const STEP_LABELS = ['Config', 'Analizar', 'Bodymaster', 'Set 360°', 'Facemaster', 'Listo'];

const SHOT_LABELS = [
  { label: 'P1 · Bodymaster',    sub: 'Frontal técnico' },
  { label: 'P2 · Rear View',     sub: '180° vista trasera' },
  { label: 'P3 · Side Profile',  sub: '90° vista lateral' },
  { label: 'P4 · Facemaster',    sub: 'DNA facial 1:1' },
];

const CloningModule: React.FC<CloningModuleProps> = ({ onSave }) => {
  const [name, setName]                   = useState('');
  const [files, setFiles]                 = useState<string[]>([]);
  const [step, setStep]                   = useState<WorkflowStep>('idle');
  const [status, setStatus]               = useState('');
  const [isRegeneratingFace, setIsRegeneratingFace] = useState(false);
  const [previews, setPreviews]           = useState<string[]>([]);
  const [identityData, setIdentityData]   = useState<any>(null);
  const [isZipping, setIsZipping]         = useState(false);
  const [zoomedIndex, setZoomedIndex]     = useState<number | null>(null);

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal } = useCreditGuard();

  const isProcessing = ['analyzing', 'generating_bodymaster', 'generating_technical_set'].includes(step) || isRegeneratingFace;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setFiles(prev => [...prev, reader.result as string].slice(0, 3));
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const reset = () => {
    setName(''); setFiles([]); setStep('idle'); setStatus('');
    setPreviews([]); setIdentityData(null);
  };

  const startCloning = async () => {
    if (!name.trim()) return alert('Nombre del Digital Twin requerido.');
    if (files.length === 0) return alert('Sube al menos 1 foto de referencia.');
    const ok = await checkAndDeduct(CREDIT_COSTS.CREATE_MODEL_CLONE);
    if (!ok) return;

    setStep('analyzing');
    setStatus('Analizando biometría y género...');
    setPreviews([]);

    try {
      const ext = await geminiService.extractAvatarProfile(files);
      setIdentityData(ext);

      setStep('generating_bodymaster');
      setStatus('Sintetizando BODYMASTER (pies a cabeza)...');
      const master = await avatarService.generateBodyMaster(ext.identity_prompt, ext.negative_prompt, files, ext.metadata.gender);
      setPreviews([master]);

      generationHistoryService.save({
        imageUrl: master, module: 'model_dna', moduleLabel: 'Model DNA (BodyMaster)',
        creditsUsed: CREDIT_COSTS.CREATE_MODEL_CLONE, promptText: ext.identity_prompt,
      }).catch(console.error);

      setStep('validating_bodymaster');
    } catch (e: any) {
      alert('Error: ' + e.message);
      setStep('idle');
    }
  };

  const approveBodyMaster = async () => {
    if (!previews[0]) return;
    setStep('generating_technical_set');
    setStatus('Generando vistas 360° + FACEMASTER...');
    try {
      const views = await avatarService.generateTechnicalViews(previews[0], identityData.metadata.gender);
      const face  = await avatarService.generateFaceMaster(previews[0]);
      setPreviews([previews[0], views.rear, views.side, face]);

      [views.rear, views.side, face].forEach((img, idx) => {
        const labels = ['Rear View', 'Side Profile', 'FaceMaster'];
        generationHistoryService.save({
          imageUrl: img, module: 'model_dna', moduleLabel: `Model DNA (${labels[idx]})`,
          creditsUsed: 0, promptText: `Vista técnica ${labels[idx]} para ${name}`,
        }).catch(console.error);
      });

      setStep('validating_facemaster');
    } catch (e: any) {
      alert('Error en vistas técnicas: ' + e.message);
      setStep('validating_bodymaster');
    }
  };

  const regenerateFaceMaster = async () => {
    if (!previews[0]) return;
    setIsRegeneratingFace(true);
    setStatus('Refinando FACEMASTER...');
    try {
      const face = await avatarService.generateFaceMaster(previews[0]);
      setPreviews(prev => [prev[0], prev[1], prev[2], face]);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setIsRegeneratingFace(false);
    }
  };

  const finalizeAndSave = () => {
    if (previews.length < 4) return;
    const avatar: AvatarProfile = {
      id: Date.now().toString(), name, type: 'reference',
      identityPrompt: identityData.identity_prompt,
      physicalDescription: identityData.physical_description,
      negativePrompt: identityData.negative_prompt,
      baseImages: previews, metadata: identityData.metadata,
      createdAt: Date.now(),
    };
    onSave(avatar);
    setStep('completed');
  };

  const downloadFullSetZip = async () => {
    if (previews.length < 4) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const labels = ['P1_BODYMASTER', 'P2_REAR', 'P3_SIDE', 'P4_FACEMASTER'];
      previews.forEach((img, i) => { zip.file(`${labels[i]}_${name}.png`, img.split(',')[1], { base64: true }); });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `DNA_${name}_MasterSet.zip`; a.click();
    } catch { alert('Error al crear el ZIP.'); }
    finally { setIsZipping(false); }
  };

  const openZoom  = (i: number) => setZoomedIndex(i);
  const closeZoom = () => setZoomedIndex(null);
  const navZoom   = (dir: 'prev' | 'next') => {
    if (zoomedIndex === null) return;
    const len = previews.length;
    setZoomedIndex(dir === 'next' ? (zoomedIndex + 1) % len : (zoomedIndex - 1 + len) % len);
  };

  const stepIndex = STEP_META[step].index;

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />

      <div className="min-h-screen bg-[#0A0A0F] pb-28 md:pb-12">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-8">

          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-5 bg-gradient-to-b from-violet-500 to-fuchsia-500 rounded-full" />
                <span className="text-2xs font-black text-white/25 uppercase tracking-[0.4em]">Crear Identidad</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
                Model DNA <span className="gradient-text-violet">· Fotos</span>
              </h1>
              <p className="text-xs text-white/30 font-medium">Extrae el ADN biométrico de fotos reales para crear un modelo digital fiel.</p>
            </div>
            <div className="flex items-center gap-2">
              <ModuleTutorial moduleId="modelDnaPhotos" steps={TUTORIAL_CONFIGS.modelDnaPhotos} compact />
              {step !== 'idle' && (
                <button onClick={reset}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/8 border border-white/[0.08] rounded-xl text-2xs font-black text-white/40 hover:text-white/70 uppercase tracking-wider transition-all touch-target">
                  <RotateCcw size={12} /> Reiniciar
                </button>
              )}
            </div>
          </header>

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1">
            {STEP_LABELS.map((label, i) => (
              <React.Fragment key={label}>
                <div className={`flex items-center gap-2 flex-shrink-0 px-3 py-1.5 rounded-xl transition-all ${
                  i < stepIndex ? 'bg-violet-500/15 text-violet-400'
                  : i === stepIndex ? 'bg-violet-600/25 border border-violet-500/30 text-violet-300'
                  : 'bg-white/[0.03] text-white/20'
                }`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[8px] font-black ${
                    i < stepIndex ? 'bg-violet-500 text-white' : i === stepIndex ? 'bg-violet-600 text-white' : 'bg-white/5 text-white/20'
                  }`}>
                    {i < stepIndex ? '✓' : i + 1}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`w-4 h-px flex-shrink-0 ${i < stepIndex ? 'bg-violet-500/40' : 'bg-white/[0.06]'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            <div className="lg:col-span-4 space-y-4">

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                    <i className="fa-solid fa-dna text-violet-400 text-[10px]" />
                  </div>
                  <h3 className="text-xs font-black text-white/60 uppercase tracking-widest">Configuración</h3>
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-black text-white/25 uppercase tracking-[0.25em]">Nombre del Digital Twin</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ej: Valentina, Marco, Luna..."
                    disabled={step !== 'idle'} autoComplete="off" autoCapitalize="words"
                    className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/40 focus:bg-white/[0.07] disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl outline-none transition-all text-base sm:text-sm font-medium text-white/80 placeholder:text-white/20 touch-target"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-2xs font-black text-white/25 uppercase tracking-[0.25em]">Fotos de referencia ({files.length}/3)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {files.map((f, i) => (
                      <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/[0.08] group">
                        <img src={f} className="w-full h-full object-cover" />
                        {step === 'idle' && (
                          <button onClick={() => removeFile(i)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <X size={16} className="text-white" />
                          </button>
                        )}
                      </div>
                    ))}
                    {files.length < 3 && step === 'idle' && (
                      <label className="aspect-square bg-white/[0.03] border-2 border-dashed border-white/[0.10] hover:border-violet-500/30 hover:bg-violet-500/5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all group touch-target">
                        <i className="fa-solid fa-camera text-white/20 group-hover:text-violet-400 text-xl transition-colors" />
                        <span className="text-[8px] font-black text-white/15 group-hover:text-violet-400/60 uppercase tracking-wider mt-1.5 transition-colors">Subir</span>
                        <input type="file" hidden multiple accept="image/*" onChange={handleFileChange} />
                      </label>
                    )}
                  </div>
                  <p className="text-[9px] text-white/20 leading-relaxed">Fotos frontales, buena iluminación, rostro visible. Mínimo 1, óptimo 3.</p>
                </div>

                <div className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/15 rounded-2xl px-3 py-2.5">
                  <AlertCircle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[9px] text-amber-300/60 leading-relaxed">Al subir imágenes garantizas tener los derechos legales. Eres responsable único del uso comercial del contenido generado.</p>
                </div>

                {step === 'idle' && (
                  <button onClick={startCloning} disabled={!name.trim() || files.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-violet-900/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2 touch-target"
                  >
                    <Zap size={14} /> Sintetizar Bodymaster
                  </button>
                )}

                {isProcessing && (
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin flex-shrink-0" />
                    <p className="text-[10px] font-black text-violet-300/80 uppercase tracking-wider leading-relaxed">{status}</p>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <Zap size={10} className="text-violet-400/50" />
                  <span className="text-[9px] text-white/15 font-bold uppercase tracking-wider">{CREDIT_COSTS.CREATE_MODEL_CLONE} créditos por generación completa</span>
                </div>
              </div>

              {step === 'validating_bodymaster' && previews.length > 0 && (
                <div className="bg-gradient-to-br from-violet-600/10 to-fuchsia-600/5 border border-violet-500/20 rounded-3xl p-6 space-y-4 animate-fade-up">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
                      <i className="fa-solid fa-magnifying-glass text-violet-400 text-[10px]" />
                    </div>
                    <h3 className="text-xs font-black text-violet-300 uppercase tracking-widest">Checkpoint 1 · Estructura</h3>
                  </div>
                  <p className="text-[10px] text-white/40 leading-relaxed">Verifica que el BODYMASTER tenga cuerpo completo (pies a cabeza) y rostro fiel a las referencias.</p>
                  <div className="space-y-2">
                    {['Rostro idéntico a las fotos de referencia', 'Cuerpo completo head-to-toe visible', 'Outfit y contexto correcto'].map(check => (
                      <div key={check} className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-md bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 size={10} className="text-violet-400" />
                        </div>
                        <span className="text-[10px] text-white/40 font-medium">{check}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button onClick={startCloning} className="py-3.5 bg-white/5 hover:bg-white/8 border border-white/[0.08] text-white/50 hover:text-white/80 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all touch-target">Regenerar</button>
                    <button onClick={approveBodyMaster} className="py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-violet-900/30 hover:opacity-90 transition-all touch-target">Aprobar →</button>
                  </div>
                </div>
              )}

              {step === 'validating_facemaster' && previews.length >= 4 && (
                <div className="bg-gradient-to-br from-fuchsia-600/10 to-violet-600/5 border border-fuchsia-500/20 rounded-3xl p-6 space-y-4 animate-fade-up">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-fuchsia-500/20 flex items-center justify-center">
                      <i className="fa-solid fa-face-smile text-fuchsia-400 text-[10px]" />
                    </div>
                    <h3 className="text-xs font-black text-fuchsia-300 uppercase tracking-widest">Checkpoint 2 · Fidelidad</h3>
                  </div>
                  <p className="text-[10px] text-white/40 leading-relaxed">Verifica que el FACEMASTER (P4) tenga máxima fidelidad facial. Es el anchor de identidad del sistema.</p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button onClick={regenerateFaceMaster} disabled={isRegeneratingFace}
                      className="py-3.5 bg-white/5 hover:bg-white/8 border border-white/[0.08] text-white/50 hover:text-white/80 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-40 touch-target flex items-center justify-center gap-1.5">
                      {isRegeneratingFace ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> Generando</> : <><RotateCcw size={11} /> Regen P4</>}
                    </button>
                    <button onClick={finalizeAndSave} className="py-3.5 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-fuchsia-900/30 hover:opacity-90 transition-all touch-target">Guardar →</button>
                  </div>
                </div>
              )}

              {step === 'completed' && (
                <div className="bg-gradient-to-br from-emerald-600/10 to-teal-600/5 border border-emerald-500/20 rounded-3xl p-6 space-y-4 animate-fade-up">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-black text-emerald-300 uppercase tracking-widest">Identity Guardada</p>
                      <p className="text-[10px] text-white/30 mt-0.5">Disponible en tu Biblioteca</p>
                    </div>
                  </div>
                  <button onClick={downloadFullSetZip} disabled={isZipping}
                    className="w-full py-3.5 bg-white/5 hover:bg-white/8 border border-white/[0.08] text-white/60 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 touch-target">
                    <Download size={13} />{isZipping ? 'Comprimiendo...' : 'Descargar ZIP Completo'}
                  </button>
                  <button onClick={reset} className="w-full py-3 text-white/20 hover:text-white/50 text-[9px] font-black uppercase tracking-[0.3em] transition-colors">
                    + Crear otro Digital Twin
                  </button>
                </div>
              )}
            </div>

            <div className="lg:col-span-8">
              {previews.length === 0 && !isProcessing && (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white/[0.02] border border-white/[0.05] rounded-3xl p-12 text-center space-y-5">
                  <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                    <i className="fa-solid fa-dna text-white/15 text-3xl" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-black text-white/25 uppercase italic tracking-tight">DNA Synthesis Engine</p>
                    <p className="text-xs text-white/15 leading-relaxed max-w-xs mx-auto">Configura nombre y fotos, luego presiona "Sintetizar Bodymaster" para comenzar.</p>
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white/[0.02] border border-white/[0.05] rounded-3xl p-12 text-center space-y-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 border border-violet-500/20 flex items-center justify-center">
                      <i className="fa-solid fa-dna text-violet-400 text-3xl" />
                    </div>
                    <div className="absolute inset-0 rounded-3xl border-2 border-t-violet-500 border-r-fuchsia-500 border-b-transparent border-l-transparent animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-black text-white/50 uppercase tracking-widest animate-pulse">{status}</p>
                    <p className="text-[9px] text-white/20 uppercase tracking-wider">No cierres esta ventana</p>
                  </div>
                </div>
              )}

              {!isProcessing && previews.length === 1 && (
                <div className="relative aspect-[3/4] max-w-sm mx-auto rounded-3xl overflow-hidden border border-white/[0.08] cursor-zoom-in group" onClick={() => openZoom(0)}>
                  <img src={previews[0]} className="w-full h-full object-cover" alt="Bodymaster" />
                  <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-[10px] font-black uppercase tracking-[0.25em]">{SHOT_LABELS[0].label}</p>
                    <p className="text-white/50 text-[9px] font-bold uppercase tracking-wider mt-0.5">{SHOT_LABELS[0].sub}</p>
                  </div>
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-xl bg-black/50 flex items-center justify-center">
                      <i className="fa-solid fa-magnifying-glass-plus text-white text-base" />
                    </div>
                  </div>
                </div>
              )}

              {!isProcessing && previews.length >= 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-white/60 uppercase tracking-widest">{name}</p>
                      <p className="text-[9px] text-white/25 uppercase tracking-wider">Master Digital Twin Identity Set</p>
                    </div>
                    {(step === 'validating_facemaster' || step === 'completed') && (
                      <button onClick={downloadFullSetZip} disabled={isZipping}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/[0.08] rounded-xl text-[9px] font-black text-white/40 hover:text-white/70 uppercase tracking-wider transition-all touch-target">
                        <Download size={11} />{isZipping ? 'ZIP...' : 'ZIP'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {previews.slice(0, 4).map((img, i) => (
                      <div key={i}
                        className={`relative aspect-[3/4] rounded-2xl md:rounded-3xl overflow-hidden border cursor-zoom-in group ${
                          i === 3 && step === 'validating_facemaster' ? 'border-fuchsia-500/40 ring-2 ring-fuchsia-500/20' : 'border-white/[0.08]'
                        } ${isRegeneratingFace && i === 3 ? 'animate-pulse' : ''}`}
                        onClick={() => openZoom(i)}
                      >
                        <img src={img} className="w-full h-full object-cover" alt={SHOT_LABELS[i].label} />
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-white text-[9px] font-black uppercase tracking-[0.2em]">{SHOT_LABELS[i].label}</p>
                          <p className="text-white/40 text-[8px] font-bold uppercase mt-0.5">{SHOT_LABELS[i].sub}</p>
                        </div>
                        {i === 3 && step === 'validating_facemaster' && (
                          <div className="absolute top-2 right-2">
                            <span className="bg-fuchsia-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-lg">Verificar</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center">
                            <i className="fa-solid fa-magnifying-glass-plus text-white text-sm" />
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
      </div>

      {zoomedIndex !== null && previews.length > 0 && (
        <div
          className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-8"
          onClick={closeZoom}
          onKeyDown={e => { if (e.key === 'Escape') closeZoom(); if (e.key === 'ArrowLeft') navZoom('prev'); if (e.key === 'ArrowRight') navZoom('next'); }}
          tabIndex={0}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="relative rounded-3xl overflow-hidden border border-white/[0.08]">
              <img src={previews[zoomedIndex]} alt={SHOT_LABELS[zoomedIndex]?.label} className="w-full max-h-[80dvh] object-contain bg-[#0A0A0F]" />
              <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white text-sm font-black uppercase italic tracking-tight">{SHOT_LABELS[zoomedIndex]?.label}</p>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mt-0.5">{SHOT_LABELS[zoomedIndex]?.sub}</p>
              </div>
            </div>
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{zoomedIndex + 1} / {previews.length}</span>
            </div>
            <button onClick={closeZoom} className="absolute top-4 right-4 w-10 h-10 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-all touch-target"><X size={18} /></button>
            {previews.length > 1 && <>
              <button onClick={e => { e.stopPropagation(); navZoom('prev'); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-all touch-target"><ChevronLeft size={20} /></button>
              <button onClick={e => { e.stopPropagation(); navZoom('next'); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-all touch-target"><ChevronRight size={20} /></button>
            </>}
          </div>
        </div>
      )}
    </>
  );
};

export default CloningModule;
