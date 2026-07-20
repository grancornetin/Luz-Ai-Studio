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
