/**
 * PDLibreEditor.tsx — Editor de escenas del modo libre
 * Adaptado del prototipo PDLibre.jsx al sistema de estilos real de la app.
 * Sin emojis en etiquetas. Usa ImageSlot en lugar de FileReader propio.
 * Se monta como Paso 2 del wizard cuando recipe === 'free'.
 */
import React, { useState } from 'react';
import {
  Plus, Trash2, Maximize2, RefreshCw, Download,
  Image as ImageIcon, Link2, Sparkles, Check,
  User, Shirt, Package, Layers, Archive,
} from 'lucide-react';
import { ImageSlot } from '../../components/shared/ImageSlot';
import { FreeScene, FreeSceneRefs } from './types';

// ── Configuración de slots por escena ────────────────────────

const FREE_SLOTS: {
  key:     keyof FreeSceneRefs;
  label:   string;
  max:     number;
  icon:    React.ReactNode;
  slotType: 'person' | 'outfit' | 'product' | 'scene';
  color:   string;
  border:  string;
  bg:      string;
}[] = [
  { key: 'avatar',   label: 'Persona',  max: 2, icon: <User    size={12} strokeWidth={2} />, slotType: 'person',  color: 'text-indigo-600',  border: 'border-indigo-200',  bg: 'bg-indigo-50/40'  },
  { key: 'outfit',   label: 'Outfit',   max: 4, icon: <Shirt   size={12} strokeWidth={2} />, slotType: 'outfit',  color: 'text-purple-600',  border: 'border-purple-200',  bg: 'bg-purple-50/30'  },
  { key: 'producto', label: 'Producto', max: 4, icon: <Package size={12} strokeWidth={2} />, slotType: 'product', color: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50/30' },
  { key: 'escena',   label: 'Escena',   max: 1, icon: <Layers  size={12} strokeWidth={2} />, slotType: 'scene',   color: 'text-blue-600',    border: 'border-blue-200',    bg: 'bg-blue-50/30'    },
];

// ── Estado inicial de escena ──────────────────────────────────

export const newFreeScene = (index = 0): FreeScene => ({
  id:          Date.now() + index,
  prompt:      '',
  relation:    'ninguna',
  inheritRefs: false,
  refs:        { avatar: [], outfit: [], producto: [], escena: [] },
  result:      null,
});

// ── Mini thumbnail ────────────────────────────────────────────

const MiniThumb: React.FC<{ src: string; onRemove: () => void }> = ({ src, onRemove }) => (
  <div className="relative w-12 h-[60px] flex-shrink-0">
    <img src={src} alt="" className="w-full h-full object-cover rounded-lg border border-slate-200" />
    <button
      onClick={e => { e.stopPropagation(); onRemove(); }}
      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center"
    >
      <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
);

// ── Slot de referencias multi-imagen ─────────────────────────

interface RefSlotProps {
  slot:     typeof FREE_SLOTS[number];
  images:   (string | null)[];
  onAdd:    (src: string) => void;
  onRemove: (i: number) => void;
}

const RefSlot: React.FC<RefSlotProps> = ({ slot, images, onAdd, onRemove }) => {
  const filled  = images.filter(Boolean) as string[];
  const canAdd  = filled.length < slot.max;
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
        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.1em] flex-1">
          {slot.label}
        </span>
        {filled.length > 0 && !open && (
          <div className="flex gap-1 items-center">
            {filled.slice(0, 3).map((src, i) => (
              <img key={i} src={src} className="w-5 h-7 object-cover rounded border border-white shadow-sm" />
            ))}
            <span className={`text-[9px] font-bold ml-0.5 ${slot.color}`}>{filled.length}</span>
          </div>
        )}
        {filled.length === 0 && !open && (
          <span className="text-[9px] text-slate-400">
            {slot.max > 1 ? `Hasta ${slot.max}` : 'Subir'}
          </span>
        )}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* Thumbnails existentes */}
          {filled.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {filled.map((src, i) => (
                <MiniThumb key={i} src={src} onRemove={() => onRemove(images.indexOf(src))} />
              ))}
            </div>
          )}

          {/* Agregar nueva imagen */}
          {canAdd && (
            <div className="border-2 border-dashed border-slate-200 rounded-xl overflow-hidden">
              <ImageSlot
                value={null}
                onChange={v => { if (v) onAdd(v); }}
                slotType={slot.slotType}
                aspectRatio="portrait"
                iconless={false}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full text-[10px] text-slate-400 hover:text-slate-600 py-0.5 transition-colors"
          >
            Minimizar ↑
          </button>
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
      <img
        src={result}
        alt={`Escena ${index + 1}`}
        className="w-full aspect-[4/5] object-cover block"
      />
      <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/75 to-transparent flex gap-2">
        <button
          onClick={onExpand}
          className="flex-1 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl py-1.5 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all hover:bg-white/25"
        >
          <Maximize2 size={10} /> Ampliar
        </button>
        <button
          onClick={onRegenerate}
          className="flex-1 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl py-1.5 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all hover:bg-white/25"
        >
          <RefreshCw size={10} /> Regenerar
        </button>
        <button
          onClick={onDownload}
          className="flex-1 bg-brand-600 border-none rounded-xl py-1.5 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all hover:bg-brand-700"
        >
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
  onUpdate:    (changes: Partial<FreeScene>) => void;
  onRemove:    () => void;
  onGenerate:  () => void;
  generating:  boolean;
}

const SceneCard: React.FC<SceneCardProps> = ({
  scene, index, total, onUpdate, onRemove, onGenerate, generating,
}) => {
  const [lightbox, setLightbox] = useState(false);

  const updateRefs = (key: keyof FreeSceneRefs, images: (string | null)[]) => {
    onUpdate({ refs: { ...scene.refs, [key]: images } });
  };

  const addRefImage = (key: keyof FreeSceneRefs, src: string) => {
    const current = scene.refs[key] ?? [];
    updateRefs(key, [...current, src]);
  };

  const removeRefImage = (key: keyof FreeSceneRefs, i: number) => {
    const current = scene.refs[key] ?? [];
    updateRefs(key, current.filter((_, idx) => idx !== i));
  };

  const canGenerate = scene.prompt.trim().length >= 5;

  // Opciones de relación con escenas anteriores
  const relationOptions = [
    { value: 'ninguna', label: 'Sin relación' },
    ...Array.from({ length: index }, (_, i) => ({
      value: `escena-${i + 1}`,
      label: `Relacionada con Escena ${i + 1}`,
    })),
  ];

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
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
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

          <div className="flex items-center gap-2">
            {/* Selector de relación — solo desde escena 2 en adelante */}
            {index > 0 && (
              <div className="flex items-center gap-1.5">
                <Link2 size={11} className="text-slate-400" />
                <select
                  value={scene.relation}
                  onChange={e => onUpdate({ relation: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-semibold text-slate-600 outline-none cursor-pointer"
                >
                  {relationOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {total > 1 && (
              <button
                onClick={onRemove}
                className="w-8 h-8 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Body — dos columnas */}
        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* Columna izquierda: formulario */}
          <div className="p-5 md:border-r border-slate-100 space-y-4">

            {/* Prompt */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.12em] mb-1.5">
                Prompt <span className="text-brand-600">*</span>
              </label>
              <textarea
                value={scene.prompt}
                onChange={e => onUpdate({ prompt: e.target.value })}
                placeholder="Describí qué querés generar en esta escena..."
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all resize-none leading-relaxed"
              />
            </div>

            {/* Referencias */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.12em]">
                  Referencias
                </label>
                {index > 0 && (
                  <button
                    onClick={() => onUpdate({ inheritRefs: !scene.inheritRefs })}
                    className={`flex items-center gap-1.5 rounded-2xl px-2.5 py-1 text-[10px] font-bold border transition-all ${
                      scene.inheritRefs
                        ? 'bg-violet-50 border-violet-200 text-violet-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                      scene.inheritRefs ? 'bg-violet-600' : 'bg-slate-300'
                    }`}>
                      {scene.inheritRefs && (
                        <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    Heredar de escena anterior
                  </button>
                )}
              </div>

              {scene.inheritRefs && index > 0 ? (
                <div className="bg-violet-50 border border-violet-100 rounded-xl px-3.5 py-2.5 text-center">
                  <p className="text-[11px] text-violet-700 font-semibold">
                    Usando referencias de Escena {index}
                  </p>
                  <p className="text-[10px] text-violet-500 mt-0.5">
                    Persona, outfit, producto y escena se heredan
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {FREE_SLOTS.map(slot => (
                    <RefSlot
                      key={slot.key}
                      slot={slot}
                      images={scene.refs[slot.key] ?? []}
                      onAdd={src => addRefImage(slot.key, src)}
                      onRemove={i => removeRefImage(slot.key, i)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna derecha: resultado */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.12em]">
                Vista previa
              </label>
              {scene.result && (
                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-0.5 uppercase tracking-wider">
                  Lista
                </span>
              )}
            </div>

            <SceneResult
              index={index}
              result={scene.result}
              onRegenerate={onGenerate}
              onExpand={() => setLightbox(true)}
              onDownload={handleDownload}
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
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  Generar · 2 créditos
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && scene.result && (
        <div
          onClick={() => setLightbox(false)}
          className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-6"
        >
          <img
            src={scene.result}
            alt=""
            className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-5 w-10 h-10 bg-white/15 rounded-full text-white text-lg flex items-center justify-center hover:bg-white/25 transition-colors"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
};

// ── Componente principal del editor ──────────────────────────

interface PDLibreEditorProps {
  scenes:          FreeScene[];
  generatingIndex: number | null;
  onUpdateScene:   (index: number, changes: Partial<FreeScene>) => void;
  onAddScene:      () => void;
  onRemoveScene:   (index: number) => void;
  onGenerateScene: (index: number) => void;
}

const PDLibreEditor: React.FC<PDLibreEditorProps> = ({
  scenes, generatingIndex, onUpdateScene, onAddScene, onRemoveScene, onGenerateScene,
}) => {
  const generatedCount = scenes.filter(s => s.result).length;

  return (
    <div className="fade-in p-4 md:p-8 space-y-5">

      {/* Header del editor */}
      <div>
        <div className="text-[10px] font-black text-violet-600 uppercase tracking-[0.18em]">Paso 2 · Modo libre</div>
        <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
          Diseñá cada<br /><span className="text-violet-600 italic normal-case">escena a tu gusto</span>
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
          Cada escena tiene su propio prompt y referencias. Generás una a una para controlar el resultado.
        </p>
      </div>

      {/* Descripción */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles size={16} className="text-violet-600" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-slate-800">Cómo funciona</p>
          <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
            Cada escena se genera por separado. Podés relacionar una escena con una anterior para que el modelo mantenga coherencia visual entre ellas.
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
            onUpdate={changes => onUpdateScene(index, changes)}
            onRemove={() => onRemoveScene(index)}
            onGenerate={() => onGenerateScene(index)}
            generating={generatingIndex === index}
          />
        ))}
      </div>

      {/* Botón agregar escena */}
      {scenes.length < 6 && (
        <button
          onClick={onAddScene}
          className="w-full py-5 bg-white border-2 border-dashed border-brand-200 hover:border-brand-400 hover:bg-brand-50 rounded-2xl flex items-center justify-center gap-2 text-brand-600 text-[13px] font-black tracking-wide transition-all"
        >
          <Plus size={16} />
          Añadir escena
        </button>
      )}

      {/* Panel resumen cuando hay múltiples generadas */}
      {generatedCount > 1 && (
        <div className="bg-slate-900 rounded-[24px] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">Set completo</p>
            <p className="t-display text-[20px] text-white mt-1">
              {generatedCount} de {scenes.length} escenas generadas
            </p>
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
