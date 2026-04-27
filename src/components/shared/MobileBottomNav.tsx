import React, { useState } from 'react';
import { Home, PlusSquare, Search, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomSheet } from './BottomSheet';

interface MobileBottomNavProps {
  onSearchOpen?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onSearchOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const btnClass = (path: string) =>
    `flex flex-col items-center gap-1 px-3 py-1 ${isActive(path) ? 'text-indigo-600' : 'text-slate-400'}`;

  const iconSize = (path: string) => (isActive(path) ? 24 : 22);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 flex justify-around items-center py-2 md:hidden z-50"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        <button onClick={() => navigate('/dashboard')} className={btnClass('/dashboard')}>
          <Home size={iconSize('/dashboard')} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${isActive('/dashboard') ? 'text-indigo-600' : 'text-slate-400'}`}>Inicio</span>
        </button>

        <button
          onClick={() => setSheetOpen(true)}
          className="flex flex-col items-center gap-1 px-3 py-1 text-slate-400"
        >
          <PlusSquare size={22} />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Crear</span>
        </button>

        <button
          onClick={() => onSearchOpen?.()}
          className="flex flex-col items-center gap-1 px-3 py-1 text-slate-400"
        >
          <Search size={22} />
          <span className="text-[10px] font-black uppercase tracking-widest">Buscar</span>
        </button>

        <button onClick={() => navigate('/cuenta')} className={btnClass('/cuenta')}>
          <User size={iconSize('/cuenta')} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${isActive('/cuenta') ? 'text-indigo-600' : 'text-slate-400'}`}>Perfil</span>
        </button>
      </nav>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
};
