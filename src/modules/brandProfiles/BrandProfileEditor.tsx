import React, { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check, Save, Sparkles, AlertCircle, ArrowLeft, Download } from 'lucide-react';
import { BrandProfileLivePreview } from './components/BrandProfileLivePreview';
import { BrandColorPaletteEditor } from './components/BrandColorPaletteEditor';
import { BrandAssetUploader } from './components/BrandAssetUploader';
import { BrandAISummaryStep } from './components/BrandAISummaryStep';
import { brandProfileAiService } from '../../services/brandProfileAiService';
import { brandProfileService } from '../../services/brandProfileService';
import { downloadBrandReport } from '../../utils/brandReportUtils';
import type { BrandProfile, BrandColor, BrandAsset } from './types';
import { EMPTY_BRAND_PROFILE } from './types';

const WIZARD_STEPS = [
  { id: 'welcome',    label: 'Bienvenida' },
  { id: 'identity',  label: 'Identidad' },
  { id: 'customer',  label: 'Cliente' },
  { id: 'perception',label: 'Percepción' },
  { id: 'tone',      label: 'Tono' },
  { id: 'visual',    label: 'Estilo visual' },
  { id: 'rules',     label: 'Comercial' },
  { id: 'summary',   label: 'Resumen IA' },
  { id: 'done',      label: 'Confirmación' },
];

interface Props {
  userId: string;
  existingProfile?: BrandProfile;
  onSaved: (profile: BrandProfile) => void;
  onBack: () => void;
}

function ChipSelector({
  options,
  value,
  onChange,
  multi = true,
  maxSelect,
}: {
  options: string[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
  maxSelect?: number;
}) {
  const isOn = (o: string) => multi ? (value as string[]).includes(o) : value === o;
  const toggle = (o: string) => {
    if (multi) {
      const cur = (value as string[]);
      if (cur.includes(o)) { onChange(cur.filter(x => x !== o)); return; }
      if (maxSelect && cur.length >= maxSelect) return;
      onChange([...cur, o]);
    } else {
      onChange(value === o ? '' : o);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o}
          type="button"
          onClick={() => toggle(o)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            isOn(o)
              ? 'text-white border-transparent shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-[#F72C5B] hover:text-[#F72C5B]'
          }`}
          style={isOn(o) ? { background: '#F72C5B', borderColor: '#F72C5B' } : {}}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function SelCard({
  title,
  desc,
  active,
  onClick,
}: {
  title: string;
  desc?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
        active ? 'border-[#F72C5B] bg-rose-50' : 'border-slate-100 bg-white hover:border-slate-200'
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
            active ? 'border-[#F72C5B] bg-[#F72C5B]' : 'border-slate-300'
          }`}
        >
          {active && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
        </div>
        <div>
          <p className="text-xs font-black text-slate-800">{title}</p>
          {desc && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>}
        </div>
      </div>
    </button>
  );
}

function AiButton({
  children,
  onClick,
  loading = false,
  small = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-xl font-black uppercase tracking-wider transition-all disabled:opacity-50 ${
        small ? 'text-[10px] px-2.5 py-1.5' : 'text-xs px-3 py-2'
      }`}
      style={{ background: 'rgba(247,44,91,0.08)', color: '#F72C5B' }}
    >
      <Sparkles size={small ? 11 : 13} className={loading ? 'animate-spin' : ''} />
      {children}
    </button>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">{label}</label>
      {hint && <p className="text-[11px] text-slate-400 leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}

function inputCls() {
  return 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#F72C5B] transition-colors bg-white';
}

// ── STEP 1: BIENVENIDA ──────────────────────────────────────────────────────────
function StepWelcome() {
  const modules = [
    { name: 'Planner',        icon: '📅' },
    { name: 'Campaign',       icon: '📣' },
    { name: 'Product Studio', icon: '🛍️' },
    { name: 'UGC Studio',     icon: '📱' },
    { name: 'Prompt Studio',  icon: '✨' },
  ];
  return (
    <div className="space-y-6 max-w-lg">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
        style={{ background: 'rgba(247,44,91,0.1)' }}>
        ✨
      </div>
      <div>
        <p className="text-[11px] font-black text-[#F72C5B] uppercase tracking-widest mb-2">Paso 1 de 8 · ~5 min</p>
        <h2 className="text-2xl font-black text-slate-800 leading-tight mb-3">
          Construyamos el perfil de <span style={{ color: '#F72C5B' }}>tu marca</span>
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Te guiaremos paso a paso para entender tu marca, tu cliente ideal, tu tono de comunicación,
          tus colores y tu forma de vender. No necesitas saber marketing: cuando algo sea difícil,{' '}
          <strong style={{ color: '#F72C5B' }}>Luz IA te ayudará con ejemplos</strong>.
        </p>
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">Este perfil se usará para mejorar:</p>
        <div className="flex flex-wrap gap-2">
          {modules.map(m => (
            <div key={m.name} className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600">
              <span>{m.icon}</span> {m.name}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
        <p className="text-xs text-[#F72C5B] font-bold">💡 Puedes editar esto después en cualquier momento. No te preocupes si no tienes todo claro ahora.</p>
      </div>
    </div>
  );
}

// ── STEP 2: IDENTIDAD BÁSICA ────────────────────────────────────────────────────
function StepIdentity({ data, set, userId }: { data: Partial<BrandProfile>; set: (p: Partial<BrandProfile>) => void; userId: string }) {
  const [aiLoading, setAiLoading] = useState(false);

  const improveDesc = async () => {
    if (!data.shortDescription) return;
    setAiLoading(true);
    try {
      const improved = await brandProfileAiService.improveBrandDescription({
        brandName:          data.brandName || '',
        category:           data.mainCategory || '',
        businessModel:      data.businessModel || '',
        currentDescription: data.shortDescription,
      });
      set({ shortDescription: improved });
    } finally { setAiLoading(false); }
  };

  const BUSINESS_OPTIONS = [
    { value: 'self_made_products',                   label: 'Vendo productos hechos por mí',             desc: 'Yo fabrico, armo, diseño o personalizo lo que vendo.' },
    { value: 'supplier_products',                    label: 'Vendo productos comprados a proveedores',   desc: 'Compro productos listos y los vendo con mi atención o empaque.' },
    { value: 'own_brand_third_party_manufacturing',  label: 'Mi marca, fabricado por un tercero',       desc: 'Yo manejo la marca, pero otra persona o proveedor fabrica.' },
    { value: 'services',                             label: 'Vendo servicios',                           desc: 'Lo que vendo es una atención, experiencia o servicio.' },
    { value: 'client_content_creator',               label: 'Creo contenido para marcas o clientes',    desc: 'Uso la app para producir contenido para otros negocios.' },
    { value: 'starting',                             label: 'Estoy empezando y aún no lo tengo claro',  desc: 'Todavía estoy definiendo mi producto, marca o forma de vender.' },
    { value: 'other',                                label: 'Otro', desc: '' },
  ] as const;

  const CATEGORIES = ['Ropa / moda','Accesorios','Cosmética / skincare','Belleza','Hogar / decoración','Velas / aromas','Alimentos','Artesanía','Tecnología','Infantil','Mascotas','Fitness / bienestar','Otro'];
  const COUNTRIES = ['Chile','Argentina','Colombia','México','Perú','Uruguay','Ecuador','Bolivia','Venezuela','Costa Rica','Otro'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-800 mb-1">Identidad básica</h2>
        <p className="text-sm text-slate-400">Cuéntanos los datos fundamentales de tu marca.</p>
      </div>

      <FormField label="¿Cómo se llama tu marca?">
        <input className={inputCls()} value={data.brandName || ''} onChange={e => set({ brandName: e.target.value })} placeholder="Ej: CIGNIA, Aurora Velas..." />
      </FormField>

      <FormField label="¿En qué países vendes?" hint="Puedes elegir más de uno si vendes en varios países.">
        <ChipSelector options={COUNTRIES} value={data.country ? data.country.split(', ') : []} onChange={v => set({ country: (v as string[]).join(', ') })} multi={true} />
      </FormField>

      <FormField label="¿Cómo funciona tu negocio principalmente?">
        <div className="grid gap-2">
          {BUSINESS_OPTIONS.map(o => (
            <SelCard key={o.value} title={o.label} desc={o.desc} active={data.businessModel === o.value} onClick={() => set({ businessModel: o.value })} />
          ))}
        </div>
      </FormField>

      <FormField label="¿En qué categoría se mueve tu marca?">
        <ChipSelector options={CATEGORIES} value={data.mainCategory || ''} onChange={v => set({ mainCategory: v as string })} multi={false} />
      </FormField>

      <FormField label="Describe tu marca en una frase" hint="No tiene que ser perfecta. Elige la opción que más se parezca a tu realidad.">
        <textarea className={`${inputCls()} resize-none`} rows={3} value={data.shortDescription || ''} onChange={e => set({ shortDescription: e.target.value })} placeholder="Ej: Vendemos accesorios femeninos elegantes para mujeres que quieren elevar sus looks diarios." />
        <AiButton onClick={improveDesc} loading={aiLoading}>Ayúdame a mejorar esta descripción</AiButton>
      </FormField>
    </div>
  );
}

// ── STEP 3: CLIENTE IDEAL ───────────────────────────────────────────────────────
function StepCustomer({ data, set }: { data: Partial<BrandProfile>; set: (p: Partial<BrandProfile>) => void }) {
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const tc = data.targetCustomer || EMPTY_BRAND_PROFILE.targetCustomer;
  const setTc = (patch: Partial<typeof tc>) => set({ targetCustomer: { ...tc, ...patch } });

  const GENDER = ['Mujeres','Hombres','Ambos','Familias','Empresas','Público amplio','Otro'];
  const AGES = ['18–24','25–34','35–44','45–54','55+','No estoy segura'];
  const MOTIVATIONS = ['Verse mejor','Ahorrar dinero','Sentirse elegante','Regalar algo especial','Resolver una necesidad práctica','Sentirse única','Cuidarse','Decorar su espacio','Probar algo nuevo','Comprar rápido y fácil','Otro'];
  const FEARS = ['Precio','Calidad','Duración','Talla','Material','Si llegará a tiempo','Si el producto se verá igual que en la foto','Confianza en la tienda','Métodos de pago','Cambios o devoluciones','No sé'];

  const improveDesc = async () => {
    if (!tc.freeDescription) return;
    setAiLoading('desc');
    try {
      const improved = await brandProfileAiService.improveCustomerDescription({ brandName: data.brandName || '', currentDescription: tc.freeDescription, genderFocus: tc.genderFocus, ageRange: tc.ageRange });
      setTc({ freeDescription: improved });
    } finally { setAiLoading(null); }
  };

  const detectDoubts = async () => {
    setAiLoading('doubts');
    try {
      const doubts = await brandProfileAiService.detectCustomerDoubts({ brandName: data.brandName || '', category: data.mainCategory || '', perceivedLevel: data.positioning?.perceivedLevel || '', salesChannels: data.commercialRules?.mainSalesChannels || [] });
      setTc({ customerDoubts: doubts });
    } finally { setAiLoading(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-800 mb-1">Cliente ideal</h2>
        <p className="text-sm text-slate-400">¿A quién le vendes? Cuanto más específica seas, mejor trabajará la IA.</p>
      </div>

      <FormField label="¿A quién le vendes principalmente?">
        <ChipSelector options={GENDER} value={tc.genderFocus} onChange={v => setTc({ genderFocus: v as string })} multi={false} />
      </FormField>

      <FormField label="Edad aproximada" hint="Puedes elegir más de un rango si tu marca apela a edades distintas.">
        <ChipSelector options={AGES} value={typeof tc.ageRange === 'string' ? (tc.ageRange ? [tc.ageRange] : []) : (tc.ageRange as unknown as string[] || [])} onChange={v => setTc({ ageRange: (v as string[]).join(', ') })} multi={true} />
      </FormField>

      <FormField label="¿Qué busca esa persona cuando compra productos como los tuyos?" hint="Puedes elegir más de una.">
        <ChipSelector options={MOTIVATIONS} value={tc.buyingMotivation} onChange={v => setTc({ buyingMotivation: v as string[] })} />
      </FormField>

      <FormField label="¿Qué le preocupa antes de comprar?" hint="Elige las principales dudas o miedos.">
        <ChipSelector options={FEARS} value={tc.customerDoubts} onChange={v => setTc({ customerDoubts: v as string[] })} />
        <AiButton onClick={detectDoubts} loading={aiLoading === 'doubts'} small>Detectar dudas principales</AiButton>
      </FormField>

      <FormField label="Describe a tu clienta ideal con tus palabras" hint="No te preocupes si no es perfecta. Luz IA la puede mejorar.">
        <textarea className={`${inputCls()} resize-none`} rows={4} value={tc.freeDescription} onChange={e => setTc({ freeDescription: e.target.value })} placeholder="Ej: Es una mujer entre 25 y 35 años, trabaja, cuida mucho cómo se presenta y le gusta verse elegante sin gastar demasiado..." />
        <AiButton onClick={improveDesc} loading={aiLoading === 'desc'}>Mejorar descripción</AiButton>
      </FormField>
    </div>
  );
}

// ── STEP 4: PERCEPCIÓN ──────────────────────────────────────────────────────────
function StepPerception({ data, set }: { data: Partial<BrandProfile>; set: (p: Partial<BrandProfile>) => void }) {
  const [aiLoading, setAiLoading] = useState(false);
  const pos = data.positioning || EMPTY_BRAND_PROFILE.positioning;
  const setPos = (patch: Partial<typeof pos>) => set({ positioning: { ...pos, ...patch } });

  const LEVELS = ['Económica','Accesible','Media','Media-alta','Premium','No estoy segura'];
  const REASONS = ['Precio','Calidad','Atención personalizada','Rapidez de entrega','Diseño','Variedad','Empaque','Exclusividad','Cercanía','Confianza','Hecho a mano','Otro','No sé todavía'];
  const COMPETITORS = ['Tiendas de Instagram','Grandes tiendas / retail','Shein / marketplaces','Tiendas físicas locales','Marcas premium','No estoy segura'];

  const findDiff = async () => {
    setAiLoading(true);
    try {
      const result = await brandProfileAiService.findDifferentiator({ brandName: data.brandName || '', category: data.mainCategory || '', perceivedLevel: pos.perceivedLevel, currentReasons: pos.mainDifferentiators, brandPromise: pos.brandPromise });
      setPos({ brandPromise: result.promise, mainDifferentiators: result.differentiators });
    } finally { setAiLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-800 mb-1">Percepción de marca</h2>
        <p className="text-sm text-slate-400">¿Cómo quieres que te vean? Elige la opción que más se parezca a tu realidad.</p>
      </div>

      <FormField label="¿Cómo quieres que se perciba tu marca?">
        <ChipSelector options={LEVELS} value={pos.perceivedLevel} onChange={v => setPos({ perceivedLevel: v as string })} multi={false} />
      </FormField>

      <FormField label="¿Por qué crees que alguien debería comprarte a ti?">
        <ChipSelector options={REASONS} value={pos.mainDifferentiators} onChange={v => setPos({ mainDifferentiators: v as string[] })} />
      </FormField>

      <FormField label="¿Qué prometes entregar siempre?">
        <input className={inputCls()} value={pos.brandPromise} onChange={e => setPos({ brandPromise: e.target.value })} placeholder="Ej: Siempre entregamos envíos rápidos y atención personalizada..." />
        <AiButton onClick={findDiff} loading={aiLoading}>Ayúdame a encontrar mi diferencial</AiButton>
      </FormField>

      <FormField label="¿Contra qué tipo de alternativas compites?">
        <ChipSelector options={COMPETITORS} value={pos.competitorAlternatives} onChange={v => setPos({ competitorAlternatives: v as string[] })} />
      </FormField>
    </div>
  );
}

// ── STEP 5: TONO ────────────────────────────────────────────────────────────────
function StepTone({ data, set }: { data: Partial<BrandProfile>; set: (p: Partial<BrandProfile>) => void }) {
  const v = data.voice || EMPTY_BRAND_PROFILE.voice;
  const setV = (patch: Partial<typeof v>) => set({ voice: { ...v, ...patch } });
  const [tagInput, setTagInput] = useState('');
  const [avoidInput, setAvoidInput] = useState('');

  const TONES = ['Cercana','Elegante','Juvenil','Divertida','Premium','Delicada','Directa','Profesional','Emocional','Inspiradora','Minimalista','Atrevida','Experta','Amigable','Sofisticada'];
  const FORMALITY = ['Muy cercano','Cercano pero cuidado','Neutral','Profesional','Elegante/formal'];
  const EMOJIS = ['Sin emojis','Pocos emojis','Moderados','Muchos emojis'];

  const addTag = (list: string[], item: string, key: 'preferredWords' | 'forbiddenWords') => {
    if (!item.trim() || list.includes(item.trim())) return;
    setV({ [key]: [...list, item.trim()] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-800 mb-1">Tono de comunicación</h2>
        <p className="text-sm text-slate-400">¿Cómo suena tu marca? Esto ayudará al Planner a crear mejores captions.</p>
      </div>

      <FormField label="Elige hasta 4 palabras que describan el tono de tu marca:">
        <ChipSelector options={TONES} value={v.toneKeywords} onChange={val => { if ((val as string[]).length <= 4) setV({ toneKeywords: val as string[] }); }} maxSelect={4} />
      </FormField>

      <FormField label="Nivel de formalidad:">
        <ChipSelector options={FORMALITY} value={v.formality} onChange={val => setV({ formality: val as string })} multi={false} />
      </FormField>

      <FormField label="Uso de emojis:">
        <ChipSelector options={EMOJIS} value={v.emojiLevel} onChange={val => setV({ emojiLevel: val as string })} multi={false} />
      </FormField>

      <FormField label="Palabras o frases que te gusta usar:" hint="Escribe y presiona Enter.">
        <div className="border border-slate-200 rounded-xl p-2 flex flex-wrap gap-1.5 min-h-[44px] bg-white focus-within:border-[#F72C5B] transition-colors">
          {v.preferredWords.map(w => (
            <span key={w} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-lg font-bold">
              {w}
              <button onClick={() => setV({ preferredWords: v.preferredWords.filter(x => x !== w) })} className="text-slate-400 hover:text-rose-500">×</button>
            </span>
          ))}
          <input
            className="flex-1 min-w-[120px] text-xs outline-none bg-transparent text-slate-700 px-1"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(v.preferredWords, tagInput, 'preferredWords'); setTagInput(''); } }}
            placeholder="nuevo ingreso, elegancia..."
          />
        </div>
      </FormField>

      <FormField label="Palabras que quieres evitar:" hint="Escribe y presiona Enter.">
        <div className="border border-slate-200 rounded-xl p-2 flex flex-wrap gap-1.5 min-h-[44px] bg-white focus-within:border-[#F72C5B] transition-colors">
          {v.forbiddenWords.map(w => (
            <span key={w} className="flex items-center gap-1 bg-rose-50 text-rose-600 text-xs px-2 py-1 rounded-lg font-bold border border-rose-100">
              {w}
              <button onClick={() => setV({ forbiddenWords: v.forbiddenWords.filter(x => x !== w) })} className="text-rose-300 hover:text-rose-600">×</button>
            </span>
          ))}
          <input
            className="flex-1 min-w-[120px] text-xs outline-none bg-transparent text-slate-700 px-1"
            value={avoidInput}
            onChange={e => setAvoidInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(v.forbiddenWords, avoidInput, 'forbiddenWords'); setAvoidInput(''); } }}
            placeholder="barato, ofertón..."
          />
        </div>
      </FormField>
    </div>
  );
}

// ── STEP 6: VISUAL ──────────────────────────────────────────────────────────────
function StepVisual({ data, set, userId, brandId }: { data: Partial<BrandProfile>; set: (p: Partial<BrandProfile>) => void; userId: string; brandId: string }) {
  const [aiLoading, setAiLoading] = useState(false);
  const vi = data.visualIdentity || EMPTY_BRAND_PROFILE.visualIdentity;
  const setVi = (patch: Partial<typeof vi>) => set({ visualIdentity: { ...vi, ...patch } });

  const STYLES = ['Limpio','Minimalista','Elegante','Femenino','Colorido','Natural','Cálido','Urbano','Premium','Divertido','Editorial','Artesanal','Moderno','Romántico','Atrevido'];
  const MOODS = ['Confianza','Deseo','Cercanía','Elegancia','Alegría','Exclusividad','Calidez','Profesionalismo','Frescura','Seguridad','Inspiración'];
  const AVOID = ['Fondos muy cargados','Colores oscuros','Colores pastel','Estilo infantil','Estilo demasiado lujoso','Estilo muy barato','Demasiados textos','Fotos frías o sin vida','Otro'];

  const LOGO_ASSET_TYPES: Array<{ type: BrandAsset['type']; label: string }> = [
    { type: 'logo',          label: 'Logo principal' },
    { type: 'alternateLogo', label: 'Logo alternativo' },
    { type: 'icon',          label: 'Isotipo / Ícono' },
  ];

  const suggestPalette = async () => {
    setAiLoading(true);
    try {
      const newColors = await brandProfileAiService.suggestColorPalette({ brandName: data.brandName || '', category: data.mainCategory || '', visualStyle: vi.visualStyle, perceivedLevel: data.positioning?.perceivedLevel || '', contentMood: vi.contentMood });
      if (newColors.length > 0) setVi({ colors: newColors });
    } finally { setAiLoading(false); }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-black text-slate-800 mb-1">Estilo visual y recursos</h2>
        <p className="text-sm text-slate-400">Logos, paleta de colores y referencias visuales de tu marca.</p>
      </div>

      {/* Bloque A: Logos */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">A — Logos y recursos principales</h3>
        <p className="text-xs text-slate-400">Si ya tienes logo, súbelo aquí. Luz IA puede usarlo como referencia para entender mejor tus colores y estilo.</p>
        <div className="grid gap-4">
          {LOGO_ASSET_TYPES.map(({ type, label }) => (
            <div key={type}>
              <p className="text-xs font-bold text-slate-600 mb-2">{label}</p>
              <BrandAssetUploader
                userId={userId}
                brandId={brandId}
                assets={vi.assets.filter(a => a.type === type)}
                onChange={newAssets => {
                  const others = vi.assets.filter(a => a.type !== type);
                  setVi({ assets: [...others, ...newAssets] });
                }}
                assetType={type}
                label={`Subir ${label.toLowerCase()}`}
                hint="PNG, JPG o SVG recomendado"
                maxAssets={1}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bloque B: Paleta */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">B — Paleta de colores</h3>
        <BrandColorPaletteEditor
          colors={vi.colors}
          onChange={colors => setVi({ colors })}
          onSuggestWithAI={suggestPalette}
          aiLoading={aiLoading}
        />
      </div>

      {/* Bloque C: Crear paleta externa */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">C — ¿No tenés paleta todavía?</h3>
        <p className="text-xs text-slate-500">Podés crear una gratis en Coolors. Copia los colores sugeridos por Luz IA, crea tu paleta y descárgala.</p>
        <div className="space-y-1">
          {['Copia tus colores sugeridos','Abre coolors.co','Crea tu paleta gratis','Descárgala como imagen o PDF','Súbela aquí'].map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-black text-[10px] flex items-center justify-center flex-shrink-0">{i + 1}</span>
              {step}
            </div>
          ))}
        </div>
        <BrandAssetUploader
          userId={userId}
          brandId={brandId}
          assets={vi.assets.filter(a => a.type === 'palette')}
          onChange={newAssets => {
            const others = vi.assets.filter(a => a.type !== 'palette');
            setVi({ assets: [...others, ...newAssets] });
          }}
          assetType="palette"
          label="Subir paleta"
          hint="Imagen o PDF de tu paleta"
        />
      </div>

      {/* Bloque D: Estilo visual */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">D — Estilo visual</h3>
        <FormField label="¿Qué estilo visual representa mejor tu marca?">
          <ChipSelector options={STYLES} value={vi.visualStyle} onChange={v => setVi({ visualStyle: v as string[] })} />
        </FormField>
        <FormField label="¿Qué sensación debería transmitir tu contenido?">
          <ChipSelector options={MOODS} value={vi.contentMood} onChange={v => setVi({ contentMood: v as string[] })} />
        </FormField>
        <FormField label="¿Qué cosas visuales quieres evitar?">
          <ChipSelector options={AVOID} value={vi.avoidVisuals} onChange={v => setVi({ avoidVisuals: v as string[] })} />
        </FormField>
      </div>

      {/* Bloque E: Otros assets */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">E — Otros recursos de marca</h3>
        <p className="text-xs text-slate-400">Elementos gráficos, referencias visuales, packaging, manual de marca, tipografías...</p>
        <BrandAssetUploader
          userId={userId}
          brandId={brandId}
          assets={vi.assets.filter(a => ['typography','packaging','reference','manual','other'].includes(a.type))}
          onChange={newAssets => {
            const others = vi.assets.filter(a => !['typography','packaging','reference','manual','other'].includes(a.type));
            setVi({ assets: [...others, ...newAssets] });
          }}
          assetType="reference"
          label="Subir recurso visual"
          hint="Imágenes, PDFs, referencias"
          maxAssets={10}
        />
      </div>
    </div>
  );
}

// ── STEP 7: REGLAS COMERCIALES ──────────────────────────────────────────────────
function StepRules({ data, set }: { data: Partial<BrandProfile>; set: (p: Partial<BrandProfile>) => void }) {
  const [aiLoading, setAiLoading] = useState(false);
  const cr = data.commercialRules || EMPTY_BRAND_PROFILE.commercialRules;
  const setCr = (patch: Partial<typeof cr>) => set({ commercialRules: { ...cr, ...patch } });

  const CHANNELS = ['Instagram DM','WhatsApp','Tienda online','MercadoLibre','TikTok Shop','Facebook','Local físico','Ferias/eventos','Otro'];
  const CTAS = ['Escríbenos por DM','Escríbenos por WhatsApp','Compra en el link','Responde esta historia','Pide el catálogo','Guarda este post','Comenta una palabra clave','Consulta disponibilidad','Agenda tu pedido'];
  const TRUST = ['Testimonios','Fotos reales','Envíos seguros','Cambios/devoluciones','Buena atención','Empaque cuidado','Experiencia previa','Productos hechos a mano','Garantía','Resultados visibles','Comunidad'];
  const DOUBTS = ['"Está caro"','"No sé si me quedará bien"','"No sé si es de buena calidad"','"No sé si la tienda es confiable"','"No sé si llegará a tiempo"','"No sé si será igual a la foto"','"No sé cómo comprar"','"No sé qué talla elegir"','"No sé si combina conmigo"','"Tengo que pensarlo"','"Prefiero comprar en una tienda conocida"','"No sé si vale la pena"','Otra','No estoy segura'];

  const STAGES = [
    { key: 'launching',  label: 'Estoy empezando / Lanzamiento',   range: '-500',       desc: 'Tengo menos de 500 seguidores, estoy armando mi marca o recién comencé a vender.' },
    { key: 'growing',    label: 'Estoy creciendo',                  range: '500–1.000',  desc: 'Tengo entre 500 y 1.000 seguidores, ya publico y vendo, pero aún necesito hacerme más conocida.' },
    { key: 'consistent', label: 'Mantengo presencia',               range: '1.000–5.000',desc: 'Tengo entre 1.000 y 5.000 seguidores, ya tengo base de público y necesito publicar constantemente.' },
    { key: 'scaling',    label: 'Estoy acelerando / Quiero escalar',range: '5.000–10k',  desc: 'Tengo entre 5.000 y 10.000 seguidores, ya hay movimiento y quiero vender más.' },
    { key: 'community',  label: 'Mi marca ya tiene comunidad fuerte',range: '+10.000',   desc: 'Tengo más de 10.000 seguidores o una audiencia activa que ya reconoce mi marca.' },
    { key: 'unknown',    label: 'No estoy segura',                   range: undefined,   desc: 'Luz IA puede ayudarte a identificar tu etapa.' },
  ] as const;

  const detectDoubts = async () => {
    setAiLoading(true);
    try {
      const doubts = await brandProfileAiService.detectCustomerDoubts({ brandName: data.brandName || '', category: data.mainCategory || '', perceivedLevel: data.positioning?.perceivedLevel || '', salesChannels: cr.mainSalesChannels });
      setCr({ customerDoubts: doubts });
    } finally { setAiLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-800 mb-1">Reglas comerciales</h2>
        <p className="text-sm text-slate-400">Cómo vendes, dónde vendes y cómo convences a tu cliente.</p>
      </div>

      <FormField label="¿Dónde vendes principalmente?">
        <ChipSelector options={CHANNELS} value={cr.mainSalesChannels} onChange={v => setCr({ mainSalesChannels: v as string[] })} />
      </FormField>

      <FormField label="¿Qué llamado a la acción prefieres?">
        <ChipSelector options={CTAS} value={cr.preferredCTA} onChange={v => setCr({ preferredCTA: v as string[] })} />
      </FormField>

      <FormField label="¿En qué etapa sientes que está tu marca hoy?">
        <div className="grid gap-2">
          {STAGES.map(s => (
            <SelCard
              key={s.key}
              title={`${s.label}${s.range ? ` · ${s.range} seguidores` : ''}`}
              desc={s.desc}
              active={cr.businessStage.key === s.key}
              onClick={() => setCr({ businessStage: { key: s.key, label: s.label, followerRange: s.range, description: s.desc } })}
            />
          ))}
        </div>
      </FormField>

      <FormField label="¿Qué genera confianza en tu marca?">
        <ChipSelector options={TRUST} value={cr.trustBuilders} onChange={v => setCr({ trustBuilders: v as string[] })} />
      </FormField>

      <FormField label="¿Qué dudas crees que tienen tus clientes antes de comprarte?" hint="El Planner puede convertir esas dudas en contenido que genere más confianza.">
        <ChipSelector options={DOUBTS} value={cr.customerDoubts} onChange={v => setCr({ customerDoubts: v as string[] })} />
        <AiButton onClick={detectDoubts} loading={aiLoading}>Ayúdame a detectar dudas de mis clientes</AiButton>
      </FormField>
    </div>
  );
}

function isHexDark(hex: string): boolean {
  if (!hex || hex[0] !== '#') return false;
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

// ── STEP 9: CONFIRMACIÓN ────────────────────────────────────────────────────────
function StepDone({ data, onSeeAll, onCreateAnother, onGoPlanner }: {
  data: Partial<BrandProfile>;
  onSeeAll: () => void;
  onCreateAnother: () => void;
  onGoPlanner: () => void;
}) {
  const primaryColor = data.visualIdentity?.colors?.[0]?.hex || '#F72C5B';
  const initial = (data.brandName || 'M').slice(0, 1).toUpperCase();
  const logoAsset = data.visualIdentity?.assets?.find(a => a.type === 'logo');
  const isPng = logoAsset?.mimeType === 'image/png' || logoAsset?.fileName?.toLowerCase().endsWith('.png');
  const avatarBg = logoAsset && isPng && !isHexDark(primaryColor) ? '#000000' : primaryColor;
  const score = brandProfileService.calculateCompletionScore(data);
  const status = brandProfileService.resolveBrandStatus(data);
  const isComplete = status === 'complete' || status === 'advanced';

  return (
    <div className="space-y-6 max-w-lg">
      <div className="text-center space-y-4">
        <div
          className="w-20 h-20 rounded-3xl overflow-hidden flex items-center justify-center text-white font-black text-3xl mx-auto shadow-xl"
          style={{ background: avatarBg }}
        >
          {logoAsset ? (
            <img src={logoAsset.url} alt={data.brandName} className="w-16 h-16 object-contain" />
          ) : initial}
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800">{data.brandName || 'Tu marca'}</h2>
          <p className="text-sm text-slate-400">{data.mainCategory || 'Sin categoría'}</p>
        </div>

        {/* Paleta */}
        {(data.visualIdentity?.colors?.length ?? 0) > 0 && (
          <div className="flex justify-center gap-2">
            {data.visualIdentity!.colors.slice(0, 6).map(c => (
              <div key={c.id} className="w-8 h-8 rounded-xl border border-slate-100 shadow-sm" style={{ background: c.hex }} title={c.label} />
            ))}
          </div>
        )}

        {/* Score */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Completitud del perfil</p>
            <span className={`text-xs font-black px-2 py-1 rounded-xl ${isComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {isComplete ? 'Lista para usar' : 'Incompleta'}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: isComplete ? '#10B981' : primaryColor }} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{score}% completado</p>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-3 text-left">
          {[
            { label: 'Tono', value: data.voice?.toneKeywords?.[0] || '—' },
            { label: 'Canal principal', value: data.commercialRules?.mainSalesChannels?.[0] || '—' },
            { label: 'País', value: data.country || '—' },
            { label: 'Etapa', value: data.commercialRules?.businessStage?.label || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
              <p className="text-xs font-bold text-slate-700 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button onClick={onSeeAll} className="w-full py-3 rounded-2xl text-sm font-black uppercase tracking-wider text-white" style={{ background: '#F72C5B' }}>
          Ver mis marcas
        </button>
        <button
          onClick={() => downloadBrandReport(data)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black uppercase tracking-wider bg-slate-800 text-white hover:bg-slate-700 transition-all"
        >
          <Download size={15} /> Descargar informe de marca
        </button>
        <button onClick={onCreateAnother} className="w-full py-3 rounded-2xl text-sm font-black uppercase tracking-wider bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
          Crear otra marca
        </button>
        <button onClick={onGoPlanner} className="w-full py-3 rounded-2xl text-sm font-black uppercase tracking-wider bg-white border border-slate-200 text-slate-600 hover:border-[#F72C5B] hover:text-[#F72C5B] transition-all">
          Ir al Planner
        </button>
      </div>
    </div>
  );
}

// ── MAIN EDITOR ─────────────────────────────────────────────────────────────────
export const BrandProfileEditor: React.FC<Props> = ({ userId, existingProfile, onSaved, onBack }) => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Partial<BrandProfile>>(
    existingProfile || { ...EMPTY_BRAND_PROFILE, userId, brandName: '' }
  );
  const [activeProfileId, setActiveProfileId] = useState<string | undefined>(existingProfile?.id);
  // ref espejo para evitar race condition: saveProfile lee el ID actualizado aunque el state no haya re-renderizado
  const activeProfileIdRef = React.useRef<string | undefined>(existingProfile?.id);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  const brandId = activeProfileId || 'draft';

  const set = useCallback((patch: Partial<BrandProfile>) => {
    setData(prev => ({ ...prev, ...patch }));
  }, []);

  const saveProfile = async (currentData: Partial<BrandProfile>, isFinal = false): Promise<BrandProfile | null> => {
    if (!currentData.brandName?.trim()) {
      setSaveError('Escribe un nombre para tu marca antes de guardar.');
      return null;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const profileId = activeProfileIdRef.current;
      if (profileId) {
        await brandProfileService.updateBrandProfile(userId, profileId, currentData);
        const updated = { ...existingProfile, ...currentData, id: profileId, userId } as BrandProfile;
        setData(updated);
        return updated;
      } else {
        const newId = await brandProfileService.createBrandProfile(userId, currentData as BrandProfile);
        const newProfile = { ...currentData, id: newId, userId } as BrandProfile;
        activeProfileIdRef.current = newId;
        setActiveProfileId(newId);
        setData(newProfile);
        return newProfile;
      }
    } catch (err: any) {
      setSaveError(err.message || 'Error al guardar la marca.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step < WIZARD_STEPS.length - 1) {
      if (step > 0) {
        const saved = await saveProfile(data, false);
        if (!saved) return;
      }
      setStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (step === 0) { onBack(); return; }
    setStep(s => s - 1);
  };

  const handleSaveDraft = async () => {
    const saved = await saveProfile(data, false);
    if (saved) onSaved(saved);
  };

  const handleFinish = async () => {
    const saved = await saveProfile(data, true);
    if (saved) onSaved(saved);
  };

  const isLast = step === WIZARD_STEPS.length - 1;
  const isSecondToLast = step === WIZARD_STEPS.length - 2;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header breadcrumb */}
      <div className="bg-white border-b border-slate-100 px-4 md:px-8 py-3 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#F72C5B] transition-colors font-bold">
          <ArrowLeft size={14} /> Mis Marcas
        </button>
        <span className="text-slate-200">/</span>
        <span className="text-xs font-black text-slate-700">{data.brandName || 'Nueva marca'}</span>
        <span className="text-slate-200">/</span>
        <span className="text-xs font-black" style={{ color: '#F72C5B' }}>
          PASO {String(step + 1).padStart(2, '0')} DE {WIZARD_STEPS.length}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Stepper lateral */}
        <nav className="hidden lg:flex flex-col w-56 bg-white border-r border-slate-100 p-6 flex-shrink-0">
          <div className="flex-1 space-y-1">
            {WIZARD_STEPS.map((s, i) => {
              const st = i === step ? 'active' : i < step ? 'done' : 'pending';
              return (
                <button
                  key={s.id}
                  disabled={saving}
                  onClick={() => setStep(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all disabled:opacity-50 ${
                    st === 'active' ? 'text-white shadow-sm' : st === 'done' ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-400 hover:bg-slate-50'
                  }`}
                  style={st === 'active' ? { background: '#F72C5B' } : {}}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                    st === 'active' ? 'bg-white text-[#F72C5B]' : st === 'done' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {st === 'done' ? <Check size={10} /> : i + 1}
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wide">{s.label}</span>
                </button>
              );
            })}
          </div>
          {saving && (
            <div className="mt-4 flex items-center gap-2 text-[10px] text-[#F72C5B] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F72C5B] animate-pulse" /> Guardando...
            </div>
          )}
          {!saving && step > 0 && (
            <div className="mt-4 flex items-center gap-2 text-[10px] text-green-600 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Borrador guardado
            </div>
          )}
        </nav>

        {/* Contenido del paso */}
        <div className="flex-1 flex gap-0 overflow-hidden">
          {/* Formulario */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-8 max-w-2xl">
              {step === 0 && <StepWelcome />}
              {step === 1 && <StepIdentity data={data} set={set} userId={userId} />}
              {step === 2 && <StepCustomer data={data} set={set} />}
              {step === 3 && <StepPerception data={data} set={set} />}
              {step === 4 && <StepTone data={data} set={set} />}
              {step === 5 && <StepVisual data={data} set={set} userId={userId} brandId={brandId} />}
              {step === 6 && <StepRules data={data} set={set} />}
              {step === 7 && (
                <BrandAISummaryStep
                  data={data}
                  onChange={summary => set({ aiSummary: summary })}
                />
              )}
              {step === 8 && (
                <StepDone
                  data={data}
                  onSeeAll={() => { handleFinish(); }}
                  onCreateAnother={() => { handleFinish(); }}
                  onGoPlanner={() => { handleFinish(); }}
                />
              )}

              {saveError && (
                <div className="mt-4 flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl">
                  <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-600">{saveError}</p>
                </div>
              )}

              {/* Botón preview mobile */}
              <button
                className="lg:hidden mt-6 w-full py-2.5 rounded-xl text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                onClick={() => setShowMobilePreview(p => !p)}
              >
                {showMobilePreview ? 'Ocultar preview' : 'Ver preview'}
              </button>

              {/* Preview mobile */}
              {showMobilePreview && (
                <div className="lg:hidden mt-4">
                  <BrandProfileLivePreview step={step} data={data} />
                </div>
              )}
            </div>

            {/* Footer */}
            {step < 8 && (
              <div className="sticky bottom-0 bg-white border-t border-slate-100 px-4 md:px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrev}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    <ChevronLeft size={14} /> {step === 0 ? 'Volver' : 'Atrás'}
                  </button>
                  {step > 0 && (
                    <button
                      onClick={handleSaveDraft}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      <Save size={13} /> Guardar borrador
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 hidden sm:block">
                    {step}/{WIZARD_STEPS.length - 1}
                  </span>
                  <button
                    onClick={handleNext}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-sm transition-all disabled:opacity-60"
                    style={{ background: '#F72C5B', boxShadow: '0 4px 16px rgba(247,44,91,0.3)' }}
                  >
                    {saving ? 'Guardando...' : isSecondToLast ? 'Aceptar y finalizar' : 'Siguiente'}
                    {!saving && <ChevronRight size={14} />}
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* Preview desktop */}
          <aside className="hidden lg:block w-72 xl:w-80 bg-white border-l border-slate-100 p-5 overflow-y-auto flex-shrink-0">
            <BrandProfileLivePreview step={step} data={data} />
          </aside>
        </div>
      </div>
    </div>
  );
};
