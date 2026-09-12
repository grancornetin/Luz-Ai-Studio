import React, { useState, useEffect } from 'react';
import { Home, Plus, Bell, MessageCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomSheet } from './BottomSheet';
import { useNotifications } from '../../hooks/useNotifications';

interface MobileBottomNavProps {
  /** Mantenido por compatibilidad con llamadas existentes (no se usa). */
  onSearchOpen?: () => void;
}

/**
 * Navegación móvil flotante: píldora con 4 accesos — Inicio · Crear ·
 * Notificaciones · Asistente — sobre el contenido, no una barra fija de
 * ancho completo. "Crear" abre el BottomSheet con todos los módulos.
 * "Notificaciones" lleva a /notifications. "Asistente" dispara un
 * CustomEvent global que el AppAssistant escucha. El acceso al perfil
 * queda disponible desde el menú de tabs del dashboard.
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

  const handleAssistantClick = () => {
    window.dispatchEvent(new CustomEvent('app:assistant:toggle'));
  };

  const itemClass = (active: boolean) =>
    `relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-150 ${
      active
        ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_6px_16px_rgba(247,44,91,0.35)]'
        : 'text-slate-500 active:bg-slate-100'
    }`;

  return (
    <>
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 md:hidden"
        style={{ marginBottom: 'calc(0.9rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-1 bg-white/95 backdrop-blur-lg border border-slate-200/80 rounded-full p-1.5 shadow-[0_10px_32px_rgba(23,20,23,0.16)]">
          {/* INICIO */}
          <button
            aria-label="Ir al inicio"
            aria-current={isActive('/dashboard') ? 'page' : undefined}
            onClick={() => navigate('/dashboard')}
            style={{ touchAction: 'manipulation' }}
            className={itemClass(isActive('/dashboard'))}
          >
            <Home size={20} fill={isActive('/dashboard') ? 'currentColor' : 'none'} strokeWidth={isActive('/dashboard') ? 0 : 2} />
          </button>

          {/* CREAR */}
          <button
            aria-label="Crear contenido"
            onClick={() => setSheetOpen(true)}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-slate-900 text-white active:scale-95 transition-transform duration-150"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>

          {/* NOTIFICACIONES */}
          <button
            aria-label={unreadCount > 0 ? `Notificaciones (${unreadCount} sin leer)` : 'Notificaciones'}
            aria-current={isActive('/notifications') ? 'page' : undefined}
            onClick={() => navigate('/notifications')}
            style={{ touchAction: 'manipulation' }}
            className={itemClass(isActive('/notifications'))}
          >
            <Bell size={20} fill={isActive('/notifications') ? 'currentColor' : 'none'} strokeWidth={isActive('/notifications') ? 0 : 2} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-md"
                aria-hidden="true"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* ASISTENTE */}
          <button
            aria-label="Abrir asistente"
            aria-pressed={assistantOpen}
            onClick={handleAssistantClick}
            style={{ touchAction: 'manipulation' }}
            className={itemClass(assistantOpen)}
          >
            <MessageCircle size={20} fill={assistantOpen ? 'currentColor' : 'none'} strokeWidth={assistantOpen ? 0 : 2} />
          </button>
        </div>
      </nav>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
};
