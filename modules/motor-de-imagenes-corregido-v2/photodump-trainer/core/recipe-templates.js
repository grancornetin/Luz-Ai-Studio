// Plantillas de receta para el paso-a-paso de la herramienta de ensamblaje de historias.
// Viven aisladas del contrato real de producción (src/modules/photodump/recipes/) hasta
// validar manualmente en Higgsfield — no reemplazan nada todavía.
//
// Cada plantilla define el ROL NARRATIVO de cada shot (narrative_beat_fit ya existente en
// el banco), NO una escena fija — el motor de búsqueda elige entre TODAS las formas del
// banco que cumplan ese rol, para evitar que "shot 1" sea siempre la misma puesta en escena.

// Primitives que nunca deben elegirse como candidato, en NINGUNA receta: fotos "a medio paso"
// no se ven orgánicas (leen como frame de video congelado, no como foto real de cámara-roll).
const EXCLUDED_PRIMITIVE_PATTERNS = [
  /^walking_/i,
  /_walking_/i,
  /^standing_walking/i,
];

function isExcludedPrimitive(primitive) {
  if (!primitive) return false;
  return EXCLUDED_PRIMITIVE_PATTERNS.some(re => re.test(primitive));
}

// Escenarios válidos para night_out: SOLO lugares de salida nocturna real — nunca un fondo
// "inocente" heredado de la foto original de una pose (café de día, living, etc.). Esta lista
// se usa para filtrar el pool de escena_mundo que se COMBINA con la pose elegida, no para
// filtrar las señales de pose en sí (una pose de "mano en mandíbula" puede venir de cualquier
// foto — el escenario final se decide acá, aparte).
const NIGHT_OUT_VALID_SETTINGS = [
  'bar', 'pub', 'restaurante', 'restaurant', 'lounge', 'club', 'discoteca', 'terraza',
  'rooftop', 'calle', 'urbano', 'ciudad', 'city', 'skyline', 'car', 'coche', 'auto',
  'hotel', 'lobby', 'escalera', 'ascensor',
];

const RECIPE_TEMPLATES = {
  outfit_night_out: {
    label: 'Night Out',
    // outfit_night_out arranca SIEMPRE con la persona ya lista — nunca mostrar preparación
    // o arreglo (eso es lo que hacía rígido al contrato viejo de 3 shots fijos).
    excludeSignalCategories: ['preparation', 'styling_adjustment'],
    excludePrimitivePatterns: ['tryon', 'presentation', 'hanger', 'garment_presentation'],
    validSettings: NIGHT_OUT_VALID_SETTINGS,
    excludeSettingKeywords: ['bathroom', 'baño', 'cafeteria', 'cafetería', 'living', 'dormitorio', 'bedroom'],
    timeOfDay: 'noche',
    // sceneGroup: continuidad de mundo entre shots. Todos los shots del mismo grupo deben
    // compartir la MISMA descripción de escenario (mismas paredes, misma luz, mismo estilo) —
    // la variedad entre ellos viene de pose/ángulo/detalle, nunca de cambiar de lugar. Solo
    // el grupo "transition" tiene permiso explícito de ser un lugar físicamente distinto
    // (ej. el trayecto de salida) — nunca un cambio de lugar elegido al azar por el motor.
    shots: [
      {
        id: 'establish_look',
        role: 'establish',
        needsScene: true, // la pose sola no trae escenario válido — se combina con uno de venue
        sceneGroup: 'main_venue',
        note: 'Presentar el outfit completo, ya puesta, en pose estática (sentada, apoyada, reclinada), en un escenario de salida nocturna. Mirror check es una opción válida entre varias — nunca la única. Este shot ESTABLECE el venue principal de toda la historia.',
      },
      {
        id: 'social_connect_1',
        role: 'connect',
        preferCategories: ['pose', 'gesto', 'prop_bebida_comida'],
        needsScene: true,
        sceneGroup: 'main_venue',
        note: 'Interacción social: brindis, selfie grupal, cabezas juntas, mesa compartida — en el mismo venue que el shot 1.',
      },
      {
        id: 'drink_detail',
        role: 'experience',
        preferCategories: ['prop_bebida_comida'],
        needsScene: true,
        sceneGroup: 'main_venue',
        note: 'Detalle del trago/cóctel en mano o sobre la mesa, en el mismo venue que el shot 1.',
      },
      {
        id: 'venue_detail',
        role: 'experience',
        preferCategories: ['escena_mundo'],
        needsScene: false, // ESTE shot ES el escenario — no hace falta combinar con otro
        sceneGroup: 'main_venue',
        note: 'POV del personaje viviendo el ambiente: luces, decoración, DJ, pista, mesa servida, otras personas de fondo. La persona NO es protagonista del encuadre ni posa para la cámara — es "esto es lo que estoy viendo/viviendo ahora". Debe ser reconociblemente el MISMO lugar que el shot 1 (mismo estilo decorativo, misma paleta de luz).',
      },
      {
        id: 'social_connect_2',
        role: 'connect',
        preferCategories: ['pose', 'gesto', 'prop_bebida_comida'],
        needsScene: true,
        sceneGroup: 'main_venue',
        note: 'Otro momento social distinto al shot 2: fotomatón, comida compartida, manos brindando — en el mismo venue.',
      },
      {
        id: 'venue_scenic_moment',
        role: 'experience',
        preferCategories: ['escena_mundo'],
        needsScene: false,
        sceneGroup: 'main_venue',
        note: 'Foto "instagrameable": la persona posa DELIBERADAMENTE mirando o cerca de la cámara en el rincón más fotogénico del venue (una escalera decorada, un ventanal con vista, un arco, un detalle arquitectónico llamativo). Plano abierto donde el lugar domina el encuadre y la persona ocupa una porción menor del cuadro. Mismo venue que el resto de la historia.',
      },
      {
        id: 'closing_reflect',
        role: 'reflect',
        preferCategories: ['pose', 'gesto'],
        needsScene: true,
        sceneGroup: 'transition', // único shot con permiso de cambiar de lugar (ej. saliendo, en la calle, en el auto de vuelta)
        note: 'Cierre contemplativo: reclinada, mirando hacia algo, momento de pausa — puede ser en el mismo venue O en una transición legítima de salida (calle, auto, entrada del lugar), nunca un venue nuevo no relacionado.',
      },
    ],
  },
};

function getRecipeTemplate(recipeName) {
  return RECIPE_TEMPLATES[recipeName] || null;
}

module.exports = { RECIPE_TEMPLATES, getRecipeTemplate, isExcludedPrimitive };
