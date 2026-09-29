// Prompt de RE-ANÁLISIS LIVIANO: solo rellena los campos nuevos del schema
// (arquetipos + los 4 campos de PROMPT_REAUDITORIA_BANCO.md) sobre imágenes
// que YA fueron analizadas con una versión anterior del prompt maestro —
// sin volver a gastar cuota regenerando raw_visual_description, interpreted_signals,
// etc. que ya están guardados y siguen siendo válidos.
//
// Reutiliza las definiciones de arquetipos tal cual viven en system-prompt.txt
// (extraídas en runtime, no copiadas a mano) para que nunca queden desincronizadas
// si se edita el catálogo ahí.

const fs = require('fs');
const path = require('path');

const PROMPT_PATH = path.join(__dirname, 'system-prompt.txt');

let cachedSections = null;

function extractBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return '';
  const end = text.indexOf(endMarker, start + startMarker.length);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

function getEnrichmentSections() {
  if (cachedSections) return cachedSections;
  const full = fs.readFileSync(PROMPT_PATH, 'utf8');

  const archetypeSection = extractBetween(
    full,
    '# `archetype_primary` / `archetype_secondary`: arquetipo de personalidad/vibe de la creadora',
    '# Composición pensada para favorecer la figura/atractivo'
  );

  const filteringFieldsSection = extractBetween(
    full,
    'Si `companion_present` es true, clasifica además `companion_prominence`',
    '`narrative_beat_fit` (array'
  );

  cachedSections = { archetypeSection, filteringFieldsSection };
  return cachedSections;
}

function getEnrichmentPrompt() {
  const { archetypeSection, filteringFieldsSection } = getEnrichmentSections();

  return `Eres el Entrenador Visual de Photodump, en modo RE-ANÁLISIS LIVIANO. Esta imagen ya fue analizada antes con una versión anterior del schema — tu única tarea ahora es completar SOLO los campos nuevos listados abajo, mirando la imagen real. No estás rehaciendo el análisis completo: no describas de nuevo la pose, el outfit, la escena ni nada que no se te pida acá.

Responde SIEMPRE en español, en todos los campos de texto libre.

# Regla no negociable: análisis quirúrgico (misma regla que el análisis completo)

Todo lo que clasifiques debe ser verificable directamente en los píxeles de la imagen. Si no hay evidencia clara para un campo, usa el valor de "no aplica"/"no determinable" que corresponda según su definición (ver abajo) — nunca una suposición disfrazada de observación. El sujeto/protagonista principal de este banco es SIEMPRE una mujer (dato ya confirmado, no una inferencia por imagen).

# Contexto ya guardado de esta imagen (para referencia, NO lo reescribas)

Te paso el \`raw_visual_description\` que ya existe en el banco para esta imagen, como contexto — úsalo para no contradecirlo, pero no lo repitas en tu respuesta:

{{EXISTING_CONTEXT}}

${archetypeSection.trim()}

${filteringFieldsSection.trim()}

# Auto-verificación antes de responder

Antes de responder, cruza cada campo estructurado nuevo contra el contexto ya guardado de arriba (\`subject_gesture\`, \`outfit_visible\`, \`background_setting\`, \`shot_type\`, \`companion_present\`) — si hay una contradicción evidente (ej. \`hand_occupancy: empty\` mientras el contexto menciona algo sostenido en la mano), corregí el campo antes de responder.

# Schema de salida (JSON estricto, responde EXACTAMENTE esta forma, sin texto adicional antes o después)

{
  "archetype_primary": string,
  "archetype_secondary": [string],
  "body_visibility": string,
  "companion_prominence": string | null,
  "hand_occupancy": string | null,
  "reflection_surface_type": string | null
}`;
}

module.exports = { getEnrichmentPrompt };
