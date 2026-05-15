/**
 * PlannerOnboarding.tsx — Wizard de 4 preguntas que genera el plan semanal.
 * Ruta: /planner/nuevo o primer uso desde PlannerList.
 */
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Loader2, Sparkles,
  ShoppingBag, Users, Rocket, Radio,
  ImagePlus, X,
} from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { createProject, saveCalendar, savePlannerBrief, CalendarEntry } from '../../services/projectService';
import { v4 as uuidv4 } from 'uuid';

// ── Constantes ────────────────────────────────────────────────

const GOALS = [
  { id: 'sell',     label: 'Vender más',         sub: 'Mostrar productos y generar conversiones',  Icon: ShoppingBag },
  { id: 'grow',     label: 'Ganar seguidores',    sub: 'Crear comunidad y aumentar el alcance',     Icon: Users },
  { id: 'launch',   label: 'Lanzar algo nuevo',   sub: 'Presentar un producto o colección nueva',  Icon: Rocket },
  { id: 'maintain', label: 'Mantener presencia',  sub: 'Publicar con consistencia sin agotarme',   Icon: Radio },
];

const FREQUENCIES = [
  { value: 3, label: '3 días',  sub: 'Lunes, miércoles, viernes' },
  { value: 5, label: '5 días',  sub: 'De lunes a viernes' },
  { value: 7, label: '7 días',  sub: 'Todos los días' },
];

const PLATFORMS = [
  { id: 'Instagram Feed', label: 'Instagram Feed',  emoji: '📸' },
  { id: 'Stories',        label: 'Instagram Stories', emoji: '⭕' },
  { id: 'TikTok',         label: 'TikTok',           emoji: '🎵' },
  { id: 'WhatsApp',       label: 'WhatsApp',         emoji: '💬' },
];

const GOAL_LABELS: Record<string, string> = {
  sell: 'Vender más',
  grow: 'Ganar seguidores',
  launch: 'Lanzar algo nuevo',
  maintain: 'Mantener presencia',
};

// ── Generación del plan con Gemini ────────────────────────────

// Comprime una imagen a base64 para enviar a Gemini
async function compressImage(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 768;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const data = canvas.toDataURL('image/jpeg', 0.80).split(',')[1];
      resolve({ data, mimeType: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function generateWeekPlan(
  product: string,
  goal: string,
  frequency: number,
  platforms: string[],
  productImages: File[] = [],
): Promise<CalendarEntry[]> {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('No autenticado');

  const today = new Date();
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // Calcular los próximos N días hábiles
  const days: { iso: string; label: string }[] = [];
  let cursor = new Date(today);
  cursor.setDate(cursor.getDate() + 1); // empezar mañana
  while (days.length < frequency) {
    days.push({
      iso: cursor.toISOString().split('T')[0],
      label: `${dayNames[cursor.getDay()].charAt(0).toUpperCase() + dayNames[cursor.getDay()].slice(1)} ${cursor.getDate()} ${monthNames[cursor.getMonth()]}`,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const platformList = platforms.join(', ');
  const goalLabel = GOAL_LABELS[goal] ?? goal;

  // Comprimir las imágenes del producto si las hay (máx 3)
  const imageSlice = productImages.slice(0, 3);
  const compressed = imageSlice.length > 0
    ? await Promise.all(imageSlice.map(compressImage))
    : [];

  const imageContext = compressed.length > 0
    ? `\nIMAGENES DEL PRODUCTO: La emprendedora adjuntó ${compressed.length} foto(s) de su producto. Analizalas para entender el tipo de producto, estilo visual, colores y packaging, y usá esa información para personalizar los prompts, captions y hashtags.`
    : '';

  const systemPrompt = `Sos directora de contenido para emprendedoras latinoamericanas que venden en redes sociales.
Tu tarea es crear un plan de contenido semanal concreto, ejecutable y variado.

PRODUCTO: ${product}${imageContext}
META DE LA SEMANA: ${goalLabel}
PLATAFORMAS: ${platformList}
DÍAS DEL PLAN: ${days.map(d => d.label).join(', ')}

Genera exactamente ${frequency} tareas de contenido, una por cada día listado.
Variá los tipos de contenido para no repetir el mismo formato.

Tipos de contenido disponibles (rotar entre ellos):
- "Foto catálogo" → módulo: product
- "UGC review" → módulo: ugc
- "Behind the scenes" → módulo: prompt
- "Foto lifestyle" → módulo: product
- "Carrusel educativo" → módulo: prompt
- "Detalle del producto" → módulo: product
- "Testimonio de cliente" → módulo: ugc
- "Antes/después" → módulo: scene

Para el campo "platform", asignale una plataforma de esta lista rotando: ${platformList}

Respondé ÚNICAMENTE con un array JSON válido. Sin texto adicional, sin markdown, sin explicaciones.

Formato exacto de cada objeto:
{
  "dayLabel": "Lunes 14 mayo",
  "date": "2026-05-14",
  "contentType": "Foto catálogo",
  "module": "product",
  "platform": "Instagram Feed",
  "suggestedTime": "19:00",
  "prompt": "Fotografía de catálogo profesional de [producto], fondo blanco limpio, luz natural lateral suave, estilo minimalista editorial, muy detallado",
  "caption": "Caption completo listo para publicar con emojis y todo",
  "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5 #tag6",
  "whatToUpload": ["1 foto de tu producto (cualquier ángulo)", "Opcional: foto de inspiración de estilo"],
  "howToConfigure": ["Estilo: Catálogo / Fondo limpio", "Cantidad: 4 imágenes", "Aspecto: 1:1 (cuadrado)"],
  "engagementHook": "Terminá el caption con una pregunta directa. Las preguntas generan el doble de comentarios en los primeros 30 minutos."
}`;

  // Armar parts: texto + imágenes opcionales
  const parts: any[] = [{ text: systemPrompt }];
  for (const img of compressed) {
    parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
  }

  const res = await fetch('/api/gemini/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      action: 'generateText',
      model: 'gemini-2.5-flash',
      prompt: systemPrompt,
      images: compressed.map(img => img.data),
      mimeTypes: compressed.map(img => img.mimeType),
    }),
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Error generando el plan');

  const parsed: any[] = Array.isArray(data.json) ? data.json : JSON.parse(
    data.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  );

  return parsed.map((item, i) => ({
    id: uuidv4(),
    date: item.date ?? days[i]?.iso ?? '',
    dayLabel: item.dayLabel ?? days[i]?.label ?? '',
    contentType: item.contentType ?? 'Contenido',
    module: item.module ?? 'prompt',
    platform: item.platform ?? platforms[0] ?? 'Instagram Feed',
    suggestedTime: item.suggestedTime ?? '19:00',
    prompt: item.prompt ?? '',
    caption: item.caption ?? '',
    hashtags: item.hashtags ?? '',
    whatToUpload: Array.isArray(item.whatToUpload) ? item.whatToUpload : [],
    howToConfigure: Array.isArray(item.howToConfigure) ? item.howToConfigure : [],
    engagementHook: item.engagementHook ?? '',
    params: {},
    status: 'pending' as const,
  }));
}

// ── Componente ────────────────────────────────────────────────

const TOTAL_STEPS = 4;

const PlannerOnboarding: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep]               = useState(1);
  const [product, setProduct]         = useState('');
  const [productImages, setProductImages] = useState<File[]>([]);
  const [previews, setPreviews]       = useState<string[]>([]);
  const [goal, setGoal]               = useState('');
  const [frequency, setFrequency]     = useState<number>(0);
  const [platforms, setPlatforms]     = useState<string[]>([]);
  const [generating, setGenerating]   = useState(false);
  const [error, setError]             = useState('');
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 4 - productImages.length;
    const toAdd = files.slice(0, remaining);
    setProductImages(prev => [...prev, ...toAdd]);
    setPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const handleImageRemove = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setProductImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const canNext =
    (step === 1 && product.trim().length > 3) ||
    (step === 2 && goal !== '') ||
    (step === 3 && frequency > 0) ||
    (step === 4 && platforms.length > 0);

  const togglePlatform = (id: string) => {
    setPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const today = new Date();
      const planName = `Plan ${today.getDate()} ${today.toLocaleDateString('es-CL', { month: 'short' })}`;
      const project = await createProject(planName);

      await savePlannerBrief(project.id, { product, goal, frequency, platforms });

      const entries = await generateWeekPlan(product, goal, frequency, platforms, productImages);
      await saveCalendar(project.id, entries);

      navigate(`/planner/${project.id}`);
    } catch (err: any) {
      setError('No pudimos generar el plan. Intentá de nuevo.');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/planner')}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">
            Armá tu semana
          </h1>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-0.5">
            {step} de {TOTAL_STEPS} — {step === 1 ? 'Tu producto' : step === 2 ? 'Tu meta' : step === 3 ? 'Tu ritmo' : 'Tus redes'}
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="h-1 bg-slate-100 rounded-full mb-10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%`, background: '#F72C5B' }}
        />
      </div>

      {/* ── Paso 1: Producto ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Contame qué vendés
            </p>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
              ¿Qué producto o servicio tenés?
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Describilo con tus palabras. Cuanto más específica, mejor va a quedar el plan.
            </p>
          </div>

          <textarea
            autoFocus
            value={product}
            onChange={e => setProduct(e.target.value)}
            placeholder="Ej: aretes artesanales de plata con piedras naturales, vendo en Instagram y MercadoLibre"
            rows={3}
            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-700 outline-none transition-all resize-none placeholder:text-slate-300"
            onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(247,44,91,0.15)'; e.target.style.borderColor = '#F72C5B'; }}
            onBlur={e => { e.target.style.boxShadow = ''; e.target.style.borderColor = ''; }}
          />
          <p className="text-[11px] text-slate-300 -mt-3">{product.length}/200 caracteres</p>

          {/* Zona de fotos del producto */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-700">
                  Fotos de tu producto
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Opcional · Hasta 4 fotos · La IA las analiza para personalizar el plan
                </p>
              </div>
              {productImages.length > 0 && productImages.length < 4 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1"
                  style={{ color: '#F72C5B' }}
                >
                  <ImagePlus className="w-3 h-3" />
                  Agregar
                </button>
              )}
            </div>

            {/* Grid de previews */}
            {previews.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                {previews.map((url, i) => (
                  <div key={i} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleImageRemove(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Zona de drop / botón de subir */}
            {productImages.length < 4 && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageAdd}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed transition-all ${
                    previews.length === 0
                      ? 'border-slate-200 hover:border-[#F72C5B] hover:bg-rose-50 text-slate-400 hover:text-[#F72C5B]'
                      : 'border-slate-100 hover:border-slate-200 text-slate-300 hover:text-slate-400'
                  }`}
                >
                  <ImagePlus className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">
                    {previews.length === 0 ? 'Subir fotos de tu producto' : `Agregar más (${4 - productImages.length} restantes)`}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Paso 2: Meta ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Tu objetivo esta semana
            </p>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
              ¿Qué querés lograr?
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GOALS.map(({ id, label, sub, Icon }) => (
              <button
                key={id}
                onClick={() => setGoal(id)}
                className={`flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                  goal === id
                    ? 'border-[#F72C5B] bg-white shadow-lg'
                    : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
                }`}
                style={goal === id ? { boxShadow: '0 8px 24px rgba(247,44,91,0.12)' } : {}}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: goal === id ? 'rgba(247,44,91,0.08)' : '#f8fafc' }}
                >
                  <Icon className="w-5 h-5" style={{ color: goal === id ? '#F72C5B' : '#94a3b8' }} />
                </div>
                <div>
                  <p className={`text-sm font-black uppercase italic tracking-tight ${goal === id ? 'text-slate-900' : 'text-slate-600'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 normal-case not-italic font-normal">
                    {sub}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Paso 3: Frecuencia ── */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Tu ritmo de publicación
            </p>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
              ¿Cuántas veces por semana podés publicar?
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Ser consistente es más importante que publicar mucho. Elegí lo que podés sostener.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {FREQUENCIES.map(({ value, label, sub }) => (
              <button
                key={value}
                onClick={() => setFrequency(value)}
                className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
                  frequency === value
                    ? 'border-[#F72C5B] bg-white shadow-lg'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
                style={frequency === value ? { boxShadow: '0 8px 24px rgba(247,44,91,0.12)' } : {}}
              >
                <div className="text-left">
                  <p className={`text-lg font-black uppercase italic tracking-tight ${frequency === value ? 'text-slate-900' : 'text-slate-500'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-slate-400 normal-case not-italic font-normal mt-0.5">{sub}</p>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    frequency === value ? 'border-[#F72C5B]' : 'border-slate-200'
                  }`}
                >
                  {frequency === value && (
                    <div className="w-3 h-3 rounded-full" style={{ background: '#F72C5B' }} />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Paso 4: Plataformas ── */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Dónde publicás
            </p>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
              ¿En qué redes querés publicar?
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Podés elegir más de una. El plan va a distribuir el contenido entre ellas.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PLATFORMS.map(({ id, label, emoji }) => {
              const selected = platforms.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => togglePlatform(id)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                    selected
                      ? 'border-[#F72C5B] bg-white shadow-lg'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                  style={selected ? { boxShadow: '0 8px 24px rgba(247,44,91,0.12)' } : {}}
                >
                  <span className="text-2xl">{emoji}</span>
                  <div>
                    <p className={`text-xs font-black uppercase italic tracking-tight ${selected ? 'text-slate-900' : 'text-slate-500'}`}>
                      {label}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        selected ? 'border-[#F72C5B]' : 'border-slate-200'
                      }`}
                      style={selected ? { background: '#F72C5B' } : {}}
                    >
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium text-center">{error}</p>
          )}
        </div>
      )}

      {/* Footer de navegación */}
      <div
        className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto bg-white md:bg-transparent border-t border-slate-100 md:border-0 p-4 md:p-0 md:mt-10 flex items-center justify-between gap-4"
        style={{ boxShadow: '0 -8px 24px rgba(15,23,42,0.04)' }}
      >
        {step > 1 ? (
          <button
            onClick={() => setStep(s => s - 1)}
            className="hidden md:flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Atrás
          </button>
        ) : <div />}

        {step < TOTAL_STEPS ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext}
            className="flex items-center gap-2 px-6 py-3 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-40 shadow-lg ml-auto"
            style={{ background: '#F72C5B', boxShadow: '0 8px 24px rgba(247,44,91,0.25)' }}
          >
            Siguiente
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={!canNext || generating}
            className="flex items-center gap-2 px-6 py-3 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-40 shadow-lg ml-auto"
            style={{ background: '#F72C5B', boxShadow: '0 8px 24px rgba(247,44,91,0.25)' }}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Armando tu plan...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Armar mi semana
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default PlannerOnboarding;
