import React from 'react';
import { ReferenceSlot } from '../types/promptTypes';
import { Upload, Trash2, Lock } from 'lucide-react';

interface Props {
  slots: ReferenceSlot[];
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  usedTokens?: string[];

  // 🔧 NUEVO (ya existen en hook)
  onToggleLock?: (id: string) => void;
  onSetPriority?: (id: string, priority: 'low' | 'medium' | 'high') => void;
}

const getBadgeColor = (type: string) => {
  if (type === 'person') return "bg-violet-100 text-violet-600";
  if (type === 'product') return "bg-emerald-100 text-emerald-600";
  return "bg-slate-100 text-slate-600";
};

const ReferenceSlots: React.FC<Props> = ({
  slots,
  onUpload,
  onRemove,
  usedTokens = [],
  onToggleLock,
  onSetPriority
}) => {

  return (

    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">

      {slots.map((slot) => {

        const token = slot.role || '';
        const label = slot.label || token.toUpperCase();
        const badgeColor = getBadgeColor(slot.type);

        const isActive = usedTokens.includes(token);

        return (

          <div key={slot.id} className="flex flex-col gap-2">

            {/* etiqueta */}
            <div
              className={`px-3 py-1 rounded-lg text-xs font-black tracking-widest w-fit ${badgeColor}`}
            >
              {label}
            </div>

            {/* slot */}
            <div
              className={`relative aspect-[3/4] rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-slate-50
              ${isActive ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200"}
              `}
            >

              {slot.imageUrl ? (

                <img
                  src={slot.imageUrl}
                  className="w-full h-full object-contain p-2"
                />

              ) : (

                <label className="cursor-pointer flex items-center justify-center w-full h-full">

                  <input
                    type="file"
                    hidden
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        onUpload(slot.id, e.target.files[0]);
                      }
                    }}
                  />

                  <Upload className="w-7 h-7 text-slate-400" />

                </label>

              )}

            </div>

            {/* acciones */}
            {slot.imageUrl && (

              <div className="flex flex-col gap-2 px-1">

                <div className="flex items-center justify-between">

                  {/* 🔒 LOCK FUNCIONAL */}
                  <button
                    onClick={() => onToggleLock?.(slot.id)}
                    className={`p-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-all ${
                      slot.locked
                        ? 'bg-brand-100 text-brand-600'
                        : 'text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <Lock className="w-5 h-5" />
                  </button>

                  {/* eliminar */}
                  <button
                    onClick={() => onRemove(slot.id)}
                    className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-100 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5 text-slate-600" />
                  </button>

                </div>

                {/* 🔥 PRIORIDAD */}
                <div className="flex gap-1">

                  {['low', 'medium', 'high'].map((p) => (

                    <button
                      key={p}
                      onClick={() => onSetPriority?.(slot.id, p as any)}
                      className={`flex-1 text-xs font-black uppercase tracking-widest py-2.5 rounded-xl transition-all ${
                        slot.priority === p
                          ? 'bg-brand-600 text-white shadow-lg shadow-brand-100'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {p}
                    </button>

                  ))}

                </div>

              </div>

            )}

          </div>

        );

      })}

    </div>

  );

};

export default ReferenceSlots;