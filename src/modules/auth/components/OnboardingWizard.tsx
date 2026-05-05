import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap } from 'lucide-react';
import { useAuth } from '../AuthContext';

type WizardCase = 'avatar' | 'product' | 'ugc';

interface CaseConfig {
  id: WizardCase;
  icon: string;
  title: string;
  subtitle: string;
  realCost: number;
  description: string;
  route: string;
  tourSteps: string[];
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
    tourSteps: [
      'Sube al menos 4 fotos de rostro con buena luz y sin gafas',
      'Dale un nombre a tu modelo',
      'Escribe un prompt o elige un estilo',
      'Presiona Generar y listo',
    ],
  },
  {
    id: 'product',
    icon: 'fa-gem',
    title: 'Foto de Producto',
    subtitle: 'Foto profesional',
    realCost: 2,
    description: 'Genera fotografía comercial de cualquier producto.',
    route: '/productos',
    tourSteps: [
      'Sube mínimo 2 fotos del producto (frontal y trasera)',
      'Escribe el nombre del producto',
      'Elige el objetivo (redes, catálogo, etc.)',
      'Selecciona el estilo visual y presiona Generar',
    ],
  },
  {
    id: 'ugc',
    icon: 'fa-mobile-screen-button',
    title: 'Contenido para redes',
    subtitle: 'Content Studio',
    realCost: 6,
    description: 'Crea fotos estilo smartphone orgánico con tu modelo.',
    route: '/studio-pro',
    tourSteps: [
      'Elige un avatar o sube una foto de referencia',
      'Escribe el prompt de la escena',
      'Ajusta el estilo y el formato',
      'Presiona Generar',
    ],
  },
];

interface Props {
  onDone: () => void;
}

const OnboardingWizard: React.FC<Props> = ({ onDone }) => {
  const navigate = useNavigate();
  const { markOnboardingDone } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCase, setSelectedCase] = useState<WizardCase | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const caseConfig = CASES.find(c => c.id === selectedCase);

  const handleSkip = async () => {
    await markOnboardingDone();
    onDone();
  };

  const handleLaunch = async () => {
    if (!selectedCase || !caseConfig) return;
    setIsLaunching(true);
    try {
      // Flag para que el módulo destino active el tour guiado paso a paso
      localStorage.setItem('onboarding_tour_active', selectedCase);
      localStorage.setItem('onboarding_free_generation', 'true');
      await markOnboardingDone();
      onDone();
      navigate(caseConfig.route);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300 max-h-[95dvh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em]">
              Paso {step} de 2
            </p>
            <h2 className="text-white font-black text-xl uppercase italic tracking-tighter leading-none mt-1">
              {step === 1 ? 'Tu primera creación' : '¿Cómo funciona?'}
            </h2>
          </div>
          <div className="flex gap-2 items-center">
            {[1, 2].map(s => (
              <div
                key={s}
                className={`rounded-full transition-all duration-300 ${
                  s === step ? 'w-6 h-2.5 bg-white' : s < step ? 'w-2.5 h-2.5 bg-white/60' : 'w-2.5 h-2.5 bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* STEP 1 — elegir módulo */}
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

          {/* STEP 2 — instrucciones del módulo elegido */}
          {step === 2 && caseConfig && (
            <>
              <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <i className={`fa-solid ${caseConfig.icon} text-white`} />
                </div>
                <div>
                  <p className="font-black text-slate-900 text-sm uppercase">{caseConfig.title}</p>
                  <p className="text-xs text-slate-500">{caseConfig.subtitle}</p>
                </div>
              </div>

              <p className="text-xs text-slate-500 font-medium">
                Te llevamos al módulo y te guiamos paso a paso. Así va a funcionar:
              </p>

              <ol className="space-y-3">
                {caseConfig.tourSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-700 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <p className="text-xs font-bold text-emerald-700">
                  Esta primera generación no te costará créditos. Tus 20 créditos quedan intactos.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-5 border-t border-slate-100 space-y-3">

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!selectedCase}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-40 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
            >
              Ver cómo funciona <ArrowRight className="w-4 h-4" />
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
                onClick={handleLaunch}
                disabled={isLaunching}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
              >
                {isLaunching ? (
                  <><i className="fa-solid fa-spinner animate-spin" /> Abriendo módulo...</>
                ) : (
                  <><Zap className="w-4 h-4" /> Ir al módulo — Gratis</>
                )}
              </button>
            </div>
          )}

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
