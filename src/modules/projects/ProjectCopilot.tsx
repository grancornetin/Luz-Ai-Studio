/**
 * ProjectCopilot.tsx
 * Copiloto estratégico embebido en la vista de proyecto.
 * Analiza imágenes del proyecto, hace preguntas inteligentes,
 * propone planes y navega al módulo correcto con todo pre-configurado.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Send, Loader2, ImagePlus, XCircle,
  RotateCcw, ChevronRight, ArrowRight,
} from 'lucide-react';
import { Project } from '../../services/projectService';

// ── Tipos ─────────────────────────────────────────────────────
interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrls?: string[];       // imágenes adjuntas por el usuario
  actions?: CopilotAction[];  // botones de acción propuestos
}

interface CopilotAction {
  label: string;
  description: string;
  module: 'campaign' | 'photodump' | 'ugc' | 'catalog' | 'prompt';
  params: Record<string, string>;
}

interface ProjectCopilotProps {
  project: Project;
}

// ── System prompt del copiloto estratégico ────────────────────
function buildSystemPrompt(project: Project): string {
  const itemsSummary = project.items.length > 0
    ? `El proyecto tiene ${project.items.length} imagen(es): ${project.items.map(i => `[${i.type}: módulo ${i.module}]`).join(', ')}.`
    : 'El proyecto aún no tiene imágenes.';

  return `Eres el copiloto estratégico de LUZ IA Studio para el proyecto "${project.name}".
Tu rol es actuar como un director creativo y estratega de marketing digital especializado en emprendedores LATAM que venden productos físicos en Instagram, TikTok y e-commerce.

CONTEXTO DEL PROYECTO:
${itemsSummary}

TU PERSONALIDAD:
- Directa, cálida y sin jerga técnica. Hablás como una asesora de confianza, no como un robot.
- Hacés UNA pregunta a la vez, no tres juntas.
- Cuando tenés suficiente información, proponés un plan concreto y específico — nunca genérico.
- Entendés que Sofi (tu usuario típico) hace todo sola, tiene poco tiempo y quiere resultados que vendan.

MÓDULOS DE LA APP QUE PODÉS RECOMENDAR:
1. CAMPAIGN MODE (/prompt-studio?mode=campaign) — Para crear 3-5 imágenes de campaña con dirección creativa profesional. Parámetros: campaignType (product/brand/social/ecommerce), objective (sell/awareness/launch/engagement), audience (general/young/professional/luxury/family), imageCount (3/4/5), productDescription (texto URL-encoded), prompt (texto URL-encoded).
2. PHOTODUMP MODE (/prompt-studio?mode=photodump) — Para crear un set de imágenes con narrativa visual orgánica. Parámetros: narrative (day/journey/brand/character/custom), protagonist (person/product/both), count (3/4/5/6), customStory (texto URL-encoded), prompt (texto URL-encoded).
3. UGC STUDIO (/studio-pro) — Para crear contenido estilo creador real con un avatar/modelo. Ideal cuando tiene foto de su cara y quiere parecer que usa el producto.
4. PRODUCT CATALOG (/productos) — Para fotos de producto profesionales sobre fondo limpio o lifestyle. Requiere 1-4 fotos del producto.
5. PROMPT STUDIO (/prompt-studio) — Para generación libre avanzada.

CUÁNDO RECOMENDAR CADA MÓDULO:
- Tiene producto + quiere vender en Instagram → Campaign Mode (lanzamiento de producto)
- Quiere contenido orgánico tipo influencer → Photodump Mode (narrativa "día con el producto")
- Tiene foto de su cara + quiere aparecer usando el producto → UGC Studio (foco PRODUCT)
- Solo quiere fotos de catálogo limpias → Product Catalog
- Quiere total control creativo → Prompt Studio standard

FORMATO DE TUS RESPUESTAS:
- Texto plano conversacional. Sin markdown, sin asteriscos, sin listas con guiones.
- Para steps o puntos, usá números simples: 1. 2. 3.
- Cuando proponés un plan, terminá SIEMPRE con la sección: [ACCIONES] seguida de JSON válido.
- Ese JSON es un array de acciones que la app convierte en botones.

FORMATO DE ACCIONES (cuando estés listo para proponer):
[ACCIONES]
[{"label":"Ir a Campaign →","description":"Campaña de lanzamiento, 4 imágenes, audiencia jóvenes","module":"campaign","params":{"mode":"campaign","campaignType":"product","objective":"sell","audience":"young","imageCount":"4","productDescription":"chaqueta de cuero marrón"}}]

REGLAS:
- No propongas acciones hasta tener al menos: qué producto es, cuál es el objetivo y para quién.
- Si el usuario sube una imagen, analizala en relación al producto y el objetivo.
- Máximo 2-3 acciones por respuesta — no abrumes.
- Siempre que propongas un prompt base para el módulo, incluyelo como parámetro "prompt" URL-encoded.
- Si no sabés algo, preguntá. Pero UNA sola pregunta por turno.
- No hables de precios, créditos ni técnico interno.
- Responde siempre en el idioma del usuario.`;
}

// ── Compresión de imagen ──────────────────────────────────────
async function compressImage(file: File): Promise<{ data: string; mimeType: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      const preview = dataUrl;
      const data = dataUrl.split(',')[1];
      resolve({ data, mimeType: 'image/jpeg', preview });
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Llamada a Gemini ──────────────────────────────────────────
async function callCopilot(
  systemPrompt: string,
  messages: CopilotMessage[],
  imageData?: { data: string; mimeType: string },
): Promise<string> {
  const history = messages
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Copiloto'}: ${m.content}`)
    .join('\n\n');

  const fullPrompt = `${systemPrompt}\n\n---\n\n${history}\n\nCopiloto:`;

  const body: Record<string, unknown> = {
    action: 'assistantChat',
    prompt: fullPrompt,
    model: 'gemini-2.5-flash',
  };

  if (imageData) {
    body.images    = [imageData.data];
    body.mimeTypes = [imageData.mimeType];
  }

  const res = await fetch('/api/gemini/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Error en el copiloto');
  return data.text || '';
}

// ── Parser de respuesta: separa texto de acciones ─────────────
function parseResponse(raw: string): { text: string; actions: CopilotAction[] } {
  const marker = '[ACCIONES]';
  const idx = raw.indexOf(marker);
  if (idx === -1) return { text: cleanText(raw), actions: [] };

  const textPart    = raw.slice(0, idx).trim();
  const actionsPart = raw.slice(idx + marker.length).trim();

  let actions: CopilotAction[] = [];
  try {
    const match = actionsPart.match(/\[[\s\S]*\]/);
    if (match) actions = JSON.parse(match[0]);
  } catch {
    // si no parsea, no hay acciones
  }

  return { text: cleanText(textPart), actions };
}

function cleanText(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Sugerencias iniciales ─────────────────────────────────────
const INITIAL_SUGGESTIONS = [
  'Quiero vender mi producto en Instagram',
  'Necesito contenido para lanzar un producto nuevo',
  'Quiero hacer fotos de catálogo profesionales',
  'Ayúdame a planear contenido para esta semana',
];

// ── Componente principal ──────────────────────────────────────
const ProjectCopilot: React.FC<ProjectCopilotProps> = ({ project }) => {
  const navigate = useNavigate();

  const [messages,      setMessages]      = useState<CopilotMessage[]>([]);
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [pendingImage,  setPendingImage]  = useState<{ file: File; preview: string; data: string; mimeType: string } | null>(null);
  const [compressing,   setCompressing]   = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  // Saludo inicial
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Hola! Soy tu copiloto para el proyecto "${project.name}".\n\nSubí una foto de tu producto o contame qué querés lograr, y te ayudo a crear un plan de contenido concreto paso a paso.`,
    }]);
  }, [project.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file || !file.type.startsWith('image/')) return;

    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setPendingImage({ file, ...compressed });
    } catch {
      // silencioso
    } finally {
      setCompressing(false);
    }
  };

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if ((!content && !pendingImage) || loading) return;

    const imageData = pendingImage ? { data: pendingImage.data, mimeType: pendingImage.mimeType } : undefined;
    const previewUrl = pendingImage?.preview;

    const userMsg: CopilotMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content || '(imagen adjunta)',
      imageUrls: previewUrl ? [previewUrl] : undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImage(null);
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(project);
      const history = [...messages, userMsg].filter(m => m.id !== 'welcome');
      const raw = await callCopilot(systemPrompt, history, imageData);
      const { text, actions } = parseResponse(raw);

      setMessages(prev => [...prev, {
        id: Date.now().toString() + 'r',
        role: 'assistant',
        content: text,
        actions: actions.length > 0 ? actions : undefined,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + 'e',
        role: 'assistant',
        content: 'No pude conectarme en este momento. Intentá de nuevo.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, pendingImage, project]);

  const handleAction = (action: CopilotAction) => {
    // Construir URL con params del preset
    const params = new URLSearchParams(action.params);
    const routes: Record<string, string> = {
      campaign:  '/prompt-studio',
      photodump: '/prompt-studio',
      prompt:    '/prompt-studio',
      ugc:       '/studio-pro',
      catalog:   '/productos',
    };
    const base = routes[action.module] ?? '/prompt-studio';
    navigate(`${base}?${params.toString()}`);
  };

  const reset = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Hola! Soy tu copiloto para el proyecto "${project.name}".\n\nSubí una foto de tu producto o contame qué querés lograr.`,
    }]);
    setInput('');
    setPendingImage(null);
  };

  const canSend = (input.trim().length > 0 || !!pendingImage) && !loading && !compressing;

  // ── Render de un mensaje del asistente ───────────────────────
  const renderAssistantText = (text: string) =>
    text.split('\n').map((line, i) => {
      if (!line.trim()) return <br key={i} />;
      const numbered = line.match(/^(\d+)\.\s+(.+)$/);
      if (numbered) return (
        <div key={i} className="flex gap-2 my-1">
          <span className="text-indigo-500 font-black flex-shrink-0">{numbered[1]}.</span>
          <span>{numbered[2]}</span>
        </div>
      );
      return <span key={i} className="block">{line}</span>;
    });

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl overflow-hidden border border-white/10">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-indigo-600 flex-shrink-0">
        <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white uppercase tracking-widest leading-none">Copiloto del proyecto</p>
          <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest mt-0.5">Director creativo · Estratega de contenido</p>
        </div>
        {messages.length > 1 && (
          <button
            onClick={reset}
            className="w-7 h-7 bg-white/10 text-white/70 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"
            title="Nueva conversación"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 bg-indigo-600/30 border border-indigo-500/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-indigo-400" />
              </div>
            )}
            <div className="max-w-[88%] space-y-2">
              {/* Imagen adjunta por usuario */}
              {msg.imageUrls?.map((url, i) => (
                <img key={i} src={url} alt="adjunto" className="rounded-xl max-h-40 object-cover w-full border border-white/10" />
              ))}

              {/* Burbuja de texto */}
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-white/8 text-slate-200 rounded-tl-sm border border-white/10'
              }`}>
                {msg.role === 'assistant'
                  ? <div className="text-sm leading-relaxed space-y-0.5">{renderAssistantText(msg.content)}</div>
                  : <p>{msg.content}</p>
                }
              </div>

              {/* Botones de acción del copiloto */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="space-y-2 pt-1">
                  {msg.actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => handleAction(action)}
                      className="w-full text-left bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 hover:border-indigo-500/60 rounded-xl px-4 py-3 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-indigo-300 uppercase tracking-tight">{action.label}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{action.description}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-indigo-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading */}
        {(loading || compressing) && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 bg-indigo-600/30 border border-indigo-500/30 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3 h-3 text-indigo-400" />
            </div>
            <div className="bg-white/8 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              <span className="text-xs text-slate-400 font-medium">
                {compressing ? 'Procesando imagen...' : 'Pensando...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sugerencias iniciales */}
      {messages.length <= 1 && !loading && (
        <div className="px-4 pb-3 space-y-1.5 flex-shrink-0">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Por dónde empezar</p>
          {INITIAL_SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s)}
              className="w-full text-left px-3 py-2 bg-white/5 hover:bg-indigo-600/20 hover:text-indigo-300 text-slate-400 rounded-xl text-xs font-medium transition-colors border border-white/8 hover:border-indigo-500/30 flex items-center justify-between gap-2"
            >
              <span>{s}</span>
              <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
            </button>
          ))}
        </div>
      )}

      {/* Preview imagen pendiente */}
      {pendingImage && (
        <div className="px-4 pt-2 flex-shrink-0">
          <div className="relative inline-block">
            <img src={pendingImage.preview} alt="preview" className="h-14 w-14 object-cover rounded-xl border border-white/20" />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-700 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/10 flex-shrink-0 flex gap-2 items-center">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="w-9 h-9 bg-white/5 text-slate-500 rounded-xl flex items-center justify-center hover:bg-indigo-600/20 hover:text-indigo-400 disabled:opacity-30 transition-colors flex-shrink-0"
          title="Adjuntar imagen"
        >
          <ImagePlus className="w-4 h-4" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Contame qué querés lograr..."
          disabled={loading}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!canSend}
          className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-30 transition-all flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ProjectCopilot;
