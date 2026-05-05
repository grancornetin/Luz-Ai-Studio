import React, { useState, useEffect } from 'react';
import { Home, PlusSquare, Bell, MessageCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomSheet } from './BottomSheet';
import { useNotifications } from '../../hooks/useNotifications';

interface MobileBottomNavProps {
  /** Mantenido por compatibilidad con llamadas existentes (no se usa). */
  onSearchOpen?: () => void;
}

/**
 * Bottom navigation móvil con 4 botones: Inicio · Crear · Notificaciones · Asistente.
 * - "Crear" abre el BottomSheet con todos los módulos.
 * - "Notificaciones" lleva a /historial (donde queda registro de generaciones).
 * - "Asistente" dispara un CustomEvent global que el AppAssistant escucha.
 *   El acceso al perfil queda disponible desde el menú de tabs del dashboard.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const { unreadCount } = useNotifications();

  // Sincronizar el estado visual del botón con el del AppAssistant.
  useEffect(() => {
    const handleStateChange = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail;
      if (detail) setAssistantOpen(detail.open);
    };
    window.addEventListener('app:assistant:state', handleStateChange);
    return () => window.removeEventListener('app:assistant:state', handleStateChange);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const btnClass = (active: boolean) =>
    `flex flex-col items-center gap-1 px-3 py-1 transition-colors duration-150 ${
      active ? 'text-violet-600' : 'text-slate-400'
    }`;
  const labelClass = (active: boolean) =>
    `text-xs font-black uppercase tracking-widest ${active ? 'text-violet-600' : 'text-slate-400'}`;

  const handleAssistantClick = () => {
    window.dispatchEvent(new CustomEvent('app:assistant:toggle'));
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 flex justify-around items-center py-2 md:hidden z-50"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {/* INICIO */}
        <button
          aria-label="Ir al inicio"
          aria-current={isActive('/dashboard') ? 'page' : undefined}
          onClick={() => navigate('/dashboard')}
          style={{ touchAction: 'manipulation' }}
          className={btnClass(isActive('/dashboard'))}
        >
          <Home size={isActive('/dashboard') ? 24 : 22} />
          <span className={labelClass(isActive('/dashboard'))}>Inicio</span>
        </button>

        {/* CREAR */}
        <button
          aria-label="Crear contenido"
          onClick={() => setSheetOpen(true)}
          style={{ touchAction: 'manipulation' }}
          className={btnClass(false)}
        >
          <PlusSquare size={22} />
          <span className={labelClass(false)}>Crear</span>
        </button>

        {/* NOTIFICACIONES */}
        <button
          aria-label={unreadCount > 0 ? `Notificaciones (${unreadCount} sin leer)` : 'Notificaciones'}
          aria-current={isActive('/notifications') ? 'page' : undefined}
          onClick={() => navigate('/notifications')}
          style={{ touchAction: 'manipulation' }}
          className={`${btnClass(isActive('/notifications'))} relative`}
        >
          <div className="relative">
            <Bell size={isActive('/notifications') ? 24 : 22} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center shadow-md"
                aria-hidden="true"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className={labelClass(isActive('/notifications'))}>Avisos</span>
        </button>

        {/* ASISTENTE */}
        <button
          aria-label="Abrir asistente"
          aria-pressed={assistantOpen}
          onClick={handleAssistantClick}
          style={{ touchAction: 'manipulation' }}
          className={btnClass(assistantOpen)}
        >
          <MessageCircle size={assistantOpen ? 24 : 22} />
          <span className={labelClass(assistantOpen)}>Asistente</span>
        </button>
      </nav>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
};
