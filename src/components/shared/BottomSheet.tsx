import React from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const modules = [
  { name: 'Crear modelo',     tech: 'Model DNA',         icon: '👤', path: '/crear/clonar',      cost: '8 cr' },
  { name: 'Foto producto',    tech: 'Product Studio',    icon: '📸', path: '/productos',          cost: '2 cr' },
  { name: 'Contenido redes',  tech: 'UGC Studio',        icon: '📱', path: '/studio-pro',         cost: '6-14 cr' },
  { name: 'Generador con IA', tech: 'Prompt Studio',     icon: '✨', path: '/prompt-studio',      cost: '2 cr' },
  { name: 'Clonar escena',    tech: 'Scene Clone',       icon: '🖼️', path: '/clonar',             cost: '2 cr' },
  { name: 'Extraer prendas',  tech: 'Outfit Extractor',  icon: '👕', path: '/outfit-extractor',   cost: '0 cr' },
];

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose }) => {
  const navigate = useNavigate();

  if (!open) return null;

  const handleModuleClick = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-[100] md:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom-full duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Crear nuevo contenido</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {modules.map((mod) => (
            <button
              key={mod.path}
              onClick={() => handleModuleClick(mod.path)}
              className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 active:scale-95 transition-all"
            >
              <span className="text-3xl">{mod.icon}</span>
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight text-center leading-tight">{mod.name}</span>
              <span className="text-[9px] font-medium text-slate-300 normal-case tracking-normal">({mod.tech})</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{mod.cost}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
