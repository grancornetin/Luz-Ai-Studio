import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, ArrowRight, Zap, Sparkles, Camera, Shirt, Package, Wand2, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { PLANS } from '../services/creditConfig';
import { useCurrency } from '../hooks/useCurrency';

// ── DATOS ──────────────────────────────────────────────────────────────────────

const MODULES = [
  {
    icon: 'fa-dna',
    color: 'bg-purple-500',
    lightColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    name: 'Model DNA',
    tagline: 'Tu modelo, tu identidad',
    desc: 'Crea un modelo digital único a partir de fotos reales. Úsalo en cualquier campaña con consistencia visual total.',
    steps: ['Sube 1–4 fotos de referencia', 'La IA extrae identidad facial y corporal', 'Genera contenido con ese modelo en infinitas poses y escenas'],
    badge: 'Identidad Visual',
  },
  {
    icon: 'fa-wand-magic-sparkles',
    color: 'bg-brand-600',
    lightColor: 'bg-brand-50',
    textColor: 'text-brand-600',
    name: 'AI Generator',
    tagline: 'Prompts que venden',
    desc: 'Genera imágenes publicitarias de alta calidad con prompts inteligentes. Galería de prompts profesionales incluida.',
    steps: ['Escribe o elige un prompt de la galería', 'Ajusta estilo, modelo y contexto', 'Genera y descarga en segundos'],
    badge: 'Generación Libre',
  },
  {
    icon: 'fa-mobile-screen-button',
    color: 'bg-emerald-500',
    lightColor: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    name: 'Content Studio',
    tagline: 'Contenido listo para publicar',
    desc: 'Combina tu producto, escena y outfit en una sola imagen optimizada para redes sociales y publicidad digital.',
    steps: ['Sube fotos de producto, escena y prenda', 'Elige el enfoque (UGC, editorial, lifestyle)', 'Obtén contenido listo para Instagram o Meta Ads'],
    badge: 'Redes Sociales',
  },
  {
    icon: 'fa-clone',
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    name: 'Scene Clone',
    tagline: 'Recrea cualquier escena',
    desc: 'Toma una foto de referencia y replícala con tu modelo. Perfecto para mantener consistencia visual entre campañas.',
    steps: ['Sube la imagen de referencia de escena', 'Agrega tu modelo (rostro + cuerpo)', 'La IA recrea la escena con tu identidad'],
    badge: 'Escenas',
  },
  {
    icon: 'fa-gem',
    color: 'bg-amber-500',
    lightColor: 'bg-amber-50',
    textColor: 'text-amber-600',
    name: 'Product Shots',
    tagline: 'Fotografía de producto con IA',
    desc: 'Genera fotos de producto profesionales en segundos. Sin estudio, sin fotógrafo, sin presupuesto de producción.',
    steps: ['Sube la foto de tu producto', 'Describe el fondo y el estilo', 'Obtén fotografías de catálogo profesionales'],
    badge: 'E-commerce',
  },
  {
    icon: 'fa-shirt',
    color: 'bg-rose-500',
    lightColor: 'bg-rose-50',
    textColor: 'text-rose-600',
    name: 'Outfit Kit',
    tagline: 'Extracción de prendas',
    desc: 'Extrae outfits completos de cualquier imagen y renderiza en tu modelo o en distintos contextos visuales.',
    steps: ['Sube una foto con el outfit', 'La IA extrae la prenda automáticamente', 'Renderiza en tu modelo o en nuevas escenas'],
    badge: 'Moda',
  },
];

const FAQS = [
  {
    q: '¿Necesito saber de diseño o IA para usar LUZ IA?',
    a: 'No. La plataforma está diseñada para emprendedores y marketers sin experiencia técnica. Sube fotos, ajusta parámetros simples y obtén resultados profesionales en segundos.',
  },
  {
    q: '¿Qué es un crédito y cuánto cuesta?',
    a: '1 crédito = $0.10 USD. Cada imagen cuesta 2 créditos con Nano Banana 2 (Gemini) o 1 crédito con Seedream 4.5. Al registrarte recibes 10 créditos gratis para probar sin compromiso.',
  },
  {
    q: '¿Puedo usar las imágenes para publicidad comercial?',
    a: 'Sí. Las imágenes generadas son tuyas para uso comercial. Solo debes asegurarte de tener los derechos sobre las imágenes de referencia que subes.',
  },
  {
    q: '¿Funciona en cualquier industria?',
    a: 'Absolutamente. Moda, gastronomía, belleza, tecnología, retail y más. Cualquier negocio que necesite contenido visual puede usar LUZ IA.',
  },
  {
    q: '¿Puedo cancelar mi suscripción en cualquier momento?',
    a: 'Sí. Sin permanencia ni penalizaciones. Cancelas cuando quieras y tu plan sigue activo hasta el fin del período pagado.',
  },
  {
    q: '¿Las imágenes de referencia que subo se guardan?',
    a: 'No. Las imágenes de referencia se procesan en tiempo real por la IA y no se almacenan en nuestros servidores. Tu privacidad está protegida.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Valentina M.',
    role: 'Fundadora · Tienda de ropa online',
    text: 'Antes gastaba $200 USD por sesión de fotos. Con LUZ IA genero el mismo contenido por menos de $15 al mes. Es increíble.',
    stars: 5,
  },
  {
    name: 'Rodrigo C.',
    role: 'Agencia de Marketing Digital',
    text: 'Entregamos campañas completas en 1/3 del tiempo. Los clientes no pueden creer la calidad. LUZ IA nos dio una ventaja brutal.',
    stars: 5,
  },
  {
    name: 'Camila P.',
    role: 'Emprendedora · Cosmética natural',
    text: 'Probé varias herramientas de IA. Ninguna tan enfocada en contenido publicitario latinoamericano como LUZ IA.',
    stars: 5,
  },
];

// ── COMPONENTES ────────────────────────────────────────────────────────────────

const StarRating: React.FC<{ count: number }> = ({ count }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: count }).map((_, i) => (
      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
    ))}
  </div>
);

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4"
      >
        <span className="text-sm font-black text-slate-800 uppercase tracking-tight leading-snug">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        }
      </button>
      {open && (
        <p className="pb-5 text-sm text-slate-500 leading-relaxed">{a}</p>
      )}
    </div>
  );
};

// ── MOCK VISUAL CARDS (reemplazan capturas de pantalla) ───────────────────────

const MockGenerationCard: React.FC<{ color: string; icon: string; label: string; time?: string }> = ({ color, icon, label, time = '8s' }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm flex items-center gap-3">
    <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
      <i className={`fa-solid ${icon} text-white text-sm`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-black text-slate-700 uppercase tracking-tight truncate">{label}</p>
      <p className="text-[10px] text-slate-400 font-medium">Generado en ~{time}</p>
    </div>
    <div className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0" />
  </div>
);

// ── LANDING PAGE PRINCIPAL ─────────────────────────────────────────────────────

const Landing: React.FC<{ onOpenAuth: () => void }> = ({ onOpenAuth }) => {
  const navigate = useNavigate();
  const { currency, toggle, format } = useCurrency();

  const dailyCostCLP = Math.round((PLANS.starter.priceMonthly * 1000) / 30);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-5 md:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-100">
              <i className="fa-solid fa-bolt text-white text-sm" />
            </div>
            <span className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">LUZ IA</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#modulos" className="text-[11px] font-black text-slate-500 hover:text-slate-900 uppercase tracking-widest transition-colors">Módulos</a>
            <a href="#precios" className="text-[11px] font-black text-slate-500 hover:text-slate-900 uppercase tracking-widest transition-colors">Precios</a>
            <a href="#faq" className="text-[11px] font-black text-slate-500 hover:text-slate-900 uppercase tracking-widest transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenAuth}
              className="text-[11px] font-black text-slate-500 hover:text-slate-900 uppercase tracking-widest transition-colors hidden md:block"
            >
              Ingresar
            </button>
            <button
              onClick={onOpenAuth}
              className="px-4 py-2.5 bg-brand-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
            >
              Empezar gratis
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-28 pb-20 px-5 md:px-10 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 px-4 py-2 rounded-full">
              <Zap className="w-3.5 h-3.5 text-brand-600" />
              <span className="text-[11px] font-black text-brand-600 uppercase tracking-widest">IA Publicitaria para Latinoamérica</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-[0.9] text-slate-900">
              Contenido<br />
              publicitario<br />
              <span className="text-brand-600">profesional</span><br />
              con IA
            </h1>

            <p className="text-base text-slate-500 leading-relaxed max-w-md">
              Crea imágenes de campaña, fotos de producto y contenido UGC en segundos.
              Sin fotógrafo, sin estudio, sin presupuesto de producción.
            </p>

            {/* Oferta diaria */}
            <div className="bg-slate-900 rounded-[28px] p-6 space-y-4 inline-block w-full max-w-sm">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Genera contenido profesional por solo</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">
                  ${dailyCostCLP.toLocaleString('es-CL')}
                </span>
                <span className="text-sm font-bold text-slate-400">CLP / día</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">Plan Starter · {PLANS.starter.credits} créditos mensuales · ~{PLANS.starter.approxImages}</p>
              <button
                onClick={onOpenAuth}
                className="w-full py-3.5 bg-brand-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
              >
                Ver planes <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Trust signals */}
            <div className="flex items-center gap-5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-[11px] font-bold text-slate-500">Sin tarjeta para empezar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-[11px] font-bold text-slate-500">10 créditos gratis</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-[11px] font-bold text-slate-500">Cancela cuando quieras</span>
              </div>
            </div>
          </div>

          {/* Panel visual derecho */}
          <div className="relative">
            {/* Fake dashboard panel */}
            <div className="bg-slate-50 rounded-[40px] border border-slate-100 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-brand-600 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-bolt text-white text-[10px]" />
                  </div>
                  <span className="text-xs font-black text-slate-700 uppercase tracking-tight">LUZ IA · Studio</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 bg-red-300 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-amber-300 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-emerald-300 rounded-full" />
                </div>
              </div>

              {/* Módulos en mini-grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { color: 'bg-purple-500', icon: 'fa-dna', name: 'Model DNA' },
                  { color: 'bg-brand-600', icon: 'fa-wand-magic-sparkles', name: 'AI Gen' },
                  { color: 'bg-emerald-500', icon: 'fa-mobile-screen-button', name: 'Content' },
                  { color: 'bg-blue-500', icon: 'fa-clone', name: 'Scene Clone' },
                  { color: 'bg-amber-500', icon: 'fa-gem', name: 'Products' },
                  { color: 'bg-rose-500', icon: 'fa-shirt', name: 'Outfit Kit' },
                ].map((m, i) => (
                  <div key={i} className="bg-white rounded-2xl p-3 flex flex-col items-center gap-2 border border-slate-100">
                    <div className={`w-8 h-8 ${m.color} rounded-xl flex items-center justify-center`}>
                      <i className={`fa-solid ${m.icon} text-white text-[10px]`} />
                    </div>
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-tight text-center leading-tight">{m.name}</span>
                  </div>
                ))}
              </div>

              {/* Generaciones recientes */}
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Generaciones recientes</p>
                <MockGenerationCard color="bg-brand-600" icon="fa-wand-magic-sparkles" label="Campaña lifestyle editorial" time="6s" />
                <MockGenerationCard color="bg-purple-500" icon="fa-dna" label="Model DNA · Valentina" time="12s" />
                <MockGenerationCard color="bg-emerald-500" icon="fa-mobile-screen-button" label="Content Studio · UGC" time="8s" />
              </div>

              {/* Créditos mini */}
              <div className="bg-white rounded-2xl p-3 flex items-center justify-between border border-slate-100">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Créditos</p>
                  <p className="text-lg font-black text-slate-800">142 <span className="text-[10px] text-slate-400 font-medium">disponibles</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plan</p>
                  <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase">Pro</span>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl border border-slate-100 shadow-xl p-3 flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-700 uppercase tracking-tight">Imagen generada</p>
                <p className="text-[9px] text-slate-400 font-medium">en 8 segundos</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <section className="bg-slate-900 py-8 px-5 md:px-10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-10 md:gap-20">
          {[
            { value: '6', label: 'Módulos de IA' },
            { value: '~8s', label: 'Por imagen' },
            { value: '10', label: 'Créditos gratis' },
            { value: '$0.10', label: 'USD por crédito' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-black text-white">{stat.value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── MÓDULOS ── */}
      <section id="modulos" className="py-20 px-5 md:px-10 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-3">
          <p className="text-[11px] font-black text-brand-600 uppercase tracking-widest">Todo en una sola plataforma</p>
          <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900">
            6 módulos de IA<br />
            <span className="text-brand-600">especializados</span>
          </h2>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">Cada módulo resuelve un problema específico del marketing visual. No pagas por funciones que no usas.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MODULES.map((mod, i) => (
            <div key={i} className="group bg-white rounded-[28px] border border-slate-100 p-6 space-y-5 hover:shadow-xl hover:border-slate-200 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 ${mod.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                  <i className={`fa-solid ${mod.icon} text-white text-lg`} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${mod.lightColor} ${mod.textColor}`}>
                  {mod.badge}
                </span>
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900 uppercase italic tracking-tight">{mod.name}</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{mod.tagline}</p>
              </div>

              <p className="text-sm text-slate-500 leading-relaxed">{mod.desc}</p>

              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Cómo funciona</p>
                {mod.steps.map((step, j) => (
                  <div key={j} className="flex items-start gap-2.5">
                    <div className={`w-4 h-4 ${mod.color} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 opacity-80`}>
                      <span className="text-[8px] font-black text-white">{j + 1}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={onOpenAuth}
            className="px-8 py-4 bg-brand-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-xl shadow-brand-100 inline-flex items-center gap-2"
          >
            Probar todos los módulos gratis <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ── PROCESO VISUAL ── */}
      <section className="bg-slate-50 py-20 px-5 md:px-10">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-[11px] font-black text-brand-600 uppercase tracking-widest">Así de simple</p>
            <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900">
              Contenido profesional<br />en <span className="text-brand-600">3 pasos</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: <Camera className="w-6 h-6" />,
                color: 'bg-brand-600',
                title: 'Sube tus referencias',
                desc: 'Fotos de tu modelo, producto, outfit o escena. La IA entiende el contexto automáticamente.',
              },
              {
                step: '02',
                icon: <Wand2 className="w-6 h-6" />,
                color: 'bg-indigo-600',
                title: 'Elige módulo y ajusta',
                desc: 'Selecciona el módulo según tu objetivo. Ajusta estilo, formato y parámetros en segundos.',
              },
              {
                step: '03',
                icon: <Sparkles className="w-6 h-6" />,
                color: 'bg-emerald-600',
                title: 'Genera y descarga',
                desc: 'La IA genera tu imagen en ~8 segundos. Descarga en alta resolución, listo para publicar.',
              },
            ].map((step, i) => (
              <div key={i} className="relative bg-white rounded-[28px] border border-slate-100 p-8 space-y-5">
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 ${step.color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                    {step.icon}
                  </div>
                  <span className="text-6xl font-black text-slate-100 select-none">{step.step}</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase italic tracking-tight">{step.title}</h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">{step.desc}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="w-5 h-5 text-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section className="py-20 px-5 md:px-10 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <p className="text-[11px] font-black text-brand-600 uppercase tracking-widest">Lo que dicen nuestros usuarios</p>
          <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-slate-900">
            Resultados reales
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="bg-white rounded-[28px] border border-slate-100 p-6 space-y-4">
              <StarRating count={t.stars} />
              <p className="text-sm text-slate-600 leading-relaxed">"{t.text}"</p>
              <div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{t.name}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRECIOS ── */}
      <section id="precios" className="bg-slate-50 py-20 px-5 md:px-10">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-black text-brand-600 uppercase tracking-widest">Sin sorpresas</p>
              <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-slate-900">
                Precios <span className="text-brand-600">transparentes</span>
              </h2>
            </div>
            <button
              onClick={toggle}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              {currency === 'USD' ? '🇨🇱 Ver en CLP' : '🇺🇸 Ver en USD'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(['free', 'starter', 'pro'] as const).map(key => {
              const plan = PLANS[key];
              const isPro = key === 'pro';
              return (
                <div
                  key={key}
                  className={`bg-white rounded-[28px] border p-6 flex flex-col gap-5 relative ${isPro ? 'border-indigo-200 ring-2 ring-indigo-500 shadow-xl shadow-indigo-50' : 'border-slate-100'}`}
                >
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                      Más popular
                    </div>
                  )}
                  <div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${isPro ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                      {plan.label}
                    </span>
                    <div className="mt-4">
                      {plan.priceMonthly === 0 ? (
                        <p className="text-3xl font-black text-slate-900">Gratis</p>
                      ) : (
                        <>
                          <p className="text-3xl font-black text-slate-900">{format(plan.priceMonthly)}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">por mes</p>
                        </>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">{plan.approxImages}</p>
                  </div>
                  <ul className="space-y-2 flex-1">
                    {plan.features.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span className="text-[11px] font-medium text-slate-600 leading-tight">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={onOpenAuth}
                    className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      isPro
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100'
                        : 'bg-slate-900 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {plan.priceMonthly === 0 ? 'Empezar gratis' : 'Suscribirse'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate('/pricing')}
              className="text-sm font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest inline-flex items-center gap-1.5 transition-colors"
            >
              Ver todos los planes <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 px-5 md:px-10 max-w-3xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-[11px] font-black text-brand-600 uppercase tracking-widest">Preguntas frecuentes</p>
          <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-slate-900">
            FAQ
          </h2>
        </div>
        <div className="bg-white rounded-[28px] border border-slate-100 px-8 divide-y divide-slate-100">
          {FAQS.map((faq, i) => (
            <FaqItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="bg-slate-900 py-20 px-5 md:px-10">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="w-16 h-16 bg-brand-600 rounded-[24px] flex items-center justify-center mx-auto shadow-2xl shadow-brand-600/30">
            <i className="fa-solid fa-bolt text-white text-2xl" />
          </div>
          <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white leading-tight">
            Empieza hoy.<br />
            <span className="text-brand-400">Sin riesgo.</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            10 créditos gratis al registrarte. Sin tarjeta de crédito. Sin permanencia.
            Si no te convence, no pierdes nada.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onOpenAuth}
              className="px-8 py-4 bg-brand-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-xl shadow-brand-600/30 inline-flex items-center justify-center gap-2"
            >
              Crear cuenta gratis <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#precios"
              className="px-8 py-4 bg-white/10 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-white/20 transition-all inline-flex items-center justify-center gap-2"
            >
              Ver precios
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 border-t border-white/5 py-10 px-5 md:px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-brand-600 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-bolt text-white text-xs" />
            </div>
            <span className="text-sm font-black text-white uppercase italic tracking-tighter">LUZ IA</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link to="/privacidad" className="text-[11px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors">Privacidad</Link>
            <Link to="/terminos"   className="text-[11px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors">Términos</Link>
            <Link to="/descargo"   className="text-[11px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors">Descargo</Link>
            <Link to="/contacto"   className="text-[11px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors">Contacto</Link>
          </div>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            © {new Date().getFullYear()} LUZ IA · Todos los derechos reservados
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
