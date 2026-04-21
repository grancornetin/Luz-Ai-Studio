import { useState, useEffect, useCallback } from 'react';

interface UseScrollFABOptions {
  threshold?: number;        // píxeles scrolldeados para mostrar (default 100)
  alwaysVisibleOnMobile?: boolean; // si true, se muestra siempre en móvil (default false)
}

export const useScrollFAB = (options: UseScrollFABOptions = {}) => {
  const { threshold = 100, alwaysVisibleOnMobile = false } = options;
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const handleScroll = useCallback(() => {
    const scrolled = window.scrollY;
    setIsVisible(scrolled > threshold);
  }, [threshold]);

  useEffect(() => {
    // Detectar mobile por user agent o ancho (puedes ajustar)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Si siempre visible en mobile, forzar true
    if (alwaysVisibleOnMobile && isMobile) {
      setIsVisible(true);
      return () => {};
    }

    handleScroll(); // estado inicial
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', checkMobile);
    };
  }, [handleScroll, alwaysVisibleOnMobile, isMobile]);

  // Si siempre visible en mobile, retorna true cuando es mobile
  const finalVisible = alwaysVisibleOnMobile && isMobile ? true : isVisible;

  return { isVisible: finalVisible, isMobile };
};