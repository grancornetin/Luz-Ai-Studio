import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, X, Upload, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { ImageSlot } from '../../../components/shared/ImageSlot';

// ── Types ──────────────────────────────────────────────────────────────────────

type WizardCase = 'avatar' | 'product' | 'ugc';
type Step = 1 | 2 | 3;

interface CaseConfig {
  id: WizardCase;
  icon: string;
  title: string;
  subtitle: string;
  realCost: number;
  description: string;
  route: string;
  lsKey: string;
}

const CASES: CaseConfig[] = [
  {
    id: 'avatar',
    icon: 'fa-dna',
    title: 'Modelo Digital',
    subtitle: 'Crear modelo',
    realCost: 8,
    description: 'Crea tu modelo digital a partir de fotos reales.',
    route: '/crear/clonar',
    lsKey: 'onboarding_image_avatar',
  },
  {
    id: 'product',
    icon: 'fa-gem',
    title: 'Foto de Producto',
    subtitle: 'Foto profesional',
    realCost: 2,
    description: 'Genera fotografía comercial de cualquier producto.',
    route: '/productos',
    lsKey: 'onboarding_image_product',
  },
  {
    id: 'ugc',
    icon: 'fa-mobile-screen-button',
    title: 'Contenido para redes',
    subtitle: 'Content Studio',
    realCost: 6,
    description: 'Crea 2 fotos estilo smartphone orgánico con tu modelo.',
    route: '/studio-pro',
    lsKey: 'onboarding_image_ugc',
  },
];

// Small placeholder base64 (1×1 transparent PNG) that we'll use as fallback example
// Real apps would use a CDN URL; here we use a data URL of a grey sample square.
const EXAMPLE_IMAGES: Record<WizardCase, string> = {
  avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80',
  product: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80',
  ugc: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onDone: () => void;
}

const OnboardingWizard: React.FC<Props> = ({ onDone }) => {
  const navigate = useNavigate();
  const { markOnboardingDone } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [selectedCase, setSelectedCase] = useState<WizardCase | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);

  const caseConfig = CASES.find(c => c.id === selectedCase);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSkip = async () => {
    await markOnboardingDone();
    onDone();
  };

  const handleUseExample = async () => {
    if (!selectedCase) return;
    setLoadingExample(true);
    try {
      const url = EXAMPLE_IMAGES[selectedCase];
      const res = await fetch(url);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        setLoadingExample(false);
      };
      reader.readAsDataURL(blob);
    } catch {
      // fallback: just set a simple flag so user can proceed
      setUploadedImage('__example__');
      setLoadingExample(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedCase || !caseConfig || !uploadedImage) return;
    setIsGenerating(true);
    try {
      // Save image to localStorage so the target module can pick it up
      localStorage.setItem(caseConfig.lsKey, uploadedImage);
      localStorage.setItem('onboarding_free_generation', 'true');
      await markOnboardingDone();
      onDone();
      navigate(caseConfig.route);
    } finally {
      setIsGenerating(false);
    }
  };

  const canProceedStep2 = !!uploadedImage;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300 max-h-[95dvh] flex flex-col">

        {/* ── Header ── */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em]">
              Paso {step} de 3
            </p>
            <h2 className="text-white font-black text-xl uppercase italic tracking-tighter leading-none mt-1">
              {step === 1 && 'Tu primera creación'}
              {step === 2 && 'Sube una referencia'}
              {step === 3 && 'Listo para generar'}
            </h2>
          </div>

          {/* Step dots */}
          <div className="flex gap-2 items-center">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`rounded-full transition-all duration-300 ${
                  s === step ? 'w-6 h-2.5 bg-white' : s < step ? 'w-2.5 h-2.5 bg-white/60' : 'w-2.5 h-2.5 bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* STEP 1 — Choose case */}
          {step === 1 && (
            <>
              <p className="text-xs text-slate-500 font-medium">
                Elige qué quieres crear. Tu primera generación corre <strong>por cuenta de la casa</strong> — gratis, sin gastar tus 20 créditos.
              </p>
              <div className="space-y-3">
                {CASES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCase(c.id)}
                    className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-left ${
                      selectedCase === c.id
                        ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      selectedCase === c.id ? 'bg-indigo-600' : 'bg-slate-100'
                    }`}>
                      <i className={`fa-solid ${c.icon} text-lg ${selectedCase === c.id ? 'text-white' : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{c.title}</p>
                        <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          Gratis esta vez
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[10px] text-slate-300 line-through">{c.realCost} cr</p>
                      <p className="text-xs font-black text-emerald-600">0 cr</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* STEP 2 — Upload image */}
          {step === 2 && caseConfig && (
            <>
              <p className="text-xs text-slate-500 font-medium">
                {selectedCase === 'avatar' && 'Sube una foto de rostro clara (sin gafas de sol, buena luz).'}
                {selectedCase === 'product' && 'Sube una foto de tu producto sobre fondo blanco o claro.'}
                {selectedCase === 'ugc' && 'Sube una foto de rostro para tu contenido de redes.'}
              </p>

              <ImageSlot
                value={uploadedImage === '__example__' ? null : uploadedImage}
                onChange={val => setUploadedImage(val)}
                label={
                  selectedCase === 'avatar' ? 'Foto de rostro' :
                  selectedCase === 'product' ? 'Foto de producto' :
                  'Foto de rostro (avatar)'
                }
                slotType={selectedCase === 'product' ? 'product' : 'face'}
                aspectRatio="portrait"
              />

              {uploadedImage === '__example__' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-xs font-medium flex items-center gap-2">
                  <i className="fa-solid fa-circle-check" />
                  Imagen de ejemplo cargada. Puedes continuar.
                </div>
              )}

              <button
                onClick={handleUseExample}
                disabled={loadingExample}
                className="w-full py-3 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
              >
                {loadingExample ? (
                  <><i className="fa-solid fa-spinner animate-spin" /> Cargando ejemplo...</>
                ) : (
                  <><ImageIcon className="w-4 h-4" /> Usar imagen de ejemplo</>
                )}
              </button>
            </>
          )}

          {/* STEP 3 — Summary and generate */}
          {step === 3 && caseConfig && (
            <>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                    <i className={`fa-solid ${caseConfig.icon} text-white`} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm uppercase">{caseConfig.title}</p>
                    <p className="text-xs text-slate-500">{caseConfig.subtitle}</p>
                  </div>
                </div>

                {uploadedImage && uploadedImage !== '__example__' && (
                  <img
                    src={uploadedImage}
                    alt="Referencia"
                    className="w-full max-h-40 object-cover rounded-xl border border-slate-200"
                  />
                )}
                {uploadedImage === '__example__' && (
                  <div className="w-full h-24 bg-slate-200 rounded-xl flex items-center justify-center">
                    <p className="text-xs text-slate-400 font-bold">Imagen de ejemplo</p>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Coste</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-300 line-through">{caseConfig.realCost} créditos</span>
                    <span className="text-sm font-black text-emerald-600 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" /> Gratis
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                Serás redirigido a <strong>{caseConfig.subtitle}</strong>. La generación empezará automáticamente. Tus 20 créditos permanecen intactos.
              </p>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 p-5 border-t border-slate-100 space-y-3">

          {/* Main CTA */}
          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!selectedCase}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-40 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
            >
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 2 && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="py-4 px-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Atrás
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-40 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="py-4 px-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Atrás
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
              >
                {isGenerating ? (
                  <><i className="fa-solid fa-spinner animate-spin" /> Redirigiendo...</>
                ) : (
                  <><Zap className="w-4 h-4" /> Generar ahora — Gratis</>
                )}
              </button>
            </div>
          )}

          {/* Skip link — always visible */}
          <button
            onClick={handleSkip}
            className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest py-1"
          >
            Saltar tutorial — ir al dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
