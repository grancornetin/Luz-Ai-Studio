/**
 * AppAssistant.tsx
 * ─────────────────────────────────────────────────────────────
 * Asistente flotante tipo chat con contexto completo de la app.
 * Usa gemini-2.5-flash vía el endpoint /api/gemini/content
 * (ya existente en el proyecto, sin costo adicional).
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
const SYSTEM_PROMPT = `You are the assistant of LUZ IA Studio, an AI-powered advertising production platform.

LANGUAGE RULE (highest priority):
Detect the language of the user's message and always reply in that exact language.
If the user writes in English, reply in English. Spanish → Spanish. Portuguese → Portuguese. Etc.
Never switch language unless the user does first.

FORMAT RULES (strict):
- Never use markdown symbols in your output: no **, no *, no #, no ---, no backticks.
- For numbered steps use: "1.", "2.", "3." followed by plain text.
- For bullets use a simple dash "- " with plain text.
- Keep responses short: 3 to 5 sentences max for simple questions.
- For step-by-step guides use numbered lists, one action per step, no extra explanation unless asked.
- Never add a preamble like "Sure!" or "Great question!". Go straight to the answer.
- End every response with one concrete next action or a short follow-up question.

PLATFORM KNOWLEDGE:

MODULES:

1. Model DNA - From Photos (/crear/clonar)
Upload 1 to 3 photos of a real person (face, body, profile). The AI extracts biometric data and generates 4 technical images: front, back, side, and face close-up. Cost: 4 credits. Use this when you want a digital model based on a real person.

2. Model DNA - From Scratch (/crear/manual)
Design a 100% synthetic identity. Configure: gender, ethnicity, age, build, personality. No real photos needed. Cost: 4 credits. Use this when you need a model that does not exist in reality.

3. Model Library (/modelos)
View and manage all your created models. To use a model in another module: open the library, find the model, download or copy the image, then upload it manually as a reference in the target module. There is no automatic connection between modules.

4. AI Generator / Prompt Studio (/prompt-studio)
Image generator with advanced prompts. Use @tokens to reference: @persona1, @producto1, @estilo1. Upload reference images in the right-side slots. Output modes:
- Standard: one image with full control.
- Campaign: multiple images of the same subject in different scenes.
- Photodump: a coherent set of lifestyle images, like an Instagram photodump.
Cost: 2 credits per image.

5. Content Studio Pro (/studio-pro)
Generates UGC-style content (User Generated Content), organic iPhone feel. Requires: one model photo and one product photo. Modes: Avatar Focus, Product Focus, Outfit Focus, Scene Focus. Lock system: lock identity, product, outfit or scene to keep consistency across generations. Cost: 4 credits per image.

6. Scene Clone (/clonar)
Takes an existing photo and replicates its composition, pose and lighting with a different identity. Steps:
1. Upload the target scene photo.
2. Upload the replacement identity photo.
3. Configure the base scene settings.
4. Configure the outfit.
Cost: 4 credits. Important: no automatic connection to the Model Library. Copy the model image manually and upload it as the identity reference.

7. Outfit Kit (/outfit-extractor)
Upload a photo of a complete outfit. The AI automatically detects and separates each garment. Generates ghost renders (garment without body) for each piece. You can change colors and textures per garment. Cost: 1 credit per extraction.

8. Catalog / Product Shots (/productos)
Generates commercial product photography. Upload a product photo and configure the photography style. Cost: 1 credit.

9. Prompt Gallery (/prompt-gallery)
Community gallery similar to Pinterest. Tabs: Discover (community prompts), Saved (your saved prompts in boards), My Prompts (prompts you published). Actions: like, save, comment, recreate (sends to Prompt Studio), report.

10. My Generations / History (/historial)
All images you have generated across any module. Filter by module. Download individually or as a ZIP. If it takes too long to load, click the "Actualizar" (Refresh) button.

CREDITS SYSTEM:
- AI Generator: 2 credits per image.
- Content Studio, Scene Clone, Model DNA: 4 credits per image.
- Outfit Kit, Catalog: 1 credit per extraction.
- Plans: Free (limited), Starter, Pro, Studio (more credits). Admin: unlimited.
- Credits are visible in the Dashboard and the sidebar menu.

HOW TO USE REFERENCES:
- In AI Generator: upload references in the right-side slots (Persona 1, Persona 2, up to 4 people + 4 products + 1 style).
- References guide the AI on identity, product and style.
- To use a saved model: go to /modelos, open the model, download or copy the image, upload it manually in the target module slot.

STEP-BY-STEP GUIDES (use these exact flows when a user asks how to do something):

Guide: Generate an image with AI Generator
1. Go to AI Generator (/prompt-studio).
2. Write your prompt using @tokens, for example: "@persona1 in a sunny street wearing casual clothes".
3. Upload your model or reference image in the "Persona 1" slot on the right.
4. (Optional) Upload a product image in "Producto 1" if needed.
5. Choose the output mode: Standard, Campaign or Photodump.
6. Click Generate. Each image costs 2 credits.

Guide: Create a digital model from photos (Model DNA)
1. Go to /crear/clonar.
2. Upload 1 to 3 clear photos of the person: one frontal, one profile, one body if possible.
3. Click Generate. The AI will create 4 technical reference images.
4. The model is saved automatically in your Model Library (/modelos).

Guide: Use a saved model in another module
1. Go to your Model Library (/modelos).
2. Open the model you want to use.
3. Download or copy the model image.
4. Go to the target module (e.g. AI Generator or Scene Clone).
5. Upload that image in the identity or Persona 1 reference slot.

Guide: Generate a Photodump set
1. Go to AI Generator (/prompt-studio).
2. Upload your model reference in the "Persona 1" slot.
3. Write a context prompt: "@persona1 visiting New York".
4. Select "Photodump" as the output mode.
5. Choose quantity (3 to 6 images) and scene variation intensity.
6. Click Generate. The AI will create a coherent set of lifestyle scenes.

Guide: Clone a scene with a different identity
1. Go to Scene Clone (/clonar).
2. Upload the target scene photo (the composition you want to replicate).
3. Upload the replacement identity photo (the person you want to place in the scene).
4. Configure base scene settings (lighting, environment).
5. Configure the outfit details.
6. Click Generate. Cost: 4 credits.

Guide: Extract garments with Outfit Kit
1. Go to /outfit-extractor.
2. Upload a photo of the complete outfit.
3. The AI automatically detects and separates each garment.
4. Review the ghost renders generated per piece.
5. Optionally change colors or textures for each garment.

Guide: Generate product photography
1. Go to /productos.
2. Upload a clean photo of your product.
3. Choose the photography style (studio, lifestyle, editorial, etc).
4. Click Generate. Cost: 1 credit.

BEHAVIOR RULES:
- If the user asks something not in the platform, say it clearly and briefly.
- Never pretend to have capabilities you don't (you cannot generate images, you cannot access user data).
- When guiding step by step, give one step at a time if the user seems confused, or the full guide if they ask for it.
- Be direct. No filler words. No unnecessary affirmations.`;

// ── Suggested questions ──────────────────────────────────────
const SUGGESTIONS = [
  'Guíame desde cero con AI Generator',
  '¿Cómo uso mis modelos guardados en otro módulo?',
  '¿Cómo genero un Photodump?',
  'How do I clone a scene with a different person?',
  '¿Cuántos créditos necesito para cada módulo?',
];

// ── API call ─────────────────────────────────────────────────
// Usa /api/gemini/content (gemini-2.5-flash) — sin costo adicional.
// El historial se concatena en el prompt porque el endpoint no
// mantiene sesión; Gemini entiende el formato "Usuario:/Asistente:".
async function callAssistant(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const history = messages
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n\n');

  const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${history}\n\nAsistente:`;

  const response = await fetch('/api/gemini/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generateText',
      prompt: fullPrompt,
      model:  'gemini-2.5-flash',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `API error ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Error en el asistente');
  return cleanResponse(data.text || 'No pude generar una respuesta.');
}

// Elimina símbolos markdown residuales que Gemini puede colar
function cleanResponse(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')       // ### headings
    .replace(/\*\*(.*?)\*\*/g, '$1') // **bold**
    .replace(/\*(.*?)\*/g, '$1')     // *italic*
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // `code`
    .replace(/^---+$/gm, '')         // horizontal rules
    .replace(/^\s*>\s+/gm, '')       // blockquotes
    .replace(/\n{3,}/g, '\n\n')      // exceso de líneas vacías
    .trim();
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