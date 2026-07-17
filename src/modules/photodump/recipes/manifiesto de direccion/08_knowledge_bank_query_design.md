# Diseño de consulta a bancos de conocimiento transversal
Versión 1.0 — julio 2026

## 1. Propósito

Define cómo el Recipe Planner consulta las capas de conocimiento transversal (HPI, footwear_ugc_library, SeaDream, y futuros bancos equivalentes) para construir candidatos de shot, en vez de depender de `promptBlocks` escritos a mano por receta.

Este documento asume los hallazgos de `02_the_psychology_behind_photodump_v2.md` sección 4bis (núcleo narrativo dual) y `03_photodump_recipe_architecture.md` sección 13bis (beats como pool, no secuencia fija). No repite esas decisiones; construye sobre ellas.

## 2. Los tres bancos y qué aporta cada uno

Los bancos no se superponen — cada uno resuelve una pregunta distinta:

| Banco | Pregunta que responde | Unidad | Tiene producto |
|---|---|---|---|
| HPI (`03_reglas_director_hpi_*.json`) | ¿Cómo se mueve el cuerpo de forma creíble? | `familyId` (pose/gesto/expresión) | No — nunca conoce el producto |
| footwear_ugc_library (y futuros equivalentes por categoría) | ¿Qué arquetipos de escena/encuadre existen para esta categoría de producto? | `archetype` (composición completa) | Sí — un slot, una categoría fija |
| SeaDream | ¿Qué combinación de escena+pose+intención logra un gancho emocional fuerte, y para qué categorías sirve? | entrada individual con `categoryFit` multi-categoría | Sí — slot + accesorios, cualquier categoría |

Ningún banco reemplaza a otro. HPI aporta la capa de movimiento humano y sus riesgos de anatomía a **cualquier** composición, sin importar qué banco la originó. SeaDream y las librerías por categoría aportan la composición completa (escena + pose + framing) ya pensada para vender un tipo de producto. El Recipe Planner los combina, no elige uno.

## 3. Esquema común mínimo

Los tres bancos tienen formas distintas porque nacieron en momentos distintos. No se propone forzarlos a un esquema idéntico (reescribir HPI o footwear_ugc_library no está en alcance). Se propone que cualquier banco nuevo, y la capa de consulta, hablen estos cinco campos como contrato mínimo:

```ts
interface KnowledgeBankEntry {
  bankId: string;              // 'hpi', 'footwear_ugc_v0_2', 'seadream'
  entryId: string;             // id nativo del banco (familyId, archetype, sd_0001...)
  categoryFit?: Record<ProductCategory, number>; // 0-10 por categoría; ausente en HPI (no aplica)
  poseRiskProfile?: {
    topRisks: string[];
    negativePromptHints: string[];
  };
  productSlots?: { placeholder: string; slotType: string }[]; // ausente en HPI
}
```

`categoryFit` y `productSlots` son opcionales porque HPI legítimamente no los tiene — no se le fuerza un producto que no describe. La capa de consulta debe tratar la ausencia de `categoryFit` en HPI como "aplica a cualquier categoría, es capa de movimiento pura", no como dato faltante a completar.

## 4. Función de consulta

```ts
interface ShotCandidateQuery {
  beat: StoryBeat;                    // de la sección 13bis: no fija posición, es una etiqueta de función narrativa
  category: ProductCategory;          // fashion | footwear | jewelry | tech | beauty | experience
  minCategoryFit: number;             // umbral, ej. 6
  referencesAvailable: ReferenceKind[]; // qué tiene el usuario: avatar, producto, escena, companion...
  alreadyUsedArchetypes: string[];    // control de diversidad — sección 12 del doc de arquitectura
  narrativeCore: NarrativeAxis[];     // ejes del núcleo dual de la receta (ej: ['memorable_night', 'looks_incredible'])
}

interface ShotCandidate {
  source: { bankId: string; entryId: string };
  scene: SceneDescriptor;
  poseDescriptor: PoseDescriptor;
  poseRiskProfile: { topRisks: string[]; negativePromptHints: string[] }; // fusionado de HPI si aplica
  categoryFitScore: number;
  experienceFitScore: number;         // VDI-003b: se lee aparte, no resta de categoryFitScore
  productSlotMap: SlotAssignment[];
  diversityAxes: { cameraOrigin: string; framing: string; world: string; productRole: string };
}

function buildShotCandidates(query: ShotCandidateQuery): ShotCandidate[]
```

### 4.1 Pasos de la consulta

1. **Filtrar por categoría y umbral.** Consultar SeaDream (y librerías por categoría si existen para `query.category`) por `categoryFit[query.category] >= query.minCategoryFit`. Esto reemplaza al pool fijo de `shots[]` que tenía cada receta — el pool ahora es "todo lo que el banco ofrece para esta categoría", no una lista de 7 nombres.

2. **Aplicar VDI-003b explícitamente.** Entre los candidatos que pasaron el filtro de categoría, no penalizar ni descartar los que también tengan `categoryFit.experience` alto — al contrario, priorizarlos cuando el `narrativeCore` de la receta incluye un eje de tipo experiencia (como en `outfit_night_out`: "la noche fue memorable"). Un candidato con `fashion: 8, experience: 7` vale más para esa receta que uno con `fashion: 9, experience: 1`, porque cubre dos ejes del núcleo narrativo en un solo shot.

3. **Cruzar con HPI por compatibilidad de pose.** Cada candidato de SeaDream/footwear_library trae su propia `pose.description`. Buscar en HPI la familia (`familyId`) cuyo `dominantTags`/`primaryIntents` mejor se solape con esa pose (ej. `mirror_selfie`, `seated_crossed_leg`, `functional_object_interaction`). Fusionar `riskMitigation` y `amplifierHints` de esa familia HPI dentro del candidato — esto es lo que le dio a los prompts de hoy (Shot 3, Shot 6) su corrección de rigidez y anatomía. No se pide texto libre nuevo; se reutiliza lo que HPI ya validó como mitigación conocida para ese tipo de pose.

4. **Filtrar por referencias disponibles.** Descartar candidatos cuyo `productSlots` requiera un accesorio que el usuario no subió como referencia (ej. un candidato que necesita `{{ACCESSORY_SLOT_bag}}` si no hay bolso entre las referencias) — salvo que la receta permita `generated_if_missing` para ese slot (ver `03_photodump_recipe_architecture.md` sección 8, Input Contract).

5. **Filtrar por diversidad ya cubierta.** Descartar o penalizar candidatos cuyo `scene.archetype` ya fue usado en un shot anterior de la misma sesión (control de sección 12: no repetir mismo `cameraOrigin`/`framing`/`world`/`productRole` dos veces seguidas).

6. **Devolver N candidatos ordenados**, no una única respuesta — el paso de composición final (elegir cuál de los candidatos usar, y en qué orden con los otros shots ya elegidos) es responsabilidad del Recipe Planner, no de esta función. `buildShotCandidates` informa opciones; no decide el arco.

## 5. Ejemplo aplicado: `outfit_night_out`, beat `experience`

```ts
buildShotCandidates({
  beat: 'experience',
  category: 'fashion',
  minCategoryFit: 6,
  referencesAvailable: ['avatarFace', 'avatarBody', 'outfitNight'],
  alreadyUsedArchetypes: ['luxury_bathroom_mirror_selfie'], // ya se usó en el shot de preparación
  narrativeCore: ['memorable_night', 'looks_incredible'],
})
```

Resultado esperado (conceptual, no literal): candidatos tipo `balcony_railing_seated`, `bar_counter_seated`, `rooftop_editorial` con `fashion` alto y `experience` alto simultáneamente (VDI-003b), cruzados con familias HPI compatibles con pose sentada/three-quarter-turn, excluyendo cualquier candidato que reutilice `luxury_bathroom_mirror_selfie` (ya usado) o que dependa de un `companion` si no hay esa referencia disponible.

## 6. Qué falta para que esto sea implementable, no solo diseño

- **Normalizar SeaDream** (en curso — ver `seadream_normalized/`). Es el único de los tres bancos que aún no tiene `categoryFit` confiable.
- **Mapa de compatibilidad pose↔familia HPI**: hoy el cruce del paso 3 es conceptual ("buscar la familia que mejor se solape"); falta una tabla o función real de similitud entre `pose.description` de SeaDream/footwear_library y `dominantTags` de HPI. Puede resolverse con embeddings de texto o con un mapeo manual inicial acotado a las categorías que se usen primero (fashion, footwear).
- **`ProductCategory` como tipo compartido**: hoy cada banco nombra categorías con libertad (`fashion`, `garment_single`, `outfit_full`...). Definir el enum único que todos los bancos deben respetar antes de que el Planner pueda filtrar de forma consistente.
- Esta función vive conceptualmente en la capa **Recipe Planner** del diagrama de `03_photodump_recipe_architecture.md` sección 2 (Photodump Manifest → Psychology Engine → Core Stability Engine → Category Mother → Recipe → Creative Plan) — específicamente alimenta el paso de Reference Router y Prompt Composer (secciones 4.7–4.8), no los reemplaza.
