/**
 * ProjectCopilot.tsx
 * Copiloto estratégico embebido en el workspace del proyecto.
 * Mejoras: memoria entre sesiones, análisis de imágenes del proyecto,
 * generador de captions, checklist de campaña, análisis de resultados.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Send, Loader2, ImagePlus, XCircle,
  RotateCcw, ChevronRight, ArrowRight, Copy, Check,
  Instagram, Hash, ShoppingBag, Play,
} from 'lucide-react';
import {
  Project, ProjectMessage, ProjectBrief, ChecklistItem, CalendarEntry,
  saveConversation, saveBrief, saveChecklist, saveCalendar,
} from '../../services/projectService';
import { v4 as uuidv4 } from 'uuid';

// ── Tipos internos ────────────────────────────────────────────

type ActionModule = 'campaign' | 'photodump' | 'ugc' | 'catalog' | 'prompt';

interface CopilotAction {
  type?: 'navigate' | 'captions' | 'checklist' | 'calendar' | 'analyze';
  label: string;
  description: string;
  module?: ActionModule;
  params?: Record<string, string>;
  captions?: GeneratedCaptions;
  checklist?: ChecklistItem[];
  calendar?: CalendarEntry[];
}

interface GeneratedCaptions {
  instagram: string;
  tiktok: string;
  ecommerce: string;
  hashtags: string;
}

interface ProjectCopilotProps {
  project: Project;
  onChecklistUpdate?: (checklist: ChecklistItem[]) => void;
  onCalendarUpdate?: (calendar: CalendarEntry[]) => void;
}

// ── System prompt ─────────────────────────────────────────────

function buildSystemPrompt(project: Project): string {
  const itemsSummary = project.items.length > 0
    ? `El proyecto tiene ${project.items.length} imagen(es): ${project.items.map(i => `[${i.type}: ${i.module}]`).join(', ')}.`
    : 'El proyecto aún no tiene imágenes.';

  const resultItems = project.items.filter(i => i.type === 'result');
  const refItems    = project.items.filter(i => i.type === 'reference');

  const briefContext = project.brief
    ? `BRIEF CONOCIDO DEL PROYECTO:\n- Producto: ${project.brief.productDescription}\n- Objetivo: ${project.brief.goal}\n- Audiencia: ${project.brief.audience}\n- Plataforma: ${project.brief.platform}`
    : 'Aún no hay brief definido para este proyecto.';

  const checklistContext = project.checklist && project.checklist.length > 0
    ? `PLAN DE CONTENIDO ACTUAL:\n${project.checklist.map(i => `- [${i.status}] ${i.label}`).join('\n')}`
    : '';

  const calendarContext = project.calendar && project.calendar.length > 0
    ? `CALENDARIO ACTIVO: ${project.calendar.length} entradas, ${project.calendar.filter(e => e.status === 'done').length} completadas.`
    : '';

  return `Eres el copiloto estratégico de LUZ IA Studio para el proyecto "${project.name}".
Tu rol es actuar como director creativo y estratega de marketing digital para emprendedoras LATAM que venden productos físicos.

CONTEXTO DEL PROYECTO:
${itemsSummary}
- Referencias subidas: ${refItems.length}
- Generaciones completadas: ${resultItems.length}
${briefContext}
${checklistContext}
${calendarContext}

TU PERSONALIDAD:
- Directa, cálida, sin jerga técnica. Como una asesora de confianza.
- Hacés UNA pregunta a la vez, nunca tres juntas.
- Cuando tenés suficiente info, proponés planes concretos, nunca genéricos.
- Entendés que tu usuaria hace todo sola, tiene poco tiempo y quiere resultados que vendan.
- Si ya tenés brief guardado, lo usás directamente sin volver a preguntar lo mismo.

MÓDULOS DISPONIBLES:
1. CAMPAIGN MODE → /prompt-studio?mode=campaign
   Params: campaignType(product/brand/social/ecommerce), objective(sell/awareness/launch/engagement), audience(general/young/professional/luxury/family), imageCount(3/4/5), productDescription(URL-encoded), prompt(URL-encoded)
2. PHOTODUMP MODE → /prompt-studio?mode=photodump
   Params: narrative(day/journey/brand/character/custom), protagonist(person/product/both), count(3/4/5/6), customStory(URL-encoded), prompt(URL-encoded)
3. UGC STUDIO → /studio-pro
4. PRODUCT CATALOG → /productos
5. PROMPT STUDIO → /prompt-studio

CUÁNDO USAR CADA MÓDULO:
- Producto + vender en redes → Campaign (lanzamiento)
- Contenido orgánico estilo influencer → Photodump
- Aparecer usando el producto → UGC Studio
- Solo fotos de catálogo → Product Catalog

CAPACIDADES ESPECIALES — usálas cuando el contexto lo pida:

A) GENERAR CAPTIONS: Cuando la usuaria ya tiene imágenes generadas o pide texto para publicar.
   Devolvé el bloque [CAPTIONS] con JSON.

B) CREAR CHECKLIST: Cuando proponés un plan con múltiples pasos o módulos.
   Devolvé el bloque [CHECKLIST] con JSON.

C) CREAR CALENDARIO: Cuando la usuaria pide un plan semanal, calendario de contenido o quiere publicar X veces por semana/mes.
   Devolvé el bloque [CALENDAR] con JSON. Usá fechas reales a partir de hoy.
   Hoy es: ${new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

D) ANALIZAR RESULTADOS: Cuando hay imágenes de tipo "result" en el proyecto y la usuaria pregunta qué hacer con ellas.
   Analizá y decile para qué sirve cada una (feed, stories, ads, catálogo).

FORMATO DE BLOQUES ESPECIALES (al final del texto, nunca en el medio):

Para navegación a módulo:
[ACCIONES]
[{"type":"navigate","label":"Ir a Campaign →","description":"Campaña de lanzamiento, 4 imágenes","module":"campaign","params":{"mode":"campaign","campaignType":"product","objective":"sell","audience":"young","imageCount":"4","productDescription":"crema hidratante"}}]

Para captions:
[CAPTIONS]
{"instagram":"caption de instagram con emojis y tono cercano","tiktok":"caption más corto y energético para TikTok","ecommerce":"descripción de producto más formal para tienda online","hashtags":"#hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5"}

Para checklist:
[CHECKLIST]
[{"id":"1","label":"Campaña de lanzamiento — 4 imágenes","module":"campaign","params":{"mode":"campaign","campaignType":"product"},"status":"pending","createdAt":${Date.now()}},{"id":"2","label":"Photodump lifestyle — 4 imágenes","module":"photodump","params":{"mode":"photodump","narrative":"day"},"status":"pending","createdAt":${Date.now()}}]

Para calendario semanal:
[CALENDAR]
[{"id":"1","date":"2026-05-07","dayLabel":"Jueves 7 mayo","contentType":"Campaña de lanzamiento","module":"campaign","params":{"mode":"campaign","campaignType":"product"},"prompt":"product shot...","status":"pending"},{"id":"2","date":"2026-05-09","dayLabel":"Sábado 9 mayo","contentType":"Photodump lifestyle","module":"photodump","params":{"mode":"photodump","narrative":"day"},"prompt":"lifestyle...","status":"pending"}]

REGLAS IMPORTANTES:
- No propongas acciones de navegación hasta tener: producto, objetivo y plataforma.
- Máximo 2-3 acciones por respuesta.
- Si ya hay brief guardado, arrancá directo con propuestas — no repitas preguntas ya respondidas.
- Si hay resultados en el proyecto (imágenes generadas), ofrecé analizarlos o crear captions.
- Los calendarios deben tener entre 5 y 14 entradas (nunca más).
- Responde siempre en el idioma del usuario.
- Texto plano conversacional. Sin markdown, sin asteriscos.`;
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
      resolve({ data: dataUrl.split(',')[1], mimeType: 'image/jpeg', preview: dataUrl });
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Llamada a Gemini ──────────────────────────────────────────

async function callCopilot(
  systemPrompt: string,
  messages: ProjectMessage[],
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

// ── Parser de respuesta ───────────────────────────────────────

interface ParsedResponse {
  text: string;
  actions: CopilotAction[];
  brief?: Partial<ProjectBrief>;
}

function parseResponse(raw: string, currentBrief?: ProjectBrief): ParsedResponse {
  const actions: CopilotAction[] = [];
  let text = raw;

  const extractBlock = (marker: string): string | null => {
    const idx = text.indexOf(marker);
    if (idx === -1) return null;
    const after = text.slice(idx + marker.length).trim();
    text = text.slice(0, idx).trim();
    return after;
  };

  const actionsRaw   = extractBlock('[ACCIONES]');
  const captionsRaw  = extractBlock('[CAPTIONS]');
  const checklistRaw = extractBlock('[CHECKLIST]');
  const calendarRaw  = extractBlock('[CALENDAR]');

  if (actionsRaw) {
    try {
      const match = actionsRaw.match(/\[[\s\S]*?\]/);
      if (match) {
        const parsed: CopilotAction[] = JSON.parse(match[0]);
        actions.push(...parsed.map(a => ({ ...a, type: 'navigate' as const })));
      }
    } catch { /* silencioso */ }
  }

  if (captionsRaw) {
    try {
      const match = captionsRaw.match(/\{[\s\S]*?\}/);
      if (match) {
        const captions: GeneratedCaptions = JSON.parse(match[0]);
        actions.push({ type: 'captions', label: 'Captions generados', description: 'Listos para copiar y publicar', captions });
      }
    } catch { /* silencioso */ }
  }

  if (checklistRaw) {
    try {
      const match = checklistRaw.match(/\[[\s\S]*\]/);
      if (match) {
        const checklist: ChecklistItem[] = JSON.parse(match[0]);
        actions.push({ type: 'checklist', label: 'Plan de contenido', description: `${checklist.length} tareas generadas`, checklist });
      }
    } catch { /* silencioso */ }
  }

  if (calendarRaw) {
    try {
      const match = calendarRaw.match(/\[[\s\S]*\]/);
      if (match) {
        const calendar: CalendarEntry[] = JSON.parse(match[0]);
        actions.push({ type: 'calendar', label: 'Calendario de contenido', description: `${calendar.length} días programados`, calendar });
      }
    } catch { /* silencioso */ }
  }

  return { text: cleanText(text), actions };
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
  'Crea un calendario de contenido para esta semana',
  'Necesito captions para mis imágenes',
  'Ayúdame a planear contenido para el lanzamiento',
];

// ── Sub-componente: Panel de Captions ─────────────────────────

const CaptionsPanel: React.FC<{ captions: GeneratedCaptions }> = ({ captions }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const entries = [
    { key: 'instagram', icon: <Instagram className="w-3.5 h-3.5" />, label: 'Instagram', color: 'text-pink-500',   value: captions.instagram },
    { key: 'tiktok',    icon: <Play className="w-3.5 h-3.5" />,      label: 'TikTok',    color: 'text-cyan-600',   value: captions.tiktok },
    { key: 'ecommerce', icon: <ShoppingBag className="w-3.5 h-3.5" />, label: 'Tienda',  color: 'text-emerald-600', value: captions.ecommerce },
    { key: 'hashtags',  icon: <Hash className="w-3.5 h-3.5" />,      label: 'Hashtags',  color: 'text-violet-600', value: captions.hashtags },
  ];

  return (
    <div className="space-y-2 mt-2">
      {entries.map(e => (
        <div key={e.key} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <div className={`flex items-center gap-1.5 ${e.color}`}>
              {e.icon}
              <span className="text-[9px] font-black uppercase tracking-widest">{e.label}</span>
            </div>
            <button
              onClick={() => copy(e.key, e.value)}
              className="w-6 h-6 bg-gray-100 hover:bg-[#FFF0F4] text-gray-400 hover:text-[#F72C5B] rounded-lg
                         flex items-center justify-center transition-all"
            >
              {copied === e.key
                ? <Check className="w-3 h-3 text-emerald-500" />
                : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <p className="text-[11px] text-gray-600 leading-relaxed">{e.value}</p>
        </div>
      ))}
    </div>
  );
};

// ── Sub-componente: Checklist inline ─────────────────────────

const ChecklistPreview: React.FC<{
  checklist: ChecklistItem[];
  onSave: (checklist: ChecklistItem[]) => void;
}> = ({ checklist, onSave }) => {
  const [items, setItems] = useState(checklist);
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) => {
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, status: i.status === 'done' ? 'pending' : 'done' } : i
    ));
  };

  const handleSave = () => {
    onSave(items);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mt-2 bg-white border border-gray-200 rounded-xl p-3 space-y-2 shadow-sm">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Plan de contenido</p>
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2">
          <button
            onClick={() => toggle(item.id)}
            className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${
              item.status === 'done'
                ? 'bg-emerald-500 border-emerald-500'
                : 'border-gray-300 hover:border-[#F72C5B]'
            }`}
          >
            {item.status === 'done' && <Check className="w-2.5 h-2.5 text-white" />}
          </button>
          <span className={`text-[11px] flex-1 ${item.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
            {item.label}
          </span>
        </div>
      ))}
      <button
        onClick={handleSave}
        className="w-full mt-1 py-2 bg-[#FFF0F4] hover:bg-[#fce0e7] border border-[#F72C5B]/20
                   rounded-lg text-[10px] font-black text-[#F72C5B] uppercase tracking-widest
                   transition-all flex items-center justify-center gap-1.5"
      >
        {saved ? <><Check className="w-3 h-3" /> Guardado</> : 'Guardar en el proyecto'}
      </button>
    </div>
  );
};

// ── Sub-componente: Calendario preview inline ─────────────────

const CalendarPreview: React.FC<{
  calendar: CalendarEntry[];
  onSave: (calendar: CalendarEntry[]) => void;
}> = ({ calendar, onSave }) => {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(calendar);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const moduleColor: Record<string, string> = {
    campaign:  'bg-[#FFF0F4] border-[#F72C5B]/20 text-[#F72C5B]',
    photodump: 'bg-violet-50  border-violet-200   text-violet-700',
    ugc:       'bg-emerald-50 border-emerald-200  text-emerald-700',
    catalog:   'bg-sky-50     border-sky-200      text-sky-700',
    prompt:    'bg-gray-50    border-gray-200     text-gray-600',
  };

  return (
    <div className="mt-2 bg-white border border-gray-200 rounded-xl p-3 space-y-2 shadow-sm">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Calendario generado</p>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {calendar.map(entry => (
          <div
            key={entry.id}
            className={`flex items-start gap-2 p-2 rounded-lg border ${moduleColor[entry.module] || moduleColor.prompt}`}
          >
            <div className="flex-shrink-0 text-center min-w-[36px]">
              <p className="text-[8px] font-black uppercase opacity-60">{entry.dayLabel.split(' ')[0]}</p>
              <p className="text-sm font-black leading-none">{entry.dayLabel.split(' ')[1]}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-tight leading-tight">{entry.contentType}</p>
              <p className="text-[9px] opacity-60 truncate mt-0.5">{entry.prompt}</p>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        className="w-full mt-1 py-2 bg-[#FFF0F4] hover:bg-[#fce0e7] border border-[#F72C5B]/20
                   rounded-lg text-[10px] font-black text-[#F72C5B] uppercase tracking-widest
                   transition-all flex items-center justify-center gap-1.5"
      >
        {saved ? <><Check className="w-3 h-3" /> Guardado</> : 'Guardar calendario'}
      </button>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────

const ProjectCopilot: React.FC<ProjectCopilotProps> = ({
  project,
  onChecklistUpdate,
  onCalendarUpdate,
}) => {
  const navigate = useNavigate();

  const [messages,     setMessages]     = useState<ProjectMessage[]>([]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string; data: string; mimeType: string } | null>(null);
  const [compressing,  setCompressing]  = useState(false);
  const [initialized,  setInitialized]  = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const skipSaveRef    = useRef(true);

  // ── Cargar conversación guardada ─────────────────────────────
  useEffect(() => {
    skipSaveRef.current = true;
    if (project.conversation && project.conversation.length > 0) {
      setMessages(project.conversation);
    } else {
      const greeting = project.brief?.productDescription
        ? `¡Hola de nuevo! Seguimos con "${project.name}".\n\nRecuerdo que estamos trabajando con ${project.brief.productDescription} para ${project.brief.goal}. ¿Continuamos desde donde dejamos o querés explorar algo nuevo?`
        : `Hola! Soy tu copiloto para el proyecto "${project.name}".\n\nSubí una foto de tu producto o contame qué querés lograr, y te ayudo a crear un plan de contenido concreto paso a paso.`;
      setMessages([{ id: 'welcome', role: 'assistant', content: greeting, timestamp: Date.now() }]);
    }
    setInitialized(true);
    setTimeout(() => { skipSaveRef.current = false; }, 100);
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll automático ────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Guardar en Firestore (debounced) ─────────────────────────
  useEffect(() => {
    if (!initialized || skipSaveRef.current || messages.length === 0) return;
    const timer = setTimeout(() => {
      saveConversation(project.id, messages).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [messages, project.id, initialized]);

  // ── Adjuntar imagen ──────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setPendingImage({ file, ...compressed });
    } catch { /* silencioso */ }
    finally { setCompressing(false); }
  };

  // ── Enviar mensaje ────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if ((!content && !pendingImage) || loading) return;

    const imageData  = pendingImage ? { data: pendingImage.data, mimeType: pendingImage.mimeType } : undefined;
    const previewUrl = pendingImage?.preview;

    const userMsg: ProjectMessage = {
      id: uuidv4(),
      role: 'user',
      content: content || '(imagen adjunta)',
      imageUrls: previewUrl ? [previewUrl] : undefined,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImage(null);
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(project);
      const history = [...messages, userMsg].filter(m => m.id !== 'welcome');
      const raw = await callCopilot(systemPrompt, history, imageData);
      const { text: replyText, actions } = parseResponse(raw, project.brief);

      const assistantMsg: ProjectMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: replyText,
        actions: actions.length > 0 ? actions : undefined,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      tryExtractAndSaveBrief(content, replyText, project);
    } catch {
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'assistant',
        content: 'No pude conectarme en este momento. Intentá de nuevo.',
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, pendingImage, project]);

  // ── Heurística brief ─────────────────────────────────────────
  const tryExtractAndSaveBrief = (userText: string, _replyText: string, proj: Project) => {
    if (proj.brief?.productDescription) return;
    const hasProduct   = userText.length > 10;
    const hasObjective = /vend|lanzar|promover|publicar|instagram|tiktok/i.test(userText);
    if (hasProduct && hasObjective) {
      saveBrief(proj.id, {
        productDescription: userText.slice(0, 120),
        goal: 'vender en redes sociales',
        audience: 'general',
        platform: /tiktok/i.test(userText) ? 'TikTok' : 'Instagram',
        suggestedModules: ['campaign', 'photodump'],
      }).catch(() => {});
    }
  };

  // ── Ejecutar acción ───────────────────────────────────────────
  const handleAction = (action: CopilotAction) => {
    if (action.type === 'navigate' && action.module && action.params) {
      const routes: Record<ActionModule, string> = {
        campaign: '/prompt-studio', photodump: '/prompt-studio', prompt: '/prompt-studio',
        ugc: '/studio-pro', catalog: '/productos',
      };
      navigate(`${routes[action.module]}?${new URLSearchParams(action.params).toString()}`);
    }
  };

  const handleChecklistSave = async (checklist: ChecklistItem[]) => {
    await saveChecklist(project.id, checklist).catch(() => {});
    onChecklistUpdate?.(checklist);
  };

  const handleCalendarSave = async (calendar: CalendarEntry[]) => {
    await saveCalendar(project.id, calendar).catch(() => {});
    onCalendarUpdate?.(calendar);
  };

  const reset = () => {
    skipSaveRef.current = true;
    const greeting = `Hola! Empecemos de nuevo con el proyecto "${project.name}". ¿En qué te ayudo?`;
    setMessages([{ id: 'welcome', role: 'assistant', content: greeting, timestamp: Date.now() }]);
    setInput('');
    setPendingImage(null);
    setTimeout(() => { skipSaveRef.current = false; }, 100);
  };

  const canSend = (input.trim().length > 0 || !!pendingImage) && !loading && !compressing;

  // ── Render texto del asistente ────────────────────────────────
  const renderText = (text: string) =>
    text.split('\n').map((line, i) => {
      if (!line.trim()) return <br key={i} />;
      const n = line.match(/^(\d+)\.\s+(.+)$/);
      if (n) return (
        <div key={i} className="flex gap-2 my-1">
          <span className="text-[#F72C5B] font-black flex-shrink-0">{n[1]}.</span>
          <span>{n[2]}</span>
        </div>
      );
      return <span key={i} className="block">{line}</span>;
    });

  // ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">

      {/* Header del copiloto */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-[#F72C5B] flex-shrink-0">
        <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white uppercase tracking-widest leading-none">
            Copiloto del proyecto
          </p>
          <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">
            {project.brief
              ? `Producto conocido · ${project.brief.platform}`
              : 'Director creativo · Estratega de contenido'}
          </p>
        </div>
        {messages.length > 1 && (
          <button
            onClick={reset}
            className="w-7 h-7 bg-white/15 text-white/80 rounded-xl flex items-center justify-center
                       hover:bg-white/25 transition-colors"
            title="Nueva conversación"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-gray-50/50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

            {/* Avatar asistente */}
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 bg-[#FFF0F4] border border-[#F72C5B]/20 rounded-full
                              flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-[#F72C5B]" />
              </div>
            )}

            <div className="max-w-[88%] space-y-2">
              {/* Imágenes adjuntas */}
              {msg.imageUrls?.map((url, i) => (
                <img
                  key={i} src={url} alt="adjunto"
                  className="rounded-xl max-h-40 object-cover w-full border border-gray-200 shadow-sm"
                />
              ))}

              {/* Burbuja */}
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#F72C5B] text-white rounded-tr-sm shadow-sm'
                  : 'bg-[#FFF0F4] text-gray-800 rounded-tl-sm border border-[#F72C5B]/15'
              }`}>
                {msg.role === 'assistant'
                  ? <div className="text-sm leading-relaxed space-y-0.5">{renderText(msg.content)}</div>
                  : <p>{msg.content}</p>
                }
              </div>

              {/* Acciones */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="space-y-2 pt-1">
                  {(msg.actions as CopilotAction[]).map((action, i) => {
                    if (action.type === 'captions' && action.captions) {
                      return <CaptionsPanel key={i} captions={action.captions} />;
                    }
                    if (action.type === 'checklist' && action.checklist) {
                      return <ChecklistPreview key={i} checklist={action.checklist} onSave={handleChecklistSave} />;
                    }
                    if (action.type === 'calendar' && action.calendar) {
                      return <CalendarPreview key={i} calendar={action.calendar} onSave={handleCalendarSave} />;
                    }
                    // navigate
                    return (
                      <button
                        key={i}
                        onClick={() => handleAction(action)}
                        className="w-full text-left bg-white hover:bg-[#FFF0F4] border border-gray-200
                                   hover:border-[#F72C5B]/30 rounded-xl px-4 py-3 transition-all group shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-[#F72C5B] uppercase tracking-tight">
                              {action.label}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                              {action.description}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-[#F72C5B] flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {(loading || compressing) && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 bg-[#FFF0F4] border border-[#F72C5B]/20 rounded-full
                            flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3 h-3 text-[#F72C5B]" />
            </div>
            <div className="bg-[#FFF0F4] border border-[#F72C5B]/15 rounded-2xl rounded-tl-sm
                            px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-[#F72C5B] animate-spin" />
              <span className="text-xs text-gray-500 font-medium">
                {compressing ? 'Procesando imagen...' : 'Pensando...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sugerencias iniciales */}
      {messages.length <= 1 && !loading && (
        <div className="px-4 pb-3 space-y-1.5 flex-shrink-0 bg-white border-t border-gray-100">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest pt-2">
            Por dónde empezar
          </p>
          {INITIAL_SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s)}
              className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-[#FFF0F4] hover:text-[#F72C5B]
                         text-gray-500 rounded-xl text-xs font-medium transition-colors
                         border border-gray-200 hover:border-[#F72C5B]/30
                         flex items-center justify-between gap-2"
            >
              <span>{s}</span>
              <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
            </button>
          ))}
        </div>
      )}

      {/* Preview imagen pendiente */}
      {pendingImage && (
        <div className="px-4 pt-2 flex-shrink-0 bg-white">
          <div className="relative inline-block">
            <img
              src={pendingImage.preview} alt="preview"
              className="h-14 w-14 object-cover rounded-xl border border-gray-200 shadow-sm"
            />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-200 text-gray-600 rounded-full
                         flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-100 flex-shrink-0 flex gap-2 items-center bg-white">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="w-9 h-9 bg-gray-100 text-gray-400 rounded-xl flex items-center justify-center
                     hover:bg-[#FFF0F4] hover:text-[#F72C5B] disabled:opacity-30 transition-colors flex-shrink-0"
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
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800
                     placeholder-gray-400 outline-none focus:border-[#F72C5B]/40 focus:ring-2 focus:ring-[#F72C5B]/8
                     transition-all disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!canSend}
          className="w-9 h-9 bg-[#F72C5B] text-white rounded-xl flex items-center justify-center
                     hover:bg-[#C4224A] disabled:opacity-30 transition-all flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ProjectCopilot;