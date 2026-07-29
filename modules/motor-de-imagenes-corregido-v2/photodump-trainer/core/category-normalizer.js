// Normaliza `interpreted_signals[].category` sin reprocesar el banco: el prompt del
// entrenador nunca tuvo un enum cerrado para este campo, así que Gemini generó ~230
// variantes de texto libre para lo que en la práctica son ~8 conceptos reales
// (ej. "escena_mundo"/"escenario"/"scene_world"/"mundo" son todos lo mismo).
//
// Este mapeo se aplica al LEER el análisis, no al guardarlo — así el JSON original
// queda intacto (trazable a lo que Gemini devolvió) y no hace falta gastar cuota de
// Vertex reprocesando ~600 imágenes solo por este campo.

const NORMALIZED_CATEGORIES = [
  'pose',
  'gesto',
  'outfit',
  'accesorio',
  'joyeria',
  'calzado',
  'bolsos',
  'maquillaje',
  'cabello',
  'tecnologia',
  'escena_mundo',
  'iluminacion',
  'encuadre',
  'prop_bebida_comida',
  'otro',
];

// Cada regex se evalúa en orden contra la categoría en minúsculas/sin tildes —
// la primera que matchea gana. Los patrones van de más específico a más genérico.
const RULES = [
  [/pose|postura|body_language|standing|seated|reclin/, 'pose'],
  [/gesto|gesture|mirada|gaze|expresion|expression|mano|hand/, 'gesto'],
  [/joyer|jewelry|anillo|pulsera|collar|arete|pendiente/, 'joyeria'],
  [/calzad|footwear|zapato|bota|tacon/, 'calzado'],
  [/bolso|bag|cartera/, 'bolsos'],
  [/maquillaj|makeup|belleza|beauty/, 'maquillaje'],
  [/cabello|hair/, 'cabello'],
  [/tecnolog|technology|celular|phone|auricular|gadget/, 'tecnologia'],
  [/accesor|accessor/, 'accesorio'],
  [/outfit|garment|prenda|ropa|vestido|estilismo|styling|look/, 'outfit'],
  [/escena|scene|mundo|world|escenario|setting|ambiente|background|fondo|contexto|arquitect/, 'escena_mundo'],
  [/iluminacion|lighting|luz/, 'iluminacion'],
  [/encuadre|camera|framing|composicion|composition|shot_type|angulo|angle/, 'encuadre'],
  [/bebida|comida|drink|food|cocktail|coctel|copa|trago|glass/, 'prop_bebida_comida'],
];

function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeCategory(rawCategory) {
  if (!rawCategory) return 'otro';
  const clean = stripAccents(String(rawCategory).toLowerCase());
  for (const [re, normalized] of RULES) {
    if (re.test(clean)) return normalized;
  }
  return 'otro';
}

module.exports = { normalizeCategory, NORMALIZED_CATEGORIES };
