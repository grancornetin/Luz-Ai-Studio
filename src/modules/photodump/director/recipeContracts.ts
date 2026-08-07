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
    nightMomentTypes: [
      { id: 'posed_portrait', description: 'Retrato posado con bebida u otro prop cerca del cuerpo, mirando fuera de cámara o levemente hacia ella.' },
      { id: 'group_moment', description: 'Momento candid con un acompañante real (requiere foto de esa persona) — hablando, riendo, apoyados juntos.' },
      { id: 'motion_energy', description: 'Movimiento real de pista de baile, luces de club, energía — solo si el registro de la noche es de fiesta.' },
      { id: 'pov_legs', description: 'Punto de vista propio mirando hacia abajo, piernas/zapatos, quizás un trago cerca.' },
      { id: 'ambient_only', description: 'Plano ambiental sin la protagonista en foco — mesa, tragos, atmósfera del lugar.' },
      { id: 'car_transition', description: 'Interior de un auto de noche, sin persona en cuadro — la sensación del traslado ida o vuelta.' },
      { id: 'food_detail', description: 'Detalle cenital de la comida/bebida servida en la mesa, sin persona en cuadro.' },
      { id: 'toast_moment', description: 'Brindis candid en primer plano — copas/manos en foco, caras de fondo, con un acompañante real.' },
      { id: 'group_party_moment', description: 'Plano amplio de la escena social — la protagonista y su grupo, con el lugar/ambiente también visible.' },
    ],
  },
};

export function getRecipeContract(recipeId: string): RecipeContract {
  const contract = RECIPE_CONTRACTS[recipeId];
  if (!contract) throw new Error(`No hay contrato definido para la receta: ${recipeId}`);
  return contract;
}
