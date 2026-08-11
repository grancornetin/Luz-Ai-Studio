/**
 * modules/photodump/director/recipeContracts.ts
 *
 * Punto C del diagrama del usuario: el contrato de cada receta — de qué se
 * trata la historia, qué shots necesita, qué rol cumple cada uno. Portado
 * desde scripts/photodump-director/recipeContracts.js (mismo contenido,
 * validado con generaciones reales) — ver ese archivo para el historial de
 * por qué está redactado así.
 */
import type { RecipeContract } from './types';

export const RECIPE_CONTRACTS: Record<string, RecipeContract> = {
  outfit_night_out: {
    label: 'Look de noche',
    psychology: `Vender sin vender: la protagonista no está "mostrando el outfit",
está viviendo una salida nocturna real (cena, rooftop, previa, fiesta) en la que
el outfit es parte natural de la experiencia, no el foco explícito. La historia
debe sentirse como el rollo de fotos real de una noche — no una sesión de fotos
de producto. Frase ancla: "así se ve una noche que valió la pena, y así se veía
ella en ese momento" — nunca "así se ve la prenda".`,
    hardRules: [
      'La protagonista debe respetar su identidad real en todos los shots (mismo rostro/cuerpo que las referencias del usuario).',
      'El outfit debe verse idéntico a la referencia del usuario en cada shot donde sea visible — mismo diseño, color y detalles.',
      'Máximo 1 shot del set puede no mostrar a la protagonista en cuadro (bodegón/lugar puro) — todos los demás deben mostrarla, sola o con acompañante.',
      'Nunca inventar un acompañante con rostro visible si el usuario no subió una foto real de esa persona.',
    ],
    shotsByLevel: {
      // Sin mirror_check ni ningún shot fijo — ver nightMomentTypes,
      // 'single_hero_shot'. No es un 'corto' recortado a 1: es un tipo de
      // imagen distinto, pensado para resolver la historia completa en un
      // solo frame (manifiesto §4bis, núcleo narrativo dual).
      una_foto: {
        count: 1,
        description: '1 sola foto que resuelve toda la historia a la vez — outfit completo visible, contexto del venue presente, sin necesitar mirror check ni secuencia. "Tuvo una noche genial y se veía increíble", en una sola imagen.',
      },
      corto: {
        count: 3,
        description: '1 shot de mirror check (el outfit completo, de cuerpo entero, en un espejo de casa) + 2 momentos de la noche en sí (venue, experiencia).',
      },
      completo: {
        count: 5,
        description: '1 shot de mirror check + 1 shot de detalle de cómo se armó el look (ajuste de una prenda/accesorio) + 3 momentos de la noche.',
      },
      extendido: {
        count: 7,
        description: '1 shot de mirror check + 6 momentos de la noche — sin preparación adicional, todo es experiencia real de la salida.',
      },
    },
    // mirror_check es un shot FIJO, siempre presente en todos los niveles —
    // no es parte del banco rotable de night moments. Bug real corregido:
    // sin declararlo aparte, el director reusaba el id posed_portrait tanto
    // para el mirror check como para un momento de noche distinto.
    fixedShotTypes: [
      {
        id: 'mirror_check',
        description: 'Mirror selfie de cuerpo completo en un espacio doméstico (dormitorio, pasillo, baño) — el outfit completo, listo para salir, con el brazo levantado sosteniendo el teléfono tapando parcialmente el rostro. Siempre es el primer shot del set.',
        // Bug real detectado en pruebas: el mirror check salió con luz de
        // día para una cena de noche — se sintió "se preparó de mañana para
        // salir de noche". La iluminación debe seguir la hora real del
        // evento del brief, nunca la del candidato del banco.
        lightingRule: 'La iluminación de este shot se infiere de la hora del evento en el brief, nunca del candidato del banco — la pose/encuadre puede inspirarse en un candidato con luz de día, pero si el brief es una salida nocturna, este shot debe describirse con luz nocturna/artificial de interior, no la luz del candidato original.',
      },
    ],
    // Psicología general de este banco (manifiesto de dirección, §11
    // Atención desviada + §4bis Núcleo narrativo dual): ningún tipo de acá
    // "muestra el outfit" ni "muestra el lugar" de forma directa — cada uno
    // es una forma ALTERNATIVA de probar los mismos 2 ejes ("la noche fue
    // memorable" / "ella se veía increíble") desviando la atención hacia un
    // detalle concreto que el espectador usa para inferir el resto. Por eso
    // varios tipos comparten diversityAxis: si dos shots del mismo eje
    // conviven en un set, se leen como la misma foto repetida aunque sus ids
    // sean distintos (ej. pov_legs + food_detail + ambient_only son las 3
    // formas de "detalle sin protagonista que insinúa el resto" — elegir más
    // de 1 en un set de 3 deja el set sin variedad real, aunque técnicamente
    // sean "shots distintos").
    nightMomentDiversityRule: 'Nunca elijas más de 1 tipo del mismo diversityAxis en un mismo set — si ya elegiste un tipo de un eje, los demás candidatos de ese eje quedan descartados para esta sesión, sin importar cuán buenos sean sus candidatos del banco.',
    nightMomentTypes: [
      {
        id: 'posed_portrait',
        description: 'Retrato posado con bebida u otro prop cerca del cuerpo, mirando fuera de cámara o levemente hacia ella.',
        diversityAxis: 'posed_with_protagonist',
        attentionBridge: 'El prop (copa, vaso) es la excusa de la pose — la atención aparente es "sostener algo", pero el mensaje real es la presencia/confianza de la protagonista en el lugar.',
      },
      {
        id: 'group_moment',
        description: 'Momento candid con un acompañante real (requiere foto de esa persona) — hablando, riendo, apoyados juntos.',
        diversityAxis: 'social_connection',
        attentionBridge: 'La interacción con otra persona desvía la atención de "estoy mostrando mi outfit" hacia "estoy viviendo un momento social real" — el outfit se hereda de la escena, no se declara.',
      },
      {
        id: 'motion_energy',
        description: 'Movimiento real de pista de baile, luces de club, energía — solo si el registro de la noche es de fiesta.',
        diversityAxis: 'motion',
        attentionBridge: 'El movimiento/blur desvía la atención hacia la energía del momento — insinúa que la noche fue lo suficientemente buena como para perder la pose.',
        fiestaOnly: true,
      },
      {
        id: 'pov_legs',
        description: 'Punto de vista propio mirando hacia abajo, piernas/zapatos, quizás un trago cerca. Los zapatos/tacones son una pieza del outfit — si son elegantes/sofisticados, insinúan que el resto del outfit lo era también.',
        diversityAxis: 'close_detail_no_protagonist',
        attentionBridge: 'Cruzar las piernas → los zapatos. La atención aparente es "así se ve el lugar desde donde estoy sentada", pero el mensaje real es "mirá qué elegante/sofisticado es mi calzado" — una pieza del outfit presume la calidad del resto sin mostrarlo completo.',
      },
      {
        id: 'ambient_only',
        description: 'Plano ambiental sin la protagonista en foco — mesa, tragos, atmósfera del lugar.',
        diversityAxis: 'close_detail_no_protagonist',
        attentionBridge: 'El detalle del lugar/bebida es la excusa — el mensaje real es "este lugar era lo suficientemente bueno como para fotografiarlo" (estatus/acceso).',
      },
      {
        id: 'car_transition',
        description: 'Interior de un auto de noche, sin persona en cuadro — la sensación del traslado ida o vuelta.',
        diversityAxis: 'transition',
        attentionBridge: 'El interior del auto insinúa el traslado/anticipación sin mostrar a la protagonista — evidencia de que la noche tuvo un antes/después real.',
      },
      {
        id: 'food_detail',
        description: 'Detalle cenital de la comida/bebida servida en la mesa, sin persona en cuadro.',
        diversityAxis: 'close_detail_no_protagonist',
        attentionBridge: 'El plato/bebida es la excusa — si la comida se ve instagrameable, insinúa que el lugar/experiencia completa también lo era, sin necesidad de mostrar más.',
      },
      {
        id: 'toast_moment',
        description: 'Brindis candid en primer plano — copas/manos en foco, caras de fondo, con un acompañante real.',
        diversityAxis: 'social_connection',
        attentionBridge: 'El choque de copas es la excusa visual — el mensaje real es celebración y conexión social genuina.',
      },
      {
        id: 'group_party_moment',
        description: 'Plano amplio de la escena social — la protagonista y su grupo, con el lugar/ambiente también visible.',
        diversityAxis: 'wide_scene',
        attentionBridge: 'La escena amplia (grupo + lugar) es la única que muestra "pertenencia + estatus del lugar" a la vez, sin depender de un detalle aislado.',
      },
      {
        // Solo se usa en el nivel 'una_foto' — 1 imagen total, sin
        // mirror_check ni ningún otro shot. A diferencia de todos los tipos
        // de arriba (que desvían la atención hacia UN detalle e insinúan el
        // resto), este tipo resuelve los 2 ejes narrativos completos en el
        // mismo frame: outfit legible de cuerpo/torso completo (no un
        // detalle aislado) + contexto real del venue visible al fondo
        // (mesa, velas, luces) — no necesita otro shot para completar la
        // historia. Ejemplo real que motivó este tipo: selfie con brazo
        // extendido, mirada directa a cámara, torso con outfit y accesorios
        // completos (bolso, joyas) visibles, mesa con velas y candelabro
        // desenfocada al fondo — la foto sola ya dice "tuvo una noche genial
        // y se veía increíble", sin necesitar una secuencia.
        id: 'single_hero_shot',
        description: 'Selfie o retrato de medio cuerpo/torso con brazo extendido o cámara sostenida por la protagonista — outfit y accesorios completos y legibles (no un detalle aislado), mirada directa o semi-directa a cámara, con el venue real (mesa, luces, decoración) visible pero desenfocado al fondo. Debe leerse como una sola foto que ya cuenta toda la noche, sin depender de otras imágenes.',
        diversityAxis: 'complete_narrative',
        attentionBridge: 'No hay desvío de atención acá — es la única excepción del banco. La foto declara directamente "así me veía, así era el lugar" porque es la única imagen del set y necesita sostener sola ambos ejes narrativos (memorable + se veía increíble).',
      },
    ],
  },
};

export function getRecipeContract(recipeId: string): RecipeContract {
  const contract = RECIPE_CONTRACTS[recipeId];
  if (!contract) throw new Error(`No hay contrato definido para la receta: ${recipeId}`);
  return contract;
}
