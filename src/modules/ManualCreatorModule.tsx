// src/modules/ManualCreatorModule.tsx — v2.0 Dark AI-Native Theme
import React, { useState } from 'react';
import { avatarService } from '../services/avatarService';
import { generationHistoryService } from '../services/generationHistoryService';
import { AvatarProfile } from '../types';
import JSZip from 'jszip';
import ModuleTutorial from '../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../components/shared/tutorialConfigs';
import { useCreditGuard } from '../hooks/useCreditGuard';
import NoCreditsModal from '../components/shared/NoCreditsModal';
import { CREDIT_COSTS } from '../services/creditConfig';
import {
  ETHNICITY_OPTIONS, AGE_OPTIONS, BUILD_OPTIONS, OUTFITS_MUJER, OUTFITS_HOMBRE,
  EYE_COLORS, HAIR_COLORS, HAIR_TYPES, HAIR_LENGTHS, PERSONALITY_OPTIONS, EXPRESSION_OPTIONS
} from '../constants';
import { Download, Zap, X, ChevronLeft, ChevronRight, CheckCircle2, Save } from 'lucide-react';

interface ManualCreatorModuleProps {
  onSave: (avatar: AvatarProfile) => void;
}

interface DarkSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[] | { id: string; label: string }[];
  disabled?: boolean;
}

const DarkSelect: React.FC<DarkSelectProps> = ({ label, value, onChange, options, disabled }) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-white/25 uppercase tracking-[0.3em] block">{label}</label>
    <select
      value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      className="w-full px-3.5 py-3 bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/40 focus:bg-white/[0.07] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl outline-none transition-all text-sm font-medium text-white/70 appearance-none cursor-pointer touch-target"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='rgba(255,255,255,0.2)' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px', paddingRight: '36px' }}
    >
      {options.map(o =>
        typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.id} value={o.id}>{o.label}</option>
      )}
    </select>
  </div>
);

const SHOT_LABELS = [
  { label: 'P1 · Frontal Master', sub: 'Vista frontal técnica' },
  { label: 'P2 · Rear 180°',      sub: 'Vista trasera' },
  { label: 'P3 · Side 90°',       sub: 'Vista lateral' },
  { label: 'P4 · Facemaster',     sub: 'DNA facial 1:1' },
];

const ManualCreatorModule: React.FC<ManualCreatorModuleProps> = ({ onSave }) => {
  const [name, setName]                       = useState('');
  const [isProcessing, setIsProcessing]       = useState(false);
  const [status, setStatus]                   = useState('');
  const [previews, setPreviews]               = useState<string[]>([]);
  const [isZipping, setIsZipping]             = useState(false);
  const [pendingAvatarData, setPendingAvatarData] = useState<AvatarProfile | null>(null);
  const [zoomedIndex, setZoomedIndex]         = useState<number | null>(null);

  const [data, setData] = useState<AvatarProfile['metadata']>({
    gender: 'mujer', age: 'joven', build: 'tonificada', ethnicity: 'latina',
    eyes: 'marron', hairColor: 'castaño oscuro', hairType: 'liso perfecto',
    hairLength: 'melena', personality: 'Profesional y elegante', expression: 'natural',
    outfit: OUTFITS_MUJER[0],
  });

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal } = useCreditGuard();

  const handleGenderChange = (gender: 'mujer' | 'hombre') => {
    setData({ ...data, gender, outfit: gender === 'mujer' ? OUTFITS_MUJER[0] : OUTFITS_HOMBRE[0] });
  };

  const set = (key: keyof typeof data) => (value: string) => setData(prev => ({ ...prev, [key]: value }));

  const handleCreate = async () => {
    if (!name.trim()) return alert('Nombre de identidad requerido.');
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
        'blurry, low quality, distorted face, messy background',
        data.gender, data.outfit, data.personality, data.expression,
      );

      setPreviews(shots);

      const labels = ['Frontal Master', 'Trasero 180°', 'Lateral 90°', 'Rostro 1:1'];
      shots.forEach((img, idx) => {
        generationHistoryService.save({
          imageUrl: img, module: 'model_dna', moduleLabel: `Model DNA (${labels[idx]})`,
          creditsUsed: idx === 0 ? CREDIT_COSTS.CREATE_MODEL_MANUAL : 0, promptText: identityPrompt,
        }).catch(console.error);
      });

      const physicalDescription = `${data.gender}, ${data.age}, ${data.ethnicity}. Complexión: ${data.build}. Ojos: ${data.eyes}. Cabello: ${data.hairLength} ${data.hairType} ${data.hairColor}. Personalidad: ${data.personality}, con expresión: ${data.expression}.`;

      setPendingAvatarData({
        id: Date.now().toString(), name, type: 'scratch',
        identityPrompt, physicalDescription, negativePrompt: 'blurry, low quality',
        baseImages: shots, metadata: data as any, createdAt: Date.now(),
      });
      setStatus('Identidad sintetizada correctamente.');
    } catch (e: any) {
      alert('Error en síntesis de ADN: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveToLibrary = () => {
    if (!pendingAvatarData) return;
    onSave(pendingAvatarData);
    setPreviews([]); setPendingAvatarData(null); setName(''); setStatus('');
  };

  const downloadAllZip = async () => {
    if (!previews.length) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      previews.forEach((p, i) => {
        const labels = ['P1_FRONTAL', 'P2_REAR', 'P3_SIDE', 'P4_FACE'];
        zip.file(`${labels[i]}_${name}.png`, p.split(',')[1], { base64: true });
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `DNA_${name}_MasterSet.zip`; a.click();
    } catch { alert('Error al crear el ZIP.'); }
    finally { setIsZipping(false); }
  };

  const navZoom = (dir: 'prev' | 'next') => {
    if (zoomedIndex === null) return;
    const len = previews.length;
    setZoomedIndex(dir === 'next' ? (zoomedIndex + 1) % len : (zoomedIndex - 1 + len) % len);
  };

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />

      <div className="min-h-screen bg-[#0A0A0F] pb-28 md:pb-12">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-8">

          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-5 bg-gradient-to-b from-fuchsia-500 to-violet-500 rounded-full" />
                <span className="text-2xs font-black text-white/25 uppercase tracking-[0.4em]">Crear Identidad</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
                Model DNA <span className="gradient-text-violet">· Manual</span>
              </h1>
              <p className="text-xs text-white/30 font-medium">Diseña una identidad digital 100% nueva configurando cada rasgo visual.</p>
            </div>
            <ModuleTutorial moduleId="modelDnaManual" steps={TUTORIAL_CONFIGS.modelDnaManual} compact />
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            <div className="lg:col-span-5 space-y-4">

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/20 flex items-center justify-center">
                    <i className="fa-solid fa-sliders text-fuchsia-400 text-[10px]" />
                  </div>
                  <h3 className="text-xs font-black text-white/50 uppercase tracking-widest">Diseñador de ADN</h3>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/25 uppercase tracking-[0.3em] block">Nombre de la Identidad</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ej: Alpha v1, Luna, Marco..."
                    disabled={isProcessing} autoComplete="off" autoCapitalize="words"
                    className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/40 focus:bg-white/[0.07] disabled:opacity-40 rounded-2xl outline-none transition-all text-sm font-medium text-white/80 placeholder:text-white/20 touch-target"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/25 uppercase tracking-[0.3em] block">Género</label>
                  <div className="flex bg-white/[0.03] border border-white/[0.06] p-1 rounded-xl">
                    {(['mujer', 'hombre'] as const).map(g => (
                      <button key={g} onClick={() => handleGenderChange(g)} disabled={isProcessing}
                        className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-lg transition-all touch-target ${
                          data.gender === g ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/30' : 'text-white/30 hover:text-white/60'
                        }`}
                      >
                        {g === 'mujer' ? '♀ Mujer' : '♂ Hombre'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-6 space-y-4">
                <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Rasgos Físicos</p>
                <div className="grid grid-cols-2 gap-3">
                  <DarkSelect label="Edad"             value={data.age}       onChange={set('age')}       options={AGE_OPTIONS}       disabled={isProcessing} />
                  <DarkSelect label="Etnia"            value={data.ethnicity} onChange={set('ethnicity')} options={ETHNICITY_OPTIONS} disabled={isProcessing} />
                  <DarkSelect label="Complexión"       value={data.build}     onChange={set('build')}     options={BUILD_OPTIONS}     disabled={isProcessing} />
                  <DarkSelect label="Color de Ojos"    value={data.eyes}      onChange={set('eyes')}      options={EYE_COLORS}        disabled={isProcessing} />
                  <DarkSelect label="Color de Cabello" value={data.hairColor} onChange={set('hairColor')} options={HAIR_COLORS}       disabled={isProcessing} />
                  <DarkSelect label="Largo de Pelo"    value={data.hairLength} onChange={set('hairLength')} options={HAIR_LENGTHS}    disabled={isProcessing} />
                  <div className="col-span-2">
                    <DarkSelect label="Tipo de Pelo" value={data.hairType} onChange={set('hairType')} options={HAIR_TYPES} disabled={isProcessing} />
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-6 space-y-4">
                <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Personalidad & Estilo</p>
                <div className="grid grid-cols-1 gap-3">
                  <DarkSelect label="Personalidad"  value={data.personality} onChange={set('personality')} options={PERSONALITY_OPTIONS} disabled={isProcessing} />
                  <DarkSelect label="Expresión"     value={data.expression}  onChange={set('expression')}  options={EXPRESSION_OPTIONS}  disabled={isProcessing} />
                  <DarkSelect label="Outfit Inicial" value={data.outfit}     onChange={set('outfit')}      options={data.gender === 'mujer' ? OUTFITS_MUJER : OUTFITS_HOMBRE} disabled={isProcessing} />
                </div>
              </div>

              <button onClick={handleCreate} disabled={isProcessing || !name.trim()}
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-violet-900/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2 touch-target"
              >
                {isProcessing
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {status}</>
                  : <><Zap size={14} /> Sintetizar ADN Maestro</>
                }
              </button>

              <p className="text-center text-[9px] text-white/15 uppercase tracking-wider flex items-center justify-center gap-1">
                <Zap size={9} className="text-violet-400/50" />
                {CREDIT_COSTS.CREATE_MODEL_MANUAL} créditos · 4 planos generados
              </p>
            </div>

            <div className="lg:col-span-7">
              {!isProcessing && previews.length === 0 && (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white/[0.02] border border-white/[0.05] rounded-3xl p-12 text-center space-y-5">
                  <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                    <i className="fa-solid fa-person text-white/10 text-4xl" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-black text-white/20 uppercase italic tracking-tight">ADN Synthesis Engine</p>
                    <p className="text-xs text-white/12 leading-relaxed max-w-xs mx-auto">Configura los rasgos y presiona "Sintetizar" para crear tu identidad digital.</p>
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white/[0.02] border border-white/[0.05] rounded-3xl p-12 text-center space-y-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 border border-violet-500/20 flex items-center justify-center">
                      <i className="fa-solid fa-person text-violet-400 text-3xl" />
                    </div>
                    <div className="absolute inset-0 rounded-3xl border-2 border-t-violet-500 border-r-fuchsia-500 border-b-transparent border-l-transparent animate-spin" />
                  </div>
                  <p className="text-xs font-black text-white/40 uppercase tracking-widest animate-pulse">{status}</p>
                </div>
              )}

              {!isProcessing && previews.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-white/60 uppercase tracking-widest">{name}</p>
                      <p className="text-[9px] text-white/25 uppercase tracking-wider">From Scratch · Master Identity Set</p>
                    </div>
                    <button onClick={downloadAllZip} disabled={isZipping}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/[0.08] rounded-xl text-[9px] font-black text-white/40 hover:text-white/70 uppercase tracking-wider transition-all touch-target">
                      <Download size={11} />{isZipping ? 'ZIP...' : 'ZIP'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {previews.slice(0, 4).map((img, i) => (
                      <div key={i}
                        className="relative aspect-[3/4] rounded-2xl md:rounded-3xl overflow-hidden border border-white/[0.08] cursor-zoom-in group hover:border-white/[0.15] transition-all"
                        onClick={() => setZoomedIndex(i)}
                      >
                        <img src={img} className="w-full h-full object-cover" alt={SHOT_LABELS[i].label} loading="lazy" />
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-white text-[9px] font-black uppercase tracking-[0.2em]">{SHOT_LABELS[i].label}</p>
                          <p className="text-white/40 text-[8px] font-bold uppercase">{SHOT_LABELS[i].sub}</p>
                        </div>
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <i className="fa-solid fa-magnifying-glass-plus text-white text-base" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {pendingAvatarData && (
                    <div className="bg-gradient-to-br from-emerald-600/10 to-teal-600/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                      <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Set generado</p>
                        <p className="text-[9px] text-white/30 mt-0.5">Guarda en biblioteca para usar en otros módulos</p>
                      </div>
                      <button onClick={handleSaveToLibrary}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg hover:opacity-90 transition-all touch-target flex-shrink-0">
                        <Save size={12} /> Guardar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {zoomedIndex !== null && previews.length > 0 && (
        <div
          className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setZoomedIndex(null)}
          onKeyDown={e => { if (e.key === 'Escape') setZoomedIndex(null); if (e.key === 'ArrowLeft') navZoom('prev'); if (e.key === 'ArrowRight') navZoom('next'); }}
          tabIndex={0}
        >
          <div className="relative max-w-xl w-full" onClick={e => e.stopPropagation()}>
            <div className="rounded-3xl overflow-hidden border border-white/[0.08]">
              <img src={previews[zoomedIndex]} className="w-full max-h-[80dvh] object-contain bg-[#0A0A0F]" alt="" />
              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white text-sm font-black uppercase italic">{SHOT_LABELS[zoomedIndex]?.label}</p>
              </div>
            </div>
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{zoomedIndex + 1} / {previews.length}</span>
            </div>
            <button onClick={() => setZoomedIndex(null)} className="absolute top-4 right-4 w-10 h-10 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-all touch-target"><X size={18} /></button>
            {previews.length > 1 && <>
              <button onClick={e => { e.stopPropagation(); navZoom('prev'); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-all touch-target"><ChevronLeft size={18} /></button>
              <button onClick={e => { e.stopPropagation(); navZoom('next'); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-all touch-target"><ChevronRight size={18} /></button>
            </>}
          </div>
        </div>
      )}
    </>
  );
};

export default ManualCreatorModule;
