import React, { useState, useEffect } from 'react';

const TIPS = [
  { icon: '🎭', title: 'Coherencia facial', body: 'Luz IA bloquea la identidad de tu persona en cada shot — ni la IA más avanzada puede cambiarle la cara.' },
  { icon: '📸', title: 'Tu foto base', body: 'Esta primera foto define la luz, el espacio y los colores que mantendremos durante la sesión.' },
  { icon: '🎨', title: 'Referencia de escena', body: 'Si subiste foto de fondo real, la IA coloca a tu persona dentro de ese espacio — no pegada sobre él.' },
  { icon: '👗', title: 'Outfit fidelity', body: 'Cada detalle del outfit — textura, costuras, colores — se bloquea desde la referencia. Nada se inventa.' },
  { icon: '📱', title: 'Estética iPhone', body: 'Los prompts están calibrados para que el resultado parezca una foto tomada con iPhone, no un render de estudio.' },
  { icon: '🔒', title: 'Identity Lock', body: 'La cara de referencia aparece varias veces en el prompt a propósito — es para que la IA le dé prioridad máxima sobre cualquier otra imagen.' },
  { icon: '✨', title: 'Sin filtros', body: 'Luz IA instruye explícitamente a la IA que NO aplique filtros de belleza ni suavizado de piel — lo real siempre se ve mejor en UGC.' },
  { icon: '💡', title: 'La luz lo es todo', body: 'En fotografía UGC, la iluminación natural siempre gana. Por eso los prompts priorizan luz de ventana y ambientes reales sobre cualquier set artificial.' },
  { icon: '🧠', title: 'GPT Image y Gemini', body: 'Gemini entiende instrucciones complejas mejor para multirreferencia. GPT Image tiende a generar texturas más fotográficas. Cada uno tiene su fortaleza.' },
  { icon: '🎯', title: 'Elige al protagonista', body: 'Puedes centrar la sesión en una persona, un producto, un look o un lugar.' },
  { icon: '🔄', title: 'Una sesión coherente', body: 'Cada foto usará la foto base para mantener el ambiente, los colores y la misma persona.' },
  { icon: '📐', title: 'Formato 3:4', body: 'El ratio vertical 3:4 es el estándar de feed de Instagram y TikTok — cada imagen sale lista para publicar sin recortar.' },
];

const QUOTES = [
  { text: 'El mejor contenido UGC parece que lo tomó un amigo, no una agencia.', author: 'Principio UGC' },
  { text: 'Las mejores fotos se sienten naturales.', author: 'Luz IA' },
  { text: 'Una sola foto real vale más que diez renders perfectos.', author: 'Marketing digital' },
  { text: 'La cara de tu persona es la firma de toda la sesión.', author: 'Identity Lock' },
  { text: 'Confianza se construye mostrando el producto en uso, no en exhibición.', author: 'UGC Marketing' },
];

interface MasterLoaderProps {
  modelId: 'gemini' | 'gptimage';
  focus: string;
}

export function MasterLoader({ modelId, focus }: MasterLoaderProps) {
  const [cardIndex, setCardIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [quoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [isFlipping, setIsFlipping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dots, setDots] = useState('');

  // Rotar tip cada 6 segundos
  useEffect(() => {
    const id = setInterval(() => {
      setIsFlipping(true);
      setTimeout(() => {
        setCardIndex(i => (i + 1) % TIPS.length);
        setIsFlipping(false);
      }, 300);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  // Contador de segundos
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Puntos animados
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 600);
    return () => clearInterval(id);
  }, []);

  const tip = TIPS[cardIndex];
  const quote = QUOTES[quoteIndex];

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const getPhaseLabel = () => {
    if (elapsed < 8) return 'Analizando referencias';
    if (elapsed < 20) return 'Construyendo la escena';
    if (elapsed < 40) return 'Posicionando a tu persona';
    if (elapsed < 60) return 'Ajustando luz y color';
    return 'Finalizando detalles';
  };

  return (
    <div className="min-h-[600px] flex flex-col items-center justify-center bg-slate-900 rounded-[40px] md:rounded-[64px] border-8 border-slate-800 shadow-2xl p-6 md:p-12 mx-4 animate-in zoom-in">

      {/* Spinner + estado */}
      <div className="flex flex-col items-center gap-4 mb-10">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-brand-500 animate-spin shadow-[0_0_30px_rgba(247,44,91,0.3)]" />
          <div className="absolute inset-3 rounded-full border-2 border-white/5 border-b-brand-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
        <div className="text-center">
          <p className="text-white font-black text-lg tracking-tight">
            {getPhaseLabel()}{dots}
          </p>
          <p className="text-slate-500 text-xs mt-1 tracking-[0.3em] uppercase">
            {modelId === 'gptimage' ? 'GPT IMAGE 2' : 'GEMINI'} · {focus} · {formatTime(elapsed)}
          </p>
        </div>
      </div>

      {/* Barra de fases */}
      <div className="w-full max-w-sm mb-10">
        <div className="flex justify-between text-[9px] text-slate-600 uppercase tracking-widest mb-2 font-bold">
          <span className={elapsed >= 0 ? 'text-brand-500' : ''}>Análisis</span>
          <span className={elapsed >= 8 ? 'text-brand-500' : ''}>Composición</span>
          <span className={elapsed >= 20 ? 'text-brand-500' : ''}>Persona</span>
          <span className={elapsed >= 40 ? 'text-brand-500' : ''}>Luz</span>
          <span className={elapsed >= 60 ? 'text-brand-500' : ''}>Final</span>
        </div>
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(95, (elapsed / 75) * 100)}%` }}
          />
        </div>
      </div>

      {/* Tarjeta de tip rotativa */}
      <div
        className={`w-full max-w-sm bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 mb-8 transition-all duration-300 ${isFlipping ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">{tip.icon}</span>
          <div>
            <p className="text-white font-black text-sm mb-1">{tip.title}</p>
            <p className="text-slate-400 text-xs leading-relaxed">{tip.body}</p>
          </div>
        </div>
        <div className="flex gap-1 mt-4 justify-center">
          {TIPS.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 rounded-full transition-all duration-300 ${i === cardIndex ? 'w-4 bg-brand-500' : 'w-1.5 bg-slate-700'}`}
            />
          ))}
        </div>
      </div>

      {/* Cita */}
      <div className="w-full max-w-sm text-center border-t border-slate-800 pt-6">
        <p className="text-slate-400 text-xs italic leading-relaxed">"{quote.text}"</p>
        <p className="text-slate-600 text-[10px] mt-2 uppercase tracking-widest">— {quote.author}</p>
      </div>
    </div>
  );
}
