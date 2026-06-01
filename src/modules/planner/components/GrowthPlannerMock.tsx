import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  Instagram,
  LayoutDashboard,
  ListTodo,
  Loader2,
  MessageCircle,
  Package,
  Play,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useBrandProfiles } from '../../../hooks/useBrandProfiles';
import { WizardStepper } from '../../../components/shared/WizardStepper';
import { WizardFooter } from '../../../components/shared/WizardFooter';
import { GenerationProgress } from '../../../components/shared/GenerationProgress';
import { compressImageForUpload, readAndCompressFile } from '../../../utils/imageUtils';
import { createProject, saveGrowthPlan } from '../../../services/projectService';
import { brandProfileService } from '../../../services/brandProfileService';
import { useAuth } from '../../auth/AuthContext';
import type { BrandProfile } from '../../brandProfiles/types';
import {
  GROWTH_DEMO_BRAND,
  GROWTH_DEMO_METRICS,
  GROWTH_DEMO_PRODUCTS,
} from '../growthPlannerMockData';
import { generateGrowthPlanWithGemini } from '../services/growthPlannerAiService';
import {
  GrowthBrand,
  GrowthContentModule,
  GrowthInstagramMetrics,
  GrowthPlanDuration,
  GrowthProduct,
  GrowthStrategicPlan,
  GrowthTask,
  GrowthTaskStatus,
} from '../growthPlannerTypes';

const STEPS = [
  { id: 'duration', label: 'Duracion' },
  { id: 'inputs', label: 'Marca' },
  { id: 'products', label: 'Productos' },
  { id: 'review', label: 'Revision' },
];

const GENERATION_STEPS = [
  { id: 'brand', label: 'Analizando marca' },
  { id: 'products', label: 'Leyendo productos' },
  { id: 'images', label: 'Analizando imagenes' },
  { id: 'metrics', label: 'Leyendo metricas de Instagram' },
  { id: 'strategy', label: 'Disenando estrategia' },
  { id: 'tasks', label: 'Creando tareas' },
  { id: 'validation', label: 'Validando tono y CTA' },
];

const STATUS_META: Record<GrowthTaskStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'En creacion', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  ready: { label: 'Lista', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  published: { label: 'Publicada', className: 'bg-slate-900 text-white border-slate-900' },
  skipped: { label: 'Saltada', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const MODULE_META: Record<GrowthContentModule, { label: string; color: string; bg: string }> = {
  product: { label: 'Product Studio', color: '#F72C5B', bg: 'rgba(247,44,91,0.08)' },
  ugc: { label: 'UGC Studio', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  scene: { label: 'Scene Clone', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  prompt: { label: 'Prompt Studio', color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
  outfit: { label: 'Outfit Extractor', color: '#EC4899', bg: 'rgba(236,72,153,0.08)' },
  none: { label: 'Manual', color: '#64748B', bg: 'rgba(100,116,139,0.08)' },
};

const TABS = [
  { id: 'summary', label: 'Resumen', icon: LayoutDashboard },
  { id: 'month', label: 'Mes', icon: CalendarDays },
  { id: 'week', label: 'Semana', icon: ListTodo },
  { id: 'tasks', label: 'Tareas', icon: Filter },
  { id: 'config', label: 'Configuracion', icon: Settings },
] as const;

type GrowthTab = (typeof TABS)[number]['id'];

interface GrowthPlannerMockProps {
  onBack: () => void;
}

function platformFromSalesChannels(channels: string[]): GrowthBrand['activeSocials'] {
  const joined = channels.join(' ').toLowerCase();
  const platforms: GrowthBrand['activeSocials'] = [];
  if (joined.includes('instagram')) {
    platforms.push('Instagram Feed', 'Stories');
  }
  if (joined.includes('tiktok')) platforms.push('TikTok');
  if (joined.includes('whatsapp')) platforms.push('WhatsApp');
  if (joined.includes('facebook')) platforms.push('Facebook');
  return platforms.length ? Array.from(new Set(platforms)) as GrowthBrand['activeSocials'] : GROWTH_DEMO_BRAND.activeSocials;
}

function mapBrandProfileToGrowthBrand(profile: BrandProfile): GrowthBrand {
  const channels = profile.commercialRules?.mainSalesChannels ?? [];
  const tone = profile.aiSummary?.voiceGuidelines
    || profile.voice?.toneKeywords?.join(', ')
    || profile.voice?.formality
    || GROWTH_DEMO_BRAND.tone;

  return {
    name: profile.brandName || GROWTH_DEMO_BRAND.name,
    category: profile.mainCategory || profile.shortDescription || GROWTH_DEMO_BRAND.category,
    idealClient: profile.aiSummary?.targetCustomerSummary
      || profile.targetCustomer?.freeDescription
      || GROWTH_DEMO_BRAND.idealClient,
    tone,
    mainSalesChannel: channels.length ? channels.join(' y ') : GROWTH_DEMO_BRAND.mainSalesChannel,
    activeSocials: platformFromSalesChannels(channels),
  };
}

function socialFromProfile(profile?: BrandProfile): GrowthInstagramMetrics {
  const social = profile?.socialInsights;
  return {
    followers: social?.followers || GROWTH_DEMO_METRICS.followers,
    reachDiagnosis: social?.reachDiagnosis || GROWTH_DEMO_METRICS.reachDiagnosis,
    reelsInsight: social?.reelsInsight || GROWTH_DEMO_METRICS.reelsInsight,
    carouselInsight: social?.carouselInsight || GROWTH_DEMO_METRICS.carouselInsight,
    bestTime: social?.bestTime || GROWTH_DEMO_METRICS.bestTime,
  };
}

function parseProducts(text: string): GrowthProduct[] {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  return lines.map((line, index) => {
    const [name, category = 'Producto', price = 'Precio no indicado', benefit = 'Beneficio por definir'] =
      line.split('|').map(part => part.trim());
    return {
      id: `product_${index + 1}`,
      name: name || `Producto ${index + 1}`,
      category,
      description: line,
      price,
      stock: 'Prioridad seleccionada para este plan',
      benefit,
    };
  });
}

function defaultProductsText() {
  return GROWTH_DEMO_PRODUCTS
    .map(product => `${product.name} | ${product.category} | ${product.price} | ${product.benefit}`)
    .join('\n');
}

function stripDataUrl(dataUrl: string) {
  const [header, data] = dataUrl.split(',');
  const mimeType = header.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
  return { data: data || dataUrl, mimeType };
}

function statusCounts(tasks: GrowthTask[]) {
  const done = tasks.filter(task => task.status === 'ready' || task.status === 'published').length;
  const active = tasks.filter(task => task.status === 'in_progress').length;
  return { done, active, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

function groupByWeek(tasks: GrowthTask[]) {
  return tasks.reduce<Record<number, GrowthTask[]>>((acc, task) => {
    acc[task.week] = acc[task.week] || [];
    acc[task.week].push(task);
    return acc;
  }, {});
}

function buildValidationExport(plan: GrowthStrategicPlan) {
  return {
    plannerInput: {
      duration: plan.duration,
      brand: plan.brand,
      businessStage: plan.businessStage,
      mainGoal: plan.mainGoal,
      commercialFocus: plan.commercialFocus,
      products: plan.products,
      instagramMetrics: plan.instagramMetrics,
    },
    brandAnalysis: plan.brandAnalysis,
    productAnalysis: plan.productAnalysis,
    socialMetricsAnalysis: plan.socialMetricsAnalysis,
    nicheResearch: plan.nicheResearch,
    planOutput: {
      strategyGoal: plan.strategyGoal,
      businessDiagnosis: plan.businessDiagnosis,
      nicheInsights: plan.nicheInsights,
      planNarrative: plan.planNarrative,
      strategicTip: plan.strategicTip,
      roadmap: plan.roadmap,
      tasks: plan.tasks,
    },
    generationLog: plan.generationLog,
    validationReportMarkdown: plan.validationReportMarkdown,
  };
}

function downloadValidation(plan: GrowthStrategicPlan) {
  const blob = new Blob([JSON.stringify(buildValidationExport(plan), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'growth-planner-validation-export.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const MetricCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4">
    <div className="flex items-center gap-2 text-slate-400 mb-2">
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-sm font-bold text-slate-700 leading-snug">{value}</p>
  </div>
);

const StatusBadge: React.FC<{ status: GrowthTaskStatus }> = ({ status }) => (
  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${STATUS_META[status].className}`}>
    {STATUS_META[status].label}
  </span>
);

const ModuleBadge: React.FC<{ module: GrowthContentModule }> = ({ module }) => {
  const meta = MODULE_META[module];
  return (
    <span
      className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
};

const TaskCard: React.FC<{
  task: GrowthTask;
  onOpen: (task: GrowthTask) => void;
  compact?: boolean;
}> = ({ task, onOpen, compact }) => (
  <button
    onClick={() => onOpen(task)}
    className="w-full text-left bg-white border border-slate-100 hover:border-rose-200 hover:shadow-md rounded-2xl p-4 transition-all"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <ModuleBadge module={task.module} />
          <StatusBadge status={task.status} />
        </div>
        <p className="text-sm font-black uppercase italic tracking-tight text-slate-900">{task.contentType}</p>
        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.visualConcept}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
    </div>
    {!compact && (
      <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex-wrap">
        <span>{task.dayLabel}</span>
        <span>{task.platform}</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.suggestedTime}</span>
      </div>
    )}
  </button>
);

const WizardView: React.FC<{
  step: number;
  setStep: (step: number) => void;
  duration: GrowthPlanDuration;
  setDuration: (duration: GrowthPlanDuration) => void;
  selectedBrand: GrowthBrand;
  socialMetrics: GrowthInstagramMetrics;
  setSocialMetrics: (metrics: GrowthInstagramMetrics) => void;
  productsText: string;
  setProductsText: (text: string) => void;
  productPreviews: string[];
  productImageCount: number;
  imageError: string;
  generationError: string;
  onProductImagesChange: (files: FileList | null) => void;
  onRemoveProductImage: (index: number) => void;
  selectedBrandProfileId: string;
  setSelectedBrandProfileId: (id: string) => void;
  brandProfiles: BrandProfile[];
  loadingBrands: boolean;
  brandError: string | null;
  onBack: () => void;
  onGenerate: () => void;
}> = ({
  step,
  setStep,
  duration,
  setDuration,
  selectedBrand,
  socialMetrics,
  setSocialMetrics,
  productsText,
  setProductsText,
  productPreviews,
  productImageCount,
  imageError,
  generationError,
  onProductImagesChange,
  onRemoveProductImage,
  selectedBrandProfileId,
  setSelectedBrandProfileId,
  brandProfiles,
  loadingBrands,
  brandError,
  onBack,
  onGenerate,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-28 md:pb-8">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Gemini 2.5 Flash</p>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">
            Planner Estrategico
          </h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <WizardStepper steps={STEPS} current={step} onJump={setStep} />
      </div>

      {generationError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-red-500 mb-1">No se pudo generar el plan</p>
          <p className="text-sm font-bold text-red-700 leading-relaxed">{generationError}</p>
        </div>
      )}

      {step === 1 && (
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">Elegir duracion</h2>
            <p className="text-sm text-slate-500 mt-1">La IA armara una estrategia ejecutable con una sola llamada a Gemini 2.5 Flash.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([7, 14, 30] as GrowthPlanDuration[]).map(days => (
              <button
                key={days}
                onClick={() => setDuration(days)}
                className={`bg-white border-2 rounded-2xl p-6 text-left transition-all ${
                  duration === days ? 'border-rose-400 shadow-lg' : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black mb-5" style={{ background: '#F72C5B' }}>
                  {days}
                </div>
                <p className="text-lg font-black uppercase italic tracking-tight text-slate-900">{days} dias</p>
                <p className="text-xs text-slate-500 mt-1">
                  {days === 7 ? 'Accion rapida con foco comercial.' : days === 14 ? 'Mini campana con arco narrativo.' : 'Estrategia mensual completa.'}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">Marca y datos base</h2>
            <p className="text-sm text-slate-500 mt-1">
              Usa una marca real y actualiza sus metricas de redes. Esta informacion queda como memoria para futuros planes.
            </p>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perfil de marca</p>
                <p className="text-xs text-slate-500 mt-1">Si eliges una marca real, las metricas se guardan en Mis Marcas.</p>
              </div>
              {loadingBrands && <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}
            </div>

            {brandError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-bold text-red-700">
                {brandError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedBrandProfileId('demo')}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  selectedBrandProfileId === 'demo'
                    ? 'border-rose-300 bg-rose-50'
                    : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                }`}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Ejemplo</p>
                <p className="text-sm font-black text-slate-900 mt-1">{GROWTH_DEMO_BRAND.name}</p>
                <p className="text-xs text-slate-500 mt-1">{GROWTH_DEMO_BRAND.category}</p>
              </button>

              {brandProfiles.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedBrandProfileId(profile.id)}
                  className={`text-left rounded-2xl border p-4 transition-all ${
                    selectedBrandProfileId === profile.id
                      ? 'border-rose-300 bg-rose-50'
                      : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mis Marcas</p>
                    {profile.isDefault && (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-black text-slate-900 mt-1">{profile.brandName || 'Marca sin nombre'}</p>
                  <p className="text-xs text-slate-500 mt-1">{profile.mainCategory || profile.shortDescription || 'Sin categoria'}</p>
                </button>
              ))}

              {!loadingBrands && brandProfiles.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-400">
                  No hay perfiles reales todavia. Se usara una marca de ejemplo para empezar.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-5 lg:col-span-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                {selectedBrandProfileId === 'demo' ? 'Marca de ejemplo' : 'Marca real seleccionada'}
              </p>
              <h3 className="text-xl font-black uppercase italic text-slate-900">{selectedBrand.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{selectedBrand.category}</p>
              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <p><span className="font-black">Tono:</span> {selectedBrand.tone}</p>
                <p><span className="font-black">Canal:</span> {selectedBrand.mainSalesChannel}</p>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-5 lg:col-span-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Productos iniciales</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {GROWTH_DEMO_PRODUCTS.map(product => (
                  <div key={product.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <Package className="w-4 h-4 text-rose-500 mb-2" />
                    <p className="text-sm font-black text-slate-900">{product.name}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{product.price} · {product.stock}</p>
                    <p className="text-[11px] text-slate-500 mt-2 leading-snug">{product.benefit}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <MetricCard label="Seguidores" value={socialMetrics.followers} icon={<Instagram className="w-4 h-4" />} />
            <MetricCard label="Alcance" value={socialMetrics.reachDiagnosis} icon={<TrendingUp className="w-4 h-4" />} />
            <MetricCard label="Reels" value={socialMetrics.reelsInsight} icon={<Play className="w-4 h-4" />} />
            <MetricCard label="Carruseles" value={socialMetrics.carouselInsight} icon={<FileText className="w-4 h-4" />} />
            <MetricCard label="Horario" value={socialMetrics.bestTime} icon={<Clock className="w-4 h-4" />} />
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Metricas de redes</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                ['followers', 'Seguidores'],
                ['reachDiagnosis', 'Diagnostico de alcance'],
                ['reelsInsight', 'Insight de Reels'],
                ['carouselInsight', 'Insight de carruseles'],
                ['bestTime', 'Mejor horario'],
              ] as const).map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                  <input
                    value={socialMetrics[key]}
                    onChange={event => setSocialMetrics({ ...socialMetrics, [key]: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-rose-300 focus:bg-white"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">Productos a vender</h2>
            <p className="text-sm text-slate-500 mt-1">
              Describe varios productos. Las imagenes son apoyo visual: maximo 5 por generacion para cuidar Vercel y costos.
            </p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <label className="space-y-2 block">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catalogo prioritario</span>
              <textarea
                value={productsText}
                onChange={event => setProductsText(event.target.value)}
                rows={8}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none focus:border-rose-300 focus:bg-white"
                placeholder="Producto | Categoria | Precio | Beneficio principal"
              />
            </label>
            <p className="text-[11px] text-slate-400 mt-2">
              Formato sugerido: Producto | Categoria | Precio | Beneficio. Puedes escribir hasta 20 lineas.
            </p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Imagenes de producto</p>
                <p className="text-xs text-slate-500 mt-1">{productImageCount}/5 imagenes seleccionadas</p>
              </div>
              <label className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white cursor-pointer" style={{ background: '#F72C5B' }}>
                Subir
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={event => {
                    onProductImagesChange(event.target.files);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
            {imageError && <p className="text-xs font-bold text-red-500 mb-3">{imageError}</p>}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {productPreviews.map((preview, index) => (
                <div key={preview} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => onRemoveProductImage(index)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-white/90 shadow"
                  >
                    <X className="w-3 h-3 text-slate-500" />
                  </button>
                </div>
              ))}
              {productPreviews.length === 0 && (
                <div className="col-span-2 md:col-span-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
                  Puedes generar el plan solo con texto. Las imagenes ayudan a Gemini a entender estilo, colores y packaging.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4">
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">Revision final</h2>
            <p className="text-sm text-slate-500">
              Se generara un plan real de {duration} dias para {selectedBrand.name}, usando Gemini 2.5 Flash.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Marca" value={selectedBrand.name} icon={<Target className="w-4 h-4" />} />
              <MetricCard label="Duracion" value={`${duration} dias`} icon={<CalendarDays className="w-4 h-4" />} />
              <MetricCard label="Productos" value={`${parseProducts(productsText).length} producto(s)`} icon={<Package className="w-4 h-4" />} />
              <MetricCard label="Imagenes" value={`${productImageCount}/5`} icon={<Eye className="w-4 h-4" />} />
            </div>
          </div>
          <div className="rounded-2xl p-6 text-white flex flex-col justify-between min-h-[260px]" style={{ background: '#0f172a' }}>
            <div>
              <Sparkles className="w-8 h-8 text-rose-300 mb-4" />
              <h3 className="text-2xl font-black uppercase italic tracking-tight">Listo para generar</h3>
              <p className="text-sm text-slate-300 mt-2">
                Se guardara el plan y podras volver a abrirlo desde Mis Planes.
              </p>
            </div>
            <button
              onClick={onGenerate}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black uppercase tracking-widest text-white"
              style={{ background: '#F72C5B' }}
            >
              <Zap className="w-4 h-4" />
              Generar plan
            </button>
          </div>
        </section>
      )}

      <WizardFooter
        onBack={step === 1 ? onBack : () => setStep(step - 1)}
        onContinue={step === STEPS.length ? onGenerate : () => setStep(step + 1)}
        continueLabel={step === STEPS.length ? 'Generar plan' : 'Continuar'}
      />
    </div>
  );
};

const GeneratingView: React.FC<{
  duration: GrowthPlanDuration;
  selectedBrand: GrowthBrand;
  products: GrowthProduct[];
  socialMetrics: GrowthInstagramMetrics;
  productImageRefs: { data: string; mimeType: string; label: string }[];
  onComplete: (plan: GrowthStrategicPlan) => void;
  onError: (message: string) => void;
}> = ({ duration, selectedBrand, products, socialMetrics, productImageRefs, onComplete, onError }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [phrase, setPhrase] = useState(0);
  const phrases = [
    'Estoy cruzando marca, productos y metricas sin usar busqueda externa.',
    'Estoy creando tareas con recetas de ejecucion y prompts reutilizables.',
    'Estoy validando que el plan tenga calendario, CTA y foco comercial.',
  ];

  useEffect(() => {
    let cancelled = false;
    const stepTimer = window.setInterval(() => {
      setCurrentStep(prev => Math.min(prev + 1, GENERATION_STEPS.length - 1));
    }, 900);
    const phraseTimer = window.setInterval(() => setPhrase(prev => (prev + 1) % phrases.length), 900);

    generateGrowthPlanWithGemini({
      duration,
      brand: selectedBrand,
      products,
      instagramMetrics: socialMetrics,
      productImageRefs,
    })
      .then(async plan => {
        if (!cancelled) await onComplete(plan);
      })
      .catch(error => {
        if (!cancelled) onError(error?.message || 'No se pudo generar el plan.');
      });

    return () => {
      cancelled = true;
      window.clearInterval(stepTimer);
      window.clearInterval(phraseTimer);
    };
  }, [duration, onComplete, onError, productImageRefs, products, selectedBrand, socialMetrics]);

  return (
    <div className="max-w-2xl mx-auto py-16 space-y-8">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: 'rgba(247,44,91,0.1)' }}>
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#F72C5B' }} />
        </div>
        <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">Generando estrategia</h1>
        <p className="text-sm text-slate-500 mt-2">Luz IA está armando tu plan personalizado.</p>
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl p-6">
        <GenerationProgress steps={GENERATION_STEPS} currentStepIndex={currentStep} />
        <p className="text-center text-xs text-slate-400 italic mt-6">{phrases[phrase]}</p>
      </div>
    </div>
  );
};

const SummaryTab: React.FC<{ plan: GrowthStrategicPlan }> = ({ plan }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
    <div className="lg:col-span-2 space-y-5">
      <section className="bg-white border border-slate-100 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-rose-500" />
          <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Diagnostico estrategico</h2>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{plan.businessDiagnosis}</p>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-100 rounded-2xl p-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Insights del nicho</h3>
          <ul className="space-y-2">
            {plan.nicheInsights.map((insight, index) => (
              <li key={index} className="flex gap-2 text-sm text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                {insight}
              </li>
            ))}
          </ul>
        </section>
        <section className="bg-white border border-slate-100 rounded-2xl p-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Roadmap</h3>
          <div className="space-y-3">
            {plan.roadmap.map(item => (
              <div key={item.week} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-xs font-black text-slate-900">Semana {item.week}: {item.title}</p>
                <p className="text-[11px] text-slate-500 mt-1">{item.objective}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="bg-slate-900 text-white rounded-2xl p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-rose-300 mb-2">Consejo estrategico</p>
        <p className="text-sm leading-relaxed">{plan.strategicTip}</p>
      </section>
    </div>
    <aside className="space-y-5">
      <section className="bg-white border border-slate-100 rounded-2xl p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Marca</p>
        <h3 className="text-xl font-black uppercase italic text-slate-900">{plan.brand.name}</h3>
        <p className="text-xs text-slate-500 mt-1">{plan.brand.category}</p>
        <p className="text-xs text-slate-600 mt-4">{plan.brandAnalysis.voiceGuide}</p>
      </section>
      <section className="bg-white border border-slate-100 rounded-2xl p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Foco comercial</p>
        <div className="space-y-2">
          {plan.products.map(product => (
            <div key={product.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <Package className="w-4 h-4 text-rose-500" />
              <div>
                <p className="text-xs font-black text-slate-800">{product.name}</p>
                <p className="text-[10px] text-slate-400">{product.price}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  </div>
);

const MonthTab: React.FC<{ plan: GrowthStrategicPlan; onOpen: (task: GrowthTask) => void }> = ({ plan, onOpen }) => {
  const sorted = [...plan.tasks].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Calendario mensual simple</h2>
        <span className="text-xs font-black text-rose-500">{plan.duration} dias</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
        {sorted.map(task => (
          <button key={task.id} onClick={() => onOpen(task)} className="text-left rounded-2xl border border-slate-100 hover:border-rose-200 p-4 bg-slate-50 transition-all">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{task.dayLabel}</span>
              <StatusBadge status={task.status} />
            </div>
            <p className="text-sm font-black text-slate-900 leading-tight">{task.contentType}</p>
            <p className="text-[11px] text-slate-500 mt-1">{task.platform} · {task.suggestedTime}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

const WeekTab: React.FC<{ plan: GrowthStrategicPlan; onOpen: (task: GrowthTask) => void }> = ({ plan, onOpen }) => {
  const weeks = groupByWeek(plan.tasks);
  return (
    <div className="space-y-5">
      {Object.entries(weeks).map(([week, tasks]) => (
        <section key={week} className="bg-white border border-slate-100 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Semana {week}</h2>
            <span className="text-xs text-slate-400 font-bold">{tasks.length} tareas</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tasks.map(task => <TaskCard key={task.id} task={task} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
    </div>
  );
};

const TasksTab: React.FC<{ plan: GrowthStrategicPlan; onOpen: (task: GrowthTask) => void }> = ({ plan, onOpen }) => (
  <div className="space-y-3">
    {plan.tasks.map(task => <TaskCard key={task.id} task={task} onOpen={onOpen} />)}
  </div>
);

const ConfigTab: React.FC<{ plan: GrowthStrategicPlan }> = ({ plan }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-6 max-w-3xl space-y-5">
    <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Configuracion</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <MetricCard label="Marca" value={plan.brand.name} icon={<Target className="w-4 h-4" />} />
      <MetricCard label="Objetivo" value={plan.mainGoal} icon={<TrendingUp className="w-4 h-4" />} />
      <MetricCard label="Duracion" value={`${plan.duration} dias`} icon={<CalendarDays className="w-4 h-4" />} />
      <MetricCard label="Canal" value={plan.brand.mainSalesChannel} icon={<MessageCircle className="w-4 h-4" />} />
    </div>
    <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
      <p className="text-xs text-amber-800 font-bold">
        Este plan fue generado con Gemini 2.5 Flash sin grounding ni generacion automatica de imagenes.
      </p>
    </div>
  </div>
);

const TaskDetail: React.FC<{
  task: GrowthTask;
  onClose: () => void;
  onStatusChange: (status: GrowthTaskStatus) => void;
}> = ({ task, onClose, onStatusChange }) => {
  const meta = MODULE_META[task.module];
  const copyPrompt = () => {
    if (task.prompt) navigator.clipboard.writeText(task.prompt);
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
      <div className="w-full max-w-5xl max-h-[92vh] bg-slate-50 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        <header className="bg-white border-b border-slate-100 p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg, color: meta.color }}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <ModuleBadge module={task.module} />
                <StatusBadge status={task.status} />
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">{task.contentType}</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                {task.dayLabel} · {task.platform} · {task.suggestedTime}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 md:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <main className="lg:col-span-2 space-y-6">
              <section className="bg-white border border-slate-100 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Que crear</p>
                <h3 className="text-base font-black text-slate-900">{task.visualConcept}</h3>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">{task.whyItWorks}</p>
              </section>

              <section className="bg-white border border-slate-100 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Receta de ejecucion</p>
                <p className="text-sm text-slate-500 mb-4">{task.executionRecipe.overview}</p>
                <div className="space-y-3">
                  {task.executionRecipe.steps.map((step, index) => (
                    <div key={step.id} className="flex gap-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0" style={{ background: '#F72C5B' }}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{step.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{step.instruction}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-slate-900 text-white rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Caption</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${task.caption}\n\n${task.hashtags}`)}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-rose-300"
                  >
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-slate-100">{task.caption}</p>
                {task.hashtags && <p className="text-xs text-slate-400 mt-3">{task.hashtags}</p>}
              </section>
            </main>

            <aside className="space-y-6">
              <section className="bg-white border border-slate-100 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Modulo recomendado</p>
                <div className="rounded-xl p-4" style={{ background: meta.bg }}>
                  <p className="text-sm font-black" style={{ color: meta.color }}>{meta.label}</p>
                  <p className="text-xs text-slate-600 mt-2">{task.moduleReason}</p>
                </div>
              </section>

              <section className="bg-white border border-slate-100 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prompt con slots</p>
                  {task.prompt && (
                    <button onClick={copyPrompt} className="text-[10px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-1">
                      <Copy className="w-3 h-3" /> Copiar
                    </button>
                  )}
                </div>
                {task.prompt ? (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3 italic">{task.prompt}</p>
                ) : (
                  <p className="text-xs text-slate-400 italic">Esta tarea es manual y no requiere prompt.</p>
                )}
                {task.slotInstructions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {task.slotInstructions.map(slot => (
                      <div key={slot.slot} className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-xs text-slate-600">
                        <span className="font-black text-rose-500">{slot.slot}</span>: {slot.instruction}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="bg-white border border-slate-100 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Guia de tomas</p>
                {task.shotGuide.shots.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-500">Duracion: {task.shotGuide.duration}</p>
                    {task.shotGuide.shots.map(shot => (
                      <div key={shot.shot} className="border-l-2 border-rose-200 pl-3">
                        <p className="text-[10px] font-black text-rose-500 uppercase">Toma {shot.shot} · {shot.duration}</p>
                        <p className="text-xs text-slate-600 mt-1">{shot.instruction}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No requiere grabacion.</p>
                )}
              </section>

              <section className="bg-white border border-slate-100 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Estado</p>
                <div className="space-y-2">
                  {(Object.keys(STATUS_META) as GrowthTaskStatus[]).map(status => (
                    <button
                      key={status}
                      onClick={() => onStatusChange(status)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
                        task.status === status ? STATUS_META[status].className : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      {STATUS_META[status].label}
                    </button>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GrowthPlannerResults: React.FC<{
  plan: GrowthStrategicPlan;
  onBack: () => void;
  onUpdateTask: (taskId: string, updates: Partial<GrowthTask>) => void;
}> = ({ plan, onBack, onUpdateTask }) => {
  const [activeTab, setActiveTab] = useState<GrowthTab>('summary');
  const [selectedTask, setSelectedTask] = useState<GrowthTask | null>(null);
  const stats = useMemo(() => statusCounts(plan.tasks), [plan.tasks]);

  const handleStatusChange = (status: GrowthTaskStatus) => {
    if (!selectedTask) return;
    onUpdateTask(selectedTask.id, { status });
    setSelectedTask({ ...selectedTask, status });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Planner estrategico</p>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">
              Estrategia {plan.duration} dias
            </h1>
            <p className="text-sm text-slate-500 mt-1">{plan.planNarrative}</p>
          </div>
        </div>
        <button
          onClick={() => downloadValidation(plan)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest"
        >
          <Download className="w-4 h-4" />
          Exportar validacion
        </button>
      </header>

      <section className="bg-white border border-slate-100 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Progreso total</p>
          <p className="text-xs font-black text-rose-500">{stats.done}/{stats.total} listas o publicadas</p>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${stats.pct}%`, background: '#F72C5B' }} />
        </div>
        {stats.active > 0 && <p className="text-[10px] text-blue-500 font-bold mt-2">{stats.active} tarea(s) en creacion</p>}
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all flex-shrink-0 ${
                active ? 'border-rose-200 text-rose-600 bg-white shadow-sm' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === 'summary' && <SummaryTab plan={plan} />}
      {activeTab === 'month' && <MonthTab plan={plan} onOpen={setSelectedTask} />}
      {activeTab === 'week' && <WeekTab plan={plan} onOpen={setSelectedTask} />}
      {activeTab === 'tasks' && <TasksTab plan={plan} onOpen={setSelectedTask} />}
      {activeTab === 'config' && <ConfigTab plan={plan} />}

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
};

const GrowthPlannerMock: React.FC<GrowthPlannerMockProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    profiles: brandProfiles,
    loading: loadingBrands,
    error: brandError,
  } = useBrandProfiles(user?.uid);
  const [duration, setDuration] = useState<GrowthPlanDuration>(30);
  const [view, setView] = useState<'wizard' | 'generating' | 'results'>('wizard');
  const [plan, setPlan] = useState<GrowthStrategicPlan | null>(null);
  const [selectedBrandProfileId, setSelectedBrandProfileId] = useState('demo');
  const [wizardStep, setWizardStep] = useState(1);
  const [socialMetrics, setSocialMetrics] = useState<GrowthInstagramMetrics>(GROWTH_DEMO_METRICS);
  const [productsText, setProductsText] = useState(defaultProductsText());
  const [productImages, setProductImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const [imageError, setImageError] = useState('');
  const [generationError, setGenerationError] = useState('');

  useEffect(() => {
    if (selectedBrandProfileId !== 'demo') return;

    const preferredProfile = brandProfiles.find(profile => profile.isDefault) ?? brandProfiles[0];
    if (preferredProfile) {
      setSelectedBrandProfileId(preferredProfile.id);
    }
  }, [brandProfiles, selectedBrandProfileId]);

  const selectedBrandProfile = selectedBrandProfileId === 'demo'
    ? undefined
    : brandProfiles.find(profile => profile.id === selectedBrandProfileId);
  const selectedBrand = selectedBrandProfile
    ? mapBrandProfileToGrowthBrand(selectedBrandProfile)
    : GROWTH_DEMO_BRAND;

  useEffect(() => {
    setSocialMetrics(socialFromProfile(selectedBrandProfile));
  }, [selectedBrandProfile?.id]);

  const products = useMemo(() => parseProducts(productsText), [productsText]);

  const productImageRefs = useMemo(() => productImages.map(image => ({
    ...stripDataUrl(image.dataUrl),
    label: image.name,
  })), [productImages]);

  const handleProductImagesChange = async (files: FileList | null) => {
    setImageError('');
    const incoming = Array.from(files ?? []);
    if (!incoming.length) return;
    const available = Math.max(0, 5 - productImages.length);
    if (!available) {
      setImageError('Ya seleccionaste el maximo de 5 imagenes.');
      return;
    }
    if (incoming.length > available) {
      setImageError(`Solo se agregaron ${available} imagen(es). El maximo por generacion es 5.`);
    }
    const selected = incoming.slice(0, available);
    const compressed = await Promise.all(selected.map(async file => ({
      dataUrl: await compressImageForUpload(await readAndCompressFile(file), 640, 0.72),
      name: file.name,
    })));
    setProductImages(prev => [...prev, ...compressed]);
  };

  const handleRemoveProductImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    setGenerationError('');
    if (!products.length) {
      setGenerationError('Agrega al menos un producto para generar el plan.');
      return;
    }

    if (user?.uid && selectedBrandProfile) {
      await brandProfileService.updateBrandSocialInsights(user.uid, selectedBrandProfile.id, {
        instagramHandle: selectedBrandProfile.socialInsights?.instagramHandle || '',
        followers: socialMetrics.followers,
        reachDiagnosis: socialMetrics.reachDiagnosis,
        reelsInsight: socialMetrics.reelsInsight,
        carouselInsight: socialMetrics.carouselInsight,
        bestTime: socialMetrics.bestTime,
        notes: selectedBrandProfile.socialInsights?.notes || '',
        updatedAt: Date.now(),
      }).catch(error => console.warn('[GrowthPlanner] social insights not saved', error));
    }

    setView('generating');
  };

  const handleComplete = async (nextPlan: GrowthStrategicPlan) => {
    setPlan(nextPlan);
    const project = await createProject(`Plan ${nextPlan.brand.name} ${nextPlan.duration} dias`);
    await saveGrowthPlan(project.id, nextPlan);
    navigate(`/planner/${project.id}`);
  };

  const handleGenerationError = (message: string) => {
    console.error('[GrowthPlanner] generation failed:', message);
    setGenerationError(message);
    setWizardStep(STEPS.length);
    setView('wizard');
  };

  const handleUpdateTask = (taskId: string, updates: Partial<GrowthTask>) => {
    setPlan(prev => prev ? {
      ...prev,
      tasks: prev.tasks.map(task => task.id === taskId ? { ...task, ...updates } : task),
    } : prev);
  };

  if (view === 'generating') {
    return (
      <GeneratingView
        duration={duration}
        selectedBrand={selectedBrand}
        products={products}
        socialMetrics={socialMetrics}
        productImageRefs={productImageRefs}
        onComplete={handleComplete}
        onError={handleGenerationError}
      />
    );
  }

  if (view === 'results' && plan) {
    return (
      <GrowthPlannerResults
        plan={plan}
        onBack={() => setView('wizard')}
        onUpdateTask={handleUpdateTask}
      />
    );
  }

  return (
    <WizardView
      step={wizardStep}
      setStep={setWizardStep}
      duration={duration}
      setDuration={setDuration}
      selectedBrand={selectedBrand}
      socialMetrics={socialMetrics}
      setSocialMetrics={setSocialMetrics}
      productsText={productsText}
      setProductsText={setProductsText}
      productPreviews={productImages.map(image => image.dataUrl)}
      productImageCount={productImages.length}
      imageError={imageError}
      generationError={generationError}
      onProductImagesChange={handleProductImagesChange}
      onRemoveProductImage={handleRemoveProductImage}
      selectedBrandProfileId={selectedBrandProfileId}
      setSelectedBrandProfileId={setSelectedBrandProfileId}
      brandProfiles={brandProfiles}
      loadingBrands={loadingBrands}
      brandError={brandError}
      onBack={onBack}
      onGenerate={handleGenerate}
    />
  );
};

export default GrowthPlannerMock;
