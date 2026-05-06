import React, { useState } from 'react';
import { ReferenceSlot } from '../types/promptTypes';
import { Upload, Trash2, Lock, Unlock, ChevronDown } from 'lucide-react';

interface Props {
  slots: ReferenceSlot[];
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  usedTokens?: string[];
  onToggleLock?: (id: string) => void;
  onSetPriority?: (id: string, priority: 'low' | 'medium' | 'high') => void;
}

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'L', fullLabel: 'Baja',  color: 'bg-slate-500 text-white' },
  { value: 'medium', label: 'M', fullLabel: 'Media', color: 'bg-amber-500 text-white' },
  { value: 'high',   label: 'H', fullLabel: 'Alta',  color: 'bg-brand-600 text-white' },
] as const;

// ── Slot individual (versión expandida para mobile) ──────────────────
const RefSlotCard: React.FC<{
  slot: ReferenceSlot;
  index: number;
  isActive: boolean;
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onSetPriority?: (id: string, priority: 'low' | 'medium' | 'high') => void;
}> = ({ slot, index, isActive, onUpload, onRemove, onToggleLock, onSetPriority }) => {
  const [priorityOpen, setPriorityOpen] = useState(false);
  const token = slot.role || '';

  if (!slot.imageUrl) {
    return (
      <label className="cursor-pointer flex-shrink-0 w-[140px] sm:w-auto flex flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 text-[11px] font-semibold hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-all"
        style={{ aspectRatio: '4/5' }}
      >
        <input type="file" hidden accept="image/*"
          onChange={e => { if (e.target.files?.[0]) onUpload(slot.id, e.target.files[0]); }}
        />
        <Upload className="w-5 h-5" />
        <span>Subir</span>
        <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">Ref {index + 1}</span>
      </label>
    );
  }

  const currentPriority = PRIORITY_OPTIONS.find(p => p.value === slot.priority);

  return (
    <div className={`flex-shrink-0 w-[160px] sm:w-auto flex flex-col gap-2 rounded-[22px] transition-all`}
      style={{ minWidth: 160 }}
    >
      {/* Imagen */}
      <div className={`relative rounded-[20px] overflow-hidden border-2 transition-all ${
        isActive
          ? 'border-brand-400 shadow-[0_0_0_3px_rgba(255,116,139,0.15)]'
          : 'border-slate-200'
      }`} style={{ aspectRatio: '4/5' }}>
        <img src={slot.imageUrl} alt={token} className="w-full h-full object-cover" />

        {/* Token tag */}
        <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md">
          @{token || `ref${index + 1}`}
        </div>

        {/* "en uso" badge */}
        {isActive && (
          <div className="absolute bottom-2 left-2 bg-[#E4F1AC] text-slate-800 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
            en uso
          </div>
        )}
      </div>

      {/* Controles compactos */}
      <div className="flex items-center gap-1.5 px-0.5">
        {/* Lock */}
        <button
          onClick={() => onToggleLock?.(slot.id)}
          title={slot.locked ? 'Desbloquear' : 'Bloquear'}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
            slot.locked
              ? 'bg-brand-100 text-brand-600'
              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
          }`}
        >
          {slot.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>

        {/* Priority dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => setPriorityOpen(o => !o)}
            className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
              currentPriority ? currentPriority.color : 'bg-slate-100 text-slate-400'
            }`}
          >
            <span>{currentPriority?.fullLabel ?? 'Prior.'}</span>
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {priorityOpen && (
            <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xl z-20">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => { onSetPriority?.(slot.id, p.value); setPriorityOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 transition-colors ${
                    slot.priority === p.value ? 'text-brand-600' : 'text-slate-600'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white ${p.color}`}>
                    {p.label}
                  </span>
                  {p.fullLabel}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Eliminar */}
        <button
          onClick={() => onRemove(slot.id)}
          title="Eliminar"
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-xl transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ── ReferenceSlots principal ─────────────────────────────────────────
const ReferenceSlots: React.FC<Props> = ({
  slots, onUpload, onRemove, usedTokens = [], onToggleLock, onSetPriority,
}) => {
  return (
    <>
      {/* Mobile: scroll horizontal */}
      <div className="sm:hidden -mx-2 px-2">
        <div className="flex gap-3 overflow-x-auto pb-2"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          {slots.map((slot, i) => (
            <div key={slot.id} style={{ scrollSnapAlign: 'start' }}>
              <RefSlotCard
                slot={slot}
                index={i}
                isActive={usedTokens.includes(slot.role || '')}
                onUpload={onUpload}
                onRemove={onRemove}
                onToggleLock={onToggleLock}
                onSetPriority={onSetPriority}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: grid 4 columnas */}
      <div className="hidden sm:grid grid-cols-4 gap-3">
        {slots.map((slot, i) => {
          const token    = slot.role || '';
          const isActive = usedTokens.includes(token);

          if (!slot.imageUrl) {
            return (
              <label key={slot.id}
                className="cursor-pointer flex flex-col items-center justify-center gap-2 aspect-[4/5] rounded-[22px] border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 text-[11px] font-semibold hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-all"
              >
                <input type="file" hidden accept="image/*"
                  onChange={e => { if (e.target.files?.[0]) onUpload(slot.id, e.target.files[0]); }}
                />
                <Upload className="w-5 h-5" />
                <span>Subir ref</span>
              </label>
            );
          }

          return (
            <div key={slot.id} className="flex flex-col gap-2">
              <div className={`relative aspect-[4/5] rounded-[22px] overflow-hidden border-2 transition-all ${
                isActive ? 'border-brand-400 shadow-[0_0_0_3px_rgba(255,116,139,0.15)]' : 'border-transparent'
              }`}>
                <img src={slot.imageUrl} alt={token} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                  @{token}
                </div>
                {slot.locked && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-white/95 rounded-full flex items-center justify-center shadow">
                    <Lock className="w-2.5 h-2.5 text-brand-600" />
                  </div>
                )}
                {slot.priority && (
                  <div className="absolute bottom-2 right-2 w-5 h-5 bg-white/95 rounded-full flex items-center justify-center shadow text-[9px] font-black text-slate-700">
                    {PRIORITY_OPTIONS.find(p => p.value === slot.priority)?.label ?? '–'}
                  </div>
                )}
                {isActive && (
                  <div className="absolute bottom-2 left-2 bg-[#E4F1AC] text-slate-800 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full">
                    en uso
                  </div>
                )}
              </div>
              {/* Controles desktop */}
              <div className="flex items-center justify-between gap-1 px-0.5">
                <button onClick={() => onToggleLock?.(slot.id)}
                  className={`p-2 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-xl transition-all ${
                    slot.locked ? 'bg-brand-100 text-brand-600' : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>
                <div className="flex gap-0.5 flex-1">
                  {PRIORITY_OPTIONS.map(p => (
                    <button key={p.value} onClick={() => onSetPriority?.(slot.id, p.value)}
                      className={`flex-1 text-[9px] font-black uppercase py-1.5 rounded-lg transition-all ${
                        slot.priority === p.value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => onRemove(slot.id)}
                  className="p-2 min-h-[32px] min-w-[32px] flex items-center justify-center hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-xl transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default ReferenceSlots;
