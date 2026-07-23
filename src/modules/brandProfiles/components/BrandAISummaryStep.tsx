import React, { useState } from 'react';
import { Sparkles, RefreshCw, Edit3, Check, AlertCircle } from 'lucide-react';
import type { BrandProfile } from '../types';
import { brandProfileAiService } from '../../../services/brandProfileAiService';

interface Props {
  data: Partial<BrandProfile>;
  onChange: (summary: BrandProfile['aiSummary']) => void;
}

const SUMMARY_FIELDS: { key: keyof BrandProfile['aiSummary']; label: string; multiline?: boolean; isArray?: boolean }[] = [
  { key: 'brandEssence',          label: 'Esencia de marca',       multiline: true },
  { key: 'targetCustomerSummary', label: 'Cliente ideal',          multiline: true },
  { key: 'positioningSummary',    label: 'Posicionamiento',        multiline: true },
  { key: 'voiceGuidelines',       label: 'Guía de tono y voz',    multiline: true },
  { key: 'visualGuidelines',      label: 'Guía visual',            multiline: true },
  { key: 'salesGuidelines',       label: 'Guía comercial',         multiline: true },
  { key: 'contentDo',             label: 'Sí hacer',               isArray: true },
  { key: 'contentDont',           label: 'Evitar',                 isArray: true },
];

export const BrandAISummaryStep: React.FC<Props> = ({ data, onChange }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const summary = data.aiSummary || {
    brandEssence: '', targetCustomerSummary: '', positioningSummary: '',
    voiceGuidelines: '', visualGuidelines: '', salesGuidelines: '',
    contentDo: [], contentDont: [],
  };

  const hasSummary = !!(summary.brandEssence);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setAccepted(false);
    try {
      const result = await brandProfileAiService.generateBrandSummary(data);
      onChange(result);
    } catch (err: any) {
      setError('No se pudo generar el resumen. Verifica tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key: keyof BrandProfile['aiSummary'], value: string | string[]) => {
    onChange({ ...summary, [key]: value } as BrandProfile['aiSummary']);
  };

  const updateArrayItem = (key: keyof BrandProfile['aiSummary'], index: number, value: string) => {
    const arr = [...(summary[key] as string[])];
    arr[index] = value;
    onChange({ ...summary, [key]: arr } as BrandProfile['aiSummary']);
  };

  const addArrayItem = (key: keyof BrandProfile['aiSummary']) => {
    const arr = [...(summary[key] as string[]), ''];
    onChange({ ...summary, [key]: arr } as BrandProfile['aiSummary']);
  };

  const removeArrayItem = (key: keyof BrandProfile['aiSummary'], index: number) => {
    const arr = (summary[key] as string[]).filter((_, i) => i !== index);
    onChange({ ...summary, [key]: arr } as BrandProfile['aiSummary']);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
            <Sparkles size={16} className="text-[#F72C5B]" />
          </div>
          <h2 className="text-xl font-black text-slate-800">Resumen de tu marca</h2>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Luz IA analiza todo lo que completaste y genera un resumen estratégico de tu marca.
          Puedes editarlo manualmente si algo no te convence.
        </p>
      </div>

      {/* Botones principales */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-60"
          style={{ background: '#F72C5B', boxShadow: '0 4px 16px rgba(247,44,91,0.3)' }}
        >
          {loading ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {loading ? 'Preparando...' : (hasSummary ? 'Preparar de nuevo' : 'Preparar mi resumen')}
        </button>

        {hasSummary && !accepted && (
          <button
            onClick={() => setAccepted(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-100 text-green-700 text-xs font-black uppercase tracking-wider hover:bg-green-200 transition-all"
          >
            <Check size={14} /> Aceptar resumen
          </button>
        )}

        {accepted && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-100 text-green-700 text-xs font-black">
            <Check size={14} /> Resumen aceptado
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl">
          <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-rose-700">Error al generar</p>
            <p className="text-xs text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!hasSummary && !loading && (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Sparkles size={20} className="text-slate-400" />
          </div>
          <p className="text-sm font-bold text-slate-500 mb-1">Aún no hay resumen</p>
          <p className="text-xs text-slate-400">Prepara una guía clara con la información que completaste.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse bg-slate-100 rounded-xl h-16" />
          ))}
        </div>
      )}

      {/* Campos del resumen */}
      {hasSummary && !loading && (
        <div className="space-y-4">
          {SUMMARY_FIELDS.map(field => {
            const val = summary[field.key];
            const isEditing = editingField === field.key;

            if (field.isArray) {
              const arr = (val as string[]) || [];
              const isDo = field.key === 'contentDo';
              return (
                <div key={field.key} className="bg-white border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${isDo ? 'bg-green-400' : 'bg-rose-400'}`}
                      />
                      {field.label}
                    </p>
                    <button
                      onClick={() => addArrayItem(field.key)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
                    >
                      + Agregar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {arr.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${isDo ? 'text-green-500' : 'text-rose-400'}`}>
                          {isDo ? '✓' : '✗'}
                        </span>
                        <input
                          className="flex-1 text-xs border border-slate-100 rounded-lg px-2 py-1.5 outline-none focus:border-[#F72C5B] text-slate-700"
                          value={item}
                          onChange={e => updateArrayItem(field.key, i, e.target.value)}
                          placeholder={isDo ? 'Qué hacer...' : 'Qué evitar...'}
                        />
                        <button
                          onClick={() => removeArrayItem(field.key, i)}
                          className="text-slate-300 hover:text-rose-400 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {arr.length === 0 && (
                      <p className="text-[11px] text-slate-400 italic">Aún no agregaste información</p>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={field.key} className="bg-white border border-slate-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-black text-slate-600 uppercase tracking-wider">{field.label}</p>
                  <button
                    onClick={() => setEditingField(isEditing ? null : field.key)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-[#F72C5B] transition-colors"
                  >
                    {isEditing ? <Check size={11} /> : <Edit3 size={11} />}
                    {isEditing ? 'Listo' : 'Editar'}
                  </button>
                </div>
                {isEditing ? (
                  <textarea
                    autoFocus
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#F72C5B] text-slate-700 leading-relaxed resize-none"
                    rows={3}
                    value={val as string}
                    onChange={e => updateField(field.key, e.target.value)}
                  />
                ) : (
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {(val as string) || <span className="text-slate-300 italic">Sin contenido</span>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
