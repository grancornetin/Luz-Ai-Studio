import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Zap, Star, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useCurrency } from '../hooks/useCurrency';

// ─────────────────────────────────────────────────────────────────────────────
// Landing.tsx v2.0 — Dark AI-Native Theme
// Props: onOpenAuth() → abre AuthModal
// Imágenes: /public/images/landing/**  (copiar carpeta v2imgs allí)
// ─────────────────────────────────────────────────────────────────────────────

const IMG = (path: string) => `/images/landing/${path}`;

// ── HERO IMAGES (portrait ratio 9:16, shown in phone cards) ──────────────────
const HERO_KEYS = [
  'hero_h7','hero_u6','hero_h5','hero_u3b','hero_h6',
  'hero_u2','hero_u6a','hero_h8','hero_u3','hero_h3',
  'hero_u3a','hero_h9','hero_u7','hero_h4','hero_u7a',
  'hero_h1','hero_u7b','hero_h2','hero_u7c',
];

// ── MODULE DATA ───────────────────────────────────────────────────────────────
const MODULES = [
  {
    id: 'dna',
    icon: 'fa-dna',
    accent: '#A78BFA',
    accentBg: 'rgba(124,58,237,0.12)',
    name: 'Model DNA',
    sub: 'Identidad Digital',
    desc: 'Extrae el ADN biométrico de fotos reales y crea un gemelo digital con fidelidad persistente — o diseña un modelo desde cero con parámetros precisos.',
    features: ['Set de 4 planos técnicos', 'Identidad persistente en todos los módulos', 'From Photos o From Scratch', 'Biblioteca de modelos'],
    refs:    [{ src: IMG('dna_ref.jpg'), label: 'Referencia' }],
    results: [{ src: IMG('dna_p1.jpg'), label: 'P1 Bodymaster' }, { src: IMG('dna_p2.jpg'), label: 'P2 Rear' }, { src: IMG('dna_p3.jpg'), label: 'P3 Side' }, { src: IMG('dna_p4.jpg'), label: 'P4 Facemaster' }],
  },
  {
    id: 'gen',
    icon: 'fa-wand-magic-sparkles',
    accent: '#E879F9',
    accentBg: 'rgba(232,121,249,0.12)',
    name: 'AI Generator',
    sub: 'Generación Avanzada',
    desc: 'Prompts estructurados con identidad persistente. Configura modelo, outfit, producto y escena — resultados con coherencia visual total.',
    features: ['Prompt Studio con slots de referencia', 'Identidad consistente en cada resultado', 'Biblioteca de prompts comunitarios', 'Múltiples estilos y aspectos'],
    prompt: 'A studio-style close-up editorial portrait of a person with strong, well-defined facial features and slightly imperfect, natural skin texture. The subject wears a black tailored turtleneck, layered under a high-collared black jacket. Selective color photography — monochrome black-and-white image with only the sunglasses in vivid orange. Mood is calm and confident, direct gaze. Lighting: soft frontal studio light, cinematic contrast. Shot on a professional portrait camera, f/2.0, ISO 100, 1/125s.',
    refs:    [],
    results: [{ src: IMG('gen1.jpg'), label: 'Resultado 1' }, { src: IMG('gen2.jpg'), label: 'Resultado 2' }],
  },
  {
    id: 'studio',
    icon: 'fa-mobile-screen-button',
    accent: '#F72C5B',
    accentBg: 'rgba(247,44,91,0.12)',
    name: 'Content Studio Pro',
    sub: 'UGC · Identity Lock',
    desc: 'Sesiones completas de contenido UGC estilo iPhone orgánico. El Lock System mantiene identidad, producto y escena 100% consistentes.',
    features: ['Master Anchor + shots derivados', 'Modos Avatar, Producto, Outfit, Escena', 'Checkpoint de validación', 'Descarga ZIP o biblioteca'],
    refs:    [{ src: IMG('cs_avatar.jpg'), label: 'Avatar' }, { src: IMG('cs_product.jpg'), label: 'Producto' }, { src: IMG('cs_scene.jpg'), label: 'Escena' }, { src: IMG('cs_outfit.jpg'), label: 'Outfit' }],
    results: [{ src: IMG('cs_master.jpg'), label: 'Master Anchor' }, { src: IMG('cs_s1.jpg'), label: 'Shot 1' }, { src: IMG('cs_s2.jpg'), label: 'Shot 2' }],
  },
  {
    id: 'clone',
    icon: 'fa-clone',
    accent: '#63B3ED',
    accentBg: 'rgba(99,179,237,0.12)',
    name: 'Scene Clone',
    sub: 'Identity Injection',
    desc: 'Replica cualquier fotografía existente inyectando una nueva identidad digital. Misma escena, misma iluminación — nueva persona.',
    features: ['Clonación biométrica de precisión', 'Soporte para 1 o 2 sujetos', 'Outfit swap opcional'],
    refs:    [{ src: IMG('sc_target.jpg'), label: 'Target' }, { src: IMG('sc_ref.jpg'), label: 'Identidad' }],
    results: [{ src: IMG('sc_result.jpg'), label: 'Resultado' }],
  },
  {
    id: 'outfit',
    icon: 'fa-shirt',
    accent: '#68D391',
    accentBg: 'rgba(104,211,145,0.12)',
    name: 'Outfit Kit',
    sub: 'Ghost Mannequin 3D',
    desc: 'Extrae automáticamente cada prenda de un outfit completo y genera renders Ghost Mannequin 3D individuales. Activos de nivel fashion en segundos.',
    features: ['Detección automática por IA', 'Ghost Mannequin 3D por pieza', 'Selección individual de prendas', 'Kit final compuesto + ZIP'],
    refs:    [{ src: IMG('out_orig.jpg'), label: 'Outfit Original' }],
    results: [{ src: IMG('out_p1.jpg'), label: 'Prenda 1' }, { src: IMG('out_p2.jpg'), label: 'Prenda 2' }, { src: IMG('out_final.jpg'), label: 'Kit Final' }],
  },
  {
    id: 'product',
    icon: 'fa-gem',
    accent: '#F6AD55',
    accentBg: 'rgba(246,173,85,0.12)',
    name: 'Product Studio',
    sub: 'Fotografía Comercial',
    desc: 'Sube fotos reales de tu producto y genera un set de 5 ángulos comerciales con IA. Fotografía profesional sin estudio físico.',
    features: ['Análisis automático del producto', '5 ángulos: Hero, 45°, Funcional, Detalle, Lifestyle', 'Estilo Comercial u Orgánico', 'Catálogo guardado'],
    refs:    [{ src: IMG('prod_ref.jpg'), label: 'Foto Real' }],
    results: [{ src: IMG('prod_hero.jpg'), label: 'Hero Shot' }, { src: IMG('prod_ang.jpg'), label: 'Ángulo' }, { src: IMG('prod_life.jpg'), label: 'Lifestyle' }],
  },
];

// ── PLANS DATA ────────────────────────────────────────────────────────────────
const LANDING_PLANS = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: null,
    period: '/siempre',
    credits: '10 créditos únicos',
    images: '~10 imágenes',
    featured: false,
    features: ['Acceso a todos los módulos', 'Seedream + Gemini', 'Misiones para ganar créditos extra'],
    negative: ['Sin soporte prioritario'],
    cta: 'Registrarme',
  },
  {
    id: 'explorer',
    name: 'Explorer',
    priceMonthly: 4.99,
    priceAnnual: null,
    period: '/semana',
    credits: '60 créditos/semana',
    images: '~60 imágenes',
    featured: false,
    features: ['Todos los módulos', 'Seedream + Gemini', 'Soporte email básico'],
    negative: ['Reveal prompts: 1 crédito'],
    cta: 'Empezar',
  },
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 14.99,
    priceAnnual: 11.99,
    period: '/mes',
    credits: '200 créditos/mes',
    images: '~200 imágenes',
    featured: false,
    features: ['Todo de Explorer', 'Campaign Generator', 'Photodump ilimitado', 'Soporte email prioritario'],
    negative: [],
    cta: 'Empezar',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 39.99,
    priceAnnual: 31.99,
    period: '/mes',
    credits: '500 créditos/mes',
    images: '~500 imágenes',
    featured: true,
    features: ['Todo de Starter', 'Reveal prompts GRATIS', 'Generación prioritaria', 'Soporte <24h'],
    negative: [],
    cta: 'Empezar con Pro',
  },
  {
    id: 'studio',
    name: 'Studio',
    priceMonthly: 99.99,
    priceAnnual: 79.99,
    period: '/mes',
    credits: '1.200 créditos/mes',
    images: '~1.200 imágenes',
    featured: false,
    features: ['Todo de Pro', 'Lotes de hasta 50 imágenes', 'Máxima prioridad', 'Chat dedicado', 'Estadísticas avanzadas'],
    negative: [],
    cta: 'Empezar',
  },
];

// ── FAQ DATA ──────────────────────────────────────────────────────────────────
const FAQS = [
  { q: '¿Necesito experiencia en diseño o IA?', a: 'No. LUZ IA está diseñada para emprendedores y marketers. Sube fotos, ajusta parámetros y obtén resultados profesionales en segundos.' },
  { q: '¿Cómo funcionan los créditos?', a: 'Con tecnología Seedream, 1 crédito = 1 imagen. Módulos más complejos como Content Studio o Model DNA consumen más créditos por el procesamiento multicapa.' },
  { q: '¿Puedo usar las imágenes para publicidad comercial?', a: 'Sí. Las imágenes generadas son tuyas para uso comercial. Debes tener los derechos sobre las referencias que subes.' },
  { q: '¿Funciona para cualquier industria?', a: 'Absolutamente. Moda, gastronomía, belleza, tecnología, retail y más. Cualquier negocio que necesite contenido visual puede usar LUZ IA.' },
  { q: '¿Puedo cancelar mi suscripción?', a: 'Sí. Sin permanencia ni penalizaciones. Cancelas cuando quieras y tu plan sigue activo hasta el fin del período pagado.' },
  { q: '¿Las imágenes de referencia se guardan?', a: 'No. Las imágenes se procesan en tiempo real y no se almacenan en nuestros servidores. Tu privacidad está protegida.' },
];

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left gap-4">
        <span className="text-sm font-black text-white/80 uppercase tracking-tight leading-snug">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-white/30 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />}
      </button>
      {open && <p className="pb-5 text-sm text-white/45 leading-relaxed">{a}</p>}
    </div>
  );
};

const StarRating: React.FC<{ count: number }> = ({ count }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: count }).map((_, i) => (
      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
    ))}
  </div>
);

// Lightbox
const Lightbox: React.FC<{ src: string | null; onClose: () => void }> = ({ src, onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!src) return null;
  return (
    <div
      className="fixed inset-0 z-[999] bg-black/92 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
        <img src={src} alt="" className="w-full max-h-[85dvh] object-contain rounded-2xl border border-white/10" />
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-9 h-9 bg-[#0D0D18] border border-white/15 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-all"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

// Image card (clickable)
const ImgCard: React.FC<{ src: string; label: string; isResult?: boolean; onClick: () => void; className?: string }> = ({ src, label, isResult, onClick, className = '' }) => (
  <div
    onClick={onClick}
    className={`relative rounded-xl overflow-hidden border cursor-pointer transition-all hover:scale-[1.02] ${isResult ? 'border-[#F72C5B]/40 shadow-lg shadow-[#F72C5B]/10' : 'border-white/[0.08] hover:border-white/20'} ${className}`}
  >
    <img src={src} alt={label} className="w-full h-48 object-cover block" loading="lazy" />
    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${isResult ? 'bg-[#F72C5B]/80 text-white' : 'bg-black/70 text-white/60'}`}>
      {label}
    </div>
  </div>
);

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const Landing: React.FC<{ onOpenAuth: () => void }> = ({ onOpenAuth }) => {
  const { currency, toggle, format } = useCurrency();
  const [activeModule, setActiveModule] = useState<string>('dna');
  const [billingAnnual, setBillingAnnual] = useState(false);
  const [lbSrc, setLbSrc] = useState<string | null>(null);
  const [cardImgs, setCardImgs] = useState([0, 1, 2]);
  const [scrolled, setScrolled] = useState(false);

  // Nav scroll effect
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Phone cards rotator
  useEffect(() => {
    let slot = 0;
    const interval = setInterval(() => {
      setCardImgs(prev => {
        const next = [...prev];
        next[slot] = (prev[slot] + 3) % HERO_KEYS.length;
        return next;
      });
      slot = (slot + 1) % 3;
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const openLB = useCallback((src: string) => setLbSrc(src), []);
  const closeLB = useCallback(() => setLbSrc(null), []);

  const activeMod = MODULES.find(m => m.id === activeModule) || MODULES[0];

  return (
    <div className="min-h-screen bg-[#06060D] text-white font-sans" style={{ fontFamily: '"DM Sans", sans-serif' }}>

      {/* Google Fonts */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap" />

      <Lightbox src={lbSrc} onClose={closeLB} />

      {/* ══ NAV ══════════════════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 transition-all duration-300 ${
        scrolled ? 'py-3 bg-[#06060D]/96 backdrop-blur-xl border-b border-white/[0.06]' : 'py-5'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ background: 'linear-gradient(135deg,#7C3AED,#F72C5B)', boxShadow: '0 0 16px rgba(247,44,91,0.3)' }}>
            <i className="fa-solid fa-bolt" />
          </div>
          <span style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontStyle: 'italic', letterSpacing: '-0.02em', fontSize: '18px', textTransform: 'uppercase' }}>LUZ IA</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          {[['#modulos', 'Módulos'], ['#precios', 'Precios'], ['#faq', 'FAQ']].map(([href, label]) => (
            <a key={href} href={href} className="text-[11px] font-bold text-white/50 hover:text-white uppercase tracking-widest transition-colors">{label}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onOpenAuth} className="hidden md:block text-[11px] font-bold text-white/50 hover:text-white uppercase tracking-widest transition-colors">Ingresar</button>
          <button onClick={onOpenAuth} className="px-4 py-2.5 text-white text-[11px] font-black uppercase tracking-widest rounded-full transition-all hover:opacity-90 hover:scale-105 flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg,#7C3AED,#F72C5B)', boxShadow: '0 0 20px rgba(247,44,91,0.25)' }}>
            <i className="fa-solid fa-bolt text-[10px]" /> Empezar gratis
          </button>
        </div>
      </nav>

      {/* ══ HERO ═════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[100dvh] flex items-center overflow-hidden" style={{ padding: '0 6vw' }}>
        {/* Ambient glows */}
        <div className="absolute pointer-events-none" style={{ top: '20%', right: '8%', width: 600, height: 700, background: 'radial-gradient(ellipse,rgba(124,58,237,0.14) 0%,rgba(247,44,91,0.07) 40%,transparent 70%)', zIndex: 0 }} />
        <div className="absolute pointer-events-none" style={{ top: '30%', left: '-5%', width: 400, height: 500, background: 'radial-gradient(ellipse,rgba(124,58,237,0.1),transparent 65%)', zIndex: 0 }} />

        {/* ─ TEXT BOX (fixed width layer) ─ */}
        <div className="relative z-10 flex-shrink-0 w-full max-w-[540px]" style={{ padding: '140px 0 100px' }}>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border mb-7" style={{ background: 'rgba(124,58,237,0.12)', borderColor: 'rgba(124,58,237,0.3)', fontSize: 10, fontWeight: 700, color: 'rgba(232,121,249,0.9)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#E879F9' }} />
            Producción publicitaria con IA
          </div>

          {/* H1 — each line is nowrap, font-size forces fit */}
          <h1 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', lineHeight: 0.94, letterSpacing: '-0.04em', marginBottom: 24, fontSize: 48, whiteSpace: 'nowrap' }}>
            <div>Crea</div>
            <div style={{ background: 'linear-gradient(135deg,#E879F9,#F72C5B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Contenido</div>
            <div style={{ color: 'rgba(242,240,250,0.28)' }}>Que Vende</div>
          </h1>

          <p style={{ fontSize: 16, fontWeight: 300, color: 'rgba(242,240,250,0.50)', lineHeight: 1.75, maxWidth: 440, marginBottom: 36 }}>
            Modelos digitales con identidad persistente, sesiones UGC, catálogos de producto y más — sin fotógrafos, sin estudio, en minutos.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={onOpenAuth} className="inline-flex items-center gap-2 text-white text-sm font-black uppercase tracking-widest rounded-full transition-all hover:opacity-90 hover:translate-y-[-2px]" style={{ padding: '15px 32px', background: 'linear-gradient(135deg,#7C3AED,#F72C5B)', boxShadow: '0 0 40px rgba(247,44,91,0.25)', border: 'none', cursor: 'pointer' }}>
              <i className="fa-solid fa-bolt text-sm" /> Crear cuenta gratis
            </button>
            <a href="#modulos" className="inline-flex items-center gap-2 text-white text-sm font-black uppercase tracking-widest rounded-full transition-all hover:border-white/30 hover:bg-white/10" style={{ padding: '14px 28px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
              Ver módulos <i className="fa-solid fa-arrow-down text-sm" />
            </a>
          </div>

          <div className="flex items-center gap-4 flex-wrap mt-6">
            {['10 créditos gratis', 'Sin tarjeta', 'En minutos'].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'rgba(242,240,250,0.55)' }}>
                <i className="fa-solid fa-check text-[10px]" style={{ color: '#F72C5B' }} />{t}
              </span>
            ))}
          </div>
        </div>

        {/* ─ PHONE CARDS (right side, desktop only) ─ */}
        <div className="hidden lg:flex items-center gap-4 absolute right-[6vw] top-1/2 -translate-y-1/2 z-10" style={{ padding: '0 0 0 40px' }}>
          {[0, 1, 2].map(idx => {
            const isMain = idx === 1;
            const key = HERO_KEYS[cardImgs[idx]];
            const labels = ['Content Studio · UGC', 'AI Generator · Resultado', 'Model DNA · Facemaster'];
            return (
              <div key={idx} style={{
                width: isMain ? 210 : 175,
                borderRadius: 24,
                overflow: 'hidden',
                border: isMain ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.1)',
                boxShadow: isMain ? '0 32px 80px rgba(0,0,0,0.6),0 0 40px rgba(124,58,237,0.15)' : '0 24px 60px rgba(0,0,0,0.5)',
                background: '#12121D',
                flexShrink: 0,
                position: 'relative',
                transform: isMain ? 'translateY(-20px)' : 'scale(0.95)',
                opacity: isMain ? 1 : 0.72,
                transition: 'all 0.3s ease',
              }}>
                <img src={IMG(`${key}.jpg`)} alt="" style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block', transition: 'opacity 0.8s ease' }} loading="eager" />
                <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, background: 'rgba(6,6,13,0.82)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 10px', fontFamily: '"Syne",sans-serif', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(242,240,250,0.5)' }}>
                  {labels[idx].split('·')[0].trim()} <span style={{ color: '#F72C5B' }}>·</span> {labels[idx].split('·')[1]?.trim()}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ══ MARQUEE ══════════════════════════════════════════════════════════════ */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#0D0D18', padding: '18px 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', width: 'max-content', animation: 'mq 22s linear infinite' }}>
          {[...Array(2)].map((_, rep) => (
            ['Model DNA','AI Generator','Content Studio Pro','Scene Clone','Outfit Kit · Ghost Mannequin','Product Studio','Identity Lock System','Gemini Imagen 4'].map((item, i) => (
              <div key={`${rep}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 32px', fontFamily: '"Syne",sans-serif', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(242,240,250,0.22)', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#F72C5B', flexShrink: 0 }} />
                {item}
              </div>
            ))
          ))}
        </div>
        <style>{`@keyframes mq{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      </div>

      {/* ══ MODULES ══════════════════════════════════════════════════════════════ */}
      <section id="modulos" className="px-6 md:px-10 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <div className="flex items-center gap-2.5 mb-4 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: '#F72C5B' }}>
              <div style={{ width: 20, height: 1, background: '#F72C5B' }} />
              Módulos del sistema
            </div>
            <h2 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 'clamp(32px,4vw,56px)', letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 12 }}>
              Todo lo que necesitas<br />en una sola plataforma
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(242,240,250,0.45)', maxWidth: 480, lineHeight: 1.75 }}>
              Seis herramientas especializadas. Haz click en cada módulo para ver cómo funciona.
            </p>
          </div>

          {/* Tab buttons */}
          <div className="flex gap-2 flex-wrap mb-1">
            {MODULES.map(mod => (
              <button key={mod.id} onClick={() => setActiveModule(mod.id)}
                className="flex items-center gap-2 rounded-full font-black text-[11px] uppercase tracking-[0.1em] transition-all"
                style={{
                  padding: '10px 20px', border: '1px solid',
                  borderColor: activeModule === mod.id ? 'rgba(247,44,91,0.4)' : 'rgba(255,255,255,0.07)',
                  background: activeModule === mod.id ? 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(247,44,91,0.1))' : 'transparent',
                  color: activeModule === mod.id ? '#fff' : 'rgba(242,240,250,0.45)',
                  fontFamily: '"Syne",sans-serif',
                  cursor: 'pointer',
                }}
              >
                <i className={`fa-solid ${mod.icon} text-xs`} style={{ color: activeModule === mod.id ? mod.accent : undefined }} />
                {mod.name}
              </button>
            ))}
          </div>

          {/* Panel */}
          <div style={{ background: '#0D0D18', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, overflow: 'hidden', animation: 'panIn 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
            <style>{`@keyframes panIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <div className="grid" style={{ gridTemplateColumns: '260px 1fr', minHeight: 480 }}>

              {/* Info column */}
              <div style={{ padding: '36px 28px', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 16, background: activeMod.accentBg }}>
                    <i className={`fa-solid ${activeMod.icon}`} style={{ color: activeMod.accent }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: activeMod.accent, marginBottom: 8 }}>{activeMod.sub}</div>
                  <div style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 10 }}>{activeMod.name}</div>
                  <p style={{ fontSize: 13, color: 'rgba(242,240,250,0.45)', lineHeight: 1.7, marginBottom: 20 }}>{activeMod.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                    {activeMod.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(242,240,250,0.50)' }}>
                        <i className="fa-solid fa-check" style={{ fontSize: 9, color: '#F72C5B', flexShrink: 0 }} />{f}
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={onOpenAuth} className="inline-flex items-center gap-2 text-white font-black uppercase tracking-[0.1em] rounded-full transition-all hover:opacity-90" style={{ fontFamily: '"Syne",sans-serif', fontSize: 10, padding: '11px 22px', background: 'linear-gradient(135deg,#7C3AED,#F72C5B)', border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(247,44,91,0.25)', width: 'fit-content' }}>
                  <i className="fa-solid fa-bolt text-[10px]" /> Probar gratis
                </button>
              </div>

              {/* Gallery column */}
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>

                {/* Prompt block (AI Generator only) */}
                {'prompt' in activeMod && (
                  <div style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#F72C5B', marginBottom: 8 }}>
                      <i className="fa-solid fa-terminal" style={{ marginRight: 5 }} />Prompt utilizado
                    </div>
                    <p style={{ fontSize: 11, fontStyle: 'italic', color: 'rgba(242,240,250,0.45)', lineHeight: 1.7, maxHeight: 88, overflow: 'auto' }}>
                      {(activeMod as any).prompt}
                    </p>
                  </div>
                )}

                {/* References */}
                {activeMod.refs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(242,240,250,0.28)' }}>
                        {activeMod.id === 'studio' ? 'Referencias · Avatar · Producto · Escena · Outfit' : 'Referencia'}
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
                    </div>
                    <div className="flex gap-2.5">
                      {activeMod.refs.map(ref => (
                        <div key={ref.label} onClick={() => openLB(ref.src)} className="flex-1 relative rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] border" style={{ border: '1px solid rgba(255,255,255,0.08)', minWidth: 0 }}>
                          <img src={ref.src} alt={ref.label} className="w-full block object-cover" style={{ height: activeMod.id === 'studio' ? 130 : 180, objectFit: activeMod.id === 'studio' && ref.label === 'Producto' ? 'contain' : 'cover', background: ref.label === 'Producto' ? '#14141F' : undefined, padding: ref.label === 'Producto' ? 8 : undefined }} loading="lazy" />
                          <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.75)', borderRadius: 5, padding: '2px 7px', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)' }}>{ref.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#F72C5B' }}>
                      {activeMod.id === 'clone' ? 'Resultado clonado' : activeMod.id === 'studio' ? 'Resultados · Master · Shot 1 · Shot 2' : 'Resultados generados'}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
                  </div>
                  <div className="flex gap-2.5" style={activeMod.id === 'clone' ? { display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10 } : {}}>
                    {activeMod.results.map((res, i) => (
                      <div key={res.label} onClick={() => openLB(res.src)}
                        className="relative rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02]"
                        style={{
                          flex: activeMod.id === 'clone' ? undefined : 1,
                          border: `1.5px solid ${activeMod.id === 'clone' && i === activeMod.results.length - 1 ? '#F72C5B' : 'rgba(247,44,91,0.3)'}`,
                          boxShadow: activeMod.id === 'clone' && i === activeMod.results.length - 1 ? '0 0 20px rgba(247,44,91,0.2)' : undefined,
                          minWidth: 0,
                        }}
                      >
                        <img src={res.src} alt={res.label} className="w-full block object-cover" style={{ height: activeMod.id === 'product' ? 160 : 200 }} loading="lazy" />
                        <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(247,44,91,0.75)', borderRadius: 5, padding: '2px 7px', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'white' }}>{res.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS ════════════════════════════════════════════════════════════════ */}
      <div style={{ background: '#0D0D18', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '60px 6vw' }}>
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: 'rgba(255,255,255,0.07)' }}>
          {[['6','Módulos especializados'],['∞','Identidades posibles'],['5x','Más rápido que un estudio'],['100%','Coherencia de identidad']].map(([n, l]) => (
            <div key={l} style={{ background: '#0D0D18', padding: '36px 28px', textAlign: 'center' }}>
              <div style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontStyle: 'italic', fontSize: 'clamp(36px,5vw,64px)', letterSpacing: '-0.04em', lineHeight: 1, background: 'linear-gradient(135deg,#E879F9,#F72C5B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 8 }}>{n}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(242,240,250,0.40)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ GALLERY SCROLL ═══════════════════════════════════════════════════════ */}
      <section style={{ padding: '80px 6vw', background: '#0D0D18', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-3 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: '#F72C5B' }}>
            <div style={{ width: 20, height: 1, background: '#F72C5B' }} />
            Generado con LUZ IA
          </div>
          <h2 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 'clamp(28px,3.5vw,48px)', letterSpacing: '-0.03em', marginBottom: 36 }}>
            Resultados reales
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {HERO_KEYS.map(key => (
              <div key={key} onClick={() => openLB(IMG(`${key}.jpg`))} style={{ flexShrink: 0, width: 200, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', transition: 'all 0.3s' }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(247,44,91,0.4)'; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
              >
                <img src={IMG(`${key}.jpg`)} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING ══════════════════════════════════════════════════════════════ */}
      <section id="precios" style={{ padding: '80px 6vw' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2.5 mb-3 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: '#F72C5B' }}>
              <div style={{ width: 20, height: 1, background: '#F72C5B' }} />
              Planes
              <div style={{ width: 20, height: 1, background: '#F72C5B' }} />
            </div>
            <h2 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 'clamp(28px,4vw,52px)', letterSpacing: '-0.03em', marginBottom: 12 }}>
              Precios que escalan<br />con tu negocio
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(242,240,250,0.45)', marginBottom: 24 }}>Empieza gratis. Sin tarjeta de crédito.</p>

            {/* Credit note */}
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6" style={{ background: 'rgba(232,121,249,0.08)', border: '1px solid rgba(232,121,249,0.2)', fontSize: 12, fontWeight: 600, color: '#E879F9' }}>
              <i className="fa-solid fa-bolt text-xs" />
              Seedream: 1 crédito = 1 imagen &nbsp;·&nbsp; Gemini: 2 créditos = 1 imagen
            </div>

            {/* Billing toggle */}
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-0 rounded-full p-1" style={{ background: '#14141F', border: '1px solid rgba(255,255,255,0.07)' }}>
                {[['Mensual', false], ['Anual', true]].map(([label, isAnnual]) => (
                  <button key={String(label)} onClick={() => setBillingAnnual(isAnnual as boolean)}
                    className="font-black uppercase text-[11px] tracking-widest rounded-full transition-all"
                    style={{ padding: '8px 22px', fontFamily: '"Syne",sans-serif', border: 'none', cursor: 'pointer', background: billingAnnual === isAnnual ? 'linear-gradient(135deg,#7C3AED,#F72C5B)' : 'transparent', color: billingAnnual === isAnnual ? '#fff' : 'rgba(242,240,250,0.45)', boxShadow: billingAnnual === isAnnual ? '0 2px 12px rgba(247,44,91,0.25)' : 'none' }}
                  >
                    {label}{isAnnual && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(232,121,249,0.2)', color: '#E879F9' }}>-20%</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Plans grid */}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
            {LANDING_PLANS.map(plan => {
              const price = billingAnnual && plan.priceAnnual !== null ? plan.priceAnnual : plan.priceMonthly;
              const [whole, cents] = price === 0 ? ['0', null] : String(price.toFixed(2)).split('.');

              return (
                <div key={plan.id} style={{
                  background: plan.featured ? 'linear-gradient(160deg,rgba(124,58,237,0.12),rgba(247,44,91,0.07),#0D0D18)' : '#0D0D18',
                  border: `1px solid ${plan.featured ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 20, padding: '28px 20px',
                  display: 'flex', flexDirection: 'column', gap: 0,
                  position: 'relative',
                  transform: plan.featured ? 'scale(1.03)' : 'none',
                  boxShadow: plan.featured ? '0 0 40px rgba(124,58,237,0.15)' : 'none',
                  transition: 'transform 0.3s',
                }}>
                  {plan.featured && (
                    <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', padding: '4px 14px', borderRadius: 100, background: 'linear-gradient(135deg,#7C3AED,#F72C5B)', fontFamily: '"Syne",sans-serif', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#fff', whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(247,44,91,0.3)' }}>
                      Más popular
                    </div>
                  )}
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(242,240,250,0.28)', marginBottom: 16 }}>{plan.name}</div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2, marginBottom: 6 }}>
                    {price === 0 ? (
                      <span style={{ fontFamily: '"Syne",sans-serif', fontSize: 40, fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.03em' }}>$0</span>
                    ) : (
                      <>
                        <span style={{ fontFamily: '"Syne",sans-serif', fontSize: 40, fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.03em' }}>${whole}</span>
                        <span style={{ fontFamily: '"Syne",sans-serif', fontSize: 18, fontWeight: 700, marginTop: 7, letterSpacing: '-0.02em' }}>.{cents}</span>
                      </>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(242,240,250,0.35)', marginTop: 24, marginLeft: 2 }}>{plan.period}</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#F72C5B', marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {plan.credits} · {plan.images}
                  </div>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, flex: 1 }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 11, color: 'rgba(242,240,250,0.50)' }}>
                        <i className="fa-solid fa-check" style={{ fontSize: 9, color: '#F72C5B', marginTop: 2, flexShrink: 0 }} />{f}
                      </li>
                    ))}
                    {plan.negative.map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 11, color: 'rgba(242,240,250,0.25)' }}>
                        <i className="fa-solid fa-bolt" style={{ fontSize: 9, color: 'rgba(242,240,250,0.25)', marginTop: 2, flexShrink: 0 }} />{f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={onOpenAuth}
                    style={{ width: '100%', padding: '12px 0', borderRadius: 12, fontFamily: '"Syne",sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', border: plan.featured ? 'none' : '1px solid rgba(255,255,255,0.12)', background: plan.featured ? 'linear-gradient(135deg,#7C3AED,#F72C5B)' : 'transparent', color: '#fff', boxShadow: plan.featured ? '0 4px 20px rgba(247,44,91,0.25)' : 'none', transition: 'all 0.2s' }}
                    onMouseOver={e => { if (!plan.featured) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseOut={e => { if (!plan.featured) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {plan.cta}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Credit explanation */}
          <div className="flex items-start gap-3 mt-6 rounded-2xl p-4" style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)' }}>
            <i className="fa-solid fa-bolt" style={{ color: '#F72C5B', marginTop: 2, flexShrink: 0, fontSize: 13 }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>1 crédito = 1 imagen (con Seedream)</p>
              <p style={{ fontSize: 12, color: 'rgba(242,240,250,0.40)', lineHeight: 1.65 }}>Módulos como Content Studio o Model DNA consumen más créditos por la complejidad del proceso (set de 4 planos, múltiples shots, etc.). Los planes Explorer, Starter, Pro y Studio se renuevan automáticamente. Plan Free: 10 créditos únicos, no renovables.</p>
            </div>
          </div>

          <p className="text-center mt-4" style={{ fontSize: 11, color: 'rgba(242,240,250,0.25)' }}>
            Precios en USD. Plan anual disponible con 20% de descuento en Starter, Pro y Studio. Explorer se cobra semanalmente.
          </p>
        </div>
      </section>

      {/* ══ FAQ ══════════════════════════════════════════════════════════════════ */}
      <section id="faq" style={{ padding: '80px 6vw' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2.5 mb-3 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: '#F72C5B' }}>
              <div style={{ width: 20, height: 1, background: '#F72C5B' }} />
              Preguntas frecuentes
              <div style={{ width: 20, height: 1, background: '#F72C5B' }} />
            </div>
            <h2 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 'clamp(28px,4vw,48px)', letterSpacing: '-0.03em' }}>FAQ</h2>
          </div>
          <div style={{ background: '#0D0D18', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: '0 28px' }}>
            {FAQS.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* ══ CTA FINAL ════════════════════════════════════════════════════════════ */}
      <section style={{ padding: '100px 6vw', textAlign: 'center', background: 'linear-gradient(160deg,rgba(124,58,237,0.08),rgba(247,44,91,0.05),transparent)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse,rgba(124,58,237,0.14),rgba(247,44,91,0.07),transparent 65%)', pointerEvents: 'none' }} />
        <div className="max-w-2xl mx-auto relative">
          <div className="flex items-center justify-center gap-2.5 mb-4 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: '#F72C5B' }}>
            <div style={{ width: 20, height: 1, background: '#F72C5B' }} /> Comienza hoy <div style={{ width: 20, height: 1, background: '#F72C5B' }} />
          </div>
          <h2 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 'clamp(32px,5vw,64px)', letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 14 }}>
            ¿Listo para producir<br />como un estudio?
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(242,240,250,0.45)', marginBottom: 36 }}>10 créditos gratis al registrarte. Sin tarjeta. Resultados en minutos.</p>
          <button onClick={onOpenAuth} className="inline-flex items-center gap-2 text-white font-black uppercase tracking-widest rounded-full transition-all hover:opacity-90 hover:translate-y-[-2px]" style={{ fontFamily: '"Syne",sans-serif', fontSize: 15, padding: '18px 44px', background: 'linear-gradient(135deg,#7C3AED,#F72C5B)', border: 'none', cursor: 'pointer', boxShadow: '0 0 40px rgba(247,44,91,0.25)' }}>
            <i className="fa-solid fa-bolt" /> Crear mi cuenta gratuita
          </button>
          <div className="flex items-center justify-center gap-2 mt-5" style={{ fontSize: 13, color: 'rgba(242,240,250,0.40)' }}>
            <i className="fa-solid fa-gift" style={{ color: '#F72C5B' }} />
            10 créditos gratis incluidos · Sin tarjeta de crédito
          </div>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════════ */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '36px 6vw', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div className="flex items-center gap-2.5" style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 16, letterSpacing: '-0.02em' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7C3AED,#F72C5B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
            <i className="fa-solid fa-bolt text-white" />
          </div>
          LUZ IA
        </div>
        <div className="flex gap-6 flex-wrap">
          {[['privacidad','Privacidad'],['terminos','Términos'],['descargo','Descargo']].map(([to, label]) => (
            <Link key={to} to={`/${to}`} style={{ fontSize: 11, fontWeight: 500, color: 'rgba(242,240,250,0.25)', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'color 0.2s' }}
              onMouseOver={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
              onMouseOut={e => (e.currentTarget as HTMLElement).style.color = 'rgba(242,240,250,0.25)'}
            >{label}</Link>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'rgba(242,240,250,0.18)' }}>© {new Date().getFullYear()} LUZ IA · Todos los derechos reservados</p>
      </footer>

    </div>
  );
};

export default Landing;