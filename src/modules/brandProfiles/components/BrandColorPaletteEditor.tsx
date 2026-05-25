import React, { useState } from 'react';
import { Plus, Trash2, Copy, Edit3, Check, Sparkles } from 'lucide-react';
import type { BrandColor } from '../types';

interface Props {
  colors: BrandColor[];
  onChange: (colors: BrandColor[]) => void;
  onSuggestWithAI?: () => void;
  aiLoading?: boolean;
}

const ROLE_LABELS: Record<BrandColor['role'], string> = {
  primary:         'Principal',
  secondary:       'Secundario',
  accent:          'Acento',
  lightBackground: 'Fondo claro',
  darkBackground:  'Fondo oscuro',
  text:            'Texto',
  support:         'Apoyo',
  other:           'Otro',
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [BrandColor['role'], string][];

function isHexDark(hex: string): boolean {
  if (!hex || hex[0] !== '#') return false;
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

function ColorBlock({
  color,
  onUpdate,
  onRemove,
  showRemove,
}: {
  color: BrandColor;
  onUpdate: (updates: Partial<BrandColor>) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  const [editingHex, setEditingHex] = useState(false);
  const [hexDraft, setHexDraft] = useState(color.hex);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(color.label);
  const [copied, setCopied] = useState(false);

  const dark = isHexDark(color.hex);

  const applyHex = () => {
    const val = hexDraft.startsWith('#') ? hexDraft : '#' + hexDraft;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onUpdate({ hex: val.toUpperCase() });
    } else {
      setHexDraft(color.hex);
    }
    setEditingHex(false);
  };

  const applyLabel = () => {
    onUpdate({ label: labelDraft.trim() || color.label });
    setEditingLabel(false);
  };

  const copyHex = () => {
    navigator.clipboard?.writeText(color.hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-white">
      {/* Swatch grande */}
      <div
        className="h-24 w-full flex items-end justify-between p-3 cursor-pointer"
        style={{ background: color.hex }}
        onClick={() => setEditingHex(true)}
      >
        <span
          className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg"
          style={{
            background: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.12)',
            color: dark ? '#1a1320' : 'rgba(255,255,255,0.95)',
          }}
        >
          {ROLE_LABELS[color.role]}
        </span>
        {/* Color picker nativo oculto */}
        <input
          type="color"
          value={color.hex}
          onChange={e => onUpdate({ hex: e.target.value.toUpperCase() })}
          className="opacity-0 absolute w-0 h-0"
          id={`color-picker-${color.id}`}
        />
        <label
          htmlFor={`color-picker-${color.id}`}
          className="cursor-pointer text-[10px] px-2 py-1 rounded-lg font-bold"
          style={{
            background: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
            color: dark ? 'white' : 'rgba(0,0,0,0.7)',
          }}
        >
          Cambiar
        </label>
      </div>

      {/* Info inferior */}
      <div className="p-3 space-y-2">
        {/* Label editable */}
        {editingLabel ? (
          <input
            autoFocus
            className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[#F72C5B]"
            value={labelDraft}
            onChange={e => setLabelDraft(e.target.value)}
            onBlur={applyLabel}
            onKeyDown={e => { if (e.key === 'Enter') applyLabel(); if (e.key === 'Escape') setEditingLabel(false); }}
          />
        ) : (
          <p
            className="text-xs font-bold text-slate-700 cursor-pointer hover:text-[#F72C5B] transition-colors truncate"
            onClick={() => { setLabelDraft(color.label); setEditingLabel(true); }}
          >
            {color.label}
          </p>
        )}

        {/* HEX editable */}
        {editingHex ? (
          <input
            autoFocus
            className="w-full text-xs font-mono border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[#F72C5B] uppercase"
            value={hexDraft}
            onChange={e => setHexDraft(e.target.value)}
            onBlur={applyHex}
            onKeyDown={e => { if (e.key === 'Enter') applyHex(); if (e.key === 'Escape') setEditingHex(false); }}
          />
        ) : (
          <p
            className="text-[11px] font-mono text-slate-500 cursor-pointer hover:text-slate-800 transition-colors"
            onClick={() => { setHexDraft(color.hex); setEditingHex(true); }}
          >
            {color.hex.toUpperCase()}
          </p>
        )}

        {/* Role selector */}
        <select
          value={color.role}
          onChange={e => onUpdate({ role: e.target.value as BrandColor['role'] })}
          className="w-full text-[11px] border border-slate-100 rounded-lg px-2 py-1 text-slate-600 bg-white outline-none focus:border-[#F72C5B]"
        >
          {ROLE_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        {/* Acciones */}
        <div className="flex items-center gap-1 pt-1">
          <button
            onClick={copyHex}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors px-2 py-1 rounded-lg hover:bg-slate-50"
          >
            {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            onClick={() => { setHexDraft(color.hex); setEditingHex(true); }}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors px-2 py-1 rounded-lg hover:bg-slate-50"
          >
            <Edit3 size={11} /> Editar
          </button>
          {showRemove && (
            <button
              onClick={onRemove}
              className="flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-600 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 ml-auto"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const BrandColorPaletteEditor: React.FC<Props> = ({
  colors,
  onChange,
  onSuggestWithAI,
  aiLoading = false,
}) => {
  const update = (id: string, updates: Partial<BrandColor>) => {
    onChange(colors.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const remove = (id: string) => {
    onChange(colors.filter(c => c.id !== id));
  };

  const add = () => {
    const newColor: BrandColor = {
      id: String(Date.now()),
      hex: '#CCCCCC',
      label: 'Nuevo color',
      role: 'other',
      order: colors.length,
    };
    onChange([...colors, newColor]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Paleta de colores</h4>
        <div className="flex items-center gap-2">
          {onSuggestWithAI && (
            <button
              onClick={onSuggestWithAI}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
              style={{ background: 'rgba(247,44,91,0.08)', color: '#F72C5B' }}
            >
              <Sparkles size={12} />
              {aiLoading ? 'Generando...' : 'Sugerir con IA'}
            </button>
          )}
          <button
            onClick={add}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
          >
            <Plus size={12} /> Agregar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {colors.map(color => (
          <ColorBlock
            key={color.id}
            color={color}
            onUpdate={updates => update(color.id, updates)}
            onRemove={() => remove(color.id)}
            showRemove={colors.length > 1}
          />
        ))}
      </div>

      {/* Franja de paleta compacta */}
      {colors.length > 0 && (
        <div className="rounded-xl overflow-hidden h-8 flex">
          {colors.map(c => (
            <div
              key={c.id}
              className="flex-1"
              style={{ background: c.hex }}
              title={`${c.label} · ${c.hex}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
