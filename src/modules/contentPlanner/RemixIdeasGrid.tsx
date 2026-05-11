/**
 * RemixIdeasGrid.tsx
 * Grilla de ideas generadas por el Remix Engine.
 * Muestra 15-25 ideas de posts distintos desde pocas fotos de producto.
 * Cada idea tiene: tipo, gancho, caption, módulo sugerido, y botón para ir a generar.
 */
import React, { useState } from 'react';
import {
  Lightbulb, ArrowRight, Filter, Sparkles,
  Instagram, Play, ShoppingBag,
} from 'lucide-react';

// ── Tipos (export para que ContentPlannerCopilot los importe) ─

export interface RemixIdea {
  id: string;
  postType: string;           // "Behind the scenes", "Detalle de producto", etc.
  hook: string;               // Gancho del caption
  captionIdea: string;        // Descripción de qué decir
  imageDescription: string;  // Qué imagen necesita
  moduleToUse: string;        // "campaign" | "ugc" | "photodump" | "prompt" | "scene" | "catalog"
  moduleLabel: string;        // Etiqueta visible
  alreadyHaveImage: boolean;  // Si la imagen ya existe en la biblioteca
  platform?: 'instagram' | 'tiktok' | 'both';
}

// ── Helpers ───────────────────────────────────────────────────

const MODULE_META: Record<string, { color: string; bg: string; border: string; route: string }> = {
  campaign:  { color: '#F72C5B', bg: 'bg-rose-50',    border: 'border-rose-200',    route: '/prompt-studio?mode=campaign' },
  photodump: { color: '#7C3AED', bg: 'bg-violet-50',  border: 'border-violet-200',  route: '/prompt-studio?mode=photodump' },
  ugc:       { color: '#10B981', bg: 'bg-emerald-50', border: 'border-emerald-200', route: '/studio-pro' },
  catalog:   { color: '#0EA5E9', bg: 'bg-sky-50',     border: 'border-sky-200',     route: '/productos' },
  prompt:    { color: '#64748b', bg: 'bg-slate-50',   border: 'border-slate-200',   route: '/prompt-studio' },
  scene:     { color: '#D97706', bg: 'bg-amber-50',   border: 'border-amber-200',   route: '/clonar' },
};

const POST_TYPE_COLORS: Record<string, string> = {
  'Behind the scenes':    '#7C3AED',
  'Detalle de producto':  '#0EA5E9',
  'Lifestyle':            '#10B981',
  'UGC simulado':         '#F59E0B',
  'Educativo':            '#06B6D4',
  'Comparación':          '#8B5CF6',
  'Testimonio':           '#EC4899',
  'Oferta':               '#F72C5B',
  'Engagement':           '#EF4444',
  'Humor':                '#F97316',
};

function getTypeColor(type: string): string {
  for (const [key, color] of Object.entries(POST_TYPE_COLORS)) {
    if (type.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return '#64748b';
}

// ── Filtros ───────────────────────────────────────────────────

type FilterType = 'all' | 'campaign' | 'photodump' | 'ugc' | 'catalog' | 'prompt' | 'scene';

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: 'all',       label: 'Todas' },
  { key: 'ugc',       label: 'UGC' },
  { key: 'photodump', label: 'Photodump' },
  { key: 'campaign',  label: 'Campaign' },
  { key: 'catalog',   label: 'Product' },
  { key: 'prompt',    label: 'Prompt' },
];

// ── Card de idea individual ───────────────────────────────────

const IdeaCard: React.FC<{
  idea: RemixIdea;
  onGenerate: () => void;
}> = ({ idea, onGenerate }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = MODULE_META[idea.moduleToUse] || MODULE_META.prompt;
  const typeColor = getTypeColor(idea.postType);

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all hover:shadow-md ${meta.border}`}>
      {/* Header de la card */}
      <div className={`px-4 py-3 ${meta.bg} border-b ${meta.border}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full text-white"
                style={{ background: typeColor }}
              >
                {idea.postType}
              </span>
              {idea.platform && idea.platform !== 'both' && (
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                  {idea.platform === 'instagram' ? 'IG' : 'TT'}
                </span>
              )}
            </div>
            <p className="text-sm font-black text-slate-800 leading-snug">{idea.hook}</p>
          </div>
          <span
            className="text-[8px] font-black uppercase px-2 py-1 rounded-lg text-white flex-shrink-0"
            style={{ background: meta.color }}
          >
            {idea.moduleLabel}
          </span>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs text-slate-600 leading-relaxed">{idea.captionIdea}</p>

        {expanded && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Imagen que necesitás</p>
            <p className="text-xs text-slate-600">{idea.imageDescription}</p>
            {idea.alreadyHaveImage && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <p className="text-[9px] text-emerald-600 font-bold">Ya la tenés en tu biblioteca</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
          >
            {expanded ? 'Ver menos' : 'Ver más'}
          </button>
          <button
            onClick={onGenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase text-white transition-all hover:opacity-90 flex-shrink-0"
            style={{ background: meta.color }}
          >
            Generar <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Props del componente ──────────────────────────────────────

interface Props {
  ideas: RemixIdea[];
  onNavigateModule: (path: string) => void;
  onRequestMore: () => void;
}

// ── Componente principal ──────────────────────────────────────

const RemixIdeasGrid: React.FC<Props> = ({ ideas, onNavigateModule, onRequestMore }) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filtered = activeFilter === 'all'
    ? ideas
    : ideas.filter(i => i.moduleToUse === activeFilter);

  const groupedByType = filtered.reduce<Record<string, RemixIdea[]>>((acc, idea) => {
    if (!acc[idea.postType]) acc[idea.postType] = [];
    acc[idea.postType].push(idea);
    return acc;
  }, {});

  const handleGenerate = (idea: RemixIdea) => {
    const meta = MODULE_META[idea.moduleToUse] || MODULE_META.prompt;
    onNavigateModule(meta.route);
  };

  // ── Estado vacío ──────────────────────────────────────────────
  if (ideas.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-amber-50">
          <Lightbulb className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-800 uppercase italic">Sin ideas todavía</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
            Pedile al Copiloto que genere ideas de contenido para tu producto. Decile algo como "Dame 25 ideas de posts".
          </p>
        </div>
        <button
          onClick={onRequestMore}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-all"
          style={{ background: '#F72C5B' }}
        >
          <Sparkles className="w-4 h-4" />
          Ir al copiloto
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Header con stats */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase italic">Remix Engine</h3>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest">{ideas.length} ideas generadas</p>
          </div>
        </div>
        <button
          onClick={onRequestMore}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all"
          style={{ background: 'rgba(247,44,91,0.06)', borderColor: 'rgba(247,44,91,0.2)', color: '#F72C5B' }}
        >
          <Sparkles className="w-3 h-3" />
          Generar más ideas
        </button>
      </div>

      {/* Filtros por módulo */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filtrar:</span>
        </div>
        {FILTER_OPTIONS.map(f => {
          const count = f.key === 'all' ? ideas.length : ideas.filter(i => i.moduleToUse === f.key).length;
          if (count === 0 && f.key !== 'all') return null;
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all`}
              style={isActive
                ? { background: '#F72C5B', borderColor: '#F72C5B', color: 'white' }
                : { background: 'white', borderColor: '#e2e8f0', color: '#64748b' }}
            >
              {f.label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Plataformas quick-access */}
      <div className="flex gap-2">
        {[
          { icon: <Instagram className="w-3.5 h-3.5" />, label: 'Para Instagram', filter: 'instagram' },
          { icon: <Play className="w-3.5 h-3.5" />,      label: 'Para TikTok',    filter: 'tiktok' },
          { icon: <ShoppingBag className="w-3.5 h-3.5" />, label: 'Para tienda',   filter: 'tienda' },
        ].map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-500"
          >
            {p.icon}
            <span className="hidden sm:inline">{p.label}</span>
          </div>
        ))}
        <span className="text-[9px] text-slate-400 flex items-center pl-1">todas las ideas aplican a múltiples plataformas</span>
      </div>

      {/* Grilla de ideas — agrupadas por tipo de post */}
      {Object.entries(groupedByType).map(([postType, typeIdeas]) => (
        <div key={postType} className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: getTypeColor(postType) }}
            />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {postType} · {typeIdeas.length} idea{typeIdeas.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {typeIdeas.map(idea => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onGenerate={() => handleGenerate(idea)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RemixIdeasGrid;
