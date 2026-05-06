/**
 * DailyInspiration.tsx
 * Card de inspiración diaria para el Dashboard.
 * Genera 3 ideas de contenido personalizadas via Gemini,
 * cacheadas en localStorage 24h. Cada idea tiene acción directa.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, ArrowRight, Loader2, RefreshCw } from 'lucide-react';

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
  campaign:  'Campaign',
  photodump: 'Photodump',
  ugc:       'UGC Studio',
  catalog:   'Catálogo',
  prompt:    'Prompt Studio',
};

const MODULE_COLORS: Record<string, string> = {
  campaign:  'bg-brand-600/10 text-brand-400 border-brand-500/20',
  photodump: 'bg-violet-600/10 text-violet-400 border-violet-500/20',
  ugc:       'bg-emerald-600/10 text-emerald-400 border-emerald-500/20',
  catalog:   'bg-sky-600/10 text-sky-400 border-sky-500/20',
  prompt:    'bg-slate-600/10 text-slate-400 border-slate-500/20',
};

const MODULE_ROUTES: Record<string, string> = {
  campaign:  '/prompt-studio',
  photodump: '/prompt-studio',
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
    title: 'Photodump lifestyle',
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
    <div className="bg-white border border-slate-100 rounded-[28px] p-6 shadow-sm space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Inspiración de hoy</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="w-8 h-8 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all disabled:opacity-40"
          title="Nuevas ideas"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading */}
      {loading && ideas.length === 0 && (
        <div className="flex items-center justify-center py-8 gap-3 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest">Generando ideas para hoy...</span>
        </div>
      )}

      {/* Ideas */}
      {ideas.length > 0 && (
        <div className="space-y-2">
          {ideas.map((idea, i) => (
            <div
              key={i}
              className="group flex items-start gap-3 p-3.5 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all cursor-pointer"
              onClick={() => handleUseIdea(idea)}
            >
              {/* Número */}
              <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-black text-slate-500">{i + 1}</span>
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-black text-slate-900">{idea.title}</p>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wide ${MODULE_COLORS[idea.module] ?? MODULE_COLORS.prompt}`}>
                    {MODULE_LABELS[idea.module] ?? idea.module}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {idea.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{idea.description}</p>
              </div>

              {/* Flecha */}
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-[10px] text-slate-400 text-center">Ideas de ejemplo — conectate para ideas personalizadas</p>
      )}
    </div>
  );
};

export default DailyInspiration;
