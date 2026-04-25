import React from 'react';
import { ReferenceSlot } from '../types/promptTypes';
import { Lock, Unlock, X } from 'lucide-react';

interface Props {
  slots: ReferenceSlot[];
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  usedTokens?: string[];
  onToggleLock?: (id: string) => void;
  onSetPriority?: (id: string, priority: 'low' | 'medium' | 'high') => void;
}

const TYPE_STYLE: Record<string, { badge: string; border: string; glow: string }> = {
  person:  { badge: 'bg-violet-500/15 text-violet-300 border-violet-500/20',  border: 'border-violet-500/30',  glow: 'shadow-violet-500/20' },
  product: { badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/20', border: 'border-fuchsia-500/30', glow: 'shadow-fuchsia-500/20' },
  style:   { badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',         border: 'border-cyan-500/30',    glow: 'shadow-cyan-500/20' },
};

const TYPE_ICONS: Record<string, string> = {
  person: 'fa-user', product: 'fa-gem', style: 'fa-palette',
};

const ReferenceSlots: React.FC<Props> = ({ slots, onUpload, onRemove, usedTokens = [], onToggleLock, onSetPriority }) => {
  const persons  = slots.filter(s => s.type === 'person');
  const products = slots.filter(s => s.type === 'product');
  const styles   = slots.filter(s => s.type === 'style');

  const renderGroup = (label: string, groupSlots: ReferenceSlot[], icon: string) => {
    const activeCount = groupSlots.filter(s => s.imageUrl).length;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <i className={`fa-solid ${icon} text-[9px] text-white/20`} />
          <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">{label}</p>
          {activeCount > 0 && (
            <span className="text-[8px] font-black text-violet-400/60 bg-violet-500/10 px-1.5 py-0.5 rounded-md uppercase">{activeCount} activo{activeCount > 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {groupSlots.map(slot => {
            const ts = TYPE_STYLE[slot.type] || TYPE_STYLE.style;
            const isActive = usedTokens.includes(slot.role || '');

            return (
              <div key={slot.id} className="space-y-2">
                <div className={`relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all ${
                  slot.imageUrl
                    ? `border-solid ${ts.border} shadow-lg ${ts.glow}`
                    : 'border-dashed border-white/[0.08] hover:border-white/[0.15]'
                } ${isActive ? 'ring-1 ring-violet-500/30' : ''}`}>

                  {slot.imageUrl ? (
                    <>
                      <img src={slot.imageUrl} className="w-full h-full object-cover" />
                      {slot.locked && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-violet-600 rounded-lg flex items-center justify-center shadow-lg">
                          <Lock size={10} className="text-white" />
                        </div>
                      )}
                      <button onClick={() => onRemove(slot.id)}
                        className="absolute top-2 left-2 w-6 h-6 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity touch-target">
                        <X size={11} className="text-white" />
                      </button>
                    </>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer group">
                      <input type="file" hidden accept="image/*"
                        onChange={e => { if (e.target.files?.[0]) onUpload(slot.id, e.target.files[0]); }}
                      />
                      <i className={`fa-solid ${TYPE_ICONS[slot.type]} text-white/10 group-hover:text-white/25 text-xl transition-colors`} />
                      <p className="text-[7px] font-black text-white/10 group-hover:text-white/20 uppercase tracking-wider mt-1.5 transition-colors">
                        {slot.label}
                      </p>
                    </label>
                  )}
                </div>

                <div className="flex items-center justify-between px-0.5">
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border ${ts.badge}`}>
                    {slot.label}
                  </span>
                  {isActive && <span className="text-[7px] font-black text-violet-400/60 uppercase">activo</span>}
                </div>

                {slot.imageUrl && (
                  <div className="space-y-1.5">
                    <button onClick={() => onToggleLock?.(slot.id)}
                      className={`w-full py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 touch-target ${
                        slot.locked
                          ? 'bg-violet-500/20 border border-violet-500/25 text-violet-300'
                          : 'bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/60'
                      }`}
                    >
                      {slot.locked ? <Lock size={10} /> : <Unlock size={10} />}
                      {slot.locked ? 'Locked' : 'Lock'}
                    </button>

                    <div className="flex gap-1">
                      {(['low', 'medium', 'high'] as const).map(p => (
                        <button key={p} onClick={() => onSetPriority?.(slot.id, p)}
                          className={`flex-1 py-1.5 rounded-lg text-[7px] font-black uppercase tracking-wide transition-all touch-target ${
                            slot.priority === p
                              ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30'
                              : 'bg-white/[0.03] text-white/20 hover:text-white/50 border border-white/[0.05]'
                          }`}
                        >
                          {p[0].toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-images text-violet-400 text-[10px]" />
        </div>
        <h3 className="text-xs font-black text-white/50 uppercase tracking-widest">Referencias Visuales</h3>
        <span className="text-[9px] text-white/20 font-bold ml-1">{slots.filter(s => s.imageUrl).length}/{slots.length} activas</span>
      </div>
      {renderGroup('Personas', persons, 'fa-user')}
      {renderGroup('Productos', products, 'fa-gem')}
      {renderGroup('Estilo', styles, 'fa-palette')}
    </div>
  );
};

export default ReferenceSlots;
