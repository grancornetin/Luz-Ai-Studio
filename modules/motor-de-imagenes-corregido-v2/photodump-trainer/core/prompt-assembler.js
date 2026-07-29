// Ensambla el prompt final de un shot COMBINANDO piezas de distintas señales del banco,
// en vez de copiar el raw_visual_description completo de una sola imagen elegida.
//
// Razón: una señal de pose (ej. "sentada con piernas cruzadas") viene de UNA foto de origen
// que puede tener cualquier fondo — un café de día, un living, lo que sea. Ese fondo es
// irrelevante y hasta contraproducente para la receta actual (ej. night_out exige un venue
// de salida nocturna). El proceso real de dirección es: rol del shot -> outfit a mostrar ->
// pose que lo logra -> escenario compatible con la receta -> luz acorde a ese escenario/hora.
// Cada pieza puede venir de una imagen distinta del banco.

const store = require('./store');

// Nunca instruir "cámara de celular" de forma tan literal que el modelo dibuje la UI de una
// app de cámara (botón de shutter, "PHOTO/VIDEO", reloj, etc.) — eso pasó en una prueba real.
// Se describe el LOOK (perspectiva, grano, luz disponible) sin nombrar la interfaz.
const CAPTURE_STYLE_INSTRUCTIONS = {
  handheld_phone_natural: 'Photo taken with a handheld smartphone in natural available light: slightly wide-angle perspective, natural color, no studio lighting, no visible camera UI or app interface of any kind, no on-screen text, timestamps, buttons, or overlays — just the photograph itself as if viewed after the fact, not through a camera viewfinder.',
  handheld_phone_flash_direct: 'Photo taken with a smartphone flash at night: hard direct flash lighting, flat frontal light, slight overexposure on the subject, natural color, no studio lighting, no visible camera UI or app interface of any kind, no on-screen text or overlays.',
  mirror_selfie_phone: 'Mirror selfie photo taken with a smartphone: natural handheld perspective, phone partially visible in the reflection if applicable, no studio lighting, no visible camera UI or app interface of any kind, no on-screen text, timestamps, buttons, or overlays.',
  no_determinable: 'Photo taken with a handheld smartphone in natural available light, no studio lighting, no visible camera UI or app interface of any kind, no on-screen text or overlays.',
};

function getCaptureInstruction(captureSignature) {
  return CAPTURE_STYLE_INSTRUCTIONS[captureSignature] || CAPTURE_STYLE_INSTRUCTIONS.no_determinable;
}

// Extrae solo la descripción de POSE/GESTO/OUTFIT de una señal — deliberadamente NO incluye
// background_setting ni lighting del raw_visual_description de origen, porque esas piezas
// se deciden aparte (ver buildScenePiece).
function buildSubjectPiece(candidate) {
  const raw = candidate.rawVisualDescription || {};
  const parts = [];
  if (raw.subject_pose) parts.push(`Pose: ${raw.subject_pose}`);
  if (raw.subject_gesture) parts.push(`Gesture: ${raw.subject_gesture}`);
  if (raw.subject_gaze) parts.push(`Gaze: ${raw.subject_gaze}`);
  if (raw.hair) parts.push(`Hair: ${raw.hair}`);
  if (raw.outfit_visible) parts.push(`Outfit: ${raw.outfit_visible}`);
  if (raw.visible_objects) parts.push(`Objects: ${raw.visible_objects}`);
  if (raw.camera_framing) parts.push(`Framing: ${raw.camera_framing}`);
  return parts.join(' ');
}

// Escenario + luz se toman de una señal de categoría escena_mundo DISTINTA a la de la pose
// (o directamente son la pieza central, en shots donde el rol ES mostrar el venue).
function buildScenePiece(sceneCandidate) {
  if (!sceneCandidate) return null;
  const raw = sceneCandidate.rawVisualDescription || {};
  const parts = [];
  if (raw.background_setting) parts.push(`Setting: ${raw.background_setting}`);
  if (raw.lighting) parts.push(`Lighting: ${raw.lighting}`);
  return parts.join(' ');
}

function settingMatchesValidList(setting, validSettings) {
  if (!validSettings?.length) return true;
  return (setting || []).some(s => validSettings.some(kw => s.toLowerCase().includes(kw.toLowerCase())));
}

function settingMatchesExcludeList(setting, excludeKeywords) {
  if (!excludeKeywords?.length) return false;
  return (setting || []).some(s => excludeKeywords.some(kw => s.toLowerCase().includes(kw.toLowerCase())));
}

// Busca una señal de escenario válida para la receta, distinta del candidato de pose (para
// no repetir la misma foto como pose Y como fondo) y distinta de los escenarios ya usados en
// otros shots de la MISMA historia (para que 7 shots no terminen en el mismo rincón exacto
// del mismo lugar) — prioriza coherencia de hora del día.
function findSceneCandidate(allCandidates, template, excludeItemId, usedSceneItemIds) {
  const pool = allCandidates.filter(c =>
    c.category === 'escena_mundo' &&
    c.itemId !== excludeItemId &&
    !usedSceneItemIds.has(c.itemId) &&
    settingMatchesValidList(c.setting, template.validSettings) &&
    !settingMatchesExcludeList(c.setting, template.excludeSettingKeywords) &&
    (!template.timeOfDay || c.timeOfDayGuess?.includes(template.timeOfDay) || c.timeOfDayGuess === 'no_determinable')
  );
  pool.sort((a, b) => (b.fit || 0) - (a.fit || 0));
  return pool[0] || null;
}

// Ensambla los prompts de TODA la historia de una vez (no shot por shot aislado), para poder
// llevar un registro compartido de qué escenarios ya se usaron y evitar que 5 de 7 shots
// terminen mostrando el mismo restaurante — cada shot que necesita escena propia (needsScene)
// recibe una señal de escenario distinta a las ya asignadas en la misma historia.
function assembleStoryPrompts(story, allCandidates, template) {
  const usedSceneItemIds = new Set();

  story.forEach(shotResult => {
    const { candidate, shotId } = shotResult;
    if (!candidate) { shotResult.assembledPrompt = null; return; }

    const shotSpec = template.shots.find(s => s.id === shotId);
    const subjectPiece = buildSubjectPiece(candidate);
    const captureInstruction = getCaptureInstruction(candidate.captureSignature);

    let scenePiece = null;
    if (shotSpec?.needsScene) {
      const sceneCandidate = findSceneCandidate(allCandidates, template, candidate.itemId, usedSceneItemIds);
      if (sceneCandidate) usedSceneItemIds.add(sceneCandidate.itemId);
      scenePiece = buildScenePiece(sceneCandidate);
    } else {
      // El propio candidato es la escena (venue_detail, venue_scenic_moment) — se usa su
      // background_setting/lighting directamente. Se registra igual como "usado" para que
      // los shots de needsScene no lo vuelvan a elegir después.
      usedSceneItemIds.add(candidate.itemId);
      scenePiece = buildScenePiece(candidate);
    }

    const pieces = [captureInstruction, subjectPiece, scenePiece].filter(Boolean);
    shotResult.assembledPrompt = pieces.join(' ');
  });

  return story;
}

module.exports = { assembleStoryPrompts, buildSubjectPiece, buildScenePiece, findSceneCandidate, getCaptureInstruction };
