/**
 * PromptTemplateSelector.tsx
 * Las plantillas abren un modal de preview antes de aplicarse.
 * El usuario puede leer cada bloque, entender qué hace y editarlo
 * antes de confirmar — para adaptar la plantilla a su caso concreto.
 */
import React, { useState } from 'react';
import { X, Check, Pencil, Info } from 'lucide-react';
import { PROMPT_TEMPLATES, PromptTemplate } from '../services/promptTemplates';
import { PromptDNA } from '../types/promptTypes';
import { promptHelpers } from '../utils/promptHelpers';
import ModuleTutorial from '../../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../../components/shared/tutorialConfigs';

interface Props {
  onApply: (dna: PromptDNA) => void;
}

// Descripción en español de qué significa cada bloque del DNA
const BLOCK_HINTS: Record<string, string> = {
  STYLE:       'El estilo fotográfico general de la imagen. Cambialo si querés otro look.',
  PERSON:      'Cómo se describe a la persona en el prompt. Podés personalizarlo para tu modelo.',
  PRODUCT:     'Cómo se describe el producto. Reemplazalo por el tuyo.',
  LIGHTING:    'El tipo de luz de la escena. Afecta el mood de la imagen.',
  BACKGROUND:  'El fondo o ambiente. Cambialo si querés otra locación.',
  COMPOSITION: 'El encuadre y ángulo de cámara. Afecta cómo se ve la imagen.',
  DETAILS:     'Detalles técnicos o estéticos adicionales. Podés eliminar los que no aplican.',
};

const PromptTemplateSelector: React.FC<Props> = ({ onApply }) => {
  const [preview, setPreview] = useState<PromptTemplate | null>(null);
  const [editedDNA, setEditedDNA] = useState<PromptDNA>({});
  const [editingBlock, setEditingBlock] = useState<string | null>(null);

  const openPreview = (template: PromptTemplate) => {
    setPreview(template);
    setEditedDNA(JSON.parse(JSON.stringify(template.dna))); // deep copy
    setEditingBlock(null);
  };

  const closePreview = () => {
    setPreview(null);
    setEditedDNA({});
    setEditingBlock(null);
  };

  const handleApply = () => {
    onApply(editedDNA);
    closePreview();
  };

  const updateBlock = (key: keyof PromptDNA, rawValue: string) => {
    setEditedDNA(prev => ({
      ...prev,
      [key]: rawValue.split(',').map(v => v.trim()).filter(Boolean),
    }));
  };

  const blocks = preview ? promptHelpers.getDNABlocks(editedDNA) : [];

  return (
    <>
      {/* ── Grid de plantillas ─────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plantillas</h3>
            <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5">
              <Info className="w-3 h-3 text-indigo-500" />
              <span className="text-[9px] text-indigo-600 font-bold">Se pueden editar antes de aplicar</span>
            </div>
          </div>
          <ModuleTutorial moduleId="promptTemplates" steps={TUTORIAL_CONFIGS.promptTemplates} label="¿Cómo funciona?" compact />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PROMPT_TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => openPreview(template)}
              className="p-3 bg-white border border-slate-100 rounded-2xl hover:border-brand-400 hover:bg-brand-50 transition-all text-left group"
            >
              <div className="text-xs font-black text-slate-800 group-hover:text-brand-700">
                {template.label}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                {template.description}
              </div>
              <div className="text-[9px] text-brand-500 font-bold mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                Ver y personalizar →
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Modal de preview editable ──────────────────── */}
      {preview && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={closePreview}
        >
          <div
            className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-brand-600 px-6 py-5 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-0.5">Plantilla</p>
                <h3 className="text-lg font-black text-white uppercase italic tracking-tight">{preview.label}</h3>
                <p className="text-[10px] text-white/70 mt-0.5">{preview.description}</p>
              </div>
              <button onClick={closePreview} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explicación */}
            <div className="px-6 pt-4 pb-2 flex-shrink-0 bg-amber-50 border-b border-amber-100">
              <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                <strong>Revisá cada bloque antes de aplicar.</strong> Podés hacer clic en cualquier campo para editarlo y adaptarlo a tu producto o estilo. Los campos que no necesites podés dejarlos vacíos.
              </p>
            </div>

            {/* Bloques editables */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {blocks.map(block => {
                const isEditing = editingBlock === block.key;
                const hint = BLOCK_HINTS[block.label] ?? '';

                return (
                  <div key={block.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-brand-600 uppercase tracking-widest">{block.label}</span>
                      {hint && (
                        <span className="text-[9px] text-slate-400 font-medium italic leading-tight max-w-[60%] text-right">{hint}</span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex gap-2 items-start">
                        <input
                          autoFocus
                          type="text"
                          defaultValue={block.value}
                          onBlur={e => { updateBlock(block.key, e.target.value); setEditingBlock(null); }}
                          onKeyDown={e => { if (e.key === 'Enter') { updateBlock(block.key, (e.target as HTMLInputElement).value); setEditingBlock(null); } if (e.key === 'Escape') setEditingBlock(null); }}
                          className="flex-1 bg-slate-50 border-2 border-brand-400 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:bg-white transition-all"
                          placeholder={`Valor para ${block.label.toLowerCase()}...`}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingBlock(block.key)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all group flex items-start justify-between gap-2 ${
                          block.value
                            ? 'bg-slate-50 border-slate-200 hover:border-brand-300 hover:bg-brand-50'
                            : 'bg-slate-50/50 border-dashed border-slate-200 hover:border-brand-200'
                        }`}
                      >
                        <span className={`text-xs font-medium flex-1 leading-snug ${block.value ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                          {block.value || `(vacío — clic para agregar)`}
                        </span>
                        <Pencil className="w-3 h-3 text-slate-300 group-hover:text-brand-500 flex-shrink-0 mt-0.5 transition-colors" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Acciones */}
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
              <button
                onClick={closePreview}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-100"
              >
                <Check className="w-3.5 h-3.5" />
                Aplicar plantilla
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PromptTemplateSelector;
