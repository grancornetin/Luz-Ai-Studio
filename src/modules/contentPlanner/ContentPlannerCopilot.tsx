/**
 * ContentPlannerCopilot.tsx
 * Copiloto elevado del Publicar Studio.
 * Extiende el ProjectCopilot con:
 *   - Remix Engine: genera 20-30 ideas de posts desde pocas fotos
 *   - Plan semanal completo (tipo + caption + módulo + horario)
 *   - Captions por plataforma listos para copiar
 *   - Navegación a todos los módulos de generación
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Send, Loader2, ImagePlus, XCircle,
  RotateCcw, ChevronRight, ArrowRight, Copy, Check,
  Instagram, Hash, ShoppingBag, Play, Lightbulb,
} from 'lucide-react';
import {
  Project, ProjectMessage, ProjectBrief, ChecklistItem, CalendarEntry,
  saveConversation, saveBrief, saveChecklist, saveCalendar,
} from '../../services/projectService';
import { getAuth } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import { RemixIdea } from './RemixIdeasGrid';

// ── Tipos ─────────────────────────────────────────────────────

type ActionModule = 'campaign' | 'photodump' | 'ugc' | 'catalog' | 'prompt' | 'scene' | 'outfit';

interface CopilotAction {
  type?: 'navigate' | 'captions' | 'checklist' | 'calendar' | 'remix';
  label: string;
  description: string;
  module?: ActionModule;
  params?: Record<string, string>;
  captions?: GeneratedCaptions;
  checklist?: ChecklistItem[];
  calendar?: CalendarEntry[];
  remixIdeas?: RemixIdea[];
}

interface GeneratedCaptions {
  instagram: string;
  tiktok: string;
  ecommerce: string;
  hashtags: string;
}

interface Props {
  project: Project;
  onCalendarUpdate?: (calendar: CalendarEntry[]) => void;
  onChecklistUpdate?: (checklist: ChecklistItem[]) => void;
  onRemixIdeas?: (ideas: RemixIdea[]) => void;
  onNavigateModule?: (path: string) => void;
}

// ── System prompt ─────────────────────────────────────────────

function buildSystemPrompt(project: Project): string {
  const itemsSummary = project.items.length > 0
    ? `El proyecto tiene ${project.items.length} imagen(es): ${project.items.map(i => `[${i.type}: ${i.module}]`).join(', ')}.`
    : 'El proyecto aún no tiene imágenes.';

  const refItems    = project.items.filter(i => i.type === 'reference');
  const resultItems = project.items.filter(i => i.type === 'result');

  const briefContext = project.brief
    ? `BRIEF CONOCIDO:\n- Producto: ${project.brief.productDescription}\n- Objetivo: ${project.brief.goal}\n- Audiencia: ${project.brief.audience}\n- Plataforma: ${project.brief.platform}`
    : 'Sin brief definido aún.';

  const checklistCtx = project.checklist?.length
    ? `PLAN ACTUAL:\n${project.checklist.map(i => `- [${i.status}] ${i.label}`).join('\n')}`
    : '';

  const calendarCtx = project.calendar?.length
    ? `CALENDARIO: ${project.calendar.length} entradas, ${project.calendar.filter(e => e.status === 'done').length} completadas.`
    : '';

  return `Eres el Copiloto de Publicar Studio de LUZ IA Studio, para el proyecto "${project.name}".
Tu rol es ser directora creativa y estratega de contenido para emprendedoras LATAM que venden productos físicos en Instagram, TikTok y tienda online.

CONTEXTO DEL PROYECTO:
${itemsSummary}
- Referencias subidas: ${refItems.length}
- Generaciones completadas: ${resultItems.length}
${briefContext}
${checklistCtx}
${calendarCtx}

TU PERSONALIDAD:
- Directa, cálida, sin jerga técnica. Como una asesora de confianza.
- Una pregunta a la vez, nunca tres juntas.
- Cuando tenés suficiente info, proponés planes concretos, nunca genéricos.
- Entendés que tu usuaria lo hace sola y tiene poco tiempo.
- Si ya tenés brief, no volvés a preguntar lo mismo.

MÓDULOS DISPONIBLES PARA NAVEGAR:
1. CAMPAIGN MODE     → /prompt-studio?mode=campaign    (campaña de lanzamiento con varias imágenes)
2. PHOTODUMP MODE    → /prompt-studio?mode=photodump   (contenido orgánico tipo influencer)
3. UGC STUDIO        → /studio-pro                     (fotos estilo creador usando el producto)
4. PRODUCT STUDIO    → /productos                      (fotos de catálogo del producto)
5. SCENE CLONE       → /clonar                         (clonar escena de referencia)
6. OUTFIT EXTRACTOR  → /outfit-extractor               (extraer prendas de una foto)
7. PROMPT STUDIO     → /prompt-studio                  (generación libre)

CUÁNDO USAR CADA MÓDULO:
- Lanzar un producto → Campaign Mode
- Contenido orgánico diario → Photodump
- Aparecer usando el producto → UGC Studio
- Fotos de catálogo → Product Studio
- Inspirarse en una foto de Pinterest → Scene Clone
- Vender ropa extraída de una foto → Outfit Extractor

CAPACIDADES ESPECIALES — usálas siempre que el contexto lo pida:

A) CAPTIONS LISTOS: Cuando la usuaria tiene imágenes o pide texto para publicar.
   Devolvé el bloque [CAPTIONS] con JSON.

B) PLAN DE CONTENIDO: Cuando proponés pasos o un plan con varios módulos.
   Devolvé el bloque [CHECKLIST] con JSON.

C) CALENDARIO SEMANAL: Cuando pide un plan semanal, calendario de contenido, o quiere publicar X veces por semana.
   Devolvé el bloque [CALENDAR] con JSON. Cada entrada tiene: tipo de post, caption gancho, módulo sugerido, y mejor horario.
   Hoy es: ${new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

D) REMIX ENGINE: Cuando la usuaria quiere "más ideas de contenido" a partir de fotos que ya tiene, o no sabe qué publicar.
   Generá 20-25 ideas de posts distintos con el mismo producto.
   Devolvé el bloque [REMIX] con JSON array.

FORMATO DE BLOQUES ESPECIALES (siempre al final del texto):

Para navegación:
[ACCIONES]
[{"type":"navigate","label":"Ir a Campaign →","description":"Campaña de lanzamiento, 4 imágenes","module":"campaign","params":{"mode":"campaign","campaignType":"product","objective":"sell","audience":"young","imageCount":"4"}}]

Para captions:
[CAPTIONS]
{"instagram":"caption con emojis y tono cercano","tiktok":"caption corto y energético","ecommerce":"descripción formal para tienda","hashtags":"#hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5 #hashtag6 #hashtag7 #hashtag8 #hashtag9 #hashtag10"}

Para checklist:
[CHECKLIST]
[{"id":"1","label":"Campaña lanzamiento — 4 imágenes","module":"campaign","params":{"mode":"campaign","campaignType":"product"},"status":"pending","createdAt":${Date.now()}}]

Para calendario:
[CALENDAR]
[{"id":"1","date":"2026-05-12","dayLabel":"Martes 12 mayo","contentType":"Foto de producto","module":"catalog","params":{},"prompt":"foto catálogo fondo blanco","status":"pending","notes":"19:00 hs — mejor horario LATAM"},{"id":"2","date":"2026-05-14","dayLabel":"Jueves 14 mayo","contentType":"Contenido UGC","module":"ugc","params":{},"prompt":"estilo influencer usando el producto","status":"pending","notes":"20:00 hs"}]

Para remix engine:
[REMIX]
[{"id":"1","postType":"Behind the scenes","hook":"¿Cuánto tardé en hacer esto?","captionIdea":"Mostrá el proceso de empaquetar o preparar el pedido","imageDescription":"Close-up de tus manos preparando el producto","moduleToUse":"photodump","moduleLabel":"Photodump Mode","alreadyHaveImage":false},{"id":"2","postType":"Detalle de producto","hook":"Hay algo hipnótico en esta textura...","captionIdea":"Primer plano de la textura, material o acabado del producto","imageDescription":"Macro shot de la superficie del producto","moduleToUse":"prompt","moduleLabel":"Prompt Studio","alreadyHaveImage":false}]

REGLAS:
- No propongas acciones de navegación hasta tener: producto + objetivo + plataforma.
- Máximo 2-3 acciones por respuesta.
- Si ya hay brief, arrancá directo con propuestas.
- Los calendarios deben tener entre 5 y 14 entradas (nunca más).
- El remix debe tener entre 15 y 25 ideas, todas distintas en tipo y ángulo.
- Texto plano conversacional. Sin markdown, sin asteriscos, sin # de títulos.
- Respondé siempre en español.`;
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

// ── Llamada Gemini ────────────────────────────────────────────

async function callCopilot(
  systemPrompt: string,
  messages: ProjectMessage[],
  imageData?: { data: string; mimeType: string },
): Promise<string> {
  // Últimos 12 mensajes, texto conversacional únicamente.
  // Los mensajes del asistente ya tienen los bloques especiales ([REMIX], [CALENDAR], etc.)
  // removidos por parseResponse antes de guardarse en `content` — no hace falta limpiar aquí.
  // Truncamos cada mensaje a 600 chars para evitar superar el límite de 48.000 del endpoint.
  const recent = messages.slice(-12);
  const history = recent
    .map(m => {
      const role    = m.role === 'user' ? 'Usuario' : 'Copiloto';
      const content = m.content.length > 600 ? m.content.slice(0, 600) + '…' : m.content;
      return `${role}: ${content}`;
    })
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

  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/gemini/content', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error('[callCopilot] HTTP', res.status, errBody);
    throw new Error(`API error ${res.status}: ${errBody}`);
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Error en el copiloto');
  return data.text || '';
}

// ── Parser de respuesta ───────────────────────────────────────

interface ParsedResponse {
  text: string;
  actions: CopilotAction[];
}

function parseResponse(raw: string): ParsedResponse {
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
  const remixRaw     = extractBlock('[REMIX]');

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
        actions.push({ type: 'captions', label: 'Captions listos', description: 'Para Instagram, TikTok y tienda', captions });
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
        actions.push({ type: 'calendar', label: 'Calendario generado', description: `${calendar.length} días planificados`, calendar });
      }
    } catch { /* silencioso */ }
  }

  if (remixRaw) {
    try {
      const match = remixRaw.match(/\[[\s\S]*\]/);
      if (match) {
        const remixIdeas: RemixIdea[] = JSON.parse(match[0]);
        actions.push({ type: 'remix', label: 'Ideas de Remix', description: `${remixIdeas.length} ideas generadas`, remixIdeas });
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
  'Generame un plan para esta semana',
  'Dame 25 ideas de posts con mi producto',
  'Creame captions para mis fotos de Instagram',
  'Qué publico mañana para generar ventas',
];

// ── Sub-componente: CaptionsPanel ─────────────────────────────

const CaptionsPanel: React.FC<{ captions: GeneratedCaptions }> = ({ captions }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const entries = [
    { key: 'instagram', icon: <Instagram className="w-3.5 h-3.5" />, label: 'Instagram', color: 'text-pink-500',    value: captions.instagram },
    { key: 'tiktok',    icon: <Play className="w-3.5 h-3.5" />,       label: 'TikTok',    color: 'text-cyan-500',    value: captions.tiktok },
    { key: 'ecommerce', icon: <ShoppingBag className="w-3.5 h-3.5" />, label: 'Tienda',   color: 'text-emerald-500', value: captions.ecommerce },
    { key: 'hashtags',  icon: <Hash className="w-3.5 h-3.5" />,       label: 'Hashtags',  color: 'text-violet-500',  value: captions.hashtags },
  ];

  return (
    <div className="space-y-2 mt-2">
      {entries.map(e => (
        <div key={e.key} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className={`flex items-center gap-1.5 ${e.color}`}>
              {e.icon}
              <span className="text-[9px] font-black uppercase tracking-widest">{e.label}</span>
            </div>
            <button
              onClick={() => copy(e.key, e.value)}
              className="w-6 h-6 bg-slate-200 hover:bg-slate-300 text-slate-500 hover:text-slate-700 rounded-lg flex items-center justify-center transition-all"
            >
              {copied === e.key ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-700 leading-relaxed">{e.value}</p>
        </div>
      ))}
    </div>
  );
};

// ── Sub-componente: ChecklistPreview ──────────────────────────

const ChecklistPreview: React.FC<{
  checklist: ChecklistItem[];
  onSave: (c: ChecklistItem[]) => void;
}> = ({ checklist, onSave }) => {
  const [items, setItems] = useState(checklist);
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: i.status === 'done' ? 'pending' : 'done' } : i));

  const handleSave = () => {
    onSave(items);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plan de contenido</p>
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2">
          <button
            onClick={() => toggle(item.id)}
            className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${
              item.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
            }`}
          >
            {item.status === 'done' && <Check className="w-2.5 h-2.5 text-white" />}
          </button>
          <span className={`text-[11px] flex-1 ${item.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
            {item.label}
          </span>
        </div>
      ))}
      <button
        onClick={handleSave}
        className="w-full mt-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border"
        style={{ background: 'rgba(247,44,91,0.06)', borderColor: 'rgba(247,44,91,0.2)', color: '#F72C5B' }}
      >
        {saved ? <><Check className="w-3 h-3" /> Guardado</> : 'Guardar en el proyecto'}
      </button>
    </div>
  );
};

// ── Sub-componente: CalendarPreview ───────────────────────────

const CalendarPreview: React.FC<{
  calendar: CalendarEntry[];
  onSave: (c: CalendarEntry[]) => void;
}> = ({ calendar, onSave }) => {
  const [saved, setSaved] = useState(false);

  const moduleColor: Record<string, string> = {
    campaign:  'bg-rose-50 border-rose-200 text-rose-700',
    photodump: 'bg-violet-50 border-violet-200 text-violet-700',
    ugc:       'bg-emerald-50 border-emerald-200 text-emerald-700',
    catalog:   'bg-sky-50 border-sky-200 text-sky-700',
    prompt:    'bg-slate-50 border-slate-200 text-slate-700',
    scene:     'bg-amber-50 border-amber-200 text-amber-700',
    outfit:    'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700',
  };

  const handleSave = () => {
    onSave(calendar);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Calendario generado</p>
      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {calendar.map(entry => (
          <div key={entry.id} className={`flex items-start gap-2 p-2 rounded-lg border ${moduleColor[entry.module] || moduleColor.prompt}`}>
            <div className="flex-shrink-0 text-center min-w-[36px]">
              <p className="text-[8px] font-black uppercase opacity-60">{entry.dayLabel.split(' ')[0]}</p>
              <p className="text-sm font-black leading-none">{entry.dayLabel.split(' ')[1]}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-tight leading-tight">{entry.contentType}</p>
              <p className="text-[9px] opacity-60 truncate mt-0.5">{entry.prompt}</p>
              {entry.notes && <p className="text-[9px] opacity-50 mt-0.5">{entry.notes}</p>}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        className="w-full mt-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border"
        style={{ background: 'rgba(247,44,91,0.06)', borderColor: 'rgba(247,44,91,0.2)', color: '#F72C5B' }}
      >
        {saved ? <><Check className="w-3 h-3" /> Guardado</> : 'Guardar calendario'}
      </button>
    </div>
  );
};

// ── Sub-componente: RemixPreview ──────────────────────────────

const RemixPreview: React.FC<{
  ideas: RemixIdea[];
  onOpen: () => void;
}> = ({ ideas, onOpen }) => (
  <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{ideas.length} ideas generadas</p>
      </div>
      <button
        onClick={onOpen}
        className="text-[9px] font-black uppercase tracking-widest transition-colors"
        style={{ color: '#F72C5B' }}
      >
        Ver todas →
      </button>
    </div>
    <div className="space-y-1">
      {ideas.slice(0, 4).map(idea => (
        <div key={idea.id} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg">
          <span className="text-[9px] font-black uppercase text-amber-600 flex-shrink-0">{idea.postType}</span>
          <span className="text-[10px] text-slate-600 truncate">{idea.hook}</span>
        </div>
      ))}
      {ideas.length > 4 && (
        <p className="text-[9px] text-slate-400 text-center py-1">+{ideas.length - 4} ideas más...</p>
      )}
    </div>
  </div>
);

// ── Componente principal ──────────────────────────────────────

const ContentPlannerCopilot: React.FC<Props> = ({
  project,
  onCalendarUpdate,
  onChecklistUpdate,
  onRemixIdeas,
  onNavigateModule,
}) => {
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

  // ── Cargar conversación ──────────────────────────────────────
  useEffect(() => {
    skipSaveRef.current = true;

    if (project.conversation && project.conversation.length > 0) {
      setMessages(project.conversation);
    } else {
      const greeting = project.brief?.productDescription
        ? `¡Hola de nuevo! Seguimos con "${project.name}".\n\nRecuerdo que trabajamos con ${project.brief.productDescription}. ¿Qué publicamos esta semana?`
        : `Hola! Soy tu copiloto para "${project.name}".\n\nContame qué vendés o subí una foto de tu producto y te armo el plan de contenido para esta semana.`;

      setMessages([{ id: 'welcome', role: 'assistant', content: greeting, timestamp: Date.now() }]);
    }

    setInitialized(true);
    setTimeout(() => { skipSaveRef.current = false; }, 100);
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll automático ────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Guardar conversación en Firestore (debounced) ─────────────
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
    } finally { setCompressing(false); }
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
      const { text: replyText, actions } = parseResponse(raw);

      const assistantMsg: ProjectMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: replyText,
        actions: actions.length > 0 ? actions : undefined,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      tryExtractBrief(content, project);

    } catch (err: any) {
      console.error('[ContentPlannerCopilot] error:', err?.message || err);
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'assistant',
        content: 'No pude conectarme en este momento. Intentá de nuevo en unos segundos.',
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, pendingImage, project]);

  // ── Heurística brief ─────────────────────────────────────────
  const tryExtractBrief = (userText: string, proj: Project) => {
    if (proj.brief?.productDescription) return;
    const hasProduct  = userText.length > 10;
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
        campaign:  '/prompt-studio',
        photodump: '/prompt-studio',
        prompt:    '/prompt-studio',
        ugc:       '/studio-pro',
        catalog:   '/productos',
        scene:     '/clonar',
        outfit:    '/outfit-extractor',
      };
      const path = `${routes[action.module]}?${new URLSearchParams(action.params).toString()}`;
      onNavigateModule?.(path);
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

  const handleRemixOpen = (ideas: RemixIdea[]) => {
    onRemixIdeas?.(ideas);
  };

  const reset = () => {
    skipSaveRef.current = true;
    const greeting = `Empecemos de nuevo. ¿Qué querés planificar esta semana?`;
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
          <span className="font-black flex-shrink-0" style={{ color: '#F72C5B' }}>{n[1]}.</span>
          <span>{n[2]}</span>
        </div>
      );
      return <span key={i} className="block">{line}</span>;
    });

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ height: '70vh', minHeight: '520px' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0 border-b border-slate-100" style={{ background: '#F72C5B' }}>
        <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white uppercase tracking-widest leading-none">Copiloto</p>
          <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">
            {project.brief ? `${project.brief.productDescription.slice(0, 30)}... · ${project.brief.platform}` : 'Directora creativa · Estrategia de contenido'}
          </p>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-slate-50/50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(247,44,91,0.12)' }}>
                <Sparkles className="w-3 h-3" style={{ color: '#F72C5B' }} />
              </div>
            )}
            <div className="max-w-[88%] space-y-2">
              {msg.imageUrls?.map((url, i) => (
                <img key={i} src={url} alt="adjunto" className="rounded-xl max-h-40 object-cover w-full border border-slate-200" />
              ))}

              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white rounded-tr-sm'
                  : 'bg-white text-slate-800 rounded-tl-sm border border-slate-200 shadow-sm'
              }`}
              style={msg.role === 'user' ? { background: '#F72C5B' } : {}}>
                {msg.role === 'assistant'
                  ? <div className="text-sm leading-relaxed space-y-0.5">{renderText(msg.content)}</div>
                  : <p>{msg.content}</p>
                }
              </div>

              {/* Acciones */}
              {msg.actions && (msg.actions as CopilotAction[]).length > 0 && (
                <div className="space-y-2 pt-1">
                  {(msg.actions as CopilotAction[]).map((action, i) => {
                    if (action.type === 'captions' && action.captions)
                      return <CaptionsPanel key={i} captions={action.captions} />;

                    if (action.type === 'checklist' && action.checklist)
                      return <ChecklistPreview key={i} checklist={action.checklist} onSave={handleChecklistSave} />;

                    if (action.type === 'calendar' && action.calendar)
                      return <CalendarPreview key={i} calendar={action.calendar} onSave={handleCalendarSave} />;

                    if (action.type === 'remix' && action.remixIdeas)
                      return <RemixPreview key={i} ideas={action.remixIdeas} onOpen={() => handleRemixOpen(action.remixIdeas!)} />;

                    // navigate
                    return (
                      <button
                        key={i}
                        onClick={() => handleAction(action)}
                        className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 transition-all group shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-tight" style={{ color: '#F72C5B' }}>{action.label}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{action.description}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" style={{ color: '#F72C5B' }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {(loading || compressing) && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(247,44,91,0.12)' }}>
              <Sparkles className="w-3 h-3" style={{ color: '#F72C5B' }} />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#F72C5B' }} />
              <span className="text-xs text-slate-500 font-medium">
                {compressing ? 'Procesando imagen...' : 'Pensando...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sugerencias iniciales */}
      {messages.length <= 1 && !loading && (
        <div className="px-4 pb-3 space-y-1.5 flex-shrink-0 bg-white border-t border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pt-2">Por dónde empezar</p>
          {INITIAL_SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s)}
              className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl text-xs font-medium transition-colors border border-slate-200 hover:border-rose-200 flex items-center justify-between gap-2"
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
            <img src={pendingImage.preview} alt="preview" className="h-14 w-14 object-cover rounded-xl border border-slate-200" />
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
      <div className="px-3 py-3 border-t border-slate-200 flex-shrink-0 flex gap-2 items-center bg-white">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="w-9 h-9 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 transition-colors flex-shrink-0"
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
          placeholder="¿Qué publicamos esta semana?"
          disabled={loading}
          className="flex-1 bg-slate-100 border border-transparent rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-rose-300 focus:bg-white transition-all disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!canSend}
          className="w-9 h-9 text-white rounded-xl flex items-center justify-center disabled:opacity-30 transition-all flex-shrink-0"
          style={{ background: '#F72C5B' }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ContentPlannerCopilot;
