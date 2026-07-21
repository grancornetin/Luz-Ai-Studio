/**
 * recipes/outfitMultiLook/renderProfile.ts
 *
 * Bloques de render/composición validados manualmente (fuera de código,
 * pegando prompts contra el mismo motor Gemini que usa esta app) durante el
 * diseño de outfit_multi_look — ver
 * recipes/manifiesto de direccion/09_session_log_outfit_night_out_validation.md
 * y 10_experimental_findings_001.md (Finding 003-005).
 *
 * No existían como constante de código antes de esta receta — el texto
 * suelto más parecido vivía en weeklyFavoritesV2/dayInLife ("Natural iPhone
 * quality. Candid UGC feel."). Acá se usa la versión más específica que
 * describe artefactos observables en vez de solo nombrar el dispositivo
 * (Finding 003: nombrar "iPhone" no alcanza por sí solo).
 */

// Finding 004 — lenguaje de mejor desempeño para look de camera-roll real,
// no editorial/catálogo. Se agrega al final de cada prompt de shot.
export const IPHONE_CAMERA_ROLL_LINE =
  'Camera roll quality: unedited photo, casual handheld feel, everyday smartphone capture, ' +
  'no catalogue finish, no beauty retouching, no editorial polish — a real, imperfect, authentic photo, not a professionally composed shot.';

// Finding 005 — sin esto, un shot con un lugar icónico de fondo (trip_recap)
// tiende a componerse como campaña editorial de moda en vez de foto casual:
// sujeto centrado, mirada a cámara, el lugar perfectamente enmarcado detrás.
export const UGC_CASUAL_COMPOSITION_BLOCK =
  'She is positioned off-center in the frame, not in the middle — standing toward one side with open space on the other side. ' +
  'Her gaze is directed away from the camera — toward the landmark, into the distance, or over her shoulder — not looking directly and posed at the lens, as if captured candidly rather than staged for it. ' +
  'The landmark or iconic background element is glimpsed and partially in frame, not perfectly centered behind her head. ' +
  'Framing is imperfect and casual: a slightly tilted horizon line, extra space to one side, or feet slightly cropped — the unstudied framing of a quick phone photo, not a professional composition.';

// Regla global — un shot de "caminando" (mid-stride) se ve falso casi sin
// excepción; el modelo no resuelve bien la física de piernas en movimiento
// en una imagen estática. Ver 09_session_log...md, checklist paso 10.
export const NO_WALKING_LINE =
  'She is standing still, both feet planted on the ground, not mid-stride — weight settled mostly on one leg, the other leg relaxed with the knee slightly bent, both feet close to each other, not one foot stepped far ahead of the other.';

export const AVOID_EDITORIAL_LINE =
  'Avoid: editorial or catalog-like finish, overly polished or retouched skin, perfectly centered symmetric composition, walking or mid-stride pose, legs in a walking stance.';

// Bug real reportado en producción (piloto Fase 8): sin esta instrucción,
// un "full-body mirror selfie" tiende a generarse contra un fondo de estudio
// fotográfico (backdrop liso, piso de concreto/ciclorama) — el prior más
// fuerte del modelo para esa composición. Nadie se fotografía así para un
// outfit dump; el espacio real es siempre doméstico u orgánico (dormitorio,
// baño, pasillo, frente a un espejo o vitrina de la calle). Se agrega en
// TODO shot con encuadre mirror-selfie, no solo en el ancla.
//
// Segundo bug real (piloto Fase 8, ronda 2): la primera versión de esta
// línea pedía "clutter" para escapar del look de estudio, y el resultado se
// leyó como un pasillo desordenado — en contradicción con looks elegantes y
// cuidados. El espacio debe leerse "vivido" (objetos reales, textura, no
// vacío) pero ORDENADO — la misma persona que cuida su outfit cuida su casa.
export const NO_STUDIO_BACKDROP_LINE =
  'The background is a real, lived-in domestic or everyday space — a bedroom, a bathroom, a well-kept hallway, a closet, or a street-level shop window reflection — never a photography studio, never a seamless backdrop, never a plain concrete or cyclorama floor. ' +
  'It must look like an ordinary room or place someone actually lives in, with a few real, natural details (furniture, wall texture, a mirror frame, soft ambient light) — but tidy and well cared for, matching someone who dresses with intention and care. Not a blank staged set, but not a messy or cluttered space either.';
