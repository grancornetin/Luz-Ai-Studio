/**
 * DailyInspiration.tsx
 * Card de inspiración diaria para el Dashboard.
 * Genera 3 ideas de contenido personalizadas via Gemini,
 * cacheadas en localStorage 24h. Cada idea tiene acción directa.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, RefreshCw } from 'lucide-react';

interface ContentIdea {
  title: string;
  description: string;
  module: 'campaign' | 'photodump' | 'ugc' | 'catalog' | 'prompt';
  params: Record<string, string>;
  tag: string;
}

interface DailyInspirationProps {
  userName?: string;
  plan?: string;
}

const MODULE_LABELS: Record<string, string> = {
  campaign:  'Campaña',
  photodump: 'Historia en fotos',
  ugc:       'Fotos para redes',
  catalog:   'Fotos de producto',
  prompt:    'Crear una imagen',
};

const MODULE_ROUTES: Record<string, string> = {
  campaign:  '/campaign',
  photodump: '/photodump',
  ugc:       '/studio-pro',
  catalog:   '/productos',
  prompt:    '/prompt-studio',
};

const CACHE_KEY = 'daily_inspiration_v2';
const CACHE_HOURS = 24;

interface CacheEntry {
  date: string;
  ideas: ContentIdea[];
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function loadFromCache(): ContentIdea[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (entry.date !== todayKey()) return null;
    return entry.ideas;
  } catch {
    return null;
  }
}

function saveToCache(ideas: ContentIdea[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ date: todayKey(), ideas }));
  } catch { /* silencioso */ }
}

async function fetchIdeas(userName: string): Promise<ContentIdea[]> {
  const today = new Date();
  const dayName = today.toLocaleDateString('es-CL', { weekday: 'long' });
  const monthName = today.toLocaleDateString('es-CL', { month: 'long' });

  const prompt = `Eres un estratega de contenido para emprendedoras LATAM que venden productos físicos en Instagram y TikTok.

Hoy es ${dayName}, ${today.getDate()} de ${monthName} de ${today.getFullYear()}.

Genera exactamente 3 ideas de contenido creativas, específicas y accionables para hoy. Cada idea debe:
- Ser concreta (no genérica): mencionar el tipo de producto, el mood, el ángulo creativo
- Adaptarse al día de la semana y la temporada
- Usar uno de estos módulos: campaign, photodump, ugc, catalog, prompt

Módulos disponibles:
- campaign: genera 3-5 imágenes de campaña con dirección creativa (ideal para lanzamientos, ads)
- photodump: crea un set narrativo orgánico tipo influencer (ideal para carruseles)
- ugc: contenido estilo creador real con modelo (ideal para reviews, unboxing)
- catalog: fotos de producto profesionales (ideal para e-commerce)
- prompt: generación libre avanzada

Output SOLO un JSON array válido, sin markdown:
[
  {
    "title": "título corto y atractivo (max 6 palabras)",
    "description": "descripción específica en 1 oración de qué generar exactamente",
    "module": "nombre_del_módulo",
    "params": {"mode": "campaign", "campaignType": "product", "objective": "sell", "audience": "young"},
    "tag": "etiqueta corta (ej: Tendencia, Navidad, Weekend, Tips)"
  }
]

Para los params de campaign incluí: mode, campaignType (product/brand/social/ecommerce), objective (sell/awareness/launch/engagement), audience (general/young/professional/luxury/family), imageCount (3 o 4)
Para photodump: mode=photodump, narrative (day/journey/brand/character), protagonist (person/product/both), count (3 o 4)
Para ugc: no hay params especiales
Para catalog: no hay params especiales
Para prompt: mode=standard`;

  const body = {
    action: 'assistantChat',
    prompt,
    model: 'gemini-2.5-flash',
  };

  const res = await fetch('/api/gemini/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error('API error');
  const data = await res.json();
  if (!data.success) throw new Error('No ideas generated');

  const raw = (data.text || '').replace(/```json|```/g, '').trim();
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Invalid response format');

  const parsed: ContentIdea[] = JSON.parse(match[0]);
  return parsed.slice(0, 3);
}

// ── Fallback estático por si Gemini falla ─────────────────────
const FALLBACK_IDEAS: ContentIdea[] = [
  {
    title: 'Campaña de producto del día',
    description: 'Crea 4 imágenes de tu producto estrella con dirección creativa profesional lista para publicar hoy.',
    module: 'campaign',
    params: { mode: 'campaign', campaignType: 'product', objective: 'sell', audience: 'general', imageCount: '4' },
    tag: 'Venta',
  },
  {
    title: 'Historia visual cotidiana',
    description: 'Genera un set de 4 imágenes orgánicas estilo influencer con tu producto en su contexto natural.',
    module: 'photodump',
    params: { mode: 'photodump', narrative: 'day', protagonist: 'both', count: '4' },
    tag: 'Orgánico',
  },
  {
    title: 'Fotos de catálogo express',
    description: 'Sube una foto de tu producto y obtén imágenes de catálogo profesionales listas para tu tienda.',
    module: 'catalog',
    params: {},
    tag: 'E-commerce',
  },
];

// ── Componente principal ──────────────────────────────────────
const DailyInspiration: React.FC<DailyInspirationProps> = ({ userName = 'Creador' }) => {
  const navigate = useNavigate();
  const [ideas,   setIdeas]   = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);

  const load = async (force = false) => {
    if (!force) {
      const cached = loadFromCache();
      if (cached) { setIdeas(cached); return; }
    }

    setLoading(true);
    setError(false);
    try {
      const fresh = await fetchIdeas(userName);
      saveToCache(fresh);
      setIdeas(fresh);
    } catch {
      setError(true);
      setIdeas(FALLBACK_IDEAS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUseIdea = (idea: ContentIdea) => {
    const base = MODULE_ROUTES[idea.module] ?? '/prompt-studio';
    if (Object.keys(idea.params).length > 0) {
      navigate(`${base}?${new URLSearchParams(idea.params).toString()}`);
    } else {
      navigate(base);
    }
  };

  return (
    <div className="h-full rounded-[22px] border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="t-display text-lg text-slate-900">Inspiración de hoy</h2>
          <p className="mt-1 text-xs font-semibold capitalize text-slate-400">
            {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => navigate('/prompt-gallery')}
            className="inline-flex min-h-10 items-center gap-1 px-2 text-sm font-bold text-brand-700 hover:text-brand-600"
          >
            Galería <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => load(true)}
            disabled={loading}
            aria-label="Nuevas ideas"
            title="Nuevas ideas"
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && ideas.length === 0 && (
        <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-semibold">Preparando ideas para hoy...</span>
        </div>
      )}

      {ideas.length > 0 && (
        <div className="-mx-5 mt-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1 scrollbar-hide sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {ideas.map((idea, i) => (
            <button
              key={i}
              onClick={() => handleUseIdea(idea)}
              className="group flex w-[78%] shrink-0 snap-start flex-col gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-slate-300 hover:bg-white sm:w-auto"
            >
              <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-brand-700">
                {MODULE_LABELS[idea.module] ?? idea.module}{idea.tag ? ` · ${idea.tag}` : ''}
              </span>
              <span className="text-sm font-bold leading-snug text-slate-900">{idea.title}</span>
              <span className="text-xs leading-relaxed text-slate-500">{idea.description}</span>
              <span className="mt-auto inline-flex min-h-8 items-center gap-1 pt-1 text-sm font-bold text-brand-700">
                Usar idea <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 text-center text-xs text-slate-400">Ideas de ejemplo. Conéctate para recibir ideas personalizadas.</p>
      )}
    </div>
  );
};

export default DailyInspiration;
