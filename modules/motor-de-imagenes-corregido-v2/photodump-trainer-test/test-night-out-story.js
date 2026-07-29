const { buildShotPools } = require('../photodump-trainer/core/shot-candidate-query');
const { directStory } = require('../photodump-trainer/core/creative-director');

async function main() {
  const brief = process.argv[2] || 'salida de noche con amigas a un bar';
  const { query, shotPools } = await buildShotPools(brief, 'outfit_night_out');

  console.log('Query traducida:', JSON.stringify(query, null, 1));
  console.log('\nPools por shot (candidatos disponibles para que el director elija):');
  shotPools.forEach(sp => console.log(`  ${sp.shotId}: posePool=${sp.pool.length}, scenePool=${sp.scenePool.length}`));

  console.log('\nLlamando al Director Creativo (1 llamada a Gemini para toda la historia)...\n');
  const story = await directStory(brief, 'outfit_night_out', shotPools);

  console.log('=== HISTORIA DIRIGIDA (7 shots) ===\n');
  story.forEach((shot, i) => {
    console.log(`[Shot ${i + 1}] ${shot.shotId} (rol: ${shot.role}, sceneGroup: ${shot.sceneGroup})`);
    console.log(`  Nota: ${shot.note}`);
    console.log(`  Pose de: ${shot.poseCandidate?.sourceName || shot.poseCandidate?.itemId || 'N/A'} (${shot.poseCandidate?.reusablePrimitive})`);
    if (shot.sceneCandidate) console.log(`  Escenario de: ${shot.sceneCandidate?.itemId} (${shot.sceneCandidate?.reusablePrimitive})`);
    console.log(`  sceneAnchorId: ${shot.sceneAnchorId}`);
    console.log(`  Razonamiento del director: ${shot.reasoning}`);
    console.log(`  PROMPT FINAL:\n  ${shot.finalPrompt}`);
    console.log('');
  });

  console.log('=== VERIFICACIÓN DE CONTINUIDAD ===');
  const byGroup = {};
  story.forEach(s => { (byGroup[s.sceneGroup] = byGroup[s.sceneGroup] || []).push(s.sceneAnchorId); });
  Object.entries(byGroup).forEach(([group, anchors]) => {
    const unique = new Set(anchors.filter(Boolean));
    console.log(`  ${group}: anchors=${JSON.stringify(anchors)} -> ${unique.size <= 1 ? 'OK (consistente)' : 'INCONSISTENTE (' + unique.size + ' anchors distintos)'}`);
  });
}

main().catch(err => { console.error('ERROR:', err.message, err.stack); process.exit(1); });
