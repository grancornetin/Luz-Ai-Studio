// Fase ANALYZE: una única llamada de texto a Gemini (vía vertex-client.js,
// reutilizado tal cual) que clasifica cuerpo/expresión, identifica puntos de
// contacto/soporte, categoriza, y redacta una descripción técnica
// reconstructiva — todo en un solo request.

const vertex = require('../../vertex-client');
const { POSE_CATEGORIES, EXPRESSION_CATEGORIES, CONTACT_POINTS, SUPPORT_SURFACE_HEIGHT, FRAMING_CATEGORIES } = require('./enums');

function buildSystemPrompt() {
  return `Eres un analista técnico de poses y expresiones faciales para un banco de referencias reutilizables. Tu trabajo es analizar UNA imagen real y devolver un JSON estricto que sirva para dos propósitos igual de importantes: (1) categorizar la imagen en un banco filtrable, y (2) funcionar como bloque de texto standalone capaz de reconstruir la misma pose/expresión en un generador de imágenes, sin ver la foto original.

# Paso 1 — Clasificar image_type

"body" si domina cuerpo/ropa/pose/figura completa. "expression" si domina un primer plano de cara/boca/ojos/labios/lengua o un gesto facial sin contexto de cuerpo significativo.

# Paso 1b — Clasificar framing (encuadre/mecánica de captura)

Elige EXACTAMENTE un valor de esta lista que describa cómo fue tomada la foto (independiente de la pose): ${JSON.stringify(FRAMING_CATEGORIES)}.
- "selfie_espejo": la persona se fotografía a sí misma reflejada en un espejo (suele verse el celular/cámara en la mano).
- "selfie_pov": la persona sostiene la cámara con el propio brazo extendido hacia sí misma, sin espejo de por medio.
- "selfie_frente_camara": foto frontal tipo selfie pero sin brazo ni espejo visible en encuadre (ej. cámara en trípode/temporizador con encuadre de selfie).
- "tercero_cuerpo_completo": la foto fue tomada por otra persona (o cámara fija) y muestra el cuerpo completo.
- "tercero_medio_cuerpo": tomada por otra persona/cámara fija, encuadre de medio cuerpo o menos (sin mostrar piernas completas).
- "primer_plano": encuadre cerrado en cara/rostro, tomada por otra persona o cámara fija (no selfie).
- "otro_encuadre": ninguna de las anteriores encaja con claridad.

# Paso 2 — Solo si image_type es "body": contact_points y support_surface_height

Identifica, mirando la imagen, qué parte(s) del cuerpo sostienen el peso o tocan la superficie de apoyo (array, uno o más valores EXACTOS de esta lista): ${JSON.stringify(CONTACT_POINTS)}.

Identifica también a qué altura está ese punto de apoyo respecto al suelo (un valor EXACTO de esta lista): ${JSON.stringify(SUPPORT_SURFACE_HEIGHT)}.

Regla crítica: NUNCA identifiques ni menciones el tipo de mueble u objeto de apoyo (silla, sofá, cama, barra, baranda, escalón, etc.) en ningún campo de tu respuesta — ni en contact_points, ni en support_surface_height, ni en description. Solo importa QUÉ PARTE DEL CUERPO toca la superficie y A QUÉ ALTURA aproximada, nunca QUÉ ES la superficie. Esto es porque la misma pose debe poder reutilizarse con cualquier mueble o sin ninguno — nombrar el mueble original contaminaría esa reutilización.

Si image_type es "expression", contact_points debe ser null y support_surface_height debe ser null.

# Paso 3 — category

Elige EXACTAMENTE una categoría del enum que corresponda:
- Si image_type es "body", una de: ${JSON.stringify(POSE_CATEGORIES)}
- Si image_type es "expression", una de: ${JSON.stringify(EXPRESSION_CATEGORIES)}

Para "body", la categoría debe ser consistente con contact_points/support_surface_height ya determinados (ej. contact_points con gluteos+costado sobre mueble_bajo apunta a "sentada" o "inclinada" según el ángulo del torso, nunca a "de_pie"). Usa el valor "otra_pose"/"otra_expresion" solo si de verdad ninguna otra categoría encaja — no lo uses por defecto.

# Paso 4 — description (el campo más importante)

Escribe un párrafo técnico reconstructivo en español, en prosa encadenada (no viñetas, no listas) — debe funcionar como bloque de texto standalone: si alguien pega SOLO este texto en un generador de imágenes, el resultado debe reconstruir una pose/expresión prácticamente idéntica a la original, con el mismo nivel de efectividad que usar la imagen de referencia. No es un resumen ni una frase corta.

Si image_type es "body", cubre: orientación del torso respecto a cámara (frontal, 3/4, perfil), ángulo y dirección de inclinación de cabeza, posición y ángulo de cada brazo/mano visible, distribución de peso, los puntos de contacto y altura de apoyo ya determinados integrados naturalmente en la prosa (ej. "con el costado y el antebrazo apoyados sobre una superficie a media altura" — NUNCA nombrando el mueble, ej. jamás "apoyada en el sillón" o "sentada en la silla"), ángulo/altura de cámara aparente, y cualquier curvatura de columna o torsión relevante.

Si image_type es "expression", cubre: dirección de mirada, apertura de párpados, forma de boca/labios, posición de mandíbula/lengua si aplica, inclinación de cabeza, ángulo de cámara.

# Paso 5 — tags

Tags libres en inglés, snake_case, minúsculas, sobre contexto/entorno/mood — sin restricción de enum.

# Formato de salida

Responde SOLO este JSON, sin texto adicional antes o después, sin markdown:
{
  "image_type": "body" | "expression",
  "framing": string,
  "contact_points": [string] | null,
  "support_surface_height": string | null,
  "category": string,
  "description": string,
  "tags": [string],
  "confidence": "high" | "medium" | "low"
}`;
}

async function analyzeImage(buffer, mimeType) {
  const base64 = buffer.toString('base64');
  const result = await vertex.generateAnthropicCompatible({
    system: buildSystemPrompt(),
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Analiza esta imagen según las instrucciones del sistema. Responde solo el JSON.' },
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }
      ]
    }],
    response_mime_type: 'application/json',
    max_tokens: 2500
  });
  const text = (result.content || []).map(b => b.text || '').join('');
  return { parsed: JSON.parse(text), usage: result.usage };
}

// Análisis "forzado a un tipo": para imágenes que ya tienen un análisis de
// un tipo (ej. expression) pero el usuario marcó manualmente que TAMBIÉN
// sirven como referencia del otro tipo (ej. body) — mismas reglas de
// categorización/descripción del prompt principal, pero sin dejar que
// Gemini vuelva a elegir image_type: se le pide directamente el análisis
// para el tipo indicado.
async function analyzeImageAsType(buffer, mimeType, forcedType) {
  const base64 = buffer.toString('base64');
  const typeLabel = forcedType === 'expression' ? 'expression (rostro/expresión facial)' : 'body (cuerpo/pose corporal)';
  const result = await vertex.generateAnthropicCompatible({
    system: buildSystemPrompt(),
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `Esta imagen ya tiene un análisis de un tipo distinto. Analizala ahora ESPECÍFICAMENTE como tipo "${forcedType}" (${typeLabel}) — ignorá el Paso 1 de clasificación de image_type, fijalo directamente en "${forcedType}", y completá el resto de los pasos (framing, contact_points/support_surface_height si aplica, category, description, tags) según ese tipo forzado. Responde solo el JSON.` },
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }
      ]
    }],
    response_mime_type: 'application/json',
    max_tokens: 2500
  });
  const text = (result.content || []).map(b => b.text || '').join('');
  const parsed = JSON.parse(text);
  parsed.image_type = forcedType;
  return { parsed, usage: result.usage };
}

// Re-análisis liviano: solo clasifica "framing" sobre una imagen ya
// analizada, sin tocar category/tags/description/contact_points existentes
// y sin regenerar el sketch. Pensado para completar el campo nuevo en items
// que ya están en status "done" de antes de que framing existiera.
function buildFramingOnlyPrompt() {
  return `Analiza esta foto real y clasifica EXACTAMENTE su "framing" (encuadre/mecánica de captura), eligiendo un valor de esta lista: ${JSON.stringify(FRAMING_CATEGORIES)}.
- "selfie_espejo": la persona se fotografía a sí misma reflejada en un espejo (suele verse el celular/cámara en la mano).
- "selfie_pov": la persona sostiene la cámara con el propio brazo extendido hacia sí misma, sin espejo de por medio.
- "selfie_frente_camara": foto frontal tipo selfie pero sin brazo ni espejo visible en encuadre.
- "tercero_cuerpo_completo": tomada por otra persona/cámara fija, cuerpo completo.
- "tercero_medio_cuerpo": tomada por otra persona/cámara fija, medio cuerpo o menos.
- "primer_plano": encuadre cerrado en cara/rostro, no selfie.
- "otro_encuadre": ninguna de las anteriores encaja con claridad.

Responde SOLO este JSON, sin texto adicional, sin markdown: { "framing": string }`;
}

async function classifyFraming(buffer, mimeType) {
  const result = await vertex.generateAnthropicCompatible({
    system: buildFramingOnlyPrompt(),
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Clasifica el framing de esta imagen. Responde solo el JSON.' },
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: buffer.toString('base64') } }
      ]
    }],
    response_mime_type: 'application/json',
    max_tokens: 200
  });
  const text = (result.content || []).map(b => b.text || '').join('');
  return JSON.parse(text).framing || 'otro_encuadre';
}

module.exports = { analyzeImage, analyzeImageAsType, classifyFraming };
