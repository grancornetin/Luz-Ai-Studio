import React, { useState } from 'react';
import { ReferenceSlot } from '../types/promptTypes';
import { Upload, Trash2, Lock, Unlock, User, ShoppingBag, Shirt, MapPin, ChevronDown } from 'lucide-react';

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

// ── Etiquetas y colores por tipo ──────────────────────────────
const TYPE_META = {
  person:  { icon: <User className="w-3 h-3" />,        color: 'border-indigo-200 bg-indigo-50',   badge: 'bg-indigo-600',   tokenColor: 'text-indigo-300',  label: 'Persona',  hint: 'Foto del rostro o cuerpo. Se preserva la identidad facial.' },
  outfit:  { icon: <Shirt className="w-3 h-3" />,       color: 'border-violet-200 bg-violet-50',   badge: 'bg-violet-600',   tokenColor: 'text-violet-300',  label: 'Outfit',   hint: 'Foto de la ropa. Se aplica al cuerpo de la persona preservando sus proporciones.' },
  product: { icon: <ShoppingBag className="w-3 h-3" />, color: 'border-emerald-200 bg-emerald-50', badge: 'bg-emerald-600',  tokenColor: 'text-emerald-300', label: 'Producto', hint: 'Foto del producto. Se integra a la escena como objeto.' },
  scene:   { icon: <MapPin className="w-3 h-3" />,      color: 'border-amber-200 bg-amber-50',     badge: 'bg-amber-600',    tokenColor: 'text-amber-300',   label: 'Escena',   hint: 'Foto de ambiente o locación. Define el contexto visual sin reemplazar personas ni productos.' },
};

// ── Slot individual ───────────────────────────────────────────
const SlotCard: React.FC<{
  slot: ReferenceSlot;
  isActive: boolean;
  compact?: boolean;
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onSetPriority?: (id: string, priority: 'low' | 'medium' | 'high') => void;
}> = ({ slot, isActive, compact = false, onUpload, onRemove, onToggleLock, onSetPriority }) => {
  const [priorityOpen, setPriorityOpen] = useState(false);
  const meta = TYPE_META[slot.type] ?? TYPE_META.product;
  const token = slot.role || '';

  if (!slot.imageUrl) {
    return (
      <label
        className={`cursor-pointer flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed transition-all ${meta.color} hover:opacity-80`}
        style={{ aspectRatio: '4/5' }}
        title={meta.hint}
      >
        <input type="file" hidden accept="image/*"
          onChange={e => { if (e.target.files?.[0]) onUpload(slot.id, e.target.files[0]); }}
        />
        <div className="w-7 h-7 rounded-xl bg-white/60 flex items-center justify-center">
          {meta.icon}
        </div>
        {!compact && (
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider text-center px-1 leading-tight">
            {slot.label}
          </span>
        )}
      </label>
    );
  }

  const currentPriority = PRIORITY_OPTIONS.find(p => p.value === slot.priority);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Imagen */}
      <div
        className={`relative rounded-2xl overflow-hidden border-2 transition-all ${
          isActive ? 'border-brand-400 shadow-[0_0_0_3px_rgba(255,116,139,0.15)]' : 'border-white/60'
        }`}
        style={{ aspectRatio: '4/5' }}
      >
        <img src={slot.imageUrl} alt={token} className="w-full h-full object-cover" />

        {/* Token tag */}
        <div className={`absolute top-1.5 left-1.5 ${meta.badge} text-white font-mono text-[8px] font-bold px-1.5 py-0.5 rounded-md`}>
          @{token}
        </div>

        {/* Lock indicator */}
        {slot.locked && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-white/90 rounded-full flex items-center justify-center shadow">
            <Lock className="w-2.5 h-2.5 text-brand-600" />
          </div>
        )}

        {/* En uso badge */}
        {isActive && (
          <div className="absolute bottom-1.5 left-1.5 bg-[#E4F1AC] text-slate-800 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full">
            en uso
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onToggleLock?.(slot.id)}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all flex-shrink-0 ${
            slot.locked ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
          }`}
          title={slot.locked ? 'Desbloquear' : 'Bloquear identidad'}
        >
          {slot.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
        </button>

        {/* Priority */}
        <div className="relative flex-1">
          <button
            onClick={() => setPriorityOpen(o => !o)}
            className={`w-full flex items-center justify-between gap-0.5 px-1.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide transition-all ${
              currentPriority ? currentPriority.color : 'bg-slate-100 text-slate-400'
            }`}
          >
            <span>{currentPriority?.label ?? 'P'}</span>
            <ChevronDown className="w-2 h-2" />
          </button>
          {priorityOpen && (
            <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xl z-20 min-w-[80px]">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => { onSetPriority?.(slot.id, p.value); setPriorityOpen(false); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-[9px] font-black uppercase hover:bg-slate-50 transition-colors ${
                    slot.priority === p.value ? 'text-brand-600' : 'text-slate-600'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] text-white ${p.color}`}>{p.label}</span>
                  {p.fullLabel}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onRemove(slot.id)}
          className="w-7 h-7 flex items-center justify-center hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-lg transition-all flex-shrink-0"
          title="Eliminar"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────
const ReferenceSlots: React.FC<Props> = ({
  slots, onUpload, onRemove, usedTokens = [], onToggleLock, onSetPriority,
}) => {
  const isActive = (slot: ReferenceSlot) => usedTokens.includes(slot.role || '');

  // Agrupar slots por índice de persona (1-4)
  const personGroups = [1, 2, 3, 4].map(idx => ({
    idx,
    person: slots.find(s => s.type === 'person' && s.personIndex === idx || s.id === `person-${idx}`),
    outfit: slots.find(s => s.type === 'outfit' && s.personIndex === idx),
  }));

  const productSlots = slots.filter(s => s.type === 'product');
  const sceneSlot    = slots.find(s => s.type === 'scene');

  const hasAnyPerson  = personGroups.some(g => g.person?.imageUrl);
  const hasAnyProduct = productSlots.some(s => s.imageUrl);

  return (
    <div className="space-y-5">

      {/* ── PERSONAS + OUTFITS ──────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-indigo-100 rounded-lg flex items-center justify-center">
            <User className="w-3 h-3 text-indigo-600" />
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Personas y outfits</p>
        </div>
        <p className="text-[10px] text-slate-400 leading-snug">
          Cada persona puede tener su outfit asignado. La ropa se adapta a las proporciones del cuerpo.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {personGroups.map(({ idx, person, outfit }) => (
            <div key={idx} className="space-y-1.5">
              {/* Etiqueta de grupo */}
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">P{idx}</p>

              {/* Persona */}
              {person && (
                <SlotCard
                  slot={person}
                  isActive={isActive(person)}
                  onUpload={onUpload}
                  onRemove={onRemove}
                  onToggleLock={onToggleLock}
                  onSetPriority={onSetPriority}
                />
              )}

              {/* Outfit — solo visible si la persona está activa */}
              {outfit && (
                <div className={`transition-all ${person?.imageUrl ? 'opacity-100' : 'opacity-40'}`}>
                  <SlotCard
                    slot={outfit}
                    isActive={isActive(outfit)}
                    onUpload={onUpload}
                    onRemove={onRemove}
                    onToggleLock={onToggleLock}
                    onSetPriority={onSetPriority}
                  />
                </div>
              )}

              {/* Hint de outfit cuando persona está cargada pero sin outfit */}
              {person?.imageUrl && !outfit?.imageUrl && (
                <label className="cursor-pointer flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/50 transition-all hover:border-violet-400 hover:bg-violet-50"
                  style={{ aspectRatio: '4/5' }}
                  title="Agregar outfit para esta persona"
                >
                  <input type="file" hidden accept="image/*"
                    onChange={e => { if (e.target.files?.[0] && outfit) onUpload(outfit.id, e.target.files[0]); }}
                  />
                  <Shirt className="w-4 h-4 text-violet-400" />
                  <span className="text-[8px] font-black text-violet-400 uppercase">Outfit</span>
                </label>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── PRODUCTOS ──────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-emerald-100 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-3 h-3 text-emerald-600" />
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Productos</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {productSlots.map(slot => (
            <SlotCard
              key={slot.id}
              slot={slot}
              isActive={isActive(slot)}
              onUpload={onUpload}
              onRemove={onRemove}
              onToggleLock={onToggleLock}
              onSetPriority={onSetPriority}
            />
          ))}
        </div>
      </section>

      {/* ── ESCENA ────────────────────────────────────── */}
      {sceneSlot && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-amber-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-3 h-3 text-amber-600" />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Escena / Ambiente</p>
          </div>
          <p className="text-[10px] text-slate-400 leading-snug">
            Foto de un lugar o ambiente. La IA extrae el contexto visual sin reemplazar personas ni objetos.
          </p>
          <div className="w-1/4">
            <SlotCard
              slot={sceneSlot}
              isActive={isActive(sceneSlot)}
              onUpload={onUpload}
              onRemove={onRemove}
              onToggleLock={onToggleLock}
              onSetPriority={onSetPriority}
            />
          </div>
        </section>
      )}

    </div>
  );
};

export default ReferenceSlots;
