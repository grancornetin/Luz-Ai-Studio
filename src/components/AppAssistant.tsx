/**
 * AppAssistant.tsx
 * ─────────────────────────────────────────────────────────────
 * Asistente flotante tipo chat con contexto completo de la app.
 * Usa gemini-2.5-flash vía el endpoint /api/gemini/content
 * (ya existente en el proyecto, sin costo adicional).
 * ─────────────────────────────────────────────────────────────
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2, ChevronDown, Sparkles, RotateCcw, ImagePlus, XCircle } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string; // base64 comprimida para mostrar en el chat
  timestamp: Date;
}

// ── App Context ───────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the assistant of LUZ IA Studio, an AI-powered advertising content creation platform.

LANGUAGE RULE (top priority):
Always detect the language the user is writing in and reply in that exact same language. If they write in English, answer in English. Spanish → Spanish. Portuguese → Portuguese. Never switch unless the user does first.

FORMAT RULES (absolute, no exceptions):
- Write only plain conversational text. Never output JSON, objects, arrays, curly braces {}, square brackets [], key-value pairs, or any data structure.
- Never use markdown syntax: no **, no *, no #, no ---, no backticks, no blockquotes.
- For numbered steps write plain lines like: 1. Do this. 2. Then this.
- For bullet points use a plain dash like: - item text. No quotes around the text.
- Keep answers short for simple questions: 2 to 4 sentences maximum.
- For step-by-step guides use the numbered format above, one clear action per step.
- Never open with filler phrases like "Sure!", "Of course!", "Great question!". Start directly with the answer.
- End every response with one concrete next action or a brief follow-up question in plain text.
- If you feel the urge to format as JSON or a dictionary, stop and rewrite as plain numbered steps.

PLATFORM OVERVIEW:
LUZ IA Studio is a platform to create professional advertising content using AI. It has modules for creating digital identities (models/avatars), generating images with advanced prompts, producing organic UGC-style content, cloning scenes, extracting outfits, and generating product photography.

MODULE 1 - Model DNA: From Photos (/crear/clonar)
This module clones the identity of a real person from images. The user uploads at least one clear photo of the face they want to clone. The AI generates a faithful digital clone, complemented with additional full-body angles. The result is a digital clone the user can download and use as a reference in other modules. Cost: 4 credits.

MODULE 2 - Model DNA: From Scratch (/crear/manual)
This module creates a 100% invented digital avatar by letting the user manually select physical traits. The result is a unique custom avatar they can download and use in other modules. Cost: 4 credits.

MODULE 3 - Model Library (/modelos)
Here users can manage all the identities they have created, whether cloned from photos or built from scratch. They can re-download any identity at any time. There is no automatic connection between the library and other modules. To use a saved identity in another module, the user must download the image and upload it manually in the target module.

MODULE 4 - AI Generator (/prompt-studio)
The most advanced content generator on the platform. Users write prompts to generate images. Key facts:
- A plain text prompt is enough to generate. Reference slots are completely optional.
- Reference slots on the right side of the screen accept images labeled as @persona1, @persona2 (up to 4), @producto1 (up to 4), and one style reference. These are optional and only needed if the user wants a specific person, product or style to appear.
- The person slots are treated as characters (people, outfits, accessories, looks). The product slots are treated as objects (products, items, places, props). The user can combine them creatively.
- If using references, the user must mention them in the prompt using the corresponding tag (e.g. "@persona1 wearing a red jacket in a coffee shop").
- Templates are available to help users get pre-established image styles quickly.
- Advanced Prompt Structure tool: helps users understand complex prompts by identifying which parts correspond to lighting, style, person, product, extra details, etc. Users can edit each section directly without reading the whole prompt.

Tools inside AI Generator:
- Campaign: creates up to 5 different scenes from the same base prompt and references, ideal for generating multiple ad images or social media content in one click.
- Photodump: similar to Campaign but focused on people. Creates a coherent set of organic, realistic lifestyle images ideal for an Instagram carousel or Stories. Great for digital influencers. Configure the parameters and the AI generates varied scenes with the same person.
- AI Variations: generates 3 creative variations of the original prompt. The user can lock specific layers they want to keep (e.g. style, lighting) and the AI will only modify the unlocked layers, creating different images from the same idea.

Cost: 2 credits per image.

MODULE 5 - Prompt Gallery (/prompt-gallery)
The platform's own Pinterest-style community gallery. Users share their creations here. Features:
- Discover tab: browse prompts from the whole community.
- Saved tab: prompts the user has saved, organized in boards.
- My Prompts tab: prompts the user has published.
- Each prompt has a mini gallery showing variations generated from it, so users can see how that prompt adapts to different needs.
- Actions available: like, save, comment, recreate (sends the prompt directly to AI Generator ready to use), report.
- Users share their prompts directly from AI Generator to the gallery.
This is the platform's main source of inspiration.

MODULE 6 - UGC Studio (/studio-pro)
Designed to create organic-looking content that appears made by real users, using the user's own avatar or digital model. The user uploads their chosen identity and any needed references, selects a focus, and generates a realistic session of 7 photos. These are convincing and ready to post on social media.

Focus options inside UGC Studio:
- Avatar: ideal for digital influencers. Upload the identity and optionally an outfit, a scene, or a special object to include. The result looks like the influencer has a real life of their own.
- Product: focused on promoting any product that is not clothing. Required inputs: identity of the model and the product to promote. Optional: outfit and a scene. Results include unboxing-style content, product reviews, close-ups, and the avatar using the product organically.
- Outfit: designed for people who sell clothing or want to virtually try on outfits. Required inputs: identity of the model and the outfit or specific garment items to show. Optional: accessories and a scene. Results are multi-angle sessions showing the garments, their textures, how they look on a person, and how they combine. Pro tip: use Outfit Kit or Catalog modules to get high-quality outfit and accessory images first.
- Scene: designed for showcasing places like restaurants, gyms, salons, studios, etc. Required inputs: a photo of the location and the identity of the model who will appear as a visitor. Optional: a special object and an outfit for the avatar. The user should also add a brief contextual description of the scene (e.g. "a spinning room in a gym", "a Mexican food restaurant", "a cozy living room") so the AI understands the context and generates relevant content.

Cost: 4 credits per session.

MODULE 7 - Scene Clone / CloneMaster (/clonar)
Lets users clone an existing photo and replace the person and/or products in it with their own elements. Use case: the user finds a photo they love and wants to recreate it with their own model or products.
- Supports up to 2 visible people in the image. The user can replace each person's identity and outfit.
- Required inputs: the target image to clone, a face photo of the character, and a body photo of the character. If the user doesn't have these, they can create them in the Model DNA modules.
- After cloning, the user can see the result and has the option to also change the outfits and products the AI detected in the original image.
Cost: 4 credits.

MODULE 8 - Outfit Kit (/outfit-extractor)
Extracts garments from an image. Use case: the user sees someone wearing an outfit they like and wants to see how it would look on their own model.
- The user uploads a source image. The AI analyzes it and extracts the garments automatically.
- The user selects which garments to keep from the extraction.
- The selected garments are used to generate a new image: the user uploads their model's identity and the extracted garments, and sees how those clothes look on their character.
- All generations are saved in a library where the user can combine garment elements across generations to create new outfits.
Cost: 1 credit per extraction.

MODULE 9 - Catalog (/productos)
Professional product photography generator. Ideal for e-commerce, websites, and social media.
- The user uploads up to 4 photos of their product taken from any angle, even with a phone camera.
- The user can assign a product name and a brief informal description to give the AI context (e.g. "a metallic water bottle").
- The user selects a category and a production style:
  - Commercial: white background with subtle shadows, ideal for e-commerce or web catalogs.
  - Organic: backgrounds with textures or visual elements related to the product, for a lifestyle look.
- The AI generates professional-quality product photography using all the details detected from the uploaded photos.
Cost: 1 credit per generation.

CREDITS SYSTEM:
- AI Generator: 2 credits per image.
- Model DNA (From Photos or From Scratch): 4 credits.
- UGC Studio: 4 credits per session.
- Scene Clone: 4 credits.
- Outfit Kit: 1 credit per extraction.
- Catalog: 1 credit per generation.
- Plans: Free (limited credits), Starter, Pro, Studio (progressively more credits). Admin: unlimited.
- Credits are visible in the Dashboard and the sidebar menu.

STEP-BY-STEP GUIDES:

Guide: Use AI Generator for the first time
1. Go to AI Generator (/prompt-studio).
2. Write your prompt in the text box. A plain description is enough, for example: "a woman walking in a city at sunset, editorial style". No references needed.
3. If you want a specific person or product to appear: upload the reference image in the corresponding slot on the right (Persona 1 for people, Producto 1 for objects). Then mention the slot in your prompt using the tag, like "@persona1 walking in a city at sunset".
4. Choose the output mode: Standard for a single image, Campaign for multiple ad scenes, Photodump for a lifestyle set.
5. Click Generate. Each image costs 2 credits.

Guide: Clone a real person's identity (Model DNA From Photos)
1. Go to /crear/clonar.
2. Upload at least one clear, well-lit photo of the person's face.
3. Click Generate. The AI creates a digital clone with multiple angles.
4. The clone is saved in your Model Library (/modelos) and is ready to download and use in other modules.

Guide: Create an invented avatar (Model DNA From Scratch)
1. Go to /crear/manual.
2. Select the avatar's traits manually: gender, ethnicity, age, build, personality and other visual details.
3. Click Generate. The AI creates a unique synthetic identity.
4. The avatar is saved in your Model Library and is ready to download.

Guide: Use a saved identity in another module
1. Go to your Model Library (/modelos).
2. Find the identity you want to use and download it.
3. Go to the target module (AI Generator, UGC Studio, Scene Clone, etc.).
4. Upload that downloaded image in the identity or Persona 1 slot.

Guide: Generate a Campaign (multiple ad images)
1. Go to AI Generator (/prompt-studio).
2. Write your base prompt and optionally upload references.
3. Select the Campaign tool.
4. Choose how many scenes to generate (up to 5).
5. Click Generate. You will get up to 5 different images from the same concept, ready for ads or social media.

Guide: Generate a Photodump for an influencer
1. Go to AI Generator (/prompt-studio).
2. Upload your model's identity image in the Persona 1 slot.
3. Write a context prompt like "@persona1 spending a day in Barcelona".
4. Select the Photodump tool.
5. Configure the number of images and scene variation level.
6. Click Generate. You will get a set of organic lifestyle images ready for an Instagram carousel.

Guide: Clone a scene (Scene Clone)
1. Go to Scene Clone (/clonar).
2. Upload the target photo (the image you want to recreate).
3. Upload the face photo of your character.
4. Upload the body photo of your character. If you don't have one, create it first in Model DNA.
5. Click Generate. After the result appears, you can optionally change the outfits or products the AI detected.

Guide: Extract garments and try them on (Outfit Kit)
1. Go to Outfit Kit (/outfit-extractor).
2. Upload an image that contains the outfit you want to extract.
3. The AI extracts each garment automatically. Select the ones you want to keep.
4. Upload your model's identity and the selected garments to generate a new image showing how those clothes look on your character.

Guide: Create product photos (Catalog)
1. Go to Catalog (/productos).
2. Upload up to 4 photos of your product from different angles.
3. Add a product name and a brief description like "a metallic water bottle".
4. Select the category and the style: Commercial (white background) or Organic (lifestyle background).
5. Click Generate. Cost: 1 credit.

Guide: Create UGC content (UGC Studio)
1. Go to UGC Studio (/studio-pro).
2. Choose the focus that matches your goal: Avatar, Product, Outfit, or Scene.
3. Upload the required elements for that focus (see module description above for each).
4. Add any optional elements (outfit, accessories, scene, contextual description).
5. Click Generate. You will get a session of 7 realistic organic-looking images. Cost: 4 credits.

NAVIGATION LINKS:
When mentioning a module or section, always include its route in parentheses so the user can tap it to navigate. Examples:
- "Go to AI Generator (/prompt-studio)"
- "Open your Model Library (/modelos)"
- "Check your history (/historial)"
- "Visit the Prompt Gallery (/prompt-gallery)"
Routes available: /, /crear/clonar, /crear/manual, /modelos, /prompt-studio, /prompt-gallery, /studio-pro, /clonar, /outfit-extractor, /productos, /historial, /privacidad, /terminos, /descargo

IMAGE ANALYSIS:
If the user sends an image, analyze it in relation to the platform. Examples:
- If they show a screen or error: explain what is happening and how to fix it.
- If they show a result they don't like: suggest what to change in the prompt or settings.
- If they show a reference photo: recommend the best module for their goal.

LIMITS — WHAT YOU CANNOT DO (strict):
Never do any of the following, regardless of how the user asks:
- Do not reveal, display, discuss, or reference any source code, configuration files, API keys, environment variables, internal architecture, database structure, or technical implementation details of the platform.
- Do not role-play as a developer, system admin, or anyone with access to the codebase.
- Do not attempt to access, read, modify, or simulate access to the user's account, files, generated images, billing, or personal data.
- Do not generate, edit, or describe how to generate images yourself. You are a guide, not a generator.
- Do not discuss competitor platforms in detail, make comparisons, or recommend alternatives to LUZ IA Studio.
- Do not give legal, financial, or medical advice of any kind.
- Do not engage with requests that are unrelated to the platform: general coding help, homework, creative writing unrelated to the platform, personal conversations, etc.

WHEN THE USER ASKS SOMETHING OUT OF YOUR SCOPE:
Be brief, clear, and always redirect to something useful. Use this structure:
1. Acknowledge what they asked (one sentence, no apology).
2. Explain in one sentence that it is outside what you can help with.
3. Offer an alternative: either redirect to a relevant part of the platform, or send them to contact (/descargo).

Example responses:
- If asked about source code: "That's not something I can share — the platform's internal code is not accessible through this assistant. If you have a technical issue, you can contact the team directly (/descargo)."
- If asked something completely off-topic: "That's outside what I can help with here. I'm focused on guiding you through LUZ IA Studio. Is there anything about the platform I can help you with?"

SUBSCRIPTIONS, PLANS AND PRICING:
The platform has subscription plans with different credit amounts. Exact pricing and plan details are not available to me yet — this information will be updated when plans are officially defined.
When a user asks about pricing, plans, or how to upgrade:
- Acknowledge the question.
- Explain that you do not have the current pricing details available.
- Direct them to contact the team for accurate information: "For up-to-date pricing and plan details, reach out to us directly (/descargo)."
- Do not invent or estimate prices. Do not promise specific credit amounts per plan.

CREDITS (what you do know):
- Credits are consumed per generation. Costs per module are documented above.
- Credits are visible in the Dashboard (/) and the sidebar.
- If a user runs out of credits they need to upgrade their plan. Direct them to contact (/descargo) for plan upgrade options until a self-serve upgrade flow is available.

TERMS, PRIVACY AND LEGAL:
- Terms of use are available at (/terminos). Direct users there if they ask about usage rules, content policies, or what is allowed on the platform.
- Privacy policy is at (/privacidad). Direct users there for questions about data handling, storage, or personal information.
- For any other legal or compliance questions, redirect to contact (/descargo).
- Do not interpret, paraphrase, or give your own version of the legal documents. Always send the user to read the official pages.

CONTACT AND SUPPORT:
- For billing issues, account problems, bugs, feature requests, or anything requiring human attention: always direct to (/descargo).
- Phrase it naturally, for example: "For that you'll want to reach out to the team directly — you can do it from (/descargo)."
- Never promise response times or support SLAs.

BEHAVIOR RULES:
- If the user asks about something that does not exist in the platform, say so clearly and briefly, then offer the closest relevant help.
- Never claim capabilities you do not have.
- When guiding step by step, give the full guide if they ask how to do something. If they seem stuck on one step, focus only on that.
- Be direct. No filler words. No unnecessary affirmations. No padding.
- Keep a helpful, calm and professional tone even when declining a request.`;

// ── Suggested questions ──────────────────────────────────────
const SUGGESTIONS = [
  'Guíame desde cero con AI Generator',
  '¿Cómo uso mis modelos guardados en otro módulo?',
  '¿Cómo genero un Photodump?',
  'How do I clone a scene with a different person?',
  '¿Cuántos créditos necesito para cada módulo?',
];

// ── Image compression ────────────────────────────────────────
// Redimensiona y comprime a JPEG antes de base64.
// Max 1024px en el lado mayor, calidad 0.75 → ~100-200KB típico,
// bien por debajo del límite de 4.5MB de Vercel.
async function compressImage(file: File): Promise<{ data: string; mimeType: string }> {
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
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      const base64 = dataUrl.split(',')[1];
      resolve({ data: base64, mimeType: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── API call ─────────────────────────────────────────────────
async function callAssistant(
  messages: { role: 'user' | 'assistant'; content: string }[],
  imageData?: { data: string; mimeType: string },
): Promise<string> {
  const history = messages
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n\n');

  const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${history}\n\nAsistente:`;

  const body: Record<string, unknown> = {
    action: 'assistantChat',
    prompt: fullPrompt,
    model:  'gemini-2.5-flash',
  };

  if (imageData) {
    body.images   = [imageData.data];
    body.mimeTypes = [imageData.mimeType];
  }

  const response = await fetch('/api/gemini/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `API error ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Error en el asistente');
  return cleanResponse(data.text || 'No pude generar una respuesta.');
}

// Limpia markdown residual y JSON que Gemini puede generar
function cleanResponse(text: string): string {
  const trimmed = text.trim();

  // Si toda la respuesta es un objeto JSON, conviértelo a pasos numerados
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      const lines: string[] = [];
      for (const [key, val] of Object.entries(obj)) {
        if (key === 'next_action' || key === 'next') {
          lines.push('\n' + String(val));
        } else if (!isNaN(Number(key))) {
          lines.push(`${key}. ${String(val)}`);
        } else {
          lines.push(String(val));
        }
      }
      return lines.join('\n').trim();
    } catch {
      // no era JSON válido, continuar con limpieza normal
    }
  }

  return trimmed
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/^---+$/gm, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Sanitizador anti-XSS ─────────────────────────────────────
// Elimina tags y atributos peligrosos del texto antes de renderizar.
// Solo conserva el texto plano — los tags seguros los agrega renderContent.
function sanitizeText(raw: string): string {
  return raw
    // Elimina cualquier tag HTML que venga en el texto del asistente
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Elimina atributos de evento inline (onclick, onerror, etc.)
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '')
    // Elimina tags que no deberían venir del modelo
    .replace(/<(?!br\s*\/?>)[a-z][^>]*>/gi, '')
    .replace(/<\/(?!br)[a-z][^>]*>/gi, '');
}

// ── Renderer ─────────────────────────────────────────────────
// Convierte rutas internas como /prompt-studio en links clicleables.
// Usa data-nav para que el componente los intercepte con useNavigate.
// SIEMPRE sanitiza el texto antes de construir el HTML.
function renderContent(text: string): string {
  const safe = sanitizeText(text);
  return safe
    .replace(/^\d+\.\s(.*)$/gm, '<div class="flex gap-2 my-1"><span class="text-indigo-500 font-black flex-shrink-0 mt-0.5">•</span><span>$1</span></div>')
    .replace(/^-\s(.*)$/gm, '<div class="flex gap-2 my-0.5"><span class="text-slate-400 flex-shrink-0">·</span><span>$1</span></div>')
    .replace(
      /\(?(\/[\w\-/]+)\)?/g,
      '<a data-nav="$1" class="inline-flex items-center gap-0.5 text-indigo-600 font-semibold underline underline-offset-2 cursor-pointer hover:text-indigo-800">$1</a>',
    )
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

// ── Main Component ───────────────────────────────────────────
const AppAssistant: React.FC = () => {
  const navigate = useNavigate();

  const [isOpen, setIsOpen]           = useState(false);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [hasUnread, setHasUnread]     = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [compressing, setCompressing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);

  // Greeting on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Hola! Soy el asistente de LUZ IA Studio. Puedo guiarte por cualquier módulo, explicarte cómo funciona algo, o analizar una imagen que me mandes si tienes alguna duda.\n\n¿En qué te puedo ayudar?',
        timestamp: new Date(),
      }]);
    }
    if (isOpen) { setHasUnread(false); setTimeout(() => inputRef.current?.focus(), 300); }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Interceptar clicks en links de navegación interna generados por renderContent
  const handleMessagesClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest('[data-nav]') as HTMLElement | null;
    if (link) {
      e.preventDefault();
      const route = link.getAttribute('data-nav');
      if (route) { navigate(route); setIsOpen(false); }
    }
  }, [navigate]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const preview = URL.createObjectURL(file);
    setPendingImage({ file, preview });
  };

  const removePendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if ((!content && !pendingImage) || loading) return;

    setCompressing(true);
    let compressed: { data: string; mimeType: string } | undefined;
    let previewUrl: string | undefined;

    if (pendingImage) {
      try {
        compressed = await compressImage(pendingImage.file);
        previewUrl = pendingImage.preview;
      } catch {
        // si falla la compresión, continúa sin imagen
      }
      setPendingImage(null);
    }
    setCompressing(false);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content || '(imagen adjunta)',
      image: previewUrl,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const reply = await callAssistant(history, compressed);

      setMessages(prev => [...prev, {
        id: Date.now().toString() + 'r',
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + 'e',
        role: 'assistant',
        content: 'No pude conectarme en este momento. Intenta de nuevo en un momento.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, pendingImage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const reset = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
    setMessages([]);
  };

  const canSend = (input.trim().length > 0 || !!pendingImage) && !loading && !compressing;

  return (
    <>
      {/* ── FLOATING BUTTON ────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(p => !p)}
        className={`fixed bottom-6 right-6 z-[900] w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-slate-800 text-white scale-95'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-110 hover:shadow-indigo-200'
        }`}
        aria-label="Asistente"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {hasUnread && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      {/* ── CHAT PANEL ─────────────────────────────────────── */}
      <div
        className={`fixed bottom-24 right-6 z-[890] w-[min(380px,calc(100vw-24px))] bg-white rounded-[28px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${
          isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        }`}
        style={{ maxHeight: 'min(580px, calc(100dvh - 120px))' }}
      >
        {/* HEADER */}
        <div className="flex items-center gap-3 px-5 py-4 bg-indigo-600 flex-shrink-0">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-white uppercase tracking-widest leading-none">Asistente LUZ IA</p>
            <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest mt-0.5">Guía inteligente · Análisis de imágenes</p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 1 && (
              <button onClick={reset} className="w-7 h-7 bg-white/10 text-white/70 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors" title="Nueva conversación">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => setIsOpen(false)} className="w-7 h-7 bg-white/10 text-white/70 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MESSAGES */}
        <div
          ref={messagesBoxRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
          onClick={handleMessagesClick}
        >
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
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
                {msg.image && (
                  <img src={msg.image} alt="adjunto" className="rounded-xl mb-2 max-h-40 object-cover w-full" />
                )}
                {msg.role === 'assistant' ? (
                  <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }} />
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {(loading || compressing) && (
            <div className="flex gap-2">
              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3 h-3 text-indigo-600" />
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-400 font-medium">
                  {compressing ? 'Procesando imagen...' : 'Pensando...'}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* SUGGESTIONS */}
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

        {/* IMAGE PREVIEW */}
        {pendingImage && (
          <div className="px-4 pt-2 flex-shrink-0">
            <div className="relative inline-block">
              <img src={pendingImage.preview} alt="preview" className="h-16 w-16 object-cover rounded-xl border border-slate-200" />
              <button
                onClick={removePendingImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-700 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* INPUT */}
        <div className="px-4 py-3 border-t border-slate-100 flex-shrink-0 flex gap-2 items-center">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="w-9 h-9 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 transition-colors flex-shrink-0"
            title="Adjuntar imagen"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta o adjunta imagen..."
            disabled={loading}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:opacity-50"
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
    </>
  );
};

export default AppAssistant;