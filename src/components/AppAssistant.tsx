/**
 * AppAssistant.tsx
 * ─────────────────────────────────────────────────────────────
 * Asistente flotante tipo chat con contexto completo de la app.
 * Usa claude-haiku-4-5 (modelo de texto, gratuito relativo,
 * sin generación de imágenes) vía la API de Anthropic.
 *
 * Features:
 *  - Botón flotante entre módulos (bottom-right)
 *  - Colapsable en PC y móvil
 *  - Contexto completo de todos los módulos
 *  - Guías paso a paso
 *  - No genera imágenes, solo texto
 * ─────────────────────────────────────────────────────────────
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, ChevronDown, Sparkles, RotateCcw } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ── App Context ───────────────────────────────────────────────
// Full knowledge base injected as system prompt
const SYSTEM_PROMPT = `Eres el asistente de LUZ IA Studio, una plataforma de producción publicitaria con IA generativa.
Tu misión es guiar a los usuarios, responder preguntas sobre la app y explicar cómo usar cada módulo.

CONOCIMIENTO COMPLETO DE LA PLATAFORMA:

## MÓDULOS DISPONIBLES

### 1. Model DNA · From Photos (/crear/clonar)
- Sube 1-3 fotos de una persona real (rostro, cuerpo, perfil)
- La IA extrae el ADN biométrico: rasgos faciales, tono de piel, build corporal
- Genera 4 imágenes técnicas: frontal, trasera, lateral, close-up de rostro
- Costo: 4 créditos
- Úsalo cuando: quieres crear un modelo digital a partir de una persona real

### 2. Model DNA · From Scratch (/crear/manual)
- Diseña una identidad digital nueva 100% sintética
- Configuras: género, etnia, edad, complexión, personalidad
- Sin necesidad de fotos reales
- Costo: 4 créditos
- Úsalo cuando: necesitas un modelo que no exista en la realidad

### 3. Biblioteca de Modelos (/modelos)
- Ver y gestionar todos los modelos creados
- Los modelos se usan como referencia de identidad en otros módulos
- Para usar un modelo: COPIA manualmente la imagen del modelo y pégala como referencia en el módulo que necesites

### 4. AI Generator / Prompt Studio (/prompt-studio)
- Generador de imágenes con prompts avanzados
- Usa @tokens para referenciar: @persona1, @producto1, @estilo1
- Sube imágenes de referencia en los slots de la derecha
- DNA structure: personas, productos, estilos, iluminación, fondo, composición
- Modos de output:
  * Standard: una imagen con control total
  * Campaign: múltiples imágenes del mismo sujeto en distintas escenas
  * Photodump: set de imágenes tipo lifestyle/travel diary coherente
- Costo: 2 créditos por imagen
- Úsalo cuando: quieres generar contenido con máximo control creativo

### 5. Content Studio Pro (/studio-pro)
- Genera contenido tipo UGC (User Generated Content) estilo iPhone orgánico
- Requiere: foto de modelo + foto de producto
- Modos: Avatar Focus, Product Focus, Outfit Focus, Scene Focus
- Sistema de bloqueo: bloquea identidad, producto, outfit o escena para mantener consistencia
- Costo: 4 créditos por imagen

### 6. Scene Clone (/clonar)
- Toma una foto existente y replica composición + pose + iluminación
- Reemplaza la identidad de la persona con la que elijas
- Pasos: 1) Sube la escena target 2) Elige identidad de reemplazo 3) Configura la escena base 4) Configura outfit
- Costo: 4 créditos
- IMPORTANTE: No hay conexión automática con la Biblioteca de Modelos. Para usar un modelo guardado, copia la imagen manualmente y súbela como referencia de identidad.

### 7. Outfit Kit (/outfit-extractor)
- Sube una foto de outfit completo
- La IA detecta y separa cada prenda automáticamente
- Genera renders "ghost" (prenda sin cuerpo) de cada pieza
- Puedes cambiar colores y texturas de cada prenda
- Costo: 1 crédito por extracción

### 8. Catálogo / Product shots (/productos)
- Genera fotografía comercial de productos
- Sube foto del producto y configura estilo de fotografía
- Costo: 1 crédito

### 9. Prompt Gallery (/prompt-gallery)
- Galería comunitaria tipo Pinterest
- Descubrir: ve prompts de toda la comunidad
- Guardados: tus prompts guardados, organizados en tableros
- Mis Prompts: prompts que has publicado
- Puedes: dar like, guardar, comentar, recrear (llevar al Prompt Studio), reportar

### 10. Mis Generaciones / Historial (/historial)
- Todas las imágenes que has generado en cualquier módulo
- Filtra por módulo, descarga individual o en ZIP
- Si tarda en cargar, puede ser un problema de conexión al servidor — usa el botón "Actualizar"

## SISTEMA DE CRÉDITOS
- Cada generación de imagen consume créditos según el módulo
- Plan Free: créditos limitados
- Plan Starter/Pro/Studio: más créditos
- Admin: créditos ilimitados (∞)
- Los créditos se ven en el Dashboard y en el menú lateral

## CÓMO USAR REFERENCIAS (importante)
- En AI Generator y Scene Clone puedes subir imágenes de referencia
- Las referencias guían a la IA sobre identidad, producto y estilo
- Para usar un modelo de tu Biblioteca: abre la biblioteca (/modelos), ve al modelo, descarga o copia la imagen, y súbela manualmente como referencia en el módulo destino
- En AI Generator: usa el slot "Persona 1", "Persona 2", etc.
- Máximo 4 referencias de personas + 4 de productos + 1 de estilo

## PHOTODUMP MODE (en AI Generator)
- Es el modo que genera un SET coherente de imágenes (como un photodump de Instagram)
- Escribe un prompt describiendo el contexto: "@persona1 visitando Nueva York"
- Sube la referencia de tu modelo en el slot Persona 1
- Elige cantidad (3-6) e intensidad de variación de escena
- La IA creará diferentes escenas coherentes con ese contexto: calles, restaurantes, landmarks, etc.

## PREGUNTAS FRECUENTES

P: ¿Cómo uso mis modelos en otros módulos?
R: Actualmente la conexión es manual. Ve a tu Biblioteca de Modelos, abre el modelo que quieres usar, guarda/descarga la imagen del modelo, y súbela como referencia en el módulo destino (por ejemplo, slot "Persona 1" en AI Generator).

P: ¿Por qué el historial no carga?
R: El historial se conecta a un servidor. Si tarda más de 5 segundos, haz click en "Actualizar". Si persiste, puede ser un problema de conexión — las imágenes más recientes pueden estar en tu dispositivo.

P: ¿Cómo publico un prompt en la Galería?
R: Ve a AI Generator (/prompt-studio), genera una imagen, y haz click en el botón "Publicar" que aparece sobre la imagen generada. Agrega título y tags, y elige si lo quieres guardar en un tablero.

P: ¿El Photodump respeta mi referencia de persona?
R: Sí. Sube tu referencia en el slot Persona 1 antes de generar. El Photodump Mode usa esa referencia en todas las imágenes del set para mantener consistencia de identidad.

P: ¿Cuántos créditos necesito?
R: AI Generator: 2 créditos/imagen. Content Studio, Scene Clone, Model DNA: 4 créditos/imagen. Outfit Kit, Catálogo: 1 crédito/extracción.

## TONO Y COMPORTAMIENTO
- Sé conciso y claro. El usuario probablemente está en medio de un workflow.
- Si preguntan por algo que no existe en la app, díselo claramente.
- Para guías paso a paso, usa listas numeradas.
- Siempre termina con una pregunta de seguimiento o una acción concreta.
- No finjas tener capacidades que no tienes (no generas imágenes, no accedes a los datos del usuario).
- Habla en español latinoamericano informal pero profesional.
- Sé breve: respuestas de 3-6 oraciones máximo, excepto cuando el usuario pida una guía completa.`;

// ── Suggested questions ──────────────────────────────────────
const SUGGESTIONS = [
  '¿Cómo uso mis modelos en otros módulos?',
  '¿Cómo funciona el Photodump Mode?',
  '¿Por qué no carga mi historial?',
  '¿Cómo publico un prompt en la galería?',
  'Guíame desde cero con AI Generator',
];

// ── API call ─────────────────────────────────────────────────
async function callAssistant(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || 'No pude generar una respuesta.';
}

// ── Markdown-lite renderer ───────────────────────────────────
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<p class="font-black text-slate-800 uppercase tracking-tight text-xs mt-3 mb-1">$1</p>')
    .replace(/^## (.*$)/gm, '<p class="font-black text-slate-900 uppercase tracking-tight text-sm mt-3 mb-1">$1</p>')
    .replace(/^\d+\. (.*$)/gm, '<div class="flex gap-2 my-0.5"><span class="text-indigo-500 font-black flex-shrink-0">•</span><span>$1</span></div>')
    .replace(/^- (.*$)/gm, '<div class="flex gap-2 my-0.5"><span class="text-slate-400 flex-shrink-0">·</span><span>$1</span></div>')
    .replace(/\n\n/g, '<br/>')
    .replace(/\n/g, '<br/>');
}

// ── Main Component ───────────────────────────────────────────
const AppAssistant: React.FC = () => {
  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  // Greeting on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: '¡Hola! Soy el asistente de **LUZ IA Studio**. Puedo guiarte por cualquier módulo, explicarte cómo funciona algo, o ayudarte si algo no funciona como esperabas.\n\n¿En qué te puedo ayudar?',
        timestamp: new Date(),
      }]);
    }
    if (isOpen) { setHasUnread(false); setTimeout(() => inputRef.current?.focus(), 300); }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const reply = await callAssistant(history);

      setMessages(prev => [...prev, {
        id: Date.now().toString() + 'r',
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + 'e',
        role: 'assistant',
        content: 'Lo siento, no pude conectarme en este momento. Intenta de nuevo en un momento.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const reset = () => setMessages([]);

  return (
    <>
      {/* ── FLOATING BUTTON ────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(p => !p)}
        className={`fixed bottom-6 right-6 z-[900] w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-slate-800 text-white rotate-0 scale-95'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-110 hover:shadow-indigo-200'
        }`}
        aria-label="Asistente"
      >
        {isOpen
          ? <X className="w-6 h-6" />
          : <MessageCircle className="w-6 h-6" />
        }
        {hasUnread && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      {/* ── CHAT PANEL ─────────────────────────────────────── */}
      <div className={`fixed bottom-24 right-6 z-[890] w-[min(380px,calc(100vw-24px))] bg-white rounded-[28px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${
        isOpen
          ? 'opacity-100 scale-100 pointer-events-auto'
          : 'opacity-0 scale-95 pointer-events-none'
      }`}
        style={{ maxHeight: 'min(560px, calc(100dvh - 120px))' }}
      >

        {/* HEADER */}
        <div className="flex items-center gap-3 px-5 py-4 bg-indigo-600 flex-shrink-0">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-white uppercase tracking-widest leading-none">Asistente LUZ IA</p>
            <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest mt-0.5">Guía inteligente de la app</p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 1 && (
              <button
                onClick={reset}
                className="w-7 h-7 bg-white/10 text-white/70 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"
                title="Nueva conversación"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 bg-white/10 text-white/70 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-slate-50 text-slate-700 rounded-tl-sm border border-slate-100'
              }`}>
                {msg.role === 'assistant' ? (
                  <div
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3 h-3 text-indigo-600" />
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-400 font-medium">Pensando...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* SUGGESTIONS (shown when no conversation yet) */}
        {messages.length <= 1 && !loading && (
          <div className="px-4 pb-3 flex flex-col gap-1.5 flex-shrink-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Preguntas frecuentes</p>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="text-left px-3 py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-xl text-xs font-medium transition-colors border border-slate-100 hover:border-indigo-200"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* INPUT */}
        <div className="px-4 py-3 border-t border-slate-100 flex-shrink-0 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            disabled={loading}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-30 transition-all flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

      </div>
    </>
  );
};

export default AppAssistant;