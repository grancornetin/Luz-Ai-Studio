// src/modules/contentStudioPro/ContentStudioProModule.tsx
// "Fotos para redes" (Studio Pro / UGC Studio).
// Rediseño sep-2026: wizard de 4 pasos (Qué mostrar → Quién aparece → Tus fotos → Revisar),
// foto de prueba para aprobar, creación de fotos una por una y vista de resultado.
// La lógica de cobro único, reembolso, reintentos y pausas entre fotos se mantiene igual.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check, User, Package, Shirt, MapPin, Plus, Info, LayoutGrid, ShieldCheck, Camera,
  Lightbulb, Download, Maximize2, RefreshCw, AlertTriangle, Loader2, Images, ArrowLeft,
  ArrowRight, Save, Trash2, X, CheckSquare,
} from 'lucide-react';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { useCreditGuard } from '../../../hooks/useCreditGuard';
import { useAuth } from '../../modules/auth/AuthContext';
import NoCreditsModal from '../../components/shared/NoCreditsModal';
import { CREDIT_COSTS, MODEL_CREDIT_COST } from '../../services/creditConfig';
import type { AvatarProfile } from '../../types';
import {
  ContentStudioProSet,
  Focus,
  ProductSize,
  FOCUS_LABELS,
  ShotKey,
  ShotDirective,
  ShotRole,
  getShotCount,
  getShotKeys,
} from './types';
import { contentStudioService } from './service';
import { contentStudioStorage } from './storage';
import { analyzeProductRelevance } from './ugcDirectorService';
import { generationHistoryService } from '../../services/generationHistoryService';
import { downloadAsZip, downloadImage } from '../../utils/imageUtils';
import { ErrorDisplay, toAppError, type AppError } from '../../components/shared/ErrorDisplay';
import { REFUNDABLE_ERRORS, newSessionId } from '../../services/imageApiService';
import { getNotification } from '../../services/notificationsService';
import { ImageSlot, type SlotType } from '../../components/shared/ImageSlot';
import UploadDisclaimer from '../../components/shared/UploadDisclaimer';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { FloatingActionBar } from '../../components/shared/FloatingActionBar';
import { useScrollFAB } from '../../hooks/useScrollFAB';
import { WizardStepper } from '../../components/shared/WizardStepper';
import { WizardFooter } from '../../components/shared/WizardFooter';

type ModelId = 'gemini' | 'gptimage';
type Step = 'setup' | 'generating_master' | 'checkpoint' | 'producing' | 'retrying' | 'result';
type View = 'create' | 'library' | 'session';
type WizardStep = 1 | 2 | 3 | 4;
type FilterTab = 'TODAS' | Focus;
type ProductMode = 'single' | 'collection';
type ModelTab = 'models' | 'upload';

const MAX_REGEN_ATTEMPTS = 3;
const FIXED_STYLE = 'UGC_PREMIUM' as const;
const TAB_ORDER: FilterTab[] = ['TODAS', 'AVATAR', 'PRODUCT', 'OUTFIT', 'SCENE'];
const MAX_PRODUCT_ANGLES = 2;
const MAX_COLLECTION = 6;
const MIN_COLLECTION = 2;

// Reintentos automáticos
const AUTO_RETRY_ATTEMPTS = 2;   // 2 intentos: el parallelismo ya se redujo a lotes de 2
const AUTO_RETRY_DELAY_MS = 5000; // 5s entre reintentos internos para dar tiempo a Gemini

const WIZARD_STEPS = [
  { id: 'focus', label: 'Qué mostrar' },
  { id: 'who', label: 'Quién aparece' },
  { id: 'photos', label: 'Tus fotos' },
  { id: 'review', label: 'Revisar' },
];

const FOCUS_CARDS: {
  id: Focus;
  title: string;
  desc: string;
  ideal: string;
  gradient: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}[] = [
  {
    id: 'AVATAR',
    title: 'Una persona',
    desc: 'Fotos tuyas o de tu modelo, estilo influencer: selfies, poses y expresiones.',
    ideal: 'Ideal para marca personal',
    gradient: 'from-pink-300 to-purple-400',
    Icon: User,
  },
  {
    id: 'PRODUCT',
    title: 'Tu producto',
    desc: 'Alguien mostrando, usando y recomendando tu producto, como una reseña real.',
    ideal: 'Ideal para vender',
    gradient: 'from-rose-300 to-orange-400',
    Icon: Package,
  },
  {
    id: 'OUTFIT',
    title: 'Un look',
    desc: 'Alguien luciendo tu ropa o un outfit completo: cuerpo entero, detalles y selfie.',
    ideal: 'Ideal para tiendas de ropa',
    gradient: 'from-indigo-300 to-fuchsia-300',
    Icon: Shirt,
  },
  {
    id: 'SCENE',
    title: 'Un lugar',
    desc: 'Alguien disfrutando un espacio: tu local, café, hotel o estudio.',
    ideal: 'Ideal para negocios con local',
    gradient: 'from-emerald-300 to-sky-400',
    Icon: MapPin,
  },
];

const SIZE_OPTIONS: { id: ProductSize; name: string; sub: string }[] = [
  { id: 'SMALL', name: 'Chico', sub: 'Joyas, cremas' },
  { id: 'MEDIUM', name: 'Mediano', sub: 'Bolsos, zapatos' },
  { id: 'LARGE', name: 'Grande', sub: 'Muebles, bicis' },
];

const ROLE_SIMPLE_LABELS: Record<ShotRole, string> = {
  HERO: 'Foto principal',
  SELFIE: 'Selfie',
  EXPRESSION: 'Expresión',
  DETAIL: 'Detalle',
  INTERACTION: 'En la mano',
  LIFESTYLE: 'En uso',
  ALT_ANGLE: 'Otro ángulo',
  CONTEXT: 'El lugar',
};

function getQtyOptions(focus: Focus) {
  const isProduct = focus === 'PRODUCT';
  return [
    { n: 2, title: 'Rápida', desc: 'Primer plano y plano medio.', recommended: false },
    {
      n: 4,
      title: 'Media',
      desc: isProduct ? 'Suma el producto en la mano y un detalle.' : 'Suma una selfie y un detalle.',
      recommended: false,
    },
    {
      n: 6,
      title: 'Completa',
      desc: isProduct
        ? 'Todo lo anterior + foto principal y en uso. Alcanza para una semana de posteos.'
        : 'Todo lo anterior + foto principal y otra en contexto. Alcanza para una semana de posteos.',
      recommended: true,
    },
  ];
}

// ─── Helpers puros ─────────────────────────────────────────────────────────────

/** Título legible de una sesión: "Valentina con tu producto" / "Tu sesión de look". */
function sessionTitleParts(set: { focus: Focus; modelName?: string; collectionRefs?: string[] }): { lead: string; accent: string } {
  const isCollection = !!set.collectionRefs && set.collectionRefs.length > 0;
  if (set.modelName) {
    const accent =
      set.focus === 'PRODUCT' ? (isCollection ? 'con tu colección' : 'con tu producto')
      : set.focus === 'OUTFIT' ? 'con tu look'
      : set.focus === 'SCENE' ? 'en tu lugar'
      : '';
    return { lead: set.modelName, accent };
  }
  const accent =
    set.focus === 'PRODUCT' ? (isCollection ? 'de colección' : 'de producto')
    : set.focus === 'OUTFIT' ? 'de look'
    : set.focus === 'SCENE' ? 'en tu lugar'
    : '';
  return { lead: 'Tu sesión', accent };
}

function sessionTitle(set: { focus: Focus; modelName?: string; collectionRefs?: string[] }): string {
  const { lead, accent } = sessionTitleParts(set);
  return `${lead} ${accent}`.trim();
}

function relativeDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
}

/** Etiqueta en lenguaje simple de la foto idx (0-based) de una sesión. */
function shotLabel(set: ContentStudioProSet, idx: number, fallbackPlan?: any): string {
  if (set.collectionRefs && set.collectionRefs.length > 0) return `Producto ${idx + 1}`;
  const key = set.shots[idx]?.key;
  const plan = set.sessionPlan ?? fallbackPlan;
  const role = plan?.shots?.find((d: ShotDirective) => d.key === key)?.role as ShotRole | undefined;
  return role && ROLE_SIMPLE_LABELS[role] ? ROLE_SIMPLE_LABELS[role] : `Foto ${idx + 1}`;
}

/** Enfoques no-producto: el objeto se usa solo si el usuario lo subió. */
function computeUseProduct(focus: Focus, productRef: string | null | undefined): boolean {
  return focus === 'PRODUCT' ? true : !!productRef;
}

/**
 * Producto que corresponde a la foto `shotListIndex` (0-based dentro de set.shots).
 * En colección cada foto usa SU producto (también en reintentos).
 */
function getShotProduct(set: ContentStudioProSet, shotListIndex: number): {
  useProduct: boolean;
  ref: string | null;
  options?: { productAngles?: string[]; isCollection?: boolean };
} {
  if (set.focus === 'PRODUCT' && set.collectionRefs && set.collectionRefs.length > 0) {
    return {
      useProduct: true,
      ref: set.collectionRefs[shotListIndex] ?? set.collectionRefs[0] ?? null,
      options: { isCollection: true },
    };
  }
  const useProduct = computeUseProduct(set.focus, set.productRef);
  const angles = set.focus === 'PRODUCT' ? (set.productAngles ?? []) : [];
  return {
    useProduct,
    ref: useProduct ? (set.productRef ?? null) : null,
    options: angles.length > 0 ? { productAngles: angles } : undefined,
  };
}

/** El servicio solo acepta base64/data URL: convierte URLs remotas (si se puede). */
async function toDataUrl(src: string): Promise<string> {
  if (!src || src.startsWith('data:')) return src;
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('[UGC] No se pudo convertir la foto del modelo a base64, se usa la URL:', e);
    return src;
  }
}

function avatarFace(avatar: AvatarProfile): string | undefined {
  const imgs = avatar.baseImages ?? [];
  return imgs[3] ?? imgs[imgs.length - 1] ?? imgs[0];
}

function avatarSubtitle(avatar: AvatarProfile): string {
  if (avatar.type === 'manual') return 'Creado desde cero';
  return 'Creado desde fotos';
}

// ─── Piezas visuales chicas ────────────────────────────────────────────────────

const Title: React.FC<{ lead: string; accent?: string; className?: string }> = ({ lead, accent, className = '' }) => (
  <h2 className={`t-display text-[22px] md:text-[28px] leading-[1.08] text-slate-900 ${className}`}>
    {lead} {accent && <span className="text-brand-600">{accent}</span>}
  </h2>
);

const Desc: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[13px] text-slate-500 leading-relaxed -mt-1">{children}</p>
);

const FieldLabel: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
    <span>{children}</span>
    {right}
  </div>
);

const RequiredPill: React.FC = () => (
  <span className="text-[9px] font-black uppercase tracking-wide text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
    Necesaria
  </span>
);

const OptionalNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[11px] font-semibold normal-case tracking-normal text-slate-300">{children}</span>
);

const Tip: React.FC<{ icon?: React.ReactNode; tone?: 'neutral' | 'brand' | 'warn'; children: React.ReactNode }> = ({
  icon,
  tone = 'neutral',
  children,
}) => {
  const tones = {
    neutral: 'bg-white border-slate-100 text-slate-500 [&_b]:text-slate-700',
    brand: 'bg-brand-50 border-brand-100 text-brand-700/80 [&_b]:text-brand-900',
    warn: 'bg-amber-50 border-amber-200 text-amber-700 [&_b]:text-amber-900',
  };
  const iconTone = { neutral: 'text-slate-400', brand: 'text-brand-500', warn: 'text-amber-500' };
  return (
    <div className={`flex gap-2.5 items-start border rounded-2xl px-3.5 py-3 text-[12px] leading-relaxed ${tones[tone]}`}>
      <span className={`flex-shrink-0 mt-0.5 ${iconTone[tone]}`}>{icon ?? <Info size={14} />}</span>
      <span>{children}</span>
    </div>
  );
};

function Seg<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 bg-brand-50 border border-brand-100 rounded-2xl p-1 flex-shrink-0">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          style={{ touchAction: 'manipulation' }}
          className={`flex-1 py-2.5 rounded-xl text-[12px] font-extrabold transition-colors ${
            value === o.id ? 'bg-white text-brand-600 shadow-sm' : 'text-brand-600/55 hover:text-brand-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Barra de fase (post-wizard): mismo lenguaje visual que el WizardStepper mobile. */
const PhaseBar: React.FC<{ label: string; name: string; pct: number }> = ({ label, name, pct }) => (
  <div className="bg-white border-b border-slate-100 px-4 md:px-6 pt-3 pb-2.5">
    <div className="flex justify-between items-baseline mb-2">
      <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{label}</span>
      <span className="text-[11px] font-semibold text-slate-500">{name}</span>
    </div>
    <div className="h-[3px] bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
      />
    </div>
  </div>
);

const LiveEyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-2">
    <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse motion-reduce:animate-none" />
    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-brand-600">{children}</span>
  </div>
);

/** Barra fija inferior con sub-texto en el CTA (WizardFooter no admite sub-texto libre). */
const CtaBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="sticky bottom-0 z-20 bg-white border-t border-slate-200 px-4 md:px-6 py-3 flex items-center gap-3"
    style={{ boxShadow: '0 -8px 24px rgba(15,23,42,0.04)', clipPath: 'inset(-40px 0 0 0 round 0 0 28px 28px)' }}
  >
    {children}
  </div>
);

const primaryCtaCls =
  'flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl px-4 py-3 min-h-12 text-sm font-semibold bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_12px_28px_rgba(247,44,91,0.32)] active:scale-[0.97] transition-transform disabled:bg-none disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none';
const secondaryCtaCls =
  'flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-3 min-h-12 text-sm font-semibold border border-slate-200 bg-white text-slate-700 active:bg-slate-50 transition-colors disabled:opacity-50';

/** Slot de subida con proporción controlada por un contenedor + etiqueta opcional al estar lleno. */
const UploadCard: React.FC<{
  value: string | null;
  onChange: (v: string | null) => void;
  hint: string;
  slotType?: SlotType;
  ratio: string; // clase tailwind, ej. 'aspect-[4/5]'
  tag?: string;
}> = ({ value, onChange, hint, slotType = 'generic', ratio, tag }) => (
  <div className={`relative ${ratio} [&_.rounded-2xl]:rounded-[22px]`}>
    <ImageSlot value={value} onChange={onChange} hint={hint} slotType={slotType} aspectRatio="auto" />
    {value && tag && (
      <span className="pointer-events-none absolute bottom-3 left-3 text-[10px] font-extrabold uppercase text-white bg-black/55 px-2.5 py-1 rounded-full">
        {tag}
      </span>
    )}
  </div>
);

/** Foto de resultado con etiqueta, descarga y estados. */
const ResultPhoto: React.FC<{
  url?: string | null;
  label: string;
  status: 'done' | 'generating' | 'error' | 'idle';
  big?: boolean;
  onOpen?: () => void;
  onDownload?: () => void;
  onRetry?: () => void;
  onRegenerate?: () => void;
}> = ({ url, label, status, big, onOpen, onDownload, onRetry, onRegenerate }) => (
  <div className={`relative overflow-hidden bg-slate-100 ${big ? 'aspect-[4/5] rounded-[24px]' : 'aspect-[3/5] rounded-[20px]'}`}>
    {status === 'generating' ? (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-brand-50 text-brand-600">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest">Creando</span>
      </div>
    ) : url ? (
      <button type="button" onClick={onOpen} className="absolute inset-0 w-full h-full" aria-label={`Ver ${label}`}>
        <img src={url} alt={label} className="w-full h-full object-cover" />
      </button>
    ) : (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center bg-red-50">
        <AlertTriangle size={22} className="text-red-400" />
        <span className="text-[10px] font-black uppercase text-red-500">No salió</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 px-3.5 py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase rounded-xl flex items-center gap-1.5"
          >
            <RefreshCw size={12} /> Reintentar
          </button>
        )}
      </div>
    )}
    <span className="pointer-events-none absolute top-2.5 left-2.5 bg-black/50 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-[10px]">
      {label}
    </span>
    {url && status !== 'generating' && onDownload && (
      <button
        type="button"
        onClick={onDownload}
        aria-label={`Descargar ${label}`}
        className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-white/95 flex items-center justify-center text-slate-700 shadow"
      >
        <Download size={15} />
      </button>
    )}
    {url && status !== 'generating' && onRegenerate && (
      <button
        type="button"
        onClick={onRegenerate}
        aria-label={`Crear otra versión de ${label}`}
        title="Crear otra versión"
        className="absolute bottom-2.5 left-2.5 w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center"
      >
        <RefreshCw size={14} />
      </button>
    )}
  </div>
);

// ─── Módulo ────────────────────────────────────────────────────────────────────

interface ContentStudioProModuleProps {
  avatars?: AvatarProfile[];
}

const ContentStudioProModule: React.FC<ContentStudioProModuleProps> = ({ avatars = [] }) => {
  const navigate = useNavigate();
  const { credits, user, isAdmin } = useAuth();
  const [modelId, setModelId] = useState<ModelId>('gemini');

  const [view, setView] = useState<View>('create');
  const [step, setStep] = useState<Step>('setup');
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  const [sets, setSets] = useState<ContentStudioProSet[]>([]);
  const [currentSet, setCurrentSet] = useState<ContentStudioProSet | null>(null);
  const [viewedSet, setViewedSet] = useState<ContentStudioProSet | null>(null);
  // sessionId del set en curso, para que server agrupe master + derived shots en una sola notificación
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('TODAS');

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());

  // Paso 1
  const [focus, setFocus] = useState<Focus>('PRODUCT');
  // Paso 2 — quién aparece
  const [faceRefs, setFaceRefs] = useState<string[]>([]);
  const [manualFace, setManualFace] = useState<string | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [avatarLoadingId, setAvatarLoadingId] = useState<string | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState<string | null>(null);
  const [modelTab, setModelTab] = useState<ModelTab>(avatars.length > 0 ? 'models' : 'upload');
  // Paso 3 — fotos
  const [productMode, setProductMode] = useState<ProductMode>('single');
  const [productRef, setProductRef] = useState<string | null>(null);
  const [angleSlots, setAngleSlots] = useState<(string | null)[]>([null, null]);
  const [collectionRefs, setCollectionRefs] = useState<string[]>([]);
  const [objectRef, setObjectRef] = useState<string | null>(null); // "Un objeto" en Look/Lugar/Persona
  const [outfitRef, setOutfitRef] = useState<string | null>(null);
  const [sceneRef, setSceneRef] = useState<string | null>(null);
  const [sceneText, setSceneText] = useState('');
  const [productSize, setProductSize] = useState<ProductSize>('MEDIUM');

  const [showProductWarning, setShowProductWarning] = useState(false);
  const [productWarningMsg, setProductWarningMsg] = useState('');

  const [masterPhase, setMasterPhase] = useState<0 | 1>(0);
  const [isRegeneratingMaster, setIsRegeneratingMaster] = useState(false);
  const [errorStatus, setErrorStatus] = useState<AppError | null>(null);
  const [creditsRefunded, setCreditsRefunded] = useState(false);
  const [sessionPlan, setSessionPlan] = useState<any>(null);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxLabels, setLightboxLabels] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMetadata, setLightboxMetadata] = useState<{ label: string }>({ label: '' });

  const [userShotCount, setUserShotCount] = useState(6);

  const [generatingShots, setGeneratingShots] = useState<{ [key: string]: { status: string; imageUrl?: string; error?: string; autoRetryCount?: number } }>({});

  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [pendingProducedSet, setPendingProducedSet] = useState<ContentStudioProSet | null>(null);

  // FAB para selección múltiple en el historial
  const { isVisible: fabVisible } = useScrollFAB({ threshold: 100, alwaysVisibleOnMobile: true });

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal, refundCredits } = useCreditGuard();

  // Carrusel del paso 1
  const focusTrackRef = useRef<HTMLDivElement>(null);
  const [focusVisibleIdx, setFocusVisibleIdx] = useState(() => FOCUS_CARDS.findIndex(c => c.id === 'PRODUCT'));

  useEffect(() => {
    loadSets();
  }, []);

  // Retomar sesión desde notificación (?session=xxx)
  // Reconstruimos el set y saltamos a 'producing' o 'result' según el estado.
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
      // Master en posición 0, derivados en 1..N
      const masterShot = notif.shots.find(s => s.index === 0);
      const derivedShots = notif.shots.filter(s => s.index > 0).sort((a, b) => a.index - b.index);
      const userShots = Math.max(0, notif.totalShots - 1);

      const reconstructedShots = Array.from({ length: userShots }).map((_, i) => {
        const found = derivedShots.find(s => s.index === i + 1);
        return {
          key: `S${i + 1}` as ShotKey,
          name: `Foto ${i + 1}`,
          promptUsed: '',
          negativeUsed: '',
          status: found?.status === 'completed' && found.imageUrl ? 'done' as const :
                  found?.status === 'failed' ? 'error' as const : 'idle' as const,
          imageUrl: found?.imageUrl,
          errorMsg: found?.error || null,
          attempts: 0,
        };
      });

      const reconstructedSet: ContentStudioProSet = {
        id: sessionParam,
        createdAt: notif.createdAt,
        style: FIXED_STYLE as any,
        focus: notif.metadata?.focus || 'AVATAR',
        productSize: notif.metadata?.productSize,
        productCategory: 'jewelry' as any,
        faceRefs: [],
        productRef: null,
        outfitRef: null,
        sceneRef: null,
        sceneText: '',
        modelName: notif.metadata?.modelName || undefined,
        image0Url: masterShot?.imageUrl || '',
        ref0Analysis: undefined as any,
        attemptsImage0: 1,
        shots: reconstructedShots,
        userShotCount: notif.metadata?.userShotCount || userShots,
      };

      setCurrentSet(reconstructedSet);
      setCurrentSessionId(sessionParam);
      setUserShotCount(reconstructedSet.userShotCount || userShots);
      setView('create');
      // Con master: si todas las fotos ya terminaron → resultado; si no → progreso.
      // Sin master: vuelve al wizard para reconfigurar.
      const allFinished = reconstructedShots.length > 0 && reconstructedShots.every(s => s.status !== 'idle');
      setStep(masterShot?.imageUrl ? (allFinished ? 'result' : 'producing') : 'setup');
      setSearchParams({}, { replace: true });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Onboarding: activa tour guiado si viene del wizard de registro
  useEffect(() => {
    const tour = localStorage.getItem('onboarding_tour_active');
    if (tour === 'ugc') {
      localStorage.removeItem('onboarding_tour_active');
      // El usuario completa el módulo normalmente.
      // El flag onboarding_free_generation se consume en startMasterGeneration.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sin modelos guardados → el paso 2 abre directo en "Subir una foto".
  useEffect(() => {
    if (avatars.length === 0) setModelTab('upload');
    else if (!manualFace) setModelTab('models');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatars.length]);

  const loadSets = async () => {
    const allSets = await contentStudioStorage.listSets();
    setSets(allSets);
  };

  useEffect(() => {
    setUserShotCount(getShotCount(focus, productSize));
  }, [focus, productSize]);

  // Análisis de relevancia del objeto extra (aviso suave, no bloquea), debounce 2s
  useEffect(() => {
    if (!(focus === 'OUTFIT' || focus === 'SCENE') || !objectRef) {
      setShowProductWarning(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await analyzeProductRelevance(objectRef, focus, outfitRef, sceneRef, sceneText);
        if (!result.isRelevant) {
          setShowProductWarning(true);
          setProductWarningMsg(`${result.suggestion} Si no tiene que ver con ${focus === 'OUTFIT' ? 'el look' : 'el lugar'}, puede desentonar en las fotos.`);
        } else {
          setShowProductWarning(false);
        }
      } catch { /* silencioso — no crítico */ }
    }, 2000);
    return () => clearTimeout(timer);
  }, [objectRef, outfitRef, sceneRef, sceneText, focus]);

  // Centrar la tarjeta elegida al entrar al paso 1 (mobile)
  useEffect(() => {
    if (view !== 'create' || step !== 'setup' || wizardStep !== 1) return;
    const track = focusTrackRef.current;
    if (!track) return;
    const i = FOCUS_CARDS.findIndex(c => c.id === focus);
    const child = track.children[i] as HTMLElement | undefined;
    if (child) track.scrollLeft = child.offsetLeft - (track.clientWidth - child.clientWidth) / 2;
    setFocusVisibleIdx(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, step, wizardStep]);

  const handleFocusScroll = useCallback(() => {
    const track = focusTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    let closest = 0;
    let closestDist = Infinity;
    Array.from(track.children).forEach((child, i) => {
      const r = (child as HTMLElement).getBoundingClientRect();
      const dist = Math.abs(r.left + r.width / 2 - centerX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    });
    setFocusVisibleIdx(closest);
  }, []);

  const scrollFocusTo = (i: number) => {
    const track = focusTrackRef.current;
    const child = track?.children[i] as HTMLElement | undefined;
    if (track && child) {
      track.scrollTo({ left: child.offsetLeft - (track.clientWidth - child.clientWidth) / 2, behavior: 'smooth' });
    }
  };

  // ── Derivados del wizard ────────────────────────────────────────────────────
  const isCollection = focus === 'PRODUCT' && productMode === 'collection';
  const productAngles = angleSlots.filter((a): a is string => !!a);
  const effectiveProductRef: string | null =
    focus === 'PRODUCT' ? (isCollection ? collectionRefs[0] ?? null : productRef) : objectRef;
  const effectiveShotCount = isCollection ? collectionRefs.length : userShotCount;
  const selectedAvatar = avatars.find(a => a.id === selectedAvatarId) ?? null;

  // ── Paso 2: selección de modelo / subida manual ─────────────────────────────
  const selectAvatar = async (avatar: AvatarProfile) => {
    if (selectedAvatarId === avatar.id) {
      // Tocar de nuevo deselecciona → vuelve a la foto subida a mano, si hay
      setSelectedAvatarId(null);
      setFaceRefs(manualFace ? [manualFace] : []);
      return;
    }
    const face = avatarFace(avatar);
    if (!face) return;
    setAvatarLoadError(null);
    setSelectedAvatarId(avatar.id);
    setAvatarLoadingId(avatar.id);
    try {
      const data = await toDataUrl(face);
      // El servicio descarta en silencio las referencias que no son base64:
      // sin este corte, la sesión se generaría con una persona cualquiera.
      if (!data.startsWith('data:')) {
        setSelectedAvatarId(null);
        setFaceRefs(manualFace ? [manualFace] : []);
        setAvatarLoadError(`No pudimos cargar la foto de ${avatar.name}. Probá de nuevo o subí una foto del rostro a mano.`);
        return;
      }
      setFaceRefs([data]);
    } finally {
      setAvatarLoadingId(null);
    }
  };

  const updateManualFace = (base64: string | null) => {
    setManualFace(base64);
    setSelectedAvatarId(null);
    setFaceRefs(base64 ? [base64] : []);
  };

  // ── Paso 3: colección y ángulos ─────────────────────────────────────────────
  const setAngleAt = (i: number, v: string | null) =>
    setAngleSlots(prev => {
      const next = [...prev];
      next[i] = v;
      // compactar: los ángulos cargados quedan primero
      const filled = next.filter(Boolean);
      return [...filled, ...Array(MAX_PRODUCT_ANGLES - filled.length).fill(null)].slice(0, MAX_PRODUCT_ANGLES);
    });

  const setCollectionAt = (i: number, v: string | null) =>
    setCollectionRefs(prev => {
      if (v === null) return prev.filter((_, j) => j !== i);
      if (i >= prev.length) return [...prev, v].slice(0, MAX_COLLECTION);
      const next = [...prev];
      next[i] = v;
      return next;
    });

  const step3Ready =
    focus === 'PRODUCT' ? (isCollection ? collectionRefs.length >= MIN_COLLECTION : !!productRef)
    : focus === 'OUTFIT' ? !!outfitRef
    : focus === 'SCENE' ? !!sceneRef
    : true;

  const canContinue: Record<WizardStep, boolean> = {
    1: true,
    2: faceRefs.length > 0 && !avatarLoadingId,
    3: step3Ready,
    4: true,
  };

  const goToWizardStep = (s: WizardStep) => {
    setWizardStep(s);
    window.scrollTo({ top: 0 });
  };

  const validateReferences = (): boolean => {
    if (faceRefs.length === 0) {
      alert('Elegí un modelo o subí una foto clara del rostro.');
      return false;
    }
    if (focus === 'PRODUCT' && !isCollection && !productRef) {
      alert('Subí una foto del producto para continuar.');
      return false;
    }
    if (isCollection && collectionRefs.length < MIN_COLLECTION) {
      alert(`Para una colección subí al menos ${MIN_COLLECTION} productos.`);
      return false;
    }
    if (focus === 'OUTFIT' && !outfitRef) {
      alert('Subí una foto del look para continuar.');
      return false;
    }
    if (focus === 'SCENE' && !sceneRef) {
      alert('Subí una foto del lugar para continuar.');
      return false;
    }
    return true;
  };

  const startMasterGeneration = async (free = false) => {
    if (!validateReferences()) return;

    const shotCount = effectiveShotCount;
    const isFreeOnboarding = free || localStorage.getItem('onboarding_free_generation') === 'true';
    if (isFreeOnboarding) localStorage.removeItem('onboarding_free_generation');
    if (!isFreeOnboarding) {
      const costPerImage = MODEL_CREDIT_COST[modelId];
      const totalCost = costPerImage * (1 + shotCount);
      const ok = await checkAndDeduct(totalCost);
      if (!ok) return;
    }

    setStep('generating_master');
    setMasterPhase(0);
    setIsRegeneratingMaster(false);
    setErrorStatus(null);
    setCreditsRefunded(false);
    window.scrollTo({ top: 0 });

    // Notificaciones Nivel 3: total = 1 master + N derived shots
    const totalShotsForSession = 1 + shotCount;
    const sessionId = newSessionId();
    setCurrentSessionId(sessionId);
    const sessionMetadata: Record<string, any> = {
      focus,
      productSize: focus === 'PRODUCT' ? productSize : undefined,
      userShotCount: shotCount,
      hasFace: faceRefs.length > 0,
      hasProduct: !!effectiveProductRef,
      hasOutfit: !!outfitRef,
      hasScene: !!sceneRef,
      isCollection,
      productAngles: isCollection ? 0 : productAngles.length,
      modelName: selectedAvatar?.name,
    };
    const sessionParams = {
      uid: user?.uid,
      sessionId,
      module: 'content_studio',
      moduleLabel: `Content Studio (${FOCUS_LABELS[focus].split(' / ')[0]})`,
      metadata: sessionMetadata,
    };

    try {
      const useProduct = computeUseProduct(focus, effectiveProductRef);

      const plan = await contentStudioService.buildSessionPlan(
        focus,
        { productRef: effectiveProductRef, outfitRef, sceneRef, sceneText },
        focus === 'PRODUCT' ? productSize : undefined,
        useProduct
      );
      setSessionPlan(plan);
      setMasterPhase(1);

      const anglesForSession = focus === 'PRODUCT' && !isCollection ? productAngles : [];

      const { imageUrl: image0, analysis } = await contentStudioService.generateImage0(
        faceRefs[0],
        effectiveProductRef,
        outfitRef,
        sceneRef,
        sceneText,
        FIXED_STYLE,
        focus,
        focus === 'PRODUCT' ? productSize : undefined,
        useProduct,
        () => {},
        modelId,
        // Master = posición 0 dentro del set master+derived
        { ...sessionParams, shotIndex: 0, totalShots: totalShotsForSession },
        anglesForSession,
      );

      const shotKeys = getShotKeys(shotCount);
      const initialShots = shotKeys.map((key, idx) => ({
        key,
        name: `Foto ${idx + 1}`,
        promptUsed: '',
        negativeUsed: '',
        status: 'idle' as const,
        attempts: 0,
        errorMsg: null
      }));

      const newSet: ContentStudioProSet = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        style: FIXED_STYLE as any,
        focus,
        productSize: focus === 'PRODUCT' ? productSize : undefined,
        productCategory: plan.productCategory,
        faceRefs,
        productRef: useProduct ? effectiveProductRef : null,
        productAngles: anglesForSession.length > 0 ? anglesForSession : undefined,
        collectionRefs: isCollection ? [...collectionRefs] : undefined,
        outfitRef,
        sceneRef,
        sceneText,
        modelName: selectedAvatar?.name,
        image0Url: image0,
        ref0Analysis: analysis,
        sessionPlan: plan,
        attemptsImage0: 1,
        shots: initialShots,
        userShotCount: shotCount,
      };

      setCurrentSet(newSet);

      saveToHistorySafe({
        imageUrl: image0,
        moduleLabel: `UGC Pro (${FOCUS_LABELS[focus].split(' / ')[0]} - Master)`,
        promptText: `Master image for ${focus}`,
      });

      setStep('checkpoint');
    } catch (e: any) {
      const appErr = toAppError(e);
      setErrorStatus(appErr);
      // Reembolsar solo si de verdad se cobró: la sesión gratis de onboarding
      // (flag en localStorage) no descuenta nada, así que tampoco devuelve.
      if (!isFreeOnboarding && REFUNDABLE_ERRORS.has(appErr.code as any)) {
        const refunded = await refundCredits(MODEL_CREDIT_COST[modelId] * (1 + shotCount));
        setCreditsRefunded(refunded);
      }
      setStep('setup');
      setWizardStep(4);
    }
  };

  const regenerateMaster = async () => {
    if (!currentSet) return;
    if (currentSet.attemptsImage0 >= MAX_REGEN_ATTEMPTS) return;
    setStep('generating_master');
    setMasterPhase(1);
    setIsRegeneratingMaster(true);
    setErrorStatus(null);
    window.scrollTo({ top: 0 });

    try {
      const useProduct = computeUseProduct(currentSet.focus, currentSet.productRef);

      const { imageUrl: image0, analysis } = await contentStudioService.generateImage0(
        currentSet.faceRefs[0],
        currentSet.productRef || null,
        currentSet.outfitRef || null,
        currentSet.sceneRef || null,
        currentSet.sceneText || '',
        FIXED_STYLE,
        currentSet.focus,
        currentSet.productSize,
        useProduct,
        () => {},
        modelId,
        undefined,
        currentSet.productAngles ?? [],
      );

      setCurrentSet({
        ...currentSet,
        image0Url: image0,
        ref0Analysis: analysis,
        attemptsImage0: currentSet.attemptsImage0 + 1,
        style: FIXED_STYLE as any
      });
      setStep('checkpoint');
    } catch (e: any) {
      setErrorStatus(toAppError(e));
      setStep('checkpoint');
    } finally {
      setIsRegeneratingMaster(false);
    }
  };

  const saveToHistorySafe = (params: {
    imageUrl: string;
    moduleLabel: string;
    promptText: string;
  }) => {
    generationHistoryService.save({
      imageUrl:    params.imageUrl,
      module:      'content_studio_pro',
      moduleLabel: params.moduleLabel,
      creditsUsed: CREDIT_COSTS.UGC_PER_SHOT,
      promptText:  params.promptText,
    }).catch(e => console.warn('[UGC] History save failed (non-blocking):', e?.message));
  };

  /**
   * Genera una foto derivada con reintentos automáticos.
   * `shotListIndex` = posición de la foto dentro de set.shots (define el producto en colección).
   * `notifIndex`/`totalShots` = posición para el sistema de notificaciones.
   */
  const generateShotWithAutoRetry = async (
    producingSet: ContentStudioProSet,
    shot: { key: ShotKey; [k: string]: any },
    shotListIndex: number,
    notifIndex: number,
    totalShots: number,
    currentSessionPlan: any,
    onAttemptUpdate: (attempt: number) => void,
    sessionParams?: {
      uid?: string;
      sessionId?: string;
      module?: string;
      moduleLabel?: string;
      metadata?: Record<string, any>;
      userPlan?: string;
    },
  ): Promise<string> => {
    let lastError: any = null;
    const product = getShotProduct(producingSet, shotListIndex);

    for (let attempt = 1; attempt <= AUTO_RETRY_ATTEMPTS; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, AUTO_RETRY_DELAY_MS));
          onAttemptUpdate(attempt);
        }

        const url = await contentStudioService.generateDerivedShotAsync(
          producingSet.image0Url!,
          producingSet.faceRefs[0],
          producingSet.outfitRef ?? null,
          product.ref,
          producingSet.sceneRef ?? null,
          FIXED_STYLE,
          producingSet.focus,
          shot.key,
          producingSet.productSize,
          currentSessionPlan,
          product.useProduct,
          producingSet.ref0Analysis,
          notifIndex,
          totalShots,
          () => {},
          modelId,
          sessionParams,
          product.options,
        );

        return url;
      } catch (e: any) {
        lastError = e;
      }
    }

    throw lastError;
  };

  const approveAndProduce = async () => {
    if (!currentSet || !currentSet.image0Url || !currentSet.faceRefs[0]) return;

    const producingSet: ContentStudioProSet = {
      ...currentSet,
      style: FIXED_STYLE as any,
    };
    const setFocusLabel = FOCUS_LABELS[producingSet.focus].split(' / ')[0];
    const planForShots = producingSet.sessionPlan ?? sessionPlan;

    setStep('producing');
    setCurrentSet(producingSet);
    setErrorStatus(null);
    window.scrollTo({ top: 0 });

    const initialGenState: { [key: string]: { status: string; imageUrl?: string; error?: string; autoRetryCount?: number } } = {};
    producingSet.shots.forEach((shot) => {
      initialGenState[shot.key] = { status: 'pending', autoRetryCount: 0 };
    });
    setGeneratingShots(initialGenState);

    const updatedShots = [...producingSet.shots];

    const updateShotStatus = (shotKey: ShotKey, status: string, imageUrl?: string, errorMsg?: string, autoRetryCount?: number) => {
      setGeneratingShots(prev => ({
        ...prev,
        [shotKey]: {
          status,
          imageUrl: imageUrl ?? prev[shotKey]?.imageUrl,
          error: errorMsg,
          autoRetryCount: autoRetryCount ?? prev[shotKey]?.autoRetryCount ?? 0
        }
      }));

      const shotIndex = updatedShots.findIndex(s => s.key === shotKey);
      if (shotIndex !== -1) {
        if (status === 'completed' && imageUrl) {
          updatedShots[shotIndex].imageUrl = imageUrl;
          updatedShots[shotIndex].status = 'done';
          updatedShots[shotIndex].errorMsg = null;
        } else if (status === 'failed') {
          updatedShots[shotIndex].status = 'error';
          updatedShots[shotIndex].errorMsg = errorMsg;
        } else if (status === 'processing' || status === 'retrying') {
          updatedShots[shotIndex].status = 'generating';
        }
        setCurrentSet(prev => prev ? { ...prev, shots: [...updatedShots] } : prev);
      }
    };

    // Notificaciones Nivel 3: shots derivados van en posiciones 1..N
    // (master ya ocupó la posición 0). totalShots incluye al master.
    const totalShotsForSession = updatedShots.length + 1;
    const sessionParamsForShots = currentSessionId ? {
      uid: user?.uid,
      sessionId: currentSessionId,
      module: 'content_studio',
      moduleLabel: `Content Studio (${setFocusLabel})`,
      userPlan: credits.plan,
    } : undefined;

    // Secuencial puro: un shot a la vez con pausa entre cada uno.
    // Cualquier paralelismo — incluso lotes de 2 — provoca 429 en Gemini
    // porque QStash ejecuta los workers simultáneamente.
    const INTER_SHOT_DELAY_MS = 15000;

    for (let idx = 0; idx < updatedShots.length; idx++) {
      const shot = updatedShots[idx];
      updateShotStatus(shot.key, 'processing');

      try {
        const url = await generateShotWithAutoRetry(
          producingSet,
          shot,
          idx,
          idx + 1,
          totalShotsForSession,
          planForShots,
          (attempt) => {
            updateShotStatus(shot.key, 'retrying', undefined, undefined, attempt - 1);
          },
          sessionParamsForShots,
        );

        updateShotStatus(shot.key, 'completed', url);

        saveToHistorySafe({
          imageUrl: url,
          moduleLabel: `UGC Pro (${setFocusLabel} - ${shot.name})`,
          promptText: `Shot ${shot.key} for ${producingSet.focus}`,
        });

      } catch (e: any) {
        updateShotStatus(shot.key, 'failed', undefined, e?.message || 'Error desconocido');
      }

      // Pausa entre shots para no saturar Gemini, excepto después del último
      if (idx < updatedShots.length - 1) {
        await new Promise(r => setTimeout(r, INTER_SHOT_DELAY_MS));
      }
    }

    const finalSet = { ...producingSet, shots: updatedShots };
    const failedShots = updatedShots.filter(s => s.status === 'error');

    if (failedShots.length > 0) {
      setPendingProducedSet(finalSet);
      setShowIncompleteModal(true);
    } else {
      await contentStudioStorage.saveSet(finalSet);
      await loadSets();
      // Breve pausa para mostrar el estado "todas listas" antes del resultado
      await new Promise(r => setTimeout(r, 1200));
      setCurrentSet(finalSet);
      setStep('result');
      setGeneratingShots({});
    }
  };

  const retryFailedShots = async () => {
    if (!pendingProducedSet) return;
    setShowIncompleteModal(false);

    const targetSet = pendingProducedSet;
    const failedShots = targetSet.shots.filter(s => s.status === 'error');
    if (failedShots.length === 0) return;
    const setFocusLabel = FOCUS_LABELS[targetSet.focus].split(' / ')[0];

    // 'retrying' muestra la grilla completa con las fotos ya listas
    // mientras se reintentan solo las que fallaron
    setStep('retrying');
    setView('create');
    setCurrentSet(targetSet);

    const updatedShots = [...targetSet.shots];

    setGeneratingShots(prev => {
      const next = { ...prev };
      failedShots.forEach(s => { next[s.key] = { status: 'processing', autoRetryCount: 0 }; });
      return next;
    });

    const updateShotStatus = (shotKey: ShotKey, status: string, imageUrl?: string, errorMsg?: string, autoRetryCount?: number) => {
      setGeneratingShots(prev => ({
        ...prev,
        [shotKey]: {
          status,
          imageUrl: imageUrl ?? prev[shotKey]?.imageUrl,
          error: errorMsg,
          autoRetryCount: autoRetryCount ?? prev[shotKey]?.autoRetryCount ?? 0
        }
      }));
      const shotIndex = updatedShots.findIndex(s => s.key === shotKey);
      if (shotIndex !== -1) {
        if (status === 'completed' && imageUrl) {
          updatedShots[shotIndex].imageUrl = imageUrl;
          updatedShots[shotIndex].status = 'done';
          updatedShots[shotIndex].errorMsg = null;
        } else if (status === 'failed') {
          updatedShots[shotIndex].status = 'error';
          updatedShots[shotIndex].errorMsg = errorMsg;
        } else if (status === 'processing' || status === 'retrying') {
          updatedShots[shotIndex].status = 'generating';
        }
        setCurrentSet(prev => prev ? { ...prev, shots: [...updatedShots] } : prev);
      }
    };

    // El retry crea su propia mini-notificación con totalShots = N reintentos
    const retrySessionId = newSessionId();
    const retrySessionParams = {
      uid: user?.uid,
      sessionId: retrySessionId,
      module: 'content_studio',
      moduleLabel: `Content Studio (${setFocusLabel} – Retry)`,
      userPlan: credits.plan,
    };
    const retryTotal = failedShots.length;

    // Reintentar de a 1 shot por vez para no acumular 429s
    for (let retryIdx = 0; retryIdx < failedShots.length; retryIdx++) {
      const shot = failedShots[retryIdx];
      // Posición real de la foto en la sesión → define su producto en colección
      const idx = updatedShots.findIndex(s => s.key === shot.key);
      updateShotStatus(shot.key, 'processing');

      try {
        const url = await generateShotWithAutoRetry(
          targetSet,
          shot,
          idx,
          retryIdx,
          retryTotal,
          targetSet.sessionPlan ?? sessionPlan,
          (attempt) => {
            updateShotStatus(shot.key, 'retrying', undefined, undefined, attempt - 1);
          },
          retrySessionParams,
        );
        updateShotStatus(shot.key, 'completed', url);

        saveToHistorySafe({
          imageUrl: url,
          moduleLabel: `UGC Pro (${setFocusLabel} - ${shot.name})`,
          promptText: `Shot ${shot.key} retry for ${targetSet.focus}`,
        });

      } catch (e: any) {
        updateShotStatus(shot.key, 'failed', undefined, e?.message || 'Error desconocido');
      }

      // Pausa entre reintentos — más larga que en producción normal porque ya hubo 429
      if (retryIdx < failedShots.length - 1) {
        await new Promise(r => setTimeout(r, 20000));
      }
    }

    const finalSet = { ...targetSet, shots: updatedShots };
    const stillFailed = updatedShots.filter(s => s.status === 'error');

    if (stillFailed.length > 0) {
      setPendingProducedSet(finalSet);
      setShowIncompleteModal(true);
    } else {
      setPendingProducedSet(null);
      await contentStudioStorage.saveSet(finalSet);
      await loadSets();
      setCurrentSet(finalSet);
      setStep('result');
      setGeneratingShots({});
    }
  };

  const saveIncompleteSession = async () => {
    if (!pendingProducedSet) return;
    setShowIncompleteModal(false);
    await contentStudioStorage.saveSet(pendingProducedSet);
    await loadSets();
    setCurrentSet(pendingProducedSet);
    setPendingProducedSet(null);
    setStep('result');
    setGeneratingShots({});
  };

  const regenerateShot = async (targetSet: ContentStudioProSet, key: ShotKey) => {
    if (!targetSet.image0Url || !targetSet.faceRefs[0]) return;

    const shotIndex = targetSet.shots.findIndex((s) => s.key === key);
    const shot = targetSet.shots[shotIndex];
    if (shot.attempts >= MAX_REGEN_ATTEMPTS) return alert('Ya no quedan intentos para esta foto.');

    const applySet = (s: ContentStudioProSet) => {
      if (currentSet?.id === s.id) setCurrentSet(s);
      setViewedSet(prev => (prev?.id === s.id ? s : prev));
      setSets((prev) => prev.map((x) => (x.id === s.id ? s : x)));
    };

    const updatedShots = [...targetSet.shots];
    updatedShots[shotIndex] = { ...shot, status: 'generating', imageUrl: null, errorMsg: null };
    applySet({ ...targetSet, shots: updatedShots, style: FIXED_STYLE as any });

    const product = getShotProduct(targetSet, shotIndex);

    try {
      const url = await contentStudioService.generateDerivedShotAsync(
        targetSet.image0Url,
        targetSet.faceRefs[0],
        targetSet.outfitRef ?? null,
        product.ref,
        targetSet.sceneRef ?? null,
        FIXED_STYLE,
        targetSet.focus,
        key,
        targetSet.productSize,
        targetSet.sessionPlan ?? sessionPlan,
        product.useProduct,
        targetSet.ref0Analysis,
        shotIndex,
        updatedShots.length,
        () => {},
        modelId,
        undefined,
        product.options,
      );
      updatedShots[shotIndex] = {
        ...shot,
        imageUrl: url,
        status: 'done',
        attempts: shot.attempts + 1,
        errorMsg: null
      };
    } catch (e: any) {
      updatedShots[shotIndex] = {
        ...shot,
        status: shot.imageUrl ? 'done' : 'error',
        imageUrl: shot.imageUrl ?? null,
        errorMsg: e?.message || 'Error desconocido al regenerar'
      };
    }

    const finalSet = { ...targetSet, shots: updatedShots, style: FIXED_STYLE as any };
    applySet(finalSet);
    await contentStudioStorage.saveSet(finalSet);
  };

  const downloadSingleSet = async (set: ContentStudioProSet) => {
    const images: string[] = [];
    if (set.image0Url) images.push(set.image0Url);
    set.shots.forEach(s => { if (s.imageUrl) images.push(s.imageUrl); });
    if (images.length === 0) return;
    await downloadAsZip(images, `UGC_${set.focus}_${set.id.slice(-8)}.zip`, `ugc_${set.id.slice(-4)}`);
  };

  const downloadSelectedSets = async () => {
    if (selectedSets.size === 0) {
      alert('Elegí al menos una sesión para descargar.');
      return;
    }
    const allImages: string[] = [];
    const setsToDownload = sets.filter(s => selectedSets.has(s.id));
    for (const set of setsToDownload) {
      if (set.image0Url) allImages.push(set.image0Url);
      set.shots.forEach(s => { if (s.imageUrl) allImages.push(s.imageUrl); });
    }
    await downloadAsZip(allImages, `UGC_Selected_${selectedSets.size}_Sessions.zip`, 'ugc');
  };

  const toggleSelectSet = (setId: string) => {
    const newSelected = new Set(selectedSets);
    if (newSelected.has(setId)) {
      newSelected.delete(setId);
    } else {
      newSelected.add(setId);
    }
    setSelectedSets(newSelected);
  };

  const filteredSets = sets.filter(set => activeTab === 'TODAS' || set.focus === activeTab);

  const selectAllFiltered = () => {
    const newSelected = new Set(selectedSets);
    filteredSets.forEach(set => newSelected.add(set.id));
    setSelectedSets(newSelected);
  };

  const clearSelection = () => {
    setSelectedSets(new Set());
  };

  const deleteSession = async (set: ContentStudioProSet) => {
    if (!confirm('¿Borrar esta sesión? No se puede deshacer.')) return;
    await contentStudioStorage.deleteSet(set.id);
    await loadSets();
    setSelectedSets(new Set());
    setViewedSet(null);
    setView('library');
  };

  /** Fotos de una sesión en orden de muestra: derivadas primero, foto de prueba al final. */
  const sessionPhotos = (set: ContentStudioProSet) => {
    const items: {
      kind: 'shot' | 'master';
      key?: ShotKey;
      idx: number;
      url?: string | null;
      label: string;
      status: 'done' | 'generating' | 'error' | 'idle';
      attempts: number;
    }[] = set.shots.map((s, idx) => ({
      kind: 'shot' as const,
      key: s.key,
      idx,
      url: s.imageUrl,
      label: shotLabel(set, idx, sessionPlan),
      status: s.status === 'generating' ? 'generating' as const : s.imageUrl ? 'done' as const : s.status === 'error' ? 'error' as const : 'idle' as const,
      attempts: s.attempts,
    }));
    if (set.image0Url) {
      items.push({ kind: 'master', idx: -1, url: set.image0Url, label: 'Foto de prueba', status: 'done', attempts: 0 });
    }
    return items;
  };

  const openLightboxList = (items: { url: string; label: string }[], index: number, title: string) => {
    if (items.length === 0) return;
    setLightboxImages(items.map(i => i.url));
    setLightboxLabels(items.map(i => i.label));
    setLightboxIndex(Math.max(0, Math.min(index, items.length - 1)));
    setLightboxMetadata({ label: title });
    setLightboxOpen(true);
  };

  const openSessionLightbox = (set: ContentStudioProSet, url: string) => {
    const withUrl = sessionPhotos(set).filter(p => !!p.url) as { url: string; label: string }[];
    openLightboxList(withUrl, withUrl.findIndex(p => p.url === url), sessionTitle(set));
  };

  const resetForNewSession = () => {
    setCurrentSet(null);
    setViewedSet(null);
    setSessionPlan(null);
    setErrorStatus(null);
    setCreditsRefunded(false);
    setProductRef(null);
    setAngleSlots([null, null]);
    setCollectionRefs([]);
    setObjectRef(null);
    setOutfitRef(null);
    setSceneRef(null);
    setSceneText('');
    setView('create');
    setStep('setup');
    setWizardStep(1);
    window.scrollTo({ top: 0 });
  };

  // Costo total de la sesión: master + N fotos
  const sessionCost = MODEL_CREDIT_COST[modelId] * (1 + effectiveShotCount);
  let hasFreeOnboarding = false;
  try { hasFreeOnboarding = localStorage.getItem('onboarding_free_generation') === 'true'; } catch { /* ignore */ }

  // ── Render: pasos del wizard ────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
      <Title lead="¿Qué querés" accent="mostrar?" />
      <Desc>
        <span className="md:hidden">Deslizá y elegí quién es la estrella de tus fotos.</span>
        <span className="hidden md:inline">Elegí quién es la estrella de tus fotos.</span>
      </Desc>

      {/* Mobile: carrusel de tarjetas grandes */}
      <div className="md:hidden flex flex-col">
        <div
          ref={focusTrackRef}
          onScroll={handleFocusScroll}
          className="relative flex gap-2.5 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 scrollbar-hide h-[56vh] min-h-[380px] max-h-[580px]"
        >
          {FOCUS_CARDS.map(c => {
            const sel = focus === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setFocus(c.id)}
                aria-pressed={sel}
                className={`snap-center shrink-0 w-[84%] h-full relative rounded-[26px] overflow-hidden text-left transition-shadow ${
                  sel ? 'border-[2.5px] border-brand-600 shadow-[0_14px_30px_-10px_rgba(216,16,73,0.35)]' : 'border border-slate-100'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient}`} />
                <div className="absolute inset-0 flex items-center justify-center pb-20 text-white/55">
                  <c.Icon size={78} strokeWidth={1.3} />
                </div>
                <div className={`absolute top-3.5 right-3.5 w-[30px] h-[30px] rounded-full flex items-center justify-center ${sel ? 'bg-brand-600 text-white' : 'bg-white/85'}`}>
                  {sel && <Check size={15} strokeWidth={3} />}
                </div>
                <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-16 bg-gradient-to-t from-black/70 via-black/15 to-transparent">
                  <div className="t-display text-[21px] text-white leading-tight">{c.title}</div>
                  <p className="text-[12.5px] text-white/90 mt-1 leading-snug">{c.desc}</p>
                  <span className="inline-block mt-2.5 text-[10px] font-bold text-white bg-white/20 border border-white/30 px-2.5 py-1 rounded-full">
                    {c.ideal}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {FOCUS_CARDS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              aria-label={`Ver ${c.title}`}
              onClick={() => scrollFocusTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === focusVisibleIdx ? 'w-[18px] bg-brand-600' : 'w-1.5 bg-slate-300'}`}
            />
          ))}
        </div>
      </div>

      {/* Desktop: 4 tarjetas en grilla */}
      <div className="hidden md:grid grid-cols-2 gap-4">
        {FOCUS_CARDS.map(c => {
          const sel = focus === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setFocus(c.id)}
              aria-pressed={sel}
              className={`relative h-[300px] rounded-[24px] overflow-hidden text-left transition-shadow ${
                sel ? 'border-[2.5px] border-brand-600 shadow-[0_14px_30px_-10px_rgba(216,16,73,0.35)]' : 'border border-slate-100 hover:shadow-md'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient}`} />
              <div className="absolute inset-0 flex items-center justify-center pb-24 text-white/55">
                <c.Icon size={64} strokeWidth={1.3} />
              </div>
              <div className={`absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center ${sel ? 'bg-brand-600 text-white' : 'bg-white/85'}`}>
                {sel && <Check size={14} strokeWidth={3} />}
              </div>
              <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-14 bg-gradient-to-t from-black/70 via-black/15 to-transparent">
                <div className="t-display text-[19px] text-white leading-tight">{c.title}</div>
                <p className="text-[12px] text-white/90 mt-1 leading-snug">{c.desc}</p>
                <span className="inline-block mt-2 text-[10px] font-bold text-white bg-white/20 border border-white/30 px-2.5 py-1 rounded-full">
                  {c.ideal}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
      <Title lead="¿Quién" accent="aparece?" />
      <Desc>Esta persona va a tener la misma cara en todas las fotos.</Desc>
      <Seg<ModelTab>
        options={[
          { id: 'models', label: `Mis modelos (${avatars.length})` },
          { id: 'upload', label: 'Subir una foto' },
        ]}
        value={modelTab}
        onChange={setModelTab}
      />

      {avatarLoadError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] font-medium text-rose-700">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          {avatarLoadError}
        </div>
      )}

      {modelTab === 'models' ? (
        <div className="relative flex gap-2.5 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 md:-mx-6 md:px-6 scrollbar-hide h-[52vh] min-h-[340px] max-h-[520px]">
          {avatars.map(a => {
            const sel = selectedAvatarId === a.id;
            const cover = a.baseImages?.[0];
            const loading = avatarLoadingId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => selectAvatar(a)}
                aria-pressed={sel}
                className={`snap-start shrink-0 w-[62%] md:w-[42%] h-full relative rounded-[22px] overflow-hidden text-left bg-slate-100 ${
                  sel ? 'border-[2.5px] border-brand-600' : 'border border-slate-100'
                }`}
              >
                {cover ? (
                  <img src={cover} alt={a.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-pink-200 to-orange-100 flex items-center justify-center text-white/70">
                    <User size={56} strokeWidth={1.3} />
                  </div>
                )}
                <div className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center ${sel ? 'bg-brand-600 text-white' : 'bg-white/85'}`}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : sel && <Check size={14} strokeWidth={3} />}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3.5 pt-10 bg-gradient-to-t from-black/65 to-transparent">
                  <div className="t-display text-[17px] text-white leading-tight truncate">{a.name}</div>
                  <div className="text-[11px] text-white/80 mt-0.5">{avatarSubtitle(a)}</div>
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => navigate('/crear/clonar')}
            className="snap-start shrink-0 w-[62%] md:w-[42%] h-full rounded-[22px] bg-white border-2 border-dashed border-slate-200 hover:border-brand-300 flex flex-col items-center justify-center gap-2 px-5 text-center"
          >
            <Plus size={30} className="text-brand-400" />
            <span className="text-[13px] font-extrabold text-slate-600">Crear un modelo</span>
            <span className="text-[11px] text-slate-400 leading-snug">Queda guardado para usarlo en todas tus sesiones.</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="h-[46vh] min-h-[320px] max-h-[480px] [&_.rounded-2xl]:rounded-[22px]">
            <ImageSlot
              value={manualFace}
              onChange={updateManualFace}
              hint="Subí una foto del rostro"
              slotType="face"
              aspectRatio="auto"
            />
          </div>
          <p className="text-[12px] text-slate-500 text-center -mt-1">
            De frente, con buena luz y sin lentes de sol. Una sola foto alcanza.
          </p>
          <Tip>
            ¿Vas a usar a esta persona seguido?{' '}
            <button type="button" onClick={() => navigate('/crear/clonar')} className="font-bold text-slate-700 underline underline-offset-2">
              Creala como modelo
            </button>{' '}
            y no tenés que volver a subirla.
          </Tip>
          {selectedAvatar && (
            <p className="text-[11px] text-slate-400 text-center">
              Ahora está elegido tu modelo <b className="text-slate-600">{selectedAvatar.name}</b>. Si subís una foto, se usa esa.
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderMoreDetails = (slots: ('outfit' | 'scene' | 'object')[]) => {
    const defs = {
      outfit: { q: '¿Qué ropa usa tu modelo?', hint: 'Subí la prenda o el look', value: outfitRef, set: setOutfitRef, type: 'outfit' as SlotType },
      scene: { q: '¿Dónde se sacan las fotos?', hint: 'Tu local, tu casa, un café', value: sceneRef, set: setSceneRef, type: 'scene' as SlotType },
      object: { q: 'Un objeto', hint: 'Algo que tenga en la mano o cerca', value: objectRef, set: setObjectRef, type: 'product' as SlotType },
    };
    return (
      <div className="border border-slate-100 bg-white rounded-2xl p-3.5 flex flex-col gap-3">
        <div>
          <div className="text-[13px] font-extrabold text-slate-700">Sumar más detalles</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Opcional. Si no subís nada, elegimos algo que combine.</div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {slots.map(k => {
            const d = defs[k];
            return (
              <div key={k} className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 leading-tight min-h-[28px]">{d.q}</span>
                <UploadCard value={d.value} onChange={d.set} hint={d.hint} slotType={d.type} ratio="aspect-[3/5]" />
              </div>
            );
          })}
        </div>
        {showProductWarning && slots.includes('object') && objectRef && (
          <Tip tone="warn" icon={<AlertTriangle size={14} />}>{productWarningMsg}</Tip>
        )}
      </div>
    );
  };

  const renderStep3 = () => {
    if (focus === 'PRODUCT') {
      const remaining = MAX_COLLECTION - collectionRefs.length;
      return (
        <div className="p-4 md:p-6 flex flex-col gap-3.5">
          <Title lead="Mostranos" accent="tu producto." />
          <Desc>Fotos claras, del producto solo y con buena luz.</Desc>
          <Seg<ProductMode>
            options={[
              { id: 'single', label: 'Un producto' },
              { id: 'collection', label: 'Una colección' },
            ]}
            value={productMode}
            onChange={setProductMode}
          />

          {productMode === 'single' ? (
            <div className="flex flex-col gap-3">
              <FieldLabel right={<RequiredPill />}>Foto principal</FieldLabel>
              <UploadCard value={productRef} onChange={setProductRef} hint="Subí la foto de tu producto" slotType="product" ratio="aspect-[4/5]" tag="De frente" />
              <FieldLabel right={<OptionalNote>Opcional · hasta {MAX_PRODUCT_ANGLES} más</OptionalNote>}>Más ángulos</FieldLabel>
              <div className="grid grid-cols-2 gap-2.5">
                {angleSlots.map((a, i) => (
                  <UploadCard
                    key={i}
                    value={a}
                    onChange={v => setAngleAt(i, v)}
                    hint="Otro ángulo: atrás, detalle o textura"
                    slotType="product"
                    ratio="aspect-[3/5]"
                    tag={`Ángulo ${i + 2}`}
                  />
                ))}
              </div>
              <Tip>Con más ángulos, el producto sale <b>más fiel</b> en las fotos de detalle y de costado.</Tip>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <FieldLabel right={<OptionalNote>Uno por foto · hasta {MAX_COLLECTION}</OptionalNote>}>Tus productos</FieldLabel>
              <div className="grid grid-cols-2 gap-2.5">
                {collectionRefs.map((ref, i) => (
                  <UploadCard
                    key={`${i}-${ref.length}`}
                    value={ref}
                    onChange={v => setCollectionAt(i, v)}
                    hint="Producto"
                    slotType="product"
                    ratio="aspect-[3/5]"
                    tag={`Producto ${i + 1}`}
                  />
                ))}
                {remaining > 0 && (
                  <UploadCard
                    key={`add-${collectionRefs.length}`}
                    value={null}
                    onChange={v => v && setCollectionAt(collectionRefs.length, v)}
                    hint={`Sumar producto · te quedan ${remaining}`}
                    slotType="product"
                    ratio="aspect-[3/5]"
                  />
                )}
              </div>
              {collectionRefs.length === 0 && (
                <Tip tone="brand" icon={<LayoutGrid size={14} />}>
                  Subí entre <b>{MIN_COLLECTION} y {MAX_COLLECTION} productos</b>. Cada foto de la sesión va a mostrar uno distinto, con la misma persona, lugar y luz.
                </Tip>
              )}
              {collectionRefs.length === 1 && (
                <Tip tone="warn" icon={<AlertTriangle size={14} />}>
                  Con un solo producto conviene{' '}
                  <button
                    type="button"
                    onClick={() => {
                      if (!productRef) setProductRef(collectionRefs[0]);
                      setProductMode('single');
                    }}
                    className="font-bold underline underline-offset-2"
                  >
                    usar "Un producto"
                  </button>
                  : te sale una sesión completa con él. Para una colección sumá al menos uno más.
                </Tip>
              )}
              {collectionRefs.length >= MIN_COLLECTION && (
                <Tip tone="brand" icon={<LayoutGrid size={14} />}>
                  Subiste <b>{collectionRefs.length} productos → tu sesión tendrá {collectionRefs.length} fotos</b>, cada una con uno distinto. Misma persona, mismo lugar y misma luz: queda un feed parejo.
                </Tip>
              )}
            </div>
          )}

          <FieldLabel>¿De qué tamaño es?</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {SIZE_OPTIONS.map(s => {
              const on = productSize === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setProductSize(s.id)}
                  aria-pressed={on}
                  className={`rounded-2xl border px-1 py-2.5 flex flex-col items-center gap-0.5 transition-colors ${
                    on ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <span className={`text-[12.5px] font-extrabold ${on ? 'text-white' : 'text-slate-700'}`}>{s.name}</span>
                  <span className={`text-[10px] ${on ? 'text-white/65' : 'text-slate-400'}`}>{s.sub}</span>
                </button>
              );
            })}
          </div>

          {renderMoreDetails(['outfit', 'scene'])}
          <UploadDisclaimer />
        </div>
      );
    }

    if (focus === 'OUTFIT') {
      return (
        <div className="p-4 md:p-6 flex flex-col gap-3.5">
          <Title lead="Mostranos" accent="el look." />
          <Desc>Una foto del outfit completo, con buena luz.</Desc>
          <FieldLabel right={<RequiredPill />}>Foto del look</FieldLabel>
          <UploadCard value={outfitRef} onChange={setOutfitRef} hint="Subí la foto del look" slotType="outfit" ratio="aspect-[4/5]" tag="Look" />
          {renderMoreDetails(['scene', 'object'])}
          <UploadDisclaimer />
        </div>
      );
    }

    if (focus === 'SCENE') {
      return (
        <div className="p-4 md:p-6 flex flex-col gap-3.5">
          <Title lead="Mostranos" accent="el lugar." />
          <Desc>Una foto del espacio, como lo ve alguien que entra.</Desc>
          <FieldLabel right={<RequiredPill />}>Foto del lugar</FieldLabel>
          <UploadCard value={sceneRef} onChange={setSceneRef} hint="Subí la foto del lugar" slotType="scene" ratio="aspect-[4/5]" tag="Lugar" />
          <FieldLabel right={<OptionalNote>Opcional</OptionalNote>}>¿Qué se puede hacer ahí?</FieldLabel>
          <textarea
            value={sceneText}
            onChange={(e) => setSceneText(e.target.value)}
            placeholder="Ej: tomar un café en la barra, trabajar con la compu, probarse ropa…"
            className="w-full p-3 rounded-2xl border border-slate-200 text-[13px] focus:outline-none focus:border-brand-300"
            rows={2}
          />
          {renderMoreDetails(['outfit', 'object'])}
          <UploadDisclaimer />
        </div>
      );
    }

    // AVATAR
    return (
      <div className="p-4 md:p-6 flex flex-col gap-3.5">
        <Title lead="¿Querés" accent="sumar algo?" />
        <Desc>Todo es opcional. Si no subís nada, elegimos ropa y lugar que combinen con la persona.</Desc>
        {renderMoreDetails(['outfit', 'scene', 'object'])}
        <UploadDisclaimer />
      </div>
    );
  };

  const renderStep4 = () => {
    const whoName = selectedAvatar?.name;
    const heroThumb =
      focus === 'PRODUCT' ? effectiveProductRef
      : focus === 'OUTFIT' ? outfitRef
      : focus === 'SCENE' ? sceneRef
      : outfitRef || sceneRef || objectRef;
    const heroLabel =
      focus === 'PRODUCT' ? (isCollection ? `${collectionRefs.length} productos` : 'Producto')
      : focus === 'OUTFIT' ? 'Look'
      : focus === 'SCENE' ? 'Lugar'
      : 'Extra';
    const title = sessionTitleParts({ focus, modelName: whoName, collectionRefs: isCollection ? collectionRefs : undefined });
    const qtyOptions = getQtyOptions(focus);
    const focusKind = FOCUS_LABELS[focus].toLowerCase();

    return (
      <div className="p-4 md:p-6 flex flex-col gap-3.5">
        <Title lead="Tu sesión" accent="está casi lista." />

        <div className="bg-white border border-slate-100 rounded-[18px] p-3 flex gap-2.5 items-stretch">
          <div className="relative w-16 aspect-[3/4] rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
            {faceRefs[0] && <img src={faceRefs[0]} alt="" className="w-full h-full object-cover" />}
            <span className="absolute bottom-1 inset-x-1 text-center text-[8px] font-extrabold uppercase text-white bg-black/50 rounded-md py-0.5 truncate px-0.5">
              {whoName ?? 'Modelo'}
            </span>
          </div>
          {heroThumb && (
            <div className="relative w-16 aspect-[3/4] rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
              <img src={heroThumb} alt="" className="w-full h-full object-cover" />
              <span className="absolute bottom-1 inset-x-1 text-center text-[8px] font-extrabold uppercase text-white bg-black/50 rounded-md py-0.5 truncate px-0.5">
                {heroLabel}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <div className="text-[9px] font-black uppercase tracking-[0.07em] text-slate-400">Sesión de {focusKind}</div>
            <div className="text-[14px] font-extrabold text-slate-800 leading-tight">{`${title.lead} ${title.accent}`.trim()}</div>
            <button type="button" onClick={() => goToWizardStep(1)} className="self-start text-[11px] font-bold text-brand-600 mt-0.5">
              Cambiar algo
            </button>
          </div>
        </div>

        {isCollection ? (
          <Tip tone="brand" icon={<LayoutGrid size={14} />}>
            Tu colección tiene <b>{collectionRefs.length} productos → la sesión tendrá {collectionRefs.length} fotos</b>, una con cada producto.
          </Tip>
        ) : (
          <>
            <FieldLabel>¿Cuántas fotos querés?</FieldLabel>
            <div className="flex flex-col gap-2">
              {qtyOptions.map(q => {
                const on = userShotCount === q.n;
                return (
                  <button
                    key={q.n}
                    type="button"
                    onClick={() => setUserShotCount(q.n)}
                    aria-pressed={on}
                    className={`rounded-2xl px-3 py-3 flex gap-3 items-center text-left transition-colors ${
                      on ? 'border-2 border-brand-600 bg-brand-50' : 'border border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-[13px] flex flex-col items-center justify-center flex-shrink-0 ${on ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-800'}`}>
                      <b className="text-[17px] font-extrabold leading-none tabular-nums">{q.n}</b>
                      <span className="text-[8px] font-bold opacity-70">fotos</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-extrabold text-slate-800 flex items-center gap-1.5">
                        {q.title}
                        {q.recommended && (
                          <span className="text-[8.5px] font-extrabold uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                            Recomendada
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{q.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-between items-center bg-slate-900 text-white rounded-2xl px-4 py-3.5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.07em] text-brand-300">Costo total</div>
            <div className="text-[11px] text-white/65 mt-0.5">
              {hasFreeOnboarding
                ? 'Tu primera sesión va por nuestra cuenta.'
                : `Se cobra una sola vez. Te quedan ${credits?.available ?? 0} cr.`}
            </div>
          </div>
          <div className="t-display text-[26px] tabular-nums">
            {hasFreeOnboarding ? 'Gratis' : <>{sessionCost} <small className="text-[11px] not-italic opacity-70">cr</small></>}
          </div>
        </div>

        <Tip icon={<ShieldCheck size={14} />}>
          Primero creamos <b>una foto de prueba</b> para que la apruebes. Si no te gusta, probás otra <b>sin costo</b>. Si algo falla, te devolvemos los créditos.
        </Tip>

        {isAdmin && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Motor (solo admin)</span>
            <div className="flex gap-1 bg-slate-50 rounded-lg p-0.5">
              {([
                { id: 'gemini' as ModelId, label: 'Nano Banana 2' },
                { id: 'gptimage' as ModelId, label: 'GPT Image 2' },
              ]).map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModelId(m.id)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${modelId === m.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {errorStatus && (
          <ErrorDisplay
            error={errorStatus}
            creditsRefunded={creditsRefunded}
            onRetry={() => { setErrorStatus(null); setCreditsRefunded(false); startMasterGeneration(); }}
            onDismiss={() => setErrorStatus(null)}
          />
        )}
      </div>
    );
  };

  // ── Render: fases de creación ───────────────────────────────────────────────

  const renderGeneratingMaster = () => {
    const tl = [
      { label: 'Mirando tus fotos', state: masterPhase > 0 ? 'done' : 'active' },
      { label: 'Creando la primera foto de la sesión', state: masterPhase > 0 ? 'active' : 'todo' },
      { label: 'Lista para que la apruebes', state: 'todo' },
    ] as const;
    return (
      <>
        <PhaseBar label="Creando" name="Foto de prueba" pct={masterPhase > 0 ? 55 : 25} />
        <div className="p-4 md:p-6 flex flex-col gap-3.5">
          <LiveEyebrow>Creando · puede tardar hasta 2 minutos</LiveEyebrow>
          {isRegeneratingMaster
            ? <Title lead="Probando" accent="otra foto de prueba" />
            : <Title lead="Preparando" accent="tu foto de prueba" />}
          <div className="bg-white border border-slate-100 rounded-2xl px-3.5 py-2.5">
            {tl.map((t, i) => (
              <div key={i} className={`flex items-center gap-2.5 py-1.5 text-[13px] text-slate-700 ${t.state === 'todo' ? 'opacity-40' : ''}`}>
                <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 text-white ${
                  t.state === 'done' ? 'bg-emerald-500' : t.state === 'active' ? 'bg-brand-500 animate-pulse motion-reduce:animate-none' : 'bg-slate-200'
                }`}>
                  {t.state === 'done' && <Check size={11} strokeWidth={3.5} />}
                </span>
                {t.label}
              </div>
            ))}
          </div>
          <div className="h-[42vh] min-h-[260px] max-h-[460px] rounded-[24px] bg-gradient-to-br from-slate-100 to-brand-50 border-2 border-brand-200 flex flex-col items-center justify-center gap-2.5 animate-pulse motion-reduce:animate-none">
            <Camera size={36} strokeWidth={1.6} className="text-brand-500" />
            <div className="text-[12px] font-black text-brand-600 uppercase tracking-[0.08em]">Sacando la foto…</div>
            <div className="text-[12px] text-slate-500">Podés cerrar la ventana, te avisamos.</div>
          </div>
        </div>
      </>
    );
  };

  const renderCheckpoint = (set: ContentStudioProSet) => {
    const attemptsLeft = Math.max(0, MAX_REGEN_ATTEMPTS - set.attemptsImage0);
    const total = set.userShotCount ?? set.shots.length;
    const isColl = !!set.collectionRefs && set.collectionRefs.length > 0;
    return (
      <>
        <PhaseBar label="Tu aprobación" name="Foto de prueba" pct={60} />
        <div className="p-4 md:p-6 flex flex-col gap-3.5">
          <Title lead="¿Te gusta" accent="cómo se ve?" />
          <Desc>Todas las fotos de la sesión van a tener esta misma luz, lugar y persona.</Desc>
          <button
            type="button"
            onClick={() => set.image0Url && openLightboxList([{ url: set.image0Url, label: 'Foto de prueba' }], 0, sessionTitle(set))}
            className="relative w-full h-[58vh] min-h-[360px] max-h-[640px] md:h-auto md:max-h-none md:aspect-[4/5] rounded-[26px] overflow-hidden bg-slate-100"
            aria-label="Ver foto de prueba en grande"
          >
            {set.image0Url && <img src={set.image0Url} alt="Foto de prueba" className="w-full h-full object-cover" />}
            <span className="absolute top-3 left-3 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white bg-brand-600 px-3 py-1.5 rounded-full">
              Foto de prueba
            </span>
            <span className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-slate-700">
              <Maximize2 size={15} />
            </span>
          </button>
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2 items-center text-[12.5px] text-slate-600">
              <Check size={14} strokeWidth={2.6} className="text-emerald-500 flex-shrink-0" />
              {set.modelName ? `Fijate que la cara se parezca a ${set.modelName}.` : 'Fijate que la cara se parezca a la de tu foto.'}
            </div>
            <div className="flex gap-2 items-center text-[12.5px] text-slate-600">
              <Check size={14} strokeWidth={2.6} className="text-emerald-500 flex-shrink-0" />
              Que se vea natural, como sacada con el celular.
            </div>
            {isColl && (
              <div className="flex gap-2 items-center text-[12.5px] text-slate-600">
                <Check size={14} strokeWidth={2.6} className="text-emerald-500 flex-shrink-0" />
                Esta foto muestra el primer producto; cada foto de la sesión va a mostrar uno distinto.
              </div>
            )}
          </div>
          {errorStatus && (
            <ErrorDisplay
              error={errorStatus}
              creditsRefunded={creditsRefunded}
              onRetry={attemptsLeft > 0 ? () => { setErrorStatus(null); regenerateMaster(); } : undefined}
              onDismiss={() => setErrorStatus(null)}
            />
          )}
        </div>
        <CtaBar>
          <button type="button" onClick={regenerateMaster} disabled={attemptsLeft === 0} className={secondaryCtaCls}>
            <span className="flex items-center gap-1.5"><RefreshCw size={14} /> Probar otra</span>
            <span className="text-[10px] font-semibold text-slate-400">
              {attemptsLeft > 0 ? `Gratis · ${attemptsLeft} ${attemptsLeft === 1 ? 'intento' : 'intentos'} más` : 'Ya no quedan intentos'}
            </span>
          </button>
          <button type="button" onClick={approveAndProduce} className={primaryCtaCls}>
            <span className="flex items-center gap-1.5">Sí, crear las {total} fotos <ArrowRight size={15} /></span>
          </button>
        </CtaBar>
      </>
    );
  };

  const renderProducing = (set: ContentStudioProSet) => {
    const total = set.shots.length;
    const done = set.shots.filter(s => s.status === 'done').length;
    const pending = set.shots.filter(s => s.status !== 'done' && s.status !== 'error').length;
    const minutes = Math.max(1, Math.round(pending * 0.6));
    const t = sessionTitleParts(set);
    const isRetry = step === 'retrying';
    return (
      <>
        <PhaseBar label="Creando" name={`${done} de ${total} listas`} pct={total ? (done / total) * 100 : 0} />
        <div className="p-4 md:p-6 flex flex-col gap-3.5">
          <LiveEyebrow>
            {isRetry ? 'Volviendo a crear las que fallaron' : `Creando tus fotos · ${pending > 0 ? `unos ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}` : 'casi listo'}`}
          </LiveEyebrow>
          <Title lead={t.lead} accent={t.accent} />
          <Desc>Las fotos aparecen apenas están listas. Las creamos de a una para que salgan bien.</Desc>
          <div className="grid grid-cols-3 gap-2">
            {set.shots.map((s, idx) => {
              const gen = generatingShots[s.key];
              const retrying = gen?.status === 'retrying';
              return (
                <div
                  key={s.key}
                  className={`relative aspect-[3/4] rounded-xl overflow-hidden flex items-center justify-center text-[10px] font-extrabold ${
                    s.status === 'done' && s.imageUrl ? 'bg-slate-100'
                    : s.status === 'generating' ? 'border-2 border-brand-500 bg-brand-50 text-brand-600 animate-pulse motion-reduce:animate-none'
                    : s.status === 'error' ? 'bg-red-50 text-red-500'
                    : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {s.status === 'done' && s.imageUrl ? (
                    <>
                      <button type="button" className="absolute inset-0" onClick={() => openSessionLightbox(set, s.imageUrl!)} aria-label={`Ver ${shotLabel(set, idx, sessionPlan)}`}>
                        <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                      </button>
                      <span className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <Check size={10} strokeWidth={3.5} />
                      </span>
                    </>
                  ) : s.status === 'generating' ? (
                    <span className="flex flex-col items-center gap-1">
                      <Loader2 size={16} className="animate-spin" />
                      {retrying ? 'Reintentando' : 'Creando'}
                    </span>
                  ) : s.status === 'error' ? (
                    <span className="flex flex-col items-center gap-1"><AlertTriangle size={16} /> Falló</span>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
          <Tip icon={<Lightbulb size={14} />}>
            Podés cerrar la ventana. Te avisamos cuando termine y queda guardado en tu historial.
          </Tip>
        </div>
      </>
    );
  };

  const renderResult = (set: ContentStudioProSet, fromHistory: boolean) => {
    const photos = sessionPhotos(set);
    const [hero, ...rest] = photos;
    const doneCount = set.shots.filter(s => s.imageUrl).length || (set.image0Url ? 1 : 0);
    const t = sessionTitleParts(set);
    const photoProps = (p: typeof photos[number]) => ({
      url: p.url,
      label: p.label,
      status: p.status,
      onOpen: () => p.url && openSessionLightbox(set, p.url),
      onDownload: () => p.url && downloadImage(p.url, `ugc_${set.id.slice(-4)}_${p.kind === 'master' ? 'prueba' : p.idx + 1}.jpg`),
      onRetry: p.kind === 'shot' && p.key && set.faceRefs[0] ? () => regenerateShot(set, p.key!) : undefined,
      onRegenerate:
        p.kind === 'shot' && p.key && set.faceRefs[0] && p.attempts < MAX_REGEN_ATTEMPTS
          ? () => regenerateShot(set, p.key!)
          : undefined,
    });
    return (
      <div className="p-4 md:p-6 flex flex-col gap-3.5">
        {fromHistory && (
          <button type="button" onClick={() => { setViewedSet(null); setView('library'); }} className="self-start flex items-center gap-1.5 text-[12px] font-bold text-slate-500 hover:text-slate-700">
            <ArrowLeft size={14} /> Volver al historial
          </button>
        )}
        <div className="flex justify-between items-center gap-3">
          <Title lead={t.lead} accent={t.accent} className="!text-[20px] md:!text-[24px]" />
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[9.5px] font-extrabold uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            <Check size={10} strokeWidth={3.5} /> {doneCount} {doneCount === 1 ? 'foto' : 'fotos'}
          </span>
        </div>
        <Desc>
          Tocá una foto para verla grande.{fromHistory ? ` Creada ${relativeDate(set.createdAt)}.` : ' Ya quedó guardada en tu historial.'}
        </Desc>

        {hero && <ResultPhoto big {...photoProps(hero)} />}
        {rest.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            {rest.map(p => <ResultPhoto key={`${p.kind}-${p.idx}`} {...photoProps(p)} />)}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadSingleSet(set)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white text-slate-600 text-[12px] font-extrabold py-3.5 hover:bg-slate-50"
          >
            <Download size={14} /> Descargar todas
          </button>
          <button
            type="button"
            onClick={resetForNewSession}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-slate-900 text-white text-[12px] font-extrabold py-3.5 hover:bg-slate-800"
          >
            <Plus size={14} /> Nueva sesión
          </button>
        </div>
        {fromHistory && (
          <button type="button" onClick={() => deleteSession(set)} className="self-center flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-red-500 py-1">
            <Trash2 size={13} /> Borrar esta sesión
          </button>
        )}
      </div>
    );
  };

  // ── Render: historial ───────────────────────────────────────────────────────

  const renderLibrary = () => (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {TAB_ORDER.map((tab) => {
            const on = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => { setActiveTab(tab); setSelectedSets(new Set()); }}
                className={`flex-shrink-0 text-[11px] font-extrabold px-3.5 py-2 rounded-full border transition-colors ${
                  on ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                }`}
              >
                {tab === 'TODAS' ? 'Todas' : FOCUS_LABELS[tab]}
              </button>
            );
          })}
        </div>
        {filteredSets.length > 0 && (
          <button
            type="button"
            onClick={() => { setSelectionMode(m => !m); setSelectedSets(new Set()); }}
            className={`flex-shrink-0 flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-2 rounded-full border ${
              selectionMode ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-100 text-slate-500'
            }`}
          >
            {selectionMode ? <X size={13} /> : <CheckSquare size={13} />}
            {selectionMode ? 'Listo' : 'Elegir'}
          </button>
        )}
      </div>

      {selectionMode && filteredSets.length > 0 && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span>{selectedSets.size} {selectedSets.size === 1 ? 'sesión elegida' : 'sesiones elegidas'}</span>
          <button type="button" onClick={selectAllFiltered} className="font-bold text-brand-600">Elegir todas</button>
        </div>
      )}

      {filteredSets.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-[24px] px-6 py-12 flex flex-col items-center text-center gap-3">
          <Images size={34} strokeWidth={1.5} className="text-slate-300" />
          <div className="text-[14px] font-extrabold text-slate-700">
            {sets.length === 0 ? 'Todavía no tenés sesiones' : 'No hay sesiones de este tipo'}
          </div>
          <div className="text-[12px] text-slate-400">Creá la primera y la vas a ver acá.</div>
          <button type="button" onClick={resetForNewSession} className="mt-1 flex items-center gap-1.5 rounded-2xl bg-slate-900 text-white text-[12px] font-extrabold px-5 py-3">
            <Plus size={14} /> Crear una sesión
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {filteredSets.map(set => {
            const cover = set.image0Url || set.shots.find(s => s.imageUrl)?.imageUrl;
            const count = set.shots.filter(s => s.imageUrl).length || (set.image0Url ? 1 : 0);
            const sel = selectedSets.has(set.id);
            return (
              <button
                key={set.id}
                type="button"
                onClick={() => {
                  if (selectionMode) { toggleSelectSet(set.id); return; }
                  setViewedSet(set);
                  setView('session');
                  window.scrollTo({ top: 0 });
                }}
                className={`relative aspect-[3/4] rounded-[20px] overflow-hidden bg-slate-100 text-left ${
                  sel ? 'ring-[3px] ring-brand-600 ring-offset-2' : ''
                }`}
              >
                {cover ? (
                  <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-300"><Images size={28} /></div>
                )}
                <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-extrabold text-white bg-black/50 px-2 py-1 rounded-full">
                  <Images size={11} /> {count} {count === 1 ? 'foto' : 'fotos'}
                </span>
                {selectionMode && (
                  <span className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                    sel ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white/80 border-white'
                  }`}>
                    {sel && <Check size={13} strokeWidth={3} />}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 p-2.5 pt-9 bg-gradient-to-t from-black/65 to-transparent">
                  <div className="text-[12px] font-extrabold text-white leading-tight line-clamp-2">{sessionTitle(set)}</div>
                  <div className="text-[10px] text-white/80 mt-0.5">{FOCUS_LABELS[set.focus]} · {relativeDate(set.createdAt)}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Render principal ────────────────────────────────────────────────────────

  const isWizard = view === 'create' && step === 'setup';
  const cardCls = 'bg-white rounded-[28px] md:rounded-[32px] border border-slate-100 shadow-sm flex flex-col';

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={credits?.available ?? 0} />
      <div className="max-w-2xl mx-auto pb-28 md:pb-20 animate-in fade-in">
        <header className="px-1 mb-4 md:mb-6 flex flex-col gap-3">
          <div>
            <h1 className="t-display text-2xl md:text-3xl text-slate-900">
              Fotos para <span className="text-brand-600">redes</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-slate-500 italic text-xs md:text-sm">Sesiones naturales, como tomadas con el celular.</p>
              <ModuleTutorial moduleId="contentStudio" steps={TUTORIAL_CONFIGS.contentStudio} />
            </div>
          </div>
          <div className="flex gap-1 bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
            <button
              type="button"
              onClick={() => { setView('create'); setSelectionMode(false); setSelectedSets(new Set()); }}
              className={`flex-1 py-2.5 rounded-xl t-meta transition-colors ${view === 'create' ? 'bg-brand-600 text-white shadow-[0_2px_8px_rgba(216,16,73,0.3)]' : 'text-slate-400'}`}
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => { setView('library'); setViewedSet(null); setSelectionMode(false); setSelectedSets(new Set()); }}
              className={`flex-1 py-2.5 rounded-xl t-meta transition-colors ${view !== 'create' ? 'bg-brand-600 text-white shadow-[0_2px_8px_rgba(216,16,73,0.3)]' : 'text-slate-400'}`}
            >
              Historial ({sets.length})
            </button>
          </div>
        </header>

        {view === 'create' && (
          <div className={cardCls}>
            {isWizard && (
              <>
                <div className="rounded-t-[28px] md:rounded-t-[32px] overflow-hidden">
                  <WizardStepper
                    steps={WIZARD_STEPS}
                    current={wizardStep}
                    onJump={(s) => goToWizardStep(s as WizardStep)}
                  />
                </div>
                {wizardStep === 1 && renderStep1()}
                {wizardStep === 2 && renderStep2()}
                {wizardStep === 3 && renderStep3()}
                {wizardStep === 4 && renderStep4()}
                {wizardStep < 4 ? (
                  <div className="sticky bottom-0 z-20" style={{ clipPath: 'inset(-40px 0 0 0 round 0 0 28px 28px)' }}>
                    <WizardFooter
                      onBack={wizardStep > 1 ? () => goToWizardStep((wizardStep - 1) as WizardStep) : undefined}
                      onContinue={() => goToWizardStep((wizardStep + 1) as WizardStep)}
                      disabled={!canContinue[wizardStep]}
                      pulse={canContinue[wizardStep] && wizardStep > 1}
                    />
                  </div>
                ) : (
                  <CtaBar>
                    <button
                      type="button"
                      onClick={() => goToWizardStep(3)}
                      aria-label="Atrás"
                      className="w-12 h-12 bg-slate-100 active:bg-slate-200 rounded-xl flex items-center justify-center text-slate-700 flex-shrink-0"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <button type="button" onClick={() => startMasterGeneration()} className={primaryCtaCls}>
                      <span className="flex items-center gap-1.5">Crear foto de prueba <ArrowRight size={15} /></span>
                      <span className="text-[10px] font-semibold opacity-90">
                        {hasFreeOnboarding ? 'Gratis' : `${sessionCost} créditos`} · sesión de {effectiveShotCount} fotos
                      </span>
                    </button>
                  </CtaBar>
                )}
              </>
            )}

            {step === 'generating_master' && renderGeneratingMaster()}
            {step === 'checkpoint' && currentSet && renderCheckpoint(currentSet)}
            {(step === 'producing' || step === 'retrying') && currentSet && renderProducing(currentSet)}
            {step === 'result' && currentSet && renderResult(currentSet, false)}
          </div>
        )}

        {view === 'session' && viewedSet && (
          <div className={cardCls}>{renderResult(viewedSet, true)}</div>
        )}

        {view === 'library' && renderLibrary()}

        {/* LIGHTBOX */}
        {lightboxOpen && lightboxImages.length > 0 && (
          <ImageLightbox
            images={lightboxImages}
            labels={lightboxLabels}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
            onDownload={(url, idx) => { downloadImage(url, `ugc_image_${idx + 1}.jpg`); }}
            metadata={lightboxMetadata}
          />
        )}

        {/* BARRA FLOTANTE PARA SELECCIÓN MÚLTIPLE EN EL HISTORIAL */}
        {view === 'library' && selectionMode && selectedSets.size > 0 && fabVisible && (
          <FloatingActionBar
            isVisible={true}
            selectedCount={selectedSets.size}
            onDownload={downloadSelectedSets}
            onDelete={() => {
              if (confirm(`¿Borrar ${selectedSets.size} ${selectedSets.size === 1 ? 'sesión' : 'sesiones'}? No se puede deshacer.`)) {
                const deletePromises = Array.from(selectedSets).map(id => contentStudioStorage.deleteSet(id));
                Promise.all(deletePromises).then(() => {
                  loadSets();
                  setSelectedSets(new Set());
                  setSelectionMode(false);
                });
              }
            }}
            onClearSelection={clearSelection}
          />
        )}

        {/* MODAL SESIÓN INCOMPLETA */}
        {showIncompleteModal && pendingProducedSet && (() => {
          const failedCount = pendingProducedSet.shots.filter(s => s.status === 'error').length;
          const completedCount = pendingProducedSet.shots.filter(s => s.status === 'done').length;
          return (
            <div className="fixed inset-0 z-[20000] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-[28px] shadow-2xl max-w-md w-full p-6 md:p-8 flex flex-col gap-5 animate-in zoom-in">
                <div className="text-center flex flex-col items-center gap-2.5">
                  <div className="w-14 h-14 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
                    <AlertTriangle size={24} className="text-amber-500" />
                  </div>
                  <h3 className="t-display text-xl text-slate-900">Faltan algunas fotos</h3>
                  <p className="text-slate-500 text-[12.5px] leading-relaxed">
                    <b className="text-red-500">{failedCount} {failedCount === 1 ? 'foto no salió' : 'fotos no salieron'}</b>{' '}
                    después de {AUTO_RETRY_ATTEMPTS} intentos automáticos. {completedCount} de {pendingProducedSet.shots.length} quedaron listas.
                  </p>
                </div>

                <div className="flex gap-1.5 justify-center flex-wrap">
                  {pendingProducedSet.shots.map((s) => (
                    <div
                      key={s.key}
                      className={`w-9 h-11 rounded-xl flex items-center justify-center border-2 ${
                        s.status === 'error' ? 'bg-red-50 border-red-200 text-red-500' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                      }`}
                    >
                      {s.status === 'error' ? <X size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={retryFailedShots}
                    className="w-full py-3.5 bg-gradient-to-br from-brand-400 to-brand-600 text-white rounded-2xl text-[13px] font-bold shadow-[0_12px_28px_rgba(247,44,91,0.32)] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={15} /> Reintentar las que fallaron ({failedCount})
                  </button>
                  <button
                    type="button"
                    onClick={saveIncompleteSession}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2"
                  >
                    <Save size={15} /> Guardar como está
                  </button>
                </div>

                <p className="text-center text-[11px] text-slate-400 leading-relaxed">
                  Reintentar no tiene costo extra. Cada foto vuelve a tener {AUTO_RETRY_ATTEMPTS} intentos automáticos.
                </p>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
};

export default ContentStudioProModule;
