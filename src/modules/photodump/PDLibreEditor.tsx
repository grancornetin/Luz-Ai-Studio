/**
 * PDLibreEditor.tsx — Editor de escenas del modo libre
 * v3: sin límite de escenas · historial/papelera · selector de modelo por escena ·
 *     multi-persona (hasta 4, 1 foto c/u) · @tags sincronizados con sceneRefs
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  Plus, Trash2, Maximize2, RefreshCw, Download,
  Image as ImageIcon, Link2, Sparkles, Check,
  User, Shirt, Package, Layers, Archive, X, AtSign,
  RotateCcw, History, Users,
} from 'lucide-react';
import { ImageSlot } from '../../components/shared/ImageSlot';
import { ModelSelector } from '../../components/shared/ModelSelector';
import { FreeScene, FreeSceneRefs } from './types';
import type { ModelId } from '../../services/imageApiService';

// ── Slots de referencias (excepto personas, que tienen su propio sub-sistema) ──

const REF_SLOTS: {
  key:      Exclude<keyof FreeSceneRefs, 'personas'>;
  label:    string;
  tag:      string;
  max:      number;
  icon:     React.ReactNode;
  slotType: 'outfit' | 'product' | 'scene';
  color:    string;
  border:   string;
  bg:       string;
}[] = [
  { key: 'outfit',   label: 'Look',     tag: 'outfit',   max: 4, icon: <Shirt   size={12} strokeWidth={2} />, slotType: 'outfit',  color: 'text-purple-600',  border: 'border-purple-200',  bg: 'bg-purple-50/30'  },
  { key: 'producto', label: 'Producto', tag: 'producto', max: 4, icon: <Package size={12} strokeWidth={2} />, slotType: 'product', color: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50/30' },
  { key: 'escena',   label: 'Escena',   tag: 'escena',   max: 1, icon: <Layers  size={12} strokeWidth={2} />, slotType: 'scene',   color: 'text-blue-600',    border: 'border-blue-200',    bg: 'bg-blue-50/30'    },
];

// ── Estado inicial de escena ──────────────────────────────────

export const newFreeScene = (index = 0): FreeScene => ({
  id:          Date.now() + index,
  prompt:      '',
  sceneRefs:   [],
  inheritRefs: false,
  inheritFrom: Math.max(0, index - 1),
  refs:        { personas: [], outfit: [], producto: [], escena: [] },
  result:      null,
});

// ── Mini thumbnail ────────────────────────────────────────────

const MiniThumb: React.FC<{ src: string; onRemove: () => void; inherited?: boolean }> = ({ src, onRemove, inherited }) => (
  <div className="relative w-12 h-[60px] flex-shrink-0">
    <img src={src} alt="" className={`w-full h-full object-cover rounded-lg border ${inherited ? 'border-violet-300' : 'border-slate-200'}`} />
    {inherited && (
      <div className="absolute -top-1 -left-1 w-3.5 h-3.5 bg-violet-500 rounded-full flex items-center justify-center">
        <Link2 size={7} className="text-white" />
      </div>
    )}
    <button
      onClick={e => { e.stopPropagation(); onRemove(); }}
      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center"
    >
      <X size={6} strokeWidth={3} className="text-white" />
    </button>
  </div>
);

// ── Slot multi-imagen genérico ────────────────────────────────

interface RefSlotProps {
  slot:      typeof REF_SLOTS[number];
  images:    (string | null)[];
  inherited: boolean[];
  onAdd:     (src: string) => void;
  onRemove:  (i: number) => void;
}

const RefSlot: React.FC<RefSlotProps> = ({ slot, images, inherited, onAdd, onRemove }) => {
  const filled = images.filter(Boolean) as string[];
  const canAdd = filled.length < slot.max;
  const [open, setOpen] = useState(false);

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${
      filled.length > 0 ? `${slot.border} ${slot.bg}` : 'border-slate-200 bg-white'
    }`}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
      >
        <span className={slot.color}>{slot.icon}</span>
        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.1em] flex-1">{slot.label}</span>
        <span className={`text-[9px] font-black ${slot.color} bg-white/60 rounded px-1`}>@{slot.tag}</span>
        {filled.length > 0 && !open && (
          <div className="flex gap-1 items-center">
            {filled.slice(0, 3).map((src, i) => (
              <img key={i} src={src} className={`w-5 h-7 object-cover rounded border ${inherited[i] ? 'border-violet-300' : 'border-white'} shadow-sm`} />
            ))}
            <span className={`text-[9px] font-bold ml-0.5 ${slot.color}`}>{filled.length}</span>
          </div>
        )}
        {filled.length === 0 && !open && (
          <span className="text-[9px] text-slate-400">{slot.max > 1 ? `Hasta ${slot.max}` : 'Subir'}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {filled.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {filled.map((src, i) => (
                <MiniThumb key={i} src={src} inherited={inherited[i] ?? false} onRemove={() => onRemove(images.indexOf(src))} />
              ))}
            </div>
          )}
          {inherited.some(Boolean) && (
            <p className="text-[9px] text-violet-500 font-semibold flex items-center gap-1">
              <Link2 size={8} /> Borde violeta = heredado · podés reemplazarlo
            </p>
          )}
          {canAdd && (
            <div className="border-2 border-dashed border-slate-200 rounded-xl overflow-hidden" style={{ maxWidth: 80 }}>
              <ImageSlot value={null} onChange={v => { if (v) onAdd(v); }} slotType={slot.slotType} aspectRatio="square" iconless />
            </div>
          )}
          <button type="button" onClick={() => setOpen(false)} className="w-full text-[10px] text-slate-400 hover:text-slate-600 py-0.5 transition-colors">
            Minimizar ↑
          </button>
        </div>
      )}
    </div>
  );
};

// ── Sub-sistema de personas (hasta 4, 1 foto por persona) ─────

interface PersonasSlotsProps {
  personas:  (string | null)[];
  inherited: boolean[];
  onAdd:     (src: string) => void;
  onRemove:  (i: number) => void;
}

const PersonasSlots: React.FC<PersonasSlotsProps> = ({ personas, inherited, onAdd, onRemove }) => {
  const [open, setOpen] = useState(false);
  const filled = personas.filter(Boolean) as string[];
  const canAdd = filled.length < 4;

  // Etiquetas @persona, @persona2, @persona3, @persona4
  const tagForIndex = (i: number) => i === 0 ? 'persona' : `persona${i + 1}`;

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${
      filled.length > 0 ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-white'
    }`}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
      >
        <span className="text-indigo-600"><Users size={12} strokeWidth={2} /></span>
        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.1em] flex-1">Personas</span>
        <span className="text-[9px] font-black text-indigo-600 bg-white/60 rounded px-1">@persona</span>
        {filled.length > 0 && !open && (
          <div className="flex gap-1 items-center">
            {filled.slice(0, 4).map((src, i) => (
              <div key={i} className="relative">
                <img src={src} className={`w-5 h-7 object-cover rounded border ${inherited[i] ? 'border-violet-300' : 'border-white'} shadow-sm`} />
                <span className="absolute -bottom-1 left-0 right-0 text-center text-[7px] font-black text-indigo-600 bg-white/80 rounded leading-none py-px">
                  {tagForIndex(i).replace('persona', 'P')}
                </span>
              </div>
            ))}
            <span className="text-[9px] font-bold ml-1 text-indigo-600">{filled.length}</span>
          </div>
        )}
        {filled.length === 0 && !open && <span className="text-[9px] text-slate-400">Hasta 4</span>}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Personas ya cargadas */}
          {personas.map((src, i) => src && (
            <div key={i} className="flex items-center gap-2.5 bg-white/70 rounded-xl px-2.5 py-2 border border-indigo-100">
              <img src={src} className={`w-10 h-14 object-cover rounded-lg border-2 ${inherited[i] ? 'border-violet-400' : 'border-indigo-200'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wide">
                  Persona {i + 1}
                </p>
                <p className="text-[9px] text-indigo-400 font-mono">@{tagForIndex(i)}</p>
                {inherited[i] && <p className="text-[8px] text-violet-500 font-semibold flex items-center gap-1 mt-0.5"><Link2 size={7} /> Heredada</p>}
              </div>
              <button
                onClick={() => onRemove(i)}
                className="w-6 h-6 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          ))}

          {/* Agregar persona */}
          {canAdd && (
            <div>
              <p className="text-[9px] text-slate-400 mb-1.5 font-semibold">
                Persona {filled.length + 1} · será <span className="font-mono text-indigo-500">@{tagForIndex(filled.length)}</span>
              </p>
              <div className="border-2 border-dashed border-indigo-200 rounded-xl overflow-hidden" style={{ maxWidth: 80 }}>
                <ImageSlot value={null} onChange={v => { if (v) onAdd(v); }} slotType="person" aspectRatio="portrait" iconless />
              </div>
            </div>
          )}
          {!canAdd && (
            <p className="text-[9px] text-slate-400 text-center py-1">Máximo 4 personas por escena</p>
          )}

          {inherited.some(Boolean) && (
            <p className="text-[9px] text-violet-500 font-semibold flex items-center gap-1">
              <Link2 size={8} /> Borde violeta = heredada · podés reemplazarla
            </p>
          )}

          <button type="button" onClick={() => setOpen(false)} className="w-full text-[10px] text-slate-400 hover:text-slate-600 py-0.5 transition-colors">
            Minimizar ↑
          </button>
        </div>
      )}
    </div>
  );
};

// ── Autocomplete de @tags ─────────────────────────────────────

interface TagSuggestion {
  tag:     string;
  label:   string;
  type:    'slot' | 'scene' | 'persona';
  preview?: string | null;
}

interface TagAutocompleteProps {
  value:        string;
  onChange:     (v: string) => void;
  suggestions:  TagSuggestion[];
  placeholder?: string;
}

const TagAutocomplete: React.FC<TagAutocompleteProps> = ({ value, onChange, suggestions, placeholder }) => {
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery]       = useState('');
  const [open,  setOpen]        = useState(false);
  const [cursorPos, setCursorPos] = useState(0);

  const getActiveToken = useCallback((text: string, pos: number): string | null => {
    const before = text.slice(0, pos);
    const match  = before.match(/@(\w*)$/);
    return match ? match[1] : null;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v   = e.target.value;
    const pos = e.target.selectionStart ?? 0;
    onChange(v);
    setCursorPos(pos);
    const token = getActiveToken(v, pos);
    if (token !== null) { setQuery(token); setOpen(true); }
    else { setOpen(false); }
  };

  const insertTag = (tag: string) => {
    const before   = value.slice(0, cursorPos);
    const after    = value.slice(cursorPos);
    const replaced = before.replace(/@(\w*)$/, `@${tag}`);
    onChange(replaced + after);
    setOpen(false);
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = replaced.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const filtered = suggestions.filter(s =>
    query === '' || s.tag.toLowerCase().startsWith(query.toLowerCase()) || s.label.toLowerCase().startsWith(query.toLowerCase())
  );

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        rows={4}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all resize-none leading-relaxed"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
            <AtSign size={10} className="text-brand-500" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Tags disponibles</span>
          </div>
          {filtered.map(s => (
            <button
              key={s.tag}
              type="button"
              onMouseDown={e => { e.preventDefault(); insertTag(s.tag); }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
            >
              {s.preview ? (
                <img src={s.preview} className="w-7 h-9 object-cover rounded-lg flex-shrink-0 border border-slate-200" />
              ) : (
                <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${s.type === 'scene' ? 'bg-brand-50' : 'bg-slate-100'}`}>
                  {s.type === 'scene' ? <Sparkles size={11} className="text-brand-500" /> : <AtSign size={11} className="text-slate-400" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-bold text-slate-800">@{s.tag}</span>
                <span className="text-[10px] text-slate-400 ml-1.5">{s.label}</span>
                {s.type === 'scene' && (
                  <span className="ml-1.5 text-[9px] font-black text-brand-500 bg-brand-50 rounded px-1 uppercase tracking-wide">escena</span>
                )}
                {s.type === 'persona' && (
                  <span className="ml-1.5 text-[9px] font-black text-indigo-500 bg-indigo-50 rounded px-1 uppercase tracking-wide">persona</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Resultado de escena ───────────────────────────────────────

const SceneResult: React.FC<{
  index:        number;
  result:       string | null;
  onRegenerate: () => void;
  onExpand:     () => void;
  onDownload:   () => void;
}> = ({ index, result, onRegenerate, onExpand, onDownload }) => {
  if (!result) {
    return (
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center min-h-[220px] gap-3 p-6">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
          <ImageIcon size={18} className="text-slate-300" />
        </div>
        <p className="text-[12px] text-slate-400 text-center leading-relaxed">
          La imagen aparecerá aquí<br />una vez que generes esta escena
        </p>
      </div>
    );
  }
  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-900">
      <img src={result} alt={`Escena ${index + 1}`} className="w-full aspect-[4/5] object-cover block" />
      <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/75 to-transparent flex gap-2">
        <button onClick={onExpand} className="flex-1 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl py-1.5 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 hover:bg-white/25 transition-all">
          <Maximize2 size={10} /> Ampliar
        </button>
        <button onClick={onRegenerate} className="flex-1 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl py-1.5 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 hover:bg-white/25 transition-all">
          <RefreshCw size={10} /> Regenerar
        </button>
        <button onClick={onDownload} className="flex-1 bg-brand-600 border-none rounded-xl py-1.5 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 hover:bg-brand-700 transition-all">
          <Download size={10} /> Descargar
        </button>
      </div>
    </div>
  );
};

// ── Tarjeta de escena completa ────────────────────────────────

interface SceneCardProps {
  scene:       FreeScene;
  index:       number;
  total:       number;
  allScenes:   FreeScene[];
  modelId:     ModelId;
  onModelId:   (m: ModelId) => void;
  onUpdate:    (changes: Partial<FreeScene>) => void;
  onRemove:    () => void;
  onGenerate:  () => void;
  generating:  boolean;
}

const SceneCard: React.FC<SceneCardProps> = ({
  scene, index, total, allScenes, modelId, onModelId, onUpdate, onRemove, onGenerate, generating,
}) => {
  const [lightbox, setLightbox] = useState(false);

  // ── Herencia: pre-rellena slots con la escena origen ─────────
  const handleToggleInherit = (active: boolean) => {
    if (!active) { onUpdate({ inheritRefs: false }); return; }
    const sourceIndex = scene.inheritFrom ?? index - 1;
    const source = allScenes[sourceIndex];
    if (!source) { onUpdate({ inheritRefs: true }); return; }
    onUpdate({
      inheritRefs: true,
      refs: {
        personas: [...(source.refs.personas ?? [])],
        outfit:   [...(source.refs.outfit   ?? [])],
        producto: [...(source.refs.producto ?? [])],
        escena:   [...(source.refs.escena   ?? [])],
      },
    });
  };

  const sourceScene = scene.inheritRefs ? allScenes[scene.inheritFrom ?? index - 1] : null;
  const isInherited = (key: keyof FreeSceneRefs, imgUrl: string): boolean => {
    if (!sourceScene) return false;
    const arr = sourceScene.refs[key] as (string | null)[];
    return arr.includes(imgUrl);
  };

  // ── Actualizar refs ───────────────────────────────────────────
  const updateRefs = (key: keyof FreeSceneRefs, images: (string | null)[]) => {
    onUpdate({ refs: { ...scene.refs, [key]: images } });
  };

  const addRefImage = (key: keyof FreeSceneRefs, src: string) => {
    const current = (scene.refs[key] as (string | null)[]) ?? [];
    updateRefs(key, [...current, src]);
  };

  const removeRefImage = (key: keyof FreeSceneRefs, i: number) => {
    const current = (scene.refs[key] as (string | null)[]) ?? [];
    updateRefs(key, current.filter((_, idx) => idx !== i));
  };

  // ── sceneRefs sincronizados con @tags del prompt ──────────────
  // Extraer @escenaN del prompt y unirlos con los seleccionados manualmente
  const tagsInPrompt: string[] = [...new Set(
    (scene.prompt.match(/@escena(\d+)/g) ?? []).map(t => t.slice(1))
  )];

  const handlePromptChange = (v: string) => {
    const newTags = [...new Set((v.match(/@escena(\d+)/g) ?? []).map(t => t.slice(1)))];
    // Unir con los sceneRefs seleccionados manualmente (que no vengan del prompt)
    const manualRefs = (scene.sceneRefs ?? []).filter(r => !tagsInPrompt.includes(r));
    onUpdate({ prompt: v, sceneRefs: [...new Set([...manualRefs, ...newTags])] });
  };

  const toggleManualSceneRef = (tag: string) => {
    const current = scene.sceneRefs ?? [];
    const next = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag];
    onUpdate({ sceneRefs: next });
  };

  // ── Sugerencias @tags ─────────────────────────────────────────
  const personasSuggestions: TagSuggestion[] = (scene.refs.personas ?? [])
    .map((src, i) => src ? {
      tag:     i === 0 ? 'persona' : `persona${i + 1}`,
      label:   `Persona ${i + 1}`,
      type:    'persona' as const,
      preview: src,
    } : null)
    .filter(Boolean) as TagSuggestion[];

  const slotSuggestions: TagSuggestion[] = REF_SLOTS
    .filter(s => ((scene.refs[s.key as keyof FreeSceneRefs] as (string | null)[]) ?? []).some(Boolean))
    .map(s => ({
      tag:     s.tag,
      label:   s.label,
      type:    'slot' as const,
      preview: ((scene.refs[s.key as keyof FreeSceneRefs] as (string | null)[]) ?? []).find(Boolean) ?? null,
    }));

  const sceneSuggestions: TagSuggestion[] = allScenes
    .slice(0, index)
    .map((s, i) => ({
      tag:     `escena${i + 1}`,
      label:   `Escena ${i + 1}`,
      type:    'scene' as const,
      preview: s.result ?? null,
    }));

  const allSuggestions: TagSuggestion[] = [...personasSuggestions, ...slotSuggestions, ...sceneSuggestions];

  // Escenas previas con resultado (para el panel de contexto)
  const prevScenesWithResult = allScenes
    .slice(0, index)
    .map((s, i) => ({ scene: s, index: i }))
    .filter(({ scene: s }) => s.result);

  const canGenerate = scene.prompt.trim().length >= 5;

  // Todos los @tags del prompt
  const usedTags = [...new Set((scene.prompt.match(/@\w+/g) ?? []))];

  // Un tag está "activo" (iluminado) si está en sceneRefs O en el prompt
  const isSceneActive = (tag: string) => (scene.sceneRefs ?? []).includes(tag);

  const handleDownload = () => {
    if (!scene.result) return;
    const a = document.createElement('a');
    a.href = scene.result;
    a.download = `escena_${index + 1}.png`;
    a.click();
  };

  return (
    <>
      <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center">
              <span className="text-[13px] font-black text-brand-600">E{index + 1}</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.12em]">Escena {index + 1}</p>
              {scene.result && (
                <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
                  <Check size={8} strokeWidth={3} /> Generada
                </p>
              )}
            </div>
          </div>
          {total > 1 && (
            <button
              onClick={onRemove}
              className="w-8 h-8 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Body — dos columnas */}
        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* Columna izquierda */}
          <div className="p-5 md:border-r border-slate-100 space-y-4">

            {/* Prompt con @tags */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.12em]">
                  Describe la foto <span className="text-brand-600">*</span>
                </label>
                <div className="flex items-center gap-1 text-[9px] text-slate-400">
                  <AtSign size={9} />
                  <span>Escribí @ para taggear</span>
                </div>
              </div>
              <TagAutocomplete
                value={scene.prompt}
                onChange={handlePromptChange}
                suggestions={allSuggestions}
                placeholder="Ej.: la @persona lleva el @outfit y entra al bar..."
              />
              {usedTags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {usedTags.map(t => {
                    const tag  = t.slice(1);
                    const sugg = allSuggestions.find(s => s.tag === tag);
                    return (
                      <span key={t} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        sugg?.type === 'scene'   ? 'bg-brand-50 text-brand-600' :
                        sugg?.type === 'persona' ? 'bg-indigo-50 text-indigo-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {sugg?.preview && <img src={sugg.preview} className="w-3.5 h-3.5 rounded-full object-cover" />}
                        {t}
                        {!sugg && <span className="text-amber-500 ml-0.5" title="Tag sin imagen">!</span>}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Referencias de imágenes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.12em]">Referencias</label>
                {index > 0 && (
                  <div className="flex items-center gap-2">
                    {scene.inheritRefs && index > 1 && (
                      <select
                        value={scene.inheritFrom ?? index - 1}
                        onChange={e => {
                          const from   = Number(e.target.value);
                          const source = allScenes[from];
                          onUpdate({
                            inheritFrom: from,
                            refs: source ? {
                              personas: [...(source.refs.personas ?? [])],
                              outfit:   [...(source.refs.outfit   ?? [])],
                              producto: [...(source.refs.producto ?? [])],
                              escena:   [...(source.refs.escena   ?? [])],
                            } : scene.refs,
                          });
                        }}
                        className="bg-violet-50 border border-violet-200 rounded-xl px-2 py-1 text-[10px] font-semibold text-violet-700 outline-none"
                      >
                        {Array.from({ length: index }, (_, i) => (
                          <option key={i} value={i}>Desde E{i + 1}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => handleToggleInherit(!scene.inheritRefs)}
                      className={`flex items-center gap-1.5 rounded-2xl px-2.5 py-1 text-[10px] font-bold border transition-all ${
                        scene.inheritRefs
                          ? 'bg-violet-50 border-violet-200 text-violet-700'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full flex items-center justify-center ${scene.inheritRefs ? 'bg-violet-600' : 'bg-slate-300'}`}>
                        {scene.inheritRefs && (
                          <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      Heredar refs
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {/* Personas — sub-sistema dedicado */}
                <PersonasSlots
                  personas={scene.refs.personas ?? []}
                  inherited={(scene.refs.personas ?? []).map(img => img ? isInherited('personas', img) : false)}
                  onAdd={src => addRefImage('personas', src)}
                  onRemove={i => removeRefImage('personas', i)}
                />
                {/* Outfit, Producto, Escena */}
                {REF_SLOTS.map(slot => (
                  <RefSlot
                    key={slot.key}
                    slot={slot}
                    images={(scene.refs[slot.key as keyof FreeSceneRefs] as (string | null)[]) ?? []}
                    inherited={((scene.refs[slot.key as keyof FreeSceneRefs] as (string | null)[]) ?? []).map(img => img ? isInherited(slot.key as keyof FreeSceneRefs, img) : false)}
                    onAdd={src => addRefImage(slot.key as keyof FreeSceneRefs, src)}
                    onRemove={i => removeRefImage(slot.key as keyof FreeSceneRefs, i)}
                  />
                ))}
              </div>
            </div>

            {/* Contexto visual de escenas anteriores */}
            {prevScenesWithResult.length > 0 && (
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.12em] mb-1.5">
                  Contexto visual de escenas anteriores
                </label>
                <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                  Elige una foto anterior como referencia para mantener la continuidad.
                </p>
                <div className="flex flex-wrap gap-2">
                  {prevScenesWithResult.map(({ scene: s, index: i }) => {
                    const tag    = `escena${i + 1}`;
                    // Activo si está en sceneRefs O si está en el prompt
                    const active = isSceneActive(tag) || tagsInPrompt.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleManualSceneRef(tag)}
                        className={`relative flex-shrink-0 transition-all ${active ? 'ring-2 ring-brand-500 ring-offset-1' : 'opacity-60 hover:opacity-90'}`}
                      >
                        <img src={s.result!} alt={`Escena ${i + 1}`} className="w-14 h-[70px] object-cover rounded-xl border border-slate-200" />
                        <div className="absolute -bottom-1 left-0 right-0 flex items-center justify-center">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            E{i + 1}
                          </span>
                        </div>
                        {active && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand-600 rounded-full flex items-center justify-center">
                            <Check size={8} className="text-white" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {(scene.sceneRefs ?? []).length > 0 || tagsInPrompt.length > 0 ? (
                  <p className="text-[9px] text-brand-600 mt-1.5 font-semibold">
                    {[...new Set([...(scene.sceneRefs ?? []), ...tagsInPrompt])].length} escena(s) como referencia de continuidad
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Columna derecha: resultado */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.12em]">Vista previa</label>
              {scene.result && (
                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-0.5 uppercase tracking-wider">Lista</span>
              )}
            </div>

            <SceneResult
              index={index}
              result={scene.result}
              onRegenerate={onGenerate}
              onExpand={() => setLightbox(true)}
              onDownload={handleDownload}
            />

            {/* Selector de modelo — encima del botón de generar */}
            <ModelSelector
              value={modelId}
              onChange={onModelId}
              disabled={generating}
              exclude={[]}
            />

            <button
              onClick={onGenerate}
              disabled={!canGenerate || generating}
              className={`w-full py-3.5 rounded-2xl text-[12px] font-black tracking-wide flex items-center justify-center gap-2 transition-all ${
                canGenerate && !generating
                  ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {generating ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  Crear foto · 2 créditos
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {lightbox && scene.result && (
        <div onClick={() => setLightbox(false)} className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-6">
          <img src={scene.result} alt="" className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(false)} className="absolute top-4 right-5 w-10 h-10 bg-white/15 rounded-full text-white text-lg flex items-center justify-center hover:bg-white/25 transition-colors">×</button>
        </div>
      )}
    </>
  );
};

// ── Componente principal del editor ──────────────────────────

export interface DeletedScene {
  scene:       FreeScene;
  originalIdx: number;
  deletedAt:   number;
}

interface PDLibreEditorProps {
  scenes:          FreeScene[];
  generatingIndex: number | null;
  modelId:         ModelId;
  onModelId:       (m: ModelId) => void;
  onUpdateScene:   (index: number, changes: Partial<FreeScene>) => void;
  onAddScene:      () => void;
  onRemoveScene:   (index: number) => void;
  onGenerateScene: (index: number) => void;
  onResetAll:      () => void;
}

const PDLibreEditor: React.FC<PDLibreEditorProps> = ({
  scenes, generatingIndex, modelId, onModelId,
  onUpdateScene, onAddScene, onRemoveScene, onGenerateScene, onResetAll,
}) => {
  const generatedCount = scenes.filter(s => s.result).length;
  const [trash,      setTrash]      = useState<DeletedScene[]>([]);
  const [showTrash,  setShowTrash]  = useState(false);

  // Interceptar el borrado para guardar en papelera
  const handleRemove = (index: number) => {
    const scene = scenes[index];
    setTrash(prev => [{ scene, originalIdx: index, deletedAt: Date.now() }, ...prev]);
    onRemoveScene(index);
  };

  const handleRestore = (item: DeletedScene) => {
    // Restaurar al final (no al índice original, pues las otras escenas se movieron)
    onAddScene();
    // Actualizar la última escena recién creada con los datos de la eliminada
    setTimeout(() => {
      onUpdateScene(scenes.length, item.scene);
    }, 50);
    setTrash(prev => prev.filter(t => t.deletedAt !== item.deletedAt));
  };

  return (
    <div className="fade-in p-4 md:p-8 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black text-violet-600 uppercase tracking-[0.18em]">Paso 2 · Crea foto por foto</div>
          <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
            Diseñá cada<br /><span className="text-violet-600 italic normal-case">escena a tu gusto</span>
          </h2>
          <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
            Sin límite de escenas. Cada una se genera por separado y consume 2 créditos.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0 mt-1">
          {trash.length > 0 && (
            <button
              onClick={() => setShowTrash(p => !p)}
              className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide transition-all hover:bg-amber-100"
            >
              <History size={12} />
              Papelera ({trash.length})
            </button>
          )}
          <button
            onClick={onResetAll}
            className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide transition-all hover:bg-red-100"
          >
            <RotateCcw size={12} />
            Reiniciar
          </button>
        </div>
      </div>

      {/* Papelera */}
      {showTrash && trash.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
              <History size={12} /> Escenas borradas — recuperables
            </p>
            <button onClick={() => setShowTrash(false)} className="text-amber-400 hover:text-amber-600">
              <X size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {trash.map(item => (
              <div key={item.deletedAt} className="flex items-center gap-3 bg-white border border-amber-100 rounded-xl px-3 py-2">
                {item.scene.result ? (
                  <img src={item.scene.result} className="w-8 h-10 object-cover rounded-lg flex-shrink-0 border border-slate-200" />
                ) : (
                  <div className="w-8 h-10 bg-slate-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                    <ImageIcon size={12} className="text-slate-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-700 truncate">
                    Escena {item.originalIdx + 1}
                    {item.scene.result && <span className="ml-1.5 text-[9px] text-emerald-600 font-black">· tenía imagen</span>}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{item.scene.prompt || 'Sin descripción'}</p>
                </div>
                <button
                  onClick={() => handleRestore(item)}
                  className="flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide transition-all flex-shrink-0"
                >
                  <RotateCcw size={10} /> Recuperar
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setTrash([])}
            className="w-full text-[9px] text-amber-500 hover:text-amber-700 font-semibold transition-colors"
          >
            Vaciar papelera
          </button>
        </div>
      )}

      {/* Tip de uso */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <AtSign size={16} className="text-violet-600" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-slate-800">Cómo usar @tags</p>
          <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
            <span className="font-bold text-slate-700">@persona</span>, <span className="font-bold text-slate-700">@persona2</span>… para referenciar personas subidas.{' '}
            <span className="font-bold text-slate-700">@outfit</span>, <span className="font-bold text-slate-700">@producto</span> para otros slots.{' '}
            <span className="font-bold text-slate-700">@escena1</span>, <span className="font-bold text-slate-700">@escena3</span> para traer resultados de escenas anteriores.
          </p>
        </div>
      </div>

      {/* Escenas */}
      <div className="space-y-5">
        {scenes.map((scene, index) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            index={index}
            total={scenes.length}
            allScenes={scenes}
            modelId={modelId}
            onModelId={onModelId}
            onUpdate={changes => onUpdateScene(index, changes)}
            onRemove={() => handleRemove(index)}
            onGenerate={() => onGenerateScene(index)}
            generating={generatingIndex === index}
          />
        ))}
      </div>

      {/* Botón agregar escena — sin límite */}
      <button
        onClick={onAddScene}
        className="w-full py-5 bg-white border-2 border-dashed border-brand-200 hover:border-brand-400 hover:bg-brand-50 rounded-2xl flex items-center justify-center gap-2 text-brand-600 text-[13px] font-black tracking-wide transition-all"
      >
        <Plus size={16} />
        Añadir escena
      </button>

      {/* Panel resumen */}
      {generatedCount > 1 && (
        <div className="bg-slate-900 rounded-[24px] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">Set completo</p>
            <p className="t-display text-[20px] text-white mt-1">{generatedCount} de {scenes.length} escenas generadas</p>
            <p className="text-[12px] text-white/40 mt-0.5">Descargá todas en un ZIP</p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {scenes.filter(s => s.result).slice(0, 3).map((s, i) => (
              <img key={i} src={s.result!} alt="" className="w-12 h-12 object-cover rounded-xl border-2 border-white/20" />
            ))}
          </div>
          <button
            onClick={() => {
              scenes.filter(s => s.result).forEach((s, i) => {
                const a = document.createElement('a');
                a.href = s.result!;
                a.download = `libre_escena_${i + 1}.png`;
                a.click();
              });
            }}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-3 text-[12px] font-black tracking-wide transition-colors flex-shrink-0"
          >
            <Archive size={14} />
            Descargar ZIP
          </button>
        </div>
      )}

    </div>
  );
};

export default PDLibreEditor;
