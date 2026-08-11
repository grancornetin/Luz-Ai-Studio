/**
 * scripts/photodump-director/generateFallbackVariations.ts
 *
 * Genera, UNA VEZ, 4 variaciones de texto de escena por cada (tipo de shot ×
 * energía) del pool estático de respaldo de outfit_night_out
 * (nightMoments.ts) — el sistema al que cae la receta cuando el Director
 * Creativo falla (timeout, red, JSON inválido, etc.).
 *
 * Por qué existe: antes de esto, cada entrada de nightMoments.ts tenía
 * exactamente 1 frase fija por energía, escrita a mano una sola vez — cuando
 * el director cae (cosa que pasa con más frecuencia de la deseada), TODAS las
 * sesiones que caen al fallback ven literalmente la misma frase, sin importar
 * que el banco real tenga 300+ fotos por tipo de shot. Este script usa el
 * MISMO tipo de razonamiento que el director en vivo (Gemini evaluando
 * candidatos reales del banco, no inventando desde cero) pero corrido una
 * sola vez por humano, no por sesión — el resultado se pega a mano en
 * nightMoments.ts como un array de 4 variaciones en vez de 1 string.
 *
 * Uso:
 *   npx tsx scripts/photodump-director/generateFallbackVariations.ts
 *   npx tsx scripts/photodump-director/generateFallbackVariations.ts --shot=posed_portrait
 *
 * Imprime el resultado en JSON al final — se revisa a mano antes de pegarlo
 * en nightMoments.ts (no se auto-escribe el archivo: este texto pasa a vivir
 * en código de producción, merece lectura humana antes, mismo criterio que
 * ya se usó para escribir las 10 entradas actuales originales).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { generateJson } from './geminiClient.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cwd       = resolve(__dirname, '../..');

const VARIATIONS_PER_ENTRY = 4;

// Espejo minimal de nightMoments.ts — solo lo necesario para generar texto
// (no importa el archivo real porque ese vive en src/ con tipos de la
// receta completa; acá alcanza con id + descripción + energías aplicables).
const SHOT_TYPES: Array<{ id: string; description: string; energies: Array<'elegante' | 'fiesta'> }> = [
  { id: 'posed_portrait',    description: 'Retrato posado con bebida u otro prop cerca del cuerpo, mirando fuera de cámara o levemente hacia ella.', energies: ['elegante', 'fiesta'] },
  { id: 'group_moment',      description: 'Momento candid con un acompañante real — hablando, riendo, apoyados juntos.', energies: ['elegante', 'fiesta'] },
  { id: 'motion_energy',     description: 'Movimiento real de pista de baile, luces de club, energía — solo fiesta.', energies: ['fiesta'] },
  { id: 'pov_legs',          description: 'Punto de vista propio mirando hacia abajo, piernas/zapatos, quizás un trago cerca.', energies: ['elegante', 'fiesta'] },
  { id: 'ambient_only',      description: 'Plano ambiental sin la protagonista en foco — mesa, tragos, atmósfera del lugar.', energies: ['elegante', 'fiesta'] },
  { id: 'car_transition',    description: 'Interior de un auto de noche, sin persona en cuadro — la sensación del traslado ida o vuelta, punto de vista de pasajera.', energies: ['elegante', 'fiesta'] },
  { id: 'food_detail',       description: 'Detalle cenital de la comida/bebida servida en la mesa, sin persona en cuadro.', energies: ['elegante', 'fiesta'] },
  { id: 'toast_moment',      description: 'Brindis candid en primer plano — copas/manos en foco, caras de fondo, con un acompañante real.', energies: ['elegante', 'fiesta'] },
  { id: 'group_party_moment', description: 'Plano amplio de la escena social — la protagonista y su grupo, con el lugar/ambiente también visible.', energies: ['elegante', 'fiesta'] },
  { id: 'single_hero_shot',  description: 'Selfie o retrato de medio cuerpo/torso con brazo extendido, outfit y accesorios completos y legibles, venue real desenfocado al fondo — resuelve toda la historia en 1 sola foto.', energies: ['elegante', 'fiesta'] },
];

const rawArgs  = process.argv.slice(2);
const shotArg  = rawArgs.find(a => a.startsWith('--shot='));
const onlyShot = shotArg ? shotArg.split('=')[1] : null;

interface BankItem {
  itemId: string;
  analysis: {
    raw_visual_description?: {
      subject_pose?: string;
      subject_gesture?: string;
      subject_gaze?: string;
      visible_objects?: string;
      background_setting?: string;
      lighting?: string;
      camera_framing?: string;
    };
    companion_present?: boolean;
    search_tags?: { setting?: string[]; time_of_day_guess?: string };
  };
}

function normalizeText(s: string | undefined | null): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Filtro liviano por energía — mismo espíritu que bankFilter.ts pero sin
// depender del brief (acá no hay brief real, es una generación offline).
function scoreForEnergy(item: BankItem, energy: 'elegante' | 'fiesta'): number {
  const text = normalizeText([
    item.analysis.raw_visual_description?.background_setting,
    item.analysis.raw_visual_description?.lighting,
    ...(item.analysis.search_tags?.setting || []),
  ].filter(Boolean).join(' '));
  const eleganteKw = ['restaurante', 'cena', 'rooftop', 'elegante', 'bar', 'terraza', 'vela'];
  const fiestaKw   = ['fiesta', 'discoteca', 'club', 'neon', 'baile', 'dj', 'party'];
  const kw = energy === 'elegante' ? eleganteKw : fiestaKw;
  return kw.reduce((sum, k) => sum + (text.includes(k) ? 1 : 0), 0);
}

function summarize(item: BankItem): string {
  const d = item.analysis.raw_visual_description || {};
  return `itemId: ${item.itemId} | pose: ${d.subject_pose || 'N/A'} | gesto: ${d.subject_gesture || 'N/A'} | objetos: ${d.visible_objects || 'N/A'} | fondo: ${d.background_setting || 'N/A'} | luz: ${d.lighting || 'N/A'} | encuadre: ${d.camera_framing || 'N/A'} | acompañante: ${item.analysis.companion_present}`;
}

const VARIATIONS_SCHEMA = {
  type: 'object',
  properties: {
    variations: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['variations'],
};

async function generateVariationsFor(shotType: typeof SHOT_TYPES[number], energy: 'elegante' | 'fiesta', bankItems: BankItem[]): Promise<string[]> {
  const scored = bankItems
    .map(item => ({ item, score: scoreForEnergy(item, energy) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);
  const candidatesText = scored.map(({ item }) => summarize(item)).join('\n');

  const prompt = `Sos el Director Creativo de "Photodump" generando texto de FALLBACK ESTÁTICO — NO es una sesión real de usuario, es una tarea offline única: escribir ${VARIATIONS_PER_ENTRY} variaciones de texto de escena para el tipo de shot "${shotType.id}" en energía "${energy}", que se van a guardar en código como el pool de respaldo cuando el sistema de razonamiento en vivo no está disponible.

TIPO DE SHOT: ${shotType.description}
ENERGÍA: ${energy} (${energy === 'elegante' ? 'cena, rooftop, restaurante — tono sofisticado' : 'fiesta, discoteca, club — tono enérgico'})

CANDIDATOS REALES DEL BANCO (para inspirarte en poses/objetos/composiciones reales, no inventar desde cero):
${candidatesText}

INSTRUCCIONES:
- Escribí exactamente ${VARIATIONS_PER_ENTRY} variaciones de texto de escena en INGLÉS, cada una lista para usarse directo como prompt de generación de imagen.
- Cada variación debe ser CLARAMENTE DISTINTA de las demás en pose/composición/objetos — no repitas la misma idea con sinónimos. Priorizá diversidad real de ángulo, prop, encuadre.
- Basate en los candidatos reales de arriba (tomá piezas creíbles: poses, props, tipos de fondo) pero no cites ningún itemId ni detalle tan específico que solo aplique a esa foto puntual — esto es un fallback genérico, debe funcionar para cualquier venue real del tipo "${energy}".
- Mismo estilo y longitud que estas frases de referencia ya existentes en producción (no las repitas, son ejemplo de tono/formato):
  "A posed portrait, medium-close, holding a drink or a small prop close to the body — glass of wine, cocktail, cup. Warm, intentional lighting. She is looking away from the camera or slightly past it, composed and calm."
  "An ambient shot of the table or venue — glasses of wine or cocktails, plates, warm lighting. No person in focus, just the atmosphere of the moment."
- Reglas duras que ya rigen esta receta, respetalas en las 4 variaciones:
  - Nunca describir outfit/color de ropa específico (lo resuelve la imagen de referencia real del usuario).
  - car_transition: SIEMPRE punto de vista de pasajera, nunca de quien maneja, sin manos en el volante ni llaves sueltas.
  - Shots "sin protagonista" (ambient_only, car_transition, food_detail): nunca mencionar a la persona en cuadro.
  - single_hero_shot: debe leerse como que resuelve TODA la historia de la noche en 1 sola imagen (outfit + venue + mirada a cámara), no un detalle aislado.

Devolvé el resultado en el formato JSON pedido — un array de exactamente ${VARIATIONS_PER_ENTRY} strings.`;

  const result = await generateJson(prompt, VARIATIONS_SCHEMA) as { variations: string[] };
  return result.variations;
}

async function main() {
  const bankPath = resolve(cwd, 'src/data/photodump-bank/bank-snapshot.json');
  const snapshot = JSON.parse(readFileSync(bankPath, 'utf-8')) as { items: BankItem[] };
  console.log(`Banco cargado: ${snapshot.items.length} imágenes.`);

  const shotTypes = onlyShot ? SHOT_TYPES.filter(s => s.id === onlyShot) : SHOT_TYPES;
  if (shotTypes.length === 0) {
    console.error(`Tipo de shot desconocido: ${onlyShot}`);
    process.exit(1);
  }

  const output: Record<string, Partial<Record<'elegante' | 'fiesta', string[]>>> = {};

  for (const shotType of shotTypes) {
    output[shotType.id] = {};
    for (const energy of shotType.energies) {
      console.log(`\nGenerando ${shotType.id} / ${energy}...`);
      const variations = await generateVariationsFor(shotType, energy, snapshot.items);
      output[shotType.id][energy] = variations;
      variations.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
      // Mismo espaciado que el resto de los scripts de este directorio —
      // evita 429 de cuota al encadenar muchas llamadas seguidas.
      await new Promise(res => setTimeout(res, 8000));
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('RESULTADO COMPLETO (JSON) — revisar antes de pegar en nightMoments.ts:');
  console.log('═'.repeat(70));
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
