/**
 * recipes/outfitNightOut/nightMoments.ts
 *
 * Banco de "momentos de noche" — derivado de analizar 23 imágenes reales de
 * salidas nocturnas (2 tandas: registro elegante/cena y registro
 * fiesta/discoteca). El hallazgo real: la variedad de una salida nocturna NO
 * se explica por "en qué momento narrativo está" (llegada/social/cierre),
 * sino por el CRUCE de 4 ejes independientes:
 *
 *   Eje A — encuadre/sujeto (las 8 entradas de este banco)
 *   Eje B — energía: elegante | fiesta (resolveEnergyFromBrief) — parametriza
 *           el promptBlock de cada entrada, no agrega entradas nuevas
 *   Eje C — venue: resuelto aparte por venueResolver.ts, inyectado como
 *           bloque de escena en cualquier entrada
 *   Eje D — compañía: filtra si group_moment entra al pool disponible
 *
 * Cada entrada expone la misma forma que RevealVariant de
 * outfitRevealBasic/renderVariants.ts (ShotContract + promptBlock) — el
 * resto del pipeline (referenceRouter, intelligenceLayer, promptBuilder) no
 * necesita saber que el contenido nació de cruzar 4 ejes.
 */
import type { NightMomentId, NightOutEnergy, ShotContract } from './types';

export interface NightMoment {
  id:            NightMomentId;
  contract:      ShotContract;
  // Variaciones de texto de escena por energía — 4 por entrada, generadas
  // una vez con Gemini razonando sobre el banco real (ver
  // scripts/photodump-director/generateFallbackVariations.ts). Antes esto
  // era 1 solo string fijo: cuando el Director Creativo cae (timeout, red,
  // JSON inválido), TODAS las sesiones que caen a este fallback veían
  // literalmente la misma frase, sin importar que el banco real tenga 300+
  // fotos por tipo de shot — pedido real del usuario tras notar que el
  // fallback repetía siempre el mismo resultado. pickNightMomentsForSet
  // elige 1 de las 4 por seed (mismo mecanismo determinístico que ya usa
  // para elegir qué tipos de shot entran al set). motion_energy no tiene
  // entrada 'elegante' porque solo está disponible cuando la energía
  // resuelta es 'fiesta'.
  sceneBlockByEnergy: Partial<Record<NightOutEnergy, string[]>>;
  // Si true, requiere companion real subido para entrar al pool disponible.
  requiresCompanion: boolean;
  // Si true, solo disponible cuando la energía resuelta es 'fiesta'.
  fiestaOnly: boolean;
  // Si false, la protagonista NO aparece en cuadro (ni rostro ni cuerpo) —
  // ambient_only y car_transition son bodegón/lugar puro. pov_legs SÍ cuenta
  // como con protagonista (se ven sus propias piernas), aunque no haya
  // rostro. pickNightMomentsForSet limita a máximo 1 shot sin protagonista
  // por set completo — de lo contrario el dump se siente como fotos de
  // situaciones/personas distintas, no la salida de una sola persona.
  hasProtagonist: boolean;
}

export const NIGHT_MOMENTS: NightMoment[] = [
  {
    id: 'posed_portrait',
    contract: {
      shotId: 'posed_portrait',
      cameraGrammar: { framing: 'MEDIUM_CLOSE', angle: 'eye_level', composition: 'posed_portrait' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
      hpiPoseFamily: 'SEATED_EDITORIAL_OR_LIFESTYLE_POSE',
      hpiCameraFamily: 'OBSERVED_PROFILE_OR_CANDID',
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: [
        "A posed portrait of a woman seated at an elegant table, with one hand gently resting on her chin or cheek, a sophisticated drink (wine or cocktail) positioned on the table nearby. Her gaze is slightly averted, conveying a thoughtful mood in a softly lit restaurant ambiance.",
        "A posed portrait of a woman seated, her hand gracefully bringing a wine glass or elegant cocktail to her lips, as if savoring the taste. Her eyes are closed or looking down at the drink. The background suggests a warm, intimate bar or restaurant setting.",
        "A posed portrait of a woman seated, elegantly holding a cocktail or glass of wine, her arm casually resting on a table or bar. She looks composedly towards or slightly past the camera, set against a softly lit, upscale rooftop or terrace.",
        "A posed portrait of a woman seated, elegantly raising a glass of wine or a cocktail in a soft toasting gesture. Her eyes are gently focused, and the background hints at the sophisticated ambiance of a restaurant or bar.",
      ],
      fiesta: [
        "A vibrant posed portrait, arms raised in joyful celebration, framed by blurred movement and vivid neon club lights. A festive prop, like a glowing drink, is subtly visible.",
        "A playful, close-up posed portrait with a bold, expressive face – perhaps a mischievous smile or an open-mouthed laugh. The subject wears stylish sunglasses and holds a small, cool prop like a lollipop or a unique accessory, all illuminated by a direct, intense flash against a dark, energetic club background.",
        "A dynamic posed portrait, focusing on the subject holding a brightly colored cocktail or a unique bottle, positioned near the body. The background is a swirl of electric laser beams and deep, abstract club lighting, creating an immersive party atmosphere.",
        "A cool, stylized posed portrait captured with a slight dutch angle, featuring the subject striking an energetic pose while interacting playfully with a prop like a phone or a small, branded item. Pulsating red and purple lights cast dramatic shadows, with blurred silhouettes of fellow partygoers in the distance.",
      ],
    },
    requiresCompanion: false,
    fiestaOnly: false,
    hasProtagonist: true,
  },
  {
    id: 'group_moment',
    contract: {
      shotId: 'group_moment',
      cameraGrammar: { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'group_moment' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true, useCompanionRef: true },
      hpiPoseFamily: null,
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: [
        "A close-up of two hands clinking elegant wine or cocktail glasses over a softly lit table, suggesting a celebratory moment. The background is an out-of-focus elegant restaurant or city view at night.",
        "A candid, medium shot of a person leaning in slightly, engaged in conversation with an unseen companion at an elegant dining table. A warm, intimate light illuminates their face, with subtle gestures of hands resting near a drink or small plate.",
        "A person with a relaxed, elegant posture, gazing out towards a panoramic city skyline or a scenic vista from a rooftop bar or a sophisticated terrace. A companion's presence is implied by a shared table or a nearby drink, bathed in soft, ambient evening light.",
        "A candid, close-up shot of a person making a lighthearted or affectionate gesture, such as a subtle smile or a playful hand movement, while sharing a drink or small plate with a companion at an upscale restaurant or lounge. Warm, atmospheric lighting creates an intimate feel.",
      ],
      fiesta: [
        "A dynamic, candid shot of two friends dancing and laughing joyfully in a crowded club, arms raised, bathed in vibrant neon and laser lights. One person has an arm around the other's waist, showing close interaction. The background is a blur of energy and color.",
        "A close-up, intimate moment between two companions, leaning into each other and sharing a secret or a laugh amidst the bustling party atmosphere. One person holds a drink, the other's hand might be gesturing. Harsh frontal light illuminates their faces against a dark, blurry background of fellow party-goers.",
        "A small group of friends celebrating at a vibrant party, with one sticking out their tongue playfully while others hold up drinks in a toast. The scene is illuminated by colorful disco lights, highlighting their expressions of shared fun. A table with scattered glasses or party props might be visible.",
        "A vibrant, semi-posed shot of two friends, faces clearly visible and beaming with laughter, captured amidst the pulsating neon and laser lights of a lively club.",
      ],
    },
    requiresCompanion: true,
    fiestaOnly: false,
    hasProtagonist: true,
  },
  {
    id: 'motion_energy',
    contract: {
      shotId: 'motion_energy',
      cameraGrammar: { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'motion_energy' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
      hpiPoseFamily: null,
      hpiCameraFamily: 'DYNAMIC_MOTION_CAPTURE_FRAMING',
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      fiesta: [
        "A dynamic mid-shot of friends dancing on a club floor, arms raised in motion. Vibrant neon and laser lights illuminate the scene, with blurry party-goers in the background.",
        "A lively portrait of someone mid-dance, arms up, with a playful prop like a lollipop. The background is a blur of warm red club lights and indistinct shapes of people.",
        "A celebratory shot of a small group of friends holding drinks and a bottle, mid-cheer or playful interaction. Colorful, vibrant club lights create an energetic ambiance.",
        "A close-up of someone with a playful, energetic expression, possibly sticking their tongue out, wearing cool sunglasses. Intense red and purple club lights glow in the blurred background.",
      ],
    },
    requiresCompanion: false,
    fiestaOnly: true,
    hasProtagonist: true,
  },
  {
    id: 'pov_legs',
    contract: {
      shotId: 'pov_legs',
      cameraGrammar: { framing: 'CLOSE_UP', angle: 'looking_down', composition: 'pov_legs' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
      hpiPoseFamily: null,
      hpiCameraFamily: 'LOW_ANGLE_SELFIE_POV',
      footwearVisible: true,
    },
    sceneBlockByEnergy: {
      elegante: [
        "A sophisticated POV shot looking down at elegantly crossed legs in stylish high heels, with a chic cocktail glass resting on a sleek, dark table. The refined flooring and warm, soft lighting define an upscale lounge setting.",
        "A relaxed yet elegant POV of legs extended in stylish flat shoes, casually positioned on a luxurious patterned rug. A stemless wine glass sits nearby on a polished marble surface, bathed in intimate ambient light.",
        "An artistic POV shot centered on exquisite designer footwear, with legs gracefully angled. The subtle glow of the venue's lighting creates reflections on a pristine, dark floor, highlighting a moment of refined luxury.",
        "A chic POV observing legs in sophisticated pointed-toe flats, settled on a rich, polished wood floor. A designer evening clutch rests discreetly beside them, subtly illuminated by the warm, inviting atmosphere.",
      ],
      fiesta: [
        "A dynamic POV shot looking down at your feet, caught mid-step on a crowded, vibrating dance floor. Blurred party lights and distant dancing figures fill the background, capturing the energetic club atmosphere.",
        "POV looking down at your legs casually crossed while seated, a shimmering cocktail glass resting on the glowing club floor next to your footwear. Colorful neon hues softly illuminate the scene.",
        "A close-up POV of your shoes against a textured, slightly wet or reflective club floor, scattered with glitter or confetti. Hazy, atmospheric lights above create a dreamy, vibrant ambiance.",
        "POV of your feet traversing a flight of dimly lit club stairs, with streaks of vibrant colored light from decorative wall fixtures guiding the way. A sense of movement and transition within the party venue.",
      ],
    },
    requiresCompanion: false,
    fiestaOnly: false,
    hasProtagonist: true,
  },
  {
    id: 'ambient_only',
    contract: {
      shotId: 'ambient_only',
      cameraGrammar: { framing: 'WIDE', angle: 'eye_level', composition: 'ambient_only' },
      referencePolicy: { useIdentityRef: false, useBodyRef: false, useOutfitRefs: false },
      hpiPoseFamily: null,
      hpiCameraFamily: 'LIFESTYLE_MEDIUM_DISTANCE',
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: [
        "An elegant table setting featuring a cocktail and a wine glass, a lit candle casting a warm glow. The scene includes polished cutlery and a crisp tablecloth, suggesting an intimate dinner in a refined restaurant.",
        "A wide shot of an upscale restaurant interior at night, showcasing elegant chandeliers and decorative mirrors reflecting the warm ambient light. A large window offers a blurred view of city lights, creating a sophisticated and expansive atmosphere.",
        "An inviting outdoor lounge area at dusk, featuring comfortable seating and a low table with a refreshing cocktail. Subtle, warm string lights and decorative plants contribute to a chic and relaxed ambiance.",
        "A close-up of two elegant drinks on a sleek marble table, one a vibrant cocktail and the other a glass of fine wine. The background is softly blurred, highlighting the refined textures and warm, inviting glow of the scene.",
      ],
      fiesta: [
        "A close-up of a club table, showcasing colorful cocktails and glasses glowing under vibrant neon and laser lights. Dynamic light reflections create an energetic atmosphere.",
        "A wide shot of a dark party venue, filled with abstract geometric neon lights and intense colored beams crisscrossing the space. The scene captures the high-energy club atmosphere.",
        "An inviting shot of an outdoor evening party, with a pool reflecting warm light and a festive magenta glow. Blurred party decorations enhance the lively, open-air ambiance.",
        "A detailed shot of a lively party bar counter, covered with an array of colorful drinks, bottles, and scattered party items. Strong, vibrant UV lighting highlights the liquids and textures.",
      ],
    },
    requiresCompanion: false,
    fiestaOnly: false,
    hasProtagonist: false,
  },
  {
    id: 'car_transition',
    contract: {
      shotId: 'car_transition',
      cameraGrammar: { framing: 'MEDIUM_CLOSE', angle: 'eye_level', composition: 'car_transition' },
      referencePolicy: { useIdentityRef: false, useBodyRef: false, useOutfitRefs: false },
      hpiPoseFamily: null,
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: [
        "The interior of an elegant car at night, passenger's point of view, looking out the window. Blurred city lights streaking past, rain softly distorting the view. Reflections of the sophisticated car interior are subtly visible on the glass.",
        "An overhead shot from a passenger's perspective in an opulent car interior at night. A luxurious handbag rests casually on a plush leather seat. Through the window, the abstract blur of distant city lights paints a backdrop.",
        "A dynamic low-angle shot from the passenger's seat of an elegant car at night. The soft glow of the dashboard lights illuminates subtle textures of the interior, while the window shows elongated streaks of urban lights, conveying motion and speed.",
        "A medium-close view from inside an elegant car at night, focusing on the dark windowpane. Soft, indistinct reflections of the car's luxurious interior overlay the blurred, colorful bokeh of city lights outside, suggesting a smooth, quiet journey.",
      ],
      fiesta: [
        "An interior view of a car at night from the passenger seat, vibrant streaks of city and club lights blurring past the window, casting dynamic reflections across the dashboard and interior surfaces, conveying movement and festive energy.",
        "A close-up view from the passenger seat of a car interior at night, subtly lit, with scattered glitter and confetti on the upholstery, and a discarded, faintly glowing party accessory on the floor, suggesting the recent energy of a celebration.",
        "The perspective from a passenger seat inside a moving car at night, looking out towards the blurred, colorful glow of a distant party venue, with the car's interior bathed in a soft, ambient light, building a sense of anticipation.",
        "An immersive shot from the passenger seat of a car at night, focusing on the abstract interplay of light and shadow; dynamic, blurred light trails from passing vehicles and ambient streetlights create a vibrant, energetic pattern across the car's darkened interior surfaces.",
      ],
    },
    requiresCompanion: false,
    fiestaOnly: false,
    hasProtagonist: false,
  },
  {
    // Reescrito con base real: img_1785273260414_82 (sushi, luz de barra azul de
    // fondo), img_1785428822234_19 (pose de beber con lengua asomando, fit=8 ya
    // en outfit_night_out), img_1785428822196_6 (postre de cumpleaños, atmósfera
    // íntima). Banco: 8 imágenes de noche con comida servida en mesa de
    // restaurante — casi todas etiquetadas para day_in_life/travel, no para
    // night_out, pero el training_note de img_1785428822214_12 lo describe
    // explícitamente como "combinación de outfit de noche con comida de
    // restaurante crea un contexto de 'salida' muy útil".
    id: 'food_detail',
    contract: {
      shotId: 'food_detail',
      cameraGrammar: { framing: 'CLOSE_UP', angle: 'high_angle', composition: 'food_detail' },
      referencePolicy: { useIdentityRef: false, useBodyRef: false, useOutfitRefs: false },
      hpiPoseFamily: null,
      hpiCameraFamily: 'HIGH_ANGLE_OVERHEAD_FRAMING',
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: [
        "An overhead shot of a meticulously plated main course and a red wine glass on a dark wooden table, with elegant ambient lighting in a sophisticated restaurant.",
        "A top-down view of a handcrafted cocktail and a crystal water glass on a white marble table, complemented by gold cutlery and a folded napkin, in a softly lit, upscale bar or restaurant.",
        "An elegant dessert plate, a coffee cup, and a small, lit candle on a dark wooden table, capturing an intimate dining moment with warm, low lighting from an upscale restaurant.",
        "An overhead perspective of a selection of exquisite appetizers and various stemmed glasses on a dark, reflective table surface, set against the blurred, sophisticated lights of a city rooftop lounge.",
      ],
      fiesta: [
        "An overhead shot of a sleek club table adorned with vibrant, neon-lit cocktails and glowing beverages, casting colorful reflections. Dark, energetic background with blurred laser lights.",
        "An overhead shot of a luxurious, high-gloss bar surface showcasing perfectly crafted, sparkling cocktails and gourmet appetizers under dynamic, colorful club lighting, with mesmerizing light reflections dancing on the drinks.",
        "A close-up, top-down view of a stylish marble bar top showcasing various colorful cocktails in elegant glasses, some with fruit garnishes and ice. The scene is bathed in a festive glow of shifting red, blue, and yellow party lights.",
        "An extreme close-up, top-down shot of a festive party treat, like a vibrant candy or a sparkling dessert, placed on a dark surface. The background is a swirl of out-of-focus, energetic red and orange neon lights, suggesting a high-energy club atmosphere.",
      ],
    },
    requiresCompanion: false,
    fiestaOnly: false,
    hasProtagonist: false,
  },
  {
    // Reescrito con base real: img_1785428822266_30 ("un primer plano de gesto
    // (brindis) ancla una narrativa de experiencia (cena o salida nocturna) al
    // usar un fondo atmosférico de luces de ciudad y una iluminación cálida de
    // vela" — el ejemplo más alineado con foto de referencia real compartida
    // por el usuario), img_1785436486169_48 (brindis de grupo con champán,
    // fit=9), img_1785428822263_29 (fit=8, training_note: "el choque de copas
    // es un primitive de alto valor para comunicar celebración y conexión
    // social"). Sin familia HPI real de pose para 2+ personas interactuando
    // (mismo criterio que group_moment) — se describe a mano.
    id: 'toast_moment',
    contract: {
      shotId: 'toast_moment',
      cameraGrammar: { framing: 'CLOSE_UP', angle: 'eye_level', composition: 'toast_moment' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true, useCompanionRef: true },
      hpiPoseFamily: null,
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: [
        "A candid close-up of two elegant champagne flutes clinking gently, held by graceful hands. The background features blurred, smiling faces of companions in a warmly lit, sophisticated restaurant setting.",
        "A close-up, candid shot focusing on a hand delicately holding a wine glass, slightly raised for an elegant toast. In the soft-focused background, the subtle outlines of a companion and refined restaurant decor are visible.",
        "An atmospheric, close-up view of an elegant table setting, showcasing two filled wine glasses and a sparkling bottle. The soft-focus background reveals indistinct figures enjoying a refined dinner in an upscale rooftop bar.",
        "A close-up, artful composition of two wine glasses on a polished, dark table, catching warm ambient light and casting subtle reflections. Blurred, out-of-focus figures of companions are visible in the deep background.",
      ],
      fiesta: [
        "A close-up, candid shot of two or more hands holding vibrant, glowing cocktails, clinking together in a celebratory toast. The drinks are in sharp focus, while blurred faces of friends and a lively, neon-lit club environment are visible in the background, suggesting movement and energetic party atmosphere.",
        "A candid, low-angle medium shot of a group of friends with arms raised in a toast, holding various drinks like wine glasses or cocktails. Their hands and glasses are sharply in focus, while their smiling or laughing faces are visible yet slightly out of focus against a backdrop of colorful, pulsating party lights and blurred silhouettes of other guests.",
        "An intimate, candid close-up featuring a hand holding a drink (e.g., a cocktail or a can) in sharp focus, brightly illuminated as if by a sudden flash. Other hands and glasses are partially visible in the immediate foreground, while the background shows the dark, dynamic blur of a dance floor with indistinct figures and intense, stark lighting.",
        "A candid medium-close shot capturing a moment of shared celebration between two or more people. Hands holding glowing drinks are raised in a toast, sharply in focus, while their energetic, slightly out-of-focus faces are visible in the background, illuminated by intense, colorful side and backlighting from a vibrant club setting.",
      ],
    },
    requiresCompanion: true,
    fiestaOnly: false,
    hasProtagonist: true,
  },
  {
    // Nuevo, reemplaza a view_moment (que estaba inventado sin respaldo real
    // como shot autónomo "de espaldas mirando el paisaje" — el banco solo
    // respalda la vista urbana como FONDO de otra pose, no como shot propio).
    // Base real: img_1785331443133_1 (pileta + fiesta + noche, "reflejo en el
    // agua añade un elemento dinámico y estético reutilizable", el tipo exacto
    // de fiesta en pileta nocturna con gente compartido por el usuario),
    // img_1785331443157_8 (fit=10, "fotografía de celular en ambiente de
    // discoteca... la interacción entre las mujeres añade una capa social
    // importante"), img_1785297196870_149 ("fondo urbano nocturno como
    // elemento clave de ambientación para la narrativa de salida nocturna").
    // Requiere companion — el patrón real es grupo, no protagonista sola.
    id: 'group_party_moment',
    contract: {
      shotId: 'group_party_moment',
      cameraGrammar: { framing: 'WIDE', angle: 'eye_level', composition: 'group_party_moment' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true, useCompanionRef: true },
      hpiPoseFamily: null,
      hpiCameraFamily: 'LIFESTYLE_MEDIUM_DISTANCE',
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: [
        "A group of friends sharing drinks and laughter around a stylish table in an elegant restaurant, with warm ambient lighting.",
        "An intimate gathering on a chic rooftop bar, with the group conversing against a backdrop of city lights and a vibrant night sky.",
        "A sophisticated dinner party in a luxurious restaurant, showing the group at a beautifully set table with exquisite food and warm, inviting decor.",
        "A vibrant celebratory moment with the protagonist and her friends toasting with elegant drinks in a refined, softly lit venue.",
      ],
      fiesta: [
        "A group of friends dancing energetically, arms raised in celebration, surrounded by flashing neon and laser lights in a club. The scene is dynamic, capturing motion blur and joyful expressions.",
        "The protagonist and her group gathered closely around a table laden with glowing cocktails and party glasses. They are laughing and interacting, with a direct flash highlighting their expressions amidst the dim club atmosphere.",
        "A wide shot capturing the protagonist and her friends amidst a vibrant party scene. The energetic crowd and illuminated elements of the venue, such as a bar or dance floor, are visible, bathed in colorful, diffused party lights.",
        "The protagonist and her group caught in a moment of pure party energy, with expressive gestures and open mouths, immersed in the rhythm of the music. Intense red and purple ambient lights illuminate their faces, with blurred figures in the background.",
      ],
    },
    requiresCompanion: true,
    fiestaOnly: false,
    hasProtagonist: true,
  },
  {
    // Solo se usa en el nivel 'una_foto' (ver levelResolver.ts) — nunca
    // aparece en el sorteo normal de corto/completo/extendido. Fallback
    // estático de emergencia si el director falla en ese nivel; en el flujo
    // normal, el texto real viene del director razonando sobre el banco.
    id: 'single_hero_shot',
    contract: {
      shotId: 'single_hero_shot',
      cameraGrammar: { framing: 'MEDIUM_CLOSE', angle: 'eye_level', composition: 'single_hero_shot' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
      hpiPoseFamily: null,
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: [
        "A woman is seated at an elegant restaurant table or lounge, her arm gracefully extended to hold a sophisticated drink like a cocktail or a glass of wine, her gaze directly engaging the camera. The table is adorned with subtle details, and the blurred background reveals the upscale ambiance of the venue, highlighting her complete ensemble.",
        "A three-quarter portrait of a woman standing gracefully within an opulent setting like a grand staircase or a luxurious hotel lobby, her arm gently extended to rest on an elegant architectural feature. She looks confidently towards the camera, showcasing her polished appearance against the softly blurred, refined backdrop of the upscale venue.",
        "A half-body portrait of a woman at an upscale lounge or rooftop bar, her arm casually extended towards the viewer, perhaps holding a shimmering glass or a small clutch. Her thoughtful expression meets the camera as the city lights or ambient venue glow softly out of focus behind her, completing the sophisticated scene.",
        "A vibrant, waist-up portrait of a woman, her arm elegantly extended in an inviting pose at a chic restaurant or exclusive event. She presents a confident gaze, with the blurred, warm-lit interiors of the upscale establishment visible in the background, showcasing her complete stylish presence.",
      ],
      fiesta: [
        "A vibrant, half-body selfie in a club, with the person smiling widely, arms raised in an energetic pose, celebrating the night. The background is a blur of colorful party lights, highlighting the festive atmosphere and their full outfit.",
        "A dynamic, close-up selfie in a buzzing club. The person holds a vibrant drink, with an expressive, open-mouthed smile, capturing a fun moment. Blurry party lights and crowd fill the background, showcasing their festive look.",
        "A playful, waist-up portrait taken at a lively party. The person is winking or making a fun face while holding a cocktail, directly engaging the camera. The background is a soft blur of glowing party elements, emphasizing their celebratory style.",
        "A confident, half-body mirror selfie from a vibrant party, with the person striking a dynamic pose, arm extended to capture their festive outfit and accessories. The blurred, energetic club setting is visible in the background's reflection.",
      ],
    },
    requiresCompanion: false,
    fiestaOnly: false,
    hasProtagonist: true,
  },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Selecciona `count` entradas distintas y determinísticas por seed de un
 * sub-pool dado (mismo principio que pickVariantsForSet de
 * outfitRevealBasic/renderVariants.ts), usando un namespace de hash propio
 * para no colisionar con otras llamadas sobre el mismo seed.
 */
function pickDistinctIndices(seed: string, namespace: string, count: number, poolSize: number): number[] {
  const safeCount = Math.max(0, Math.min(count, poolSize));
  const picked: number[] = [];
  const used = new Set<number>();

  for (let i = 0; i < safeCount; i++) {
    let idx = hashString(`${seed}::${namespace}::${i}`) % poolSize;
    let attempts = 0;
    while (used.has(idx) && attempts < poolSize) {
      idx = (idx + 1) % poolSize;
      attempts++;
    }
    used.add(idx);
    picked.push(idx);
  }
  return picked;
}

/**
 * Filtra el pool disponible según companion/energía, y selecciona `count`
 * entradas distintas de forma determinística por seed.
 *
 * Regla dura: máximo 1 shot sin protagonista (hasProtagonist: false) por set
 * completo. Sin este límite, el set puede quedar con la protagonista ausente
 * en 2 de 3 fotos (ej. pov_legs + ambient_only + car_transition), lo que se
 * lee como fotos de lugares/situaciones distintas en vez del dump de la
 * salida de una sola persona. Si el pool con protagonista no alcanza para
 * cubrir el resto de `count` (pool muy chico tras filtrar companion/energía),
 * se permite más de 1 sin protagonista antes que repetir una entrada — evitar
 * duplicados es más importante que el límite blando.
 */
export function pickNightMomentsForSet(
  seed:         string,
  count:        number,
  hasCompanion: boolean,
  energy:       NightOutEnergy,
): NightMoment[] {
  const pool = NIGHT_MOMENTS.filter(m => {
    // single_hero_shot es exclusivo del nivel 'una_foto' (levelResolver.ts lo
    // usa directo vía findNightMoment) — nunca debe entrar al sorteo normal
    // de corto/completo/extendido.
    if (m.id === 'single_hero_shot') return false;
    if (m.requiresCompanion && !hasCompanion) return false;
    if (m.fiestaOnly && energy !== 'fiesta') return false;
    return true;
  });

  const withProtagonist    = pool.filter(m => m.hasProtagonist);
  const withoutProtagonist = pool.filter(m => !m.hasProtagonist);

  const safeCount = Math.max(0, Math.min(count, pool.length));
  // Preferido: exactamente 1 sin protagonista (si el set tiene al menos 1
  // shot y el sub-pool sin protagonista no está vacío). Piso: lo que sobre
  // si withProtagonist no alcanza para cubrir el resto por sí solo (pool muy
  // chico tras filtrar companion/energía) — evitar duplicados manda por
  // sobre el límite blando de "máximo 1".
  const preferred = safeCount > 0 && withoutProtagonist.length > 0 ? 1 : 0;
  const floor = Math.max(0, safeCount - withProtagonist.length);
  const noProtagonistCount = Math.min(Math.max(preferred, floor), withoutProtagonist.length, safeCount);
  const protagonistSlots = safeCount - noProtagonistCount;

  const protagonistIndices    = pickDistinctIndices(seed, 'protagonist', protagonistSlots, withProtagonist.length);
  const noProtagonistIndices  = pickDistinctIndices(seed, 'no-protagonist', noProtagonistCount, withoutProtagonist.length);

  const picked = [
    ...protagonistIndices.map(idx => withProtagonist[idx]),
    ...noProtagonistIndices.map(idx => withoutProtagonist[idx]),
  ];

  // Reordenar de forma determinística (no agrupar todos los "sin
  // protagonista" al final) usando el mismo hash de orden relativo por seed.
  const ordered = picked
    .map((moment, i) => ({ moment, key: hashString(`${seed}::order::${moment.id}::${i}`) }))
    .sort((a, b) => a.key - b.key)
    .map(({ moment }) => moment);

  // BUG REAL corregido: un shot sin protagonista (ambient_only, food_detail,
  // car_transition — sin referencePolicy de identidad/cuerpo/outfit, ver
  // arriba) no tiene NINGUNA referencia propia para anclarse a un lugar —
  // depende 100% de venueAnchorCache (la foto del PRIMER NightMoment ya
  // generado en la sesión, ver outfitNightOut/index.ts). Si el reordenamiento
  // de arriba lo dejaba como el PRIMER NightMoment del set, no había ningún
  // venue anterior al cual anclarse, y el shot fallaba en routingValidator
  // con "no tiene ninguna referencia resuelta" — confirmado en debug real de
  // producción. Un shot sin protagonista nunca puede ser el primero del
  // grupo de NightMoments (mirror_check, que sí va siempre primero de todo
  // el set, no cuenta como NightMoment): si el orden aleatorio lo puso
  // primero, se intercambia con el primer shot CON protagonista que exista.
  const firstNoProtagonistIdx = ordered.findIndex(m => !m.hasProtagonist);
  if (firstNoProtagonistIdx === 0) {
    const firstWithProtagonistIdx = ordered.findIndex(m => m.hasProtagonist);
    if (firstWithProtagonistIdx > 0) {
      [ordered[0], ordered[firstWithProtagonistIdx]] = [ordered[firstWithProtagonistIdx], ordered[0]];
    }
  }

  return ordered;
}

export function findNightMoment(id: NightMomentId): NightMoment {
  const moment = NIGHT_MOMENTS.find(m => m.id === id);
  if (!moment) throw new Error(`NightMoment desconocido: ${id}`);
  return moment;
}

/**
 * Elige, de forma determinística por seed, 1 de las variaciones de
 * sceneBlockByEnergy[energy] de un NightMoment — mismo mecanismo de hash que
 * pickDistinctIndices, namespace propio para no colisionar con la selección
 * de qué tipos de shot entran al set. Devuelve '' si no hay variaciones para
 * esa energía (ej. motion_energy sin entrada 'elegante').
 */
export function pickSceneVariation(moment: NightMoment, seed: string, energy: NightOutEnergy): string {
  const variations = moment.sceneBlockByEnergy[energy] ?? moment.sceneBlockByEnergy.elegante ?? [];
  if (variations.length === 0) return '';
  const idx = hashString(`${seed}::scene-variation::${moment.id}::${energy}`) % variations.length;
  return variations[idx];
}
