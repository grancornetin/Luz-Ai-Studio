// src/modules/modelDNA/ModelDNAModule.tsx
import React, { useState, useEffect } from 'react';
import {
  Plus, X, UserCircle2, AlertTriangle, Download, Sparkles,
  Check, Lightbulb, Info, CircleCheck,
} from 'lucide-react';
import { AvatarProfile } from '../../types';
import { startClone, waitForCloneComplete } from '../../services/avatarCloneService';
import { useCreditGuard } from '../../hooks/useCreditGuard';
import NoCreditsModal from '../../components/shared/NoCreditsModal';
import { CREDIT_COSTS } from '../../services/creditConfig';
import { downloadAsZip } from '../../utils/imageUtils';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { generationHistoryService } from '../../services/generationHistoryService';
import { useAuth } from '../../modules/auth/AuthContext';

// Nuevos componentes base
import { ErrorDisplay, toAppError, type AppError } from '../../components/shared/ErrorDisplay';
import { REFUNDABLE_ERRORS, newSessionId } from '../../services/imageApiService';
import { getNotification } from '../../services/notificationsService';
import { useSearchParams } from 'react-router-dom';
import { ImageSlot } from '../../components/shared/ImageSlot';
import UploadDisclaimer from '../../components/shared/UploadDisclaimer';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { GenerationProgress, type ProgressStep } from '../../components/shared/GenerationProgress';

const DNA_STEPS: ProgressStep[] = [
  { id: 'body',  label: 'Creando Body Master (vista frontal)' },
  { id: 'views', label: 'Creando vistas trasera y lateral' },
  { id: 'face',  label: 'Creando Face Master (close-up facial)' },
  { id: 'done',  label: 'Modelo digital listo' },
];

const VIEW_META = [
  { label: 'Frontal',         sub: 'Cuerpo completo' },
  { label: 'Trasera',         sub: '180° posterior' },
  { label: 'Lateral',         sub: '90° perfil' },
  { label: 'Close-up facial', sub: 'Referencia de identidad' },
];

interface ModelDNAModuleProps {
  onSave: (avatar: AvatarProfile) => void;
}

const ModelDNAModule: React.FC<ModelDNAModuleProps> = ({ onSave }) => {
  const { credits, user } = useAuth();
  const [name, setName] = useState('');
  const [files, setFiles] = useState<string[]>([]); // hasta 3 imágenes en base64
  const [status, setStatus] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cloneError, setCloneError] = useState<AppError | null>(null);
  const [creditsRefunded, setCreditsRefunded] = useState(false);
  const [progressStep, setProgressStep] = useState(0);

  // Retomar sesión desde notificación (?session=xxx)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (!sessionParam || !user) return;
    let cancelled = false;
    (async () => {
      const notif = await getNotification(user.uid, sessionParam);
      if (cancelled || !notif) {
        setSearchParams({}, { replace: true });
        return;
      }
      const completedShots = notif.shots
        .filter(s => s.status === 'completed' && s.imageUrl)
        .sort((a, b) => a.index - b.index)
        .map(s => s.imageUrl!);
      if (completedShots.length > 0) {
        setPreviews(completedShots);
        setName(notif.metadata?.name || 'Modelo recuperado');
        setStatus('Sesión recuperada desde notificación');
      }
      setSearchParams({}, { replace: true });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal, refundCredits } = useCreditGuard();

  // Onboarding: activa tour guiado si viene del wizard de registro
  useEffect(() => {
    const tour = localStorage.getItem('onboarding_tour_active');
    if (tour === 'avatar') {
      localStorage.removeItem('onboarding_tour_active');
      // El usuario completa el wizard del módulo normalmente.
      // El flag onboarding_free_generation se consume en startCloning.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Costo: 1 sesión = 1 imagen = 4 créditos
  const totalCost = CREDIT_COSTS.CREATE_MODEL_CLONE;
  const creditsAfter = Math.max(0, credits.available - totalCost);
  const canGenerate = name.trim().length > 0 && files.length > 0;

  // Handlers para los 3 slots de imagen
  const updateFile = (index: number, base64: string | null) => {
    const newFiles = [...files];
    if (base64 === null) {
      newFiles[index] = undefined as any;
    } else {
      newFiles[index] = base64;
    }
    // Filtrar undefined y mantener máximo 3
    const cleaned = newFiles.filter((f): f is string => f !== undefined).slice(0, 3);
    setFiles(cleaned);
  };

  const startCloning = async (free = false) => {
    if (!canGenerate) return;
    const isFreeOnboarding = free || localStorage.getItem('onboarding_free_generation') === 'true';
    if (isFreeOnboarding) localStorage.removeItem('onboarding_free_generation');
    if (!isFreeOnboarding) {
      const ok = await checkAndDeduct(CREDIT_COSTS.CREATE_MODEL_CLONE);
      if (!ok) return;
    }

    setIsLoading(true);
    setCloneError(null);
    setCreditsRefunded(false);
    setProgressStep(0);
    setStatus('Iniciando clonación asíncrona...');
    setPreviews([]);

    try {
      // Notificaciones Nivel 3: sessionId único por clonación
      const sessionId = newSessionId();
      const { jobId } = await startClone({
        mode: 'image',
        name,
        files,
        // El género ya NO lo decide el usuario — el backend lo detecta del
        // análisis de la foto real (api/avatar/clone-worker.ts). Este valor
        // queda solo como fallback de compatibilidad con el tipo del servicio.
        gender: 'mujer',
        personality: 'Profesional y elegante',
        expression: 'Natural',
        sessionId,
        module: 'clone',
        moduleLabel: 'Clone de modelo',
        metadata: { name, mode: 'image' },
      });

      setStatus('Procesando en segundo plano...');
      setProgressStep(0);
      const images = await waitForCloneComplete(jobId, (jobStatus, result) => {
        if (jobStatus === 'processing') {
          setStatus('Generando activos maestros...');
          // El clone-worker genera body → views → face secuencialmente
          // Estimamos el paso según cuántas imágenes han llegado
          if (result && result.length >= 1) setProgressStep(1);
          if (result && result.length >= 3) setProgressStep(2);
          if (result && result.length >= 4) setProgressStep(3);
        }
        if (result && result.length === 4) setPreviews(result);
      });

      const newAvatar: AvatarProfile = {
        id: Date.now().toString(),
        name,
        type: 'reference',
        identityPrompt: '',
        physicalDescription: '',
        negativePrompt: '',
        baseImages: images,
        metadata: {
          gender: '', // detectado por el backend, no forma parte del input del usuario
          age: '',
          build: '',
          ethnicity: '',
          eyes: '',
          hairColor: '',
          hairType: '',
          hairLength: '',
          personality: 'Profesional y elegante',
          expression: 'Natural',
          outfit: '',
        },
        createdAt: Date.now(),
      };
      onSave(newAvatar);

      // Guardar las 4 vistas en historial
      const viewLabels = ['Body Master', 'Vista Trasera', 'Vista Lateral', 'Face Master'];
      images.forEach((img, idx) => {
        generationHistoryService.save({
          imageUrl: img,
          module: 'model_dna',
          moduleLabel: `Crear modelo desde fotos (${viewLabels[idx] || `Vista ${idx + 1}`})`,
          creditsUsed: (!free && idx === 0) ? CREDIT_COSTS.CREATE_MODEL_CLONE : 0,
          promptText: `Clonación desde imagen — ${name}`,
        }).catch(console.error);
      });

      setStatus('Completado');
    } catch (err: any) {
      const appErr = toAppError(err);
      setCloneError(appErr);
      if (!free && REFUNDABLE_ERRORS.has(appErr.code as any)) {
        const refunded = await refundCredits(CREDIT_COSTS.CREATE_MODEL_CLONE);
        setCreditsRefunded(refunded);
      }
      setStatus('Error');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setName('');
    setFiles([]);
    setPreviews([]);
    setStatus('');
    setIsLoading(false);
    setProgressStep(0);
    setLightboxOpen(false);
    setCloneError(null);
  };

  const handleDownloadZip = async () => {
    if (previews.length === 0) return;
    await downloadAsZip(previews, `Avatar_DNA_Set_${name || 'avatar'}.zip`, `${name || 'vista'}`);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // ── Determinar qué pantalla mostrar ──────────────────────────
  const showResults = previews.length === 4 && !isLoading;
  const showGenerating = isLoading && previews.length === 0 && !cloneError;
  const showError = !!cloneError && !isLoading;

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />

      <div className="max-w-2xl mx-auto pb-20 animate-in fade-in duration-500">
        {/* ── HEADER ──────────────────────────────────────── */}
        <header className="px-1 mb-6">
          <h1 className="t-display text-3xl text-slate-900">
            Model <span className="text-brand-600">DNA</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-slate-500 font-medium italic text-xs md:text-sm">
              Clona un modelo digital fiel a una persona real
            </p>
            <ModuleTutorial moduleId="modelDnaPhotos" steps={TUTORIAL_CONFIGS.modelDnaPhotos} compact />
          </div>
        </header>

        <div className="bg-white rounded-[28px] md:rounded-[36px] shadow-sm border border-slate-100 overflow-hidden">

          {/* ══════════════ PANTALLA 1: SUBIR FOTOS ══════════════ */}
          {!showResults && !showGenerating && !showError && (
            <div className="fade-in p-4 md:p-8 flex flex-col gap-6">
              <div>
                <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Crear modelo desde fotos</div>
                <h2 className="t-display text-[26px] md:text-[32px] text-slate-900 mt-2.5 leading-[1.05]">
                  Sube fotos <span className="text-brand-600 italic normal-case">de la persona a clonar.</span>
                </h2>
                <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
                  Cuantos más ángulos y mejor luz, más fiel queda el modelo digital.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
                  Nombre del modelo <span className="text-brand-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Valentina"
                  autoComplete="off"
                  autoCapitalize="words"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-[15px] font-bold text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em]">Fotos de referencia</label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${files.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    {files.length}/3 subidas
                  </span>
                </div>
                {/* Tarjetas grandes y verticales — 2 arriba + 1 opcional abajo a ancho completo */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="aspect-[3/5]">
                    <ImageSlot value={files[0] || null} onChange={v => updateFile(0, v)} label="Frontal" hint="Vista principal" aspectRatio="auto" disabled={isLoading} />
                  </div>
                  <div className="aspect-[3/5]">
                    <ImageSlot value={files[1] || null} onChange={v => updateFile(1, v)} label="Lateral" hint="Perfil o 3/4" aspectRatio="auto" disabled={isLoading} />
                  </div>
                </div>
                <div className="aspect-[3/5] mt-2.5">
                  <ImageSlot value={files[2] || null} onChange={v => updateFile(2, v)} label="Extra (opcional)" hint="Otro ángulo o expresión" aspectRatio="auto" disabled={isLoading} />
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-brand-50 border border-brand-100">
                <UserCircle2 size={18} className="text-brand-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-bold text-brand-900">Detectamos el género automáticamente</p>
                  <p className="text-[11px] text-brand-700 mt-0.5 leading-snug">
                    Analizamos la foto para mantener la silueta y proporciones reales de la persona — no hace falta indicarlo.
                  </p>
                </div>
              </div>

              <UploadDisclaimer />

              {cloneError && (
                <ErrorDisplay
                  error={cloneError}
                  creditsRefunded={creditsRefunded}
                  onRetry={() => startCloning()}
                  onDismiss={() => setCloneError(null)}
                />
              )}
            </div>
          )}

          {/* ══════════════ PANTALLA 2: GENERANDO ══════════════ */}
          {showGenerating && (
            <div className="fade-in p-4 md:p-8 flex flex-col gap-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                  <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Generando · no cierres esta ventana</span>
                </div>
                <h2 className="t-display text-[24px] md:text-[28px] text-slate-900 leading-[1.05]">
                  Creando a <span className="text-brand-600 italic normal-case">{name || 'tu modelo'}</span>
                </h2>
                <p className="text-sm text-slate-500 mt-1.5">Esto genera 4 vistas técnicas para máxima fidelidad.</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <GenerationProgress steps={DNA_STEPS} currentStepIndex={progressStep} />
              </div>

              {/* Vistas en vivo — compactas mientras se generan simultáneamente */}
              <div className="grid grid-cols-2 gap-2.5">
                {[0, 1, 2, 3].map(i => {
                  const done = !!previews[i];
                  const active = !done && i === Math.min(progressStep, 3);
                  return (
                    <div key={i} className={`relative aspect-[3/4] rounded-2xl overflow-hidden ${done ? 'shadow-md' : active ? 'border-2 border-brand-600 bg-slate-100 animate-pulse' : 'bg-slate-100'}`}>
                      {done && <img src={previews[i]} alt={VIEW_META[i].label} className="w-full h-full object-cover" />}
                      {!done && active && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-white/95 rounded-full px-3 py-1.5 text-[9px] font-bold text-brand-600 tracking-[0.1em] uppercase">Generando...</div>
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${done ? 'bg-black/60 text-white' : 'text-slate-400'}`}>
                          {VIEW_META[i].label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-[1.5]">
                <Lightbulb size={14} className="flex-shrink-0 mt-0.5 text-slate-400" />
                Puedes cerrar la ventana. Te avisaremos cuando termine.
              </div>
            </div>
          )}

          {/* ══════════════ PANTALLA ERROR ══════════════ */}
          {showError && (
            <div className="fade-in p-4 md:p-8">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.18em]">Error al generar</span>
              </div>
              <h2 className="t-display text-[24px] text-slate-900 mb-3">No se pudo crear el modelo</h2>
              <ErrorDisplay
                error={cloneError!}
                creditsRefunded={creditsRefunded}
                onRetry={() => startCloning()}
                onDismiss={() => setCloneError(null)}
              />
            </div>
          )}

          {/* ══════════════ PANTALLA 3: RESULTADO ══════════════ */}
          {showResults && (
            <div className="fade-in p-4 md:p-8 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="t-display text-[22px] md:text-[26px] text-slate-900 italic normal-case">{name}</h2>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <Check size={11} strokeWidth={3} /> Guardado
                </span>
              </div>
              <p className="text-sm text-slate-500 -mt-3">Ya está en tu biblioteca de modelos, lista para usar en cualquier módulo.</p>

              {/* Tarjetas grandes y verticales apiladas — se ven bien, se descargan fácil */}
              <div className="flex flex-col gap-3">
                {previews.map((img, i) => (
                  <div
                    key={i}
                    className="group relative aspect-[4/5] rounded-[22px] overflow-hidden bg-slate-100 cursor-zoom-in"
                    onClick={() => openLightbox(i)}
                  >
                    <img src={img} alt={VIEW_META[i].label} className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3">
                      <div className="bg-black/55 backdrop-blur-sm rounded-xl px-3 py-2">
                        <p className="text-[12px] font-black text-white leading-none">{VIEW_META[i].label}</p>
                        <p className="text-[9.5px] text-white/70 mt-0.5">{VIEW_META[i].sub}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.href = img;
                        link.download = `${name}_${VIEW_META[i].label}.png`;
                        link.click();
                      }}
                      className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white/95 flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                    >
                      <Download size={15} className="text-slate-700" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <Info size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-slate-600 leading-relaxed">
                  Usá la foto de <strong className="text-slate-900">close-up facial</strong> como referencia para mantener el mismo rostro en tus creaciones futuras.
                </p>
              </div>

              <div className="flex gap-2.5">
                <button onClick={handleDownloadZip}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-[12.5px] font-bold transition-colors">
                  <Download size={14} /> Descargar todas
                </button>
                <button onClick={reset}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-[12.5px] font-bold transition-colors">
                  <Plus size={14} /> Crear otro modelo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Botón principal — fijo abajo del panel, solo en pantalla de subida */}
        {!showResults && !showGenerating && !showError && (
          <div className="mt-4">
            {!canGenerate && (
              <p className="text-[12px] text-slate-400 text-center mb-2">Escribe un nombre y sube al menos una foto para continuar.</p>
            )}
            <button
              type="button"
              onClick={() => startCloning()}
              disabled={!canGenerate}
              className="w-full flex flex-col items-center justify-center gap-0.5 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none bg-gradient-to-br from-brand-400 to-brand-600 text-white"
            >
              <span className="flex items-center gap-2">
                <Sparkles size={16} />
                Crear modelo digital
              </span>
              <span className="text-[10px] font-semibold normal-case opacity-90">
                {totalCost} créditos · te quedarán {creditsAfter}
              </span>
            </button>
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
            link.download = `${name}_${VIEW_META[idx]?.label ?? `vista_${idx + 1}`}.png`;
            link.click();
          }}
          metadata={{ label: `Modelo: ${name}` }}
        />
      )}
    </>
  );
};

export default ModelDNAModule;
