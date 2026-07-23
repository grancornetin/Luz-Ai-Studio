/**
 * PromptDNAPanel.tsx
 * Fusión quirúrgica de PromptDNAAnalyzer + PromptDNAEditor.
 * Modo lectura: píldoras coloreadas por categoría, fácil de escanear.
 * Click en cualquier píldora → edición inline de ese bloque.
 * Sofi puede entender el prompt de un vistazo y cambiar exactamente lo que necesita.
 */
import React, { useState } from 'react';
import { Check, X, Pencil, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { PromptDNA } from '../types/promptTypes';
import { promptHelpers } from '../utils/promptHelpers';
import ModuleTutorial from '../../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../../components/shared/tutorialConfigs';

interface PromptDNAPanelProps {
  dna: PromptDNA;
  onUpdate: (key: keyof PromptDNA, value: string) => void;
}

// ── Metadatos visuales por categoría ─────────────────────────
const BLOCK_META: Record<string, {
  color: string;       // bg de la píldora
  textColor: string;   // texto de la píldora
  border: string;
  editBg: string;      // fondo del input al editar
  labelEs: string;     // etiqueta en español
  emoji: string;
  hint: string;        // qué hace este bloque, en lenguaje simple
}> = {
  STYLE: {
    color: 'bg-violet-100', textColor: 'text-violet-800', border: 'border-violet-200',
    editBg: 'bg-violet-50 border-violet-300 focus:border-violet-500',
    labelEs: 'Estilo', emoji: '🎨',
    hint: 'El look visual general de la imagen — editorial, UGC, comercial, cinematográfico...',
  },
  PERSON: {
    color: 'bg-indigo-100', textColor: 'text-indigo-800', border: 'border-indigo-200',
    editBg: 'bg-indigo-50 border-indigo-300 focus:border-indigo-500',
    labelEs: 'Persona', emoji: '🧍',
    hint: 'Descripción del sujeto — género, edad, apariencia, actitud...',
  },
  PRODUCT: {
    color: 'bg-emerald-100', textColor: 'text-emerald-800', border: 'border-emerald-200',
    editBg: 'bg-emerald-50 border-emerald-300 focus:border-emerald-500',
    labelEs: 'Producto', emoji: '📦',
    hint: 'El objeto o producto que aparece en la imagen.',
  },
  LIGHTING: {
    color: 'bg-amber-100', textColor: 'text-amber-800', border: 'border-amber-200',
    editBg: 'bg-amber-50 border-amber-300 focus:border-amber-500',
    labelEs: 'Iluminación', emoji: '💡',
    hint: 'La calidad y tipo de luz — golden hour, estudio suave, luz de ventana...',
  },
  BACKGROUND: {
    color: 'bg-slate-100', textColor: 'text-slate-700', border: 'border-slate-200',
    editBg: 'bg-slate-50 border-slate-300 focus:border-slate-500',
    labelEs: 'Fondo', emoji: '🏙️',
    hint: 'El ambiente o locación donde ocurre la imagen.',
  },
  COMPOSITION: {
    color: 'bg-pink-100', textColor: 'text-pink-800', border: 'border-pink-200',
    editBg: 'bg-pink-50 border-pink-300 focus:border-pink-500',
    labelEs: 'Composición', emoji: '📷',
    hint: 'El encuadre y ángulo de cámara — close-up, plano general, selfie, overhead...',
  },
  DETAILS: {
    color: 'bg-orange-100', textColor: 'text-orange-800', border: 'border-orange-200',
    editBg: 'bg-orange-50 border-orange-300 focus:border-orange-500',
    labelEs: 'Detalles', emoji: '✨',
    hint: 'Detalles técnicos o estéticos adicionales. Eliminá los que no aplican a tu caso.',
  },
};

const DEFAULT_META = {
  color: 'bg-slate-100', textColor: 'text-slate-700', border: 'border-slate-200',
  editBg: 'bg-slate-50 border-slate-300 focus:border-slate-500',
  labelEs: 'Otro', emoji: '🔧',
  hint: 'Campo adicional del prompt.',
};

// ── Componente ────────────────────────────────────────────────
const PromptDNAPanel: React.FC<PromptDNAPanelProps> = ({ dna, onUpdate }) => {
  const [editingKey, setEditingKey]   = useState<string | null>(null);
  const [editValue,  setEditValue]    = useState('');
  const [expanded,   setExpanded]     = useState(true);

  const blocks = promptHelpers.getDNABlocks(dna);
  const activeBlocks  = blocks.filter(b => b.value);
  const emptyBlocks   = blocks.filter(b => !b.value);
  const hasAnyContent = activeBlocks.length > 0;

  const startEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const confirmEdit = (key: keyof PromptDNA) => {
    onUpdate(key, editValue);
    setEditingKey(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  if (!hasAnyContent) return null;

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-400">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Partes de tu descripción
            <span className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full text-[8px]">{activeBlocks.length}</span>
          </button>
        </div>
        <ModuleTutorial moduleId="promptDNA" steps={TUTORIAL_CONFIGS.promptDNA} label="¿Qué es esto?" compact />
      </div>

      {expanded && (
        <div className="space-y-2">
          {/* Bloques activos — píldoras clicables */}
          <div className="flex flex-wrap gap-2">
            {activeBlocks.map(block => {
              const meta = BLOCK_META[block.label] ?? DEFAULT_META;
              const isEditing = editingKey === block.key;

              if (isEditing) {
                return (
                  <div key={block.key} className="flex items-center gap-1.5 w-full animate-in fade-in duration-150">
                    <div className={`flex-shrink-0 px-2 py-1 rounded-lg border text-[9px] font-black uppercase ${meta.color} ${meta.textColor} ${meta.border}`}>
                      {meta.emoji} {meta.labelEs}
                    </div>
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') confirmEdit(block.key);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className={`flex-1 px-3 py-1.5 rounded-xl border-2 text-xs font-medium text-slate-700 outline-none transition-all ${meta.editBg}`}
                      placeholder={`${meta.hint}`}
                    />
                    <button
                      onClick={() => confirmEdit(block.key)}
                      className="w-7 h-7 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={block.key}
                  onClick={() => startEdit(block.key, block.value)}
                  title={`${meta.hint}\nClic para editar`}
                  className={`group flex items-start gap-1.5 px-3 py-2 rounded-2xl border transition-all hover:shadow-sm hover:scale-[1.01] active:scale-[0.99] ${meta.color} ${meta.border}`}
                >
                  <span className="text-base leading-none mt-0.5 flex-shrink-0">{meta.emoji}</span>
                  <div className="text-left min-w-0">
                    <p className={`text-[8px] font-black uppercase tracking-wider leading-none mb-0.5 ${meta.textColor} opacity-70`}>
                      {meta.labelEs}
                    </p>
                    <p className={`text-[11px] font-bold leading-snug ${meta.textColor} max-w-[200px] break-words`}>
                      {block.value}
                    </p>
                  </div>
                  <Pencil className={`w-3 h-3 ${meta.textColor} opacity-0 group-hover:opacity-50 flex-shrink-0 mt-1 transition-opacity`} />
                </button>
              );
            })}
          </div>

          {/* Bloques vacíos — añadir opcionalmente */}
          {emptyBlocks.length > 0 && !editingKey && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {emptyBlocks.map(block => {
                const meta = BLOCK_META[block.label] ?? DEFAULT_META;
                return (
                  <button
                    key={block.key}
                    onClick={() => startEdit(block.key, '')}
                    title={`Agregar: ${meta.hint}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-dashed border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    <span className="text-[9px] font-bold">{meta.emoji} {meta.labelEs}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Hint de uso */}
          <p className="text-[9px] text-slate-400 font-medium">
            Clic en cualquier bloque para editarlo · Enter para confirmar · Esc para cancelar
          </p>
        </div>
      )}
    </div>
  );
};

export default PromptDNAPanel;
