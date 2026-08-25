// Taxonomías fijas del banco de Pose Library. Fuente única de verdad — se
// interpolan literalmente en el system prompt de core/analyzer.js para que
// Gemini nunca devuelva un valor fuera de estas listas.

const POSE_CATEGORIES = [
  'de_pie',
  'sentada',
  'acostada',
  'arrodillada',
  'inclinada',
  'en_movimiento',
  'otra_pose'
];

const EXPRESSION_CATEGORIES = [
  'neutral',
  'sonrisa',
  'felicidad',
  'lengua_afuera',
  'guino',
  'sorpresa',
  'seria',
  'coqueta',
  'picara',
  'pensativa',
  'otra_expresion'
];

// Qué parte(s) del cuerpo sostienen el peso o tocan la superficie de apoyo.
// Nunca describe QUÉ es la superficie (eso es SUPPORT_SURFACE_HEIGHT) — el
// tipo exacto de mueble nunca se registra, para no anclar la pose a un
// mobiliario específico.
const CONTACT_POINTS = [
  'gluteos',
  'espalda',
  'torso_frontal',
  'costado',
  'rodillas',
  'pies',
  'manos',
  'antebrazos'
];

// A qué altura está el punto de apoyo respecto al suelo, sin nombrar el
// mueble en sí (silla/sofá/cama/escalón son todos 'mueble_bajo' si están a
// esa altura; barra/mesada/baranda son 'mueble_alto').
const SUPPORT_SURFACE_HEIGHT = [
  'suelo',
  'mueble_bajo',
  'mueble_alto',
  'ninguno'
];

// Encuadre/mecánica de captura de la foto — ortogonal a category (pose) y a
// image_type. Permite buscar cruces como "selfie espejo + de pie" o "selfie
// pov + sentada". No describe la pose en sí, solo cómo fue tomada la foto.
const FRAMING_CATEGORIES = [
  'selfie_espejo',
  'selfie_pov',
  'selfie_frente_camara',
  'tercero_cuerpo_completo',
  'tercero_medio_cuerpo',
  'primer_plano',
  'otro_encuadre'
];

module.exports = {
  POSE_CATEGORIES,
  EXPRESSION_CATEGORIES,
  CONTACT_POINTS,
  SUPPORT_SURFACE_HEIGHT,
  FRAMING_CATEGORIES
};
