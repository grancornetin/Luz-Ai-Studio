# Photodump Recipe Architecture
Version 1.0

## 1. Objetivo

Definir una arquitectura donde Photodump deje de ser una colección de pools de prompts y se convierta en un sistema de dirección creativa basado en:

- motivación humana;
- lenguaje visual por categoría;
- recetas validadas;
- routing explícito de referencias;
- continuidad;
- fidelidad;
- diversidad controlada;
- validación manual reproducible.

## 2. Jerarquía del sistema

```text
Photodump Manifest
└── Psychology Engine
    └── Core Stability Engine
        └── Category Mother / Visual Language
            └── Recipe
                └── Creative Plan
                    ├── REF0 / Anchor Strategy
                    ├── Shot Plan
                    ├── Reference Routing
                    ├── Prompt Translation
                    └── Validation
```

## 3. Conceptos

### Category Mother

Dominio físico y cultural: Fashion, Footwear, Beauty, Technology.

Define:

- comportamiento de los objetos;
- modos de interacción;
- gramática visual;
- riesgos;
- fidelity locks;
- primitives compatibles;
- impulsos psicológicos frecuentes.

No genera un set por sí sola.

### Recipe

Flujo de trabajo validado con promesa concreta.

Ejemplo:

- `fashion/outfit_night_out`
- `beauty/evening_skincare_routine`
- `footwear/shoe_pov_day_out`

Define entradas, arco, shots, compresión y éxito.

### Variant

Adaptación controlada de una receta, no una receta nueva, cuando conserva:

- misma promesa;
- mismo arco;
- mismas entradas;
- mismas reglas físicas.

Ejemplo: `outfit_night_out` puede variar entre bar, cena o concierto si el arco sigue siendo preparación → validación → experiencia → cierre.

### Primitive

Unidad visual reutilizable:

- mirror_check;
- friend_pov;
- self_pov;
- held_detail;
- in_use;
- flatlay_essentials;
- social_candid;
- walking_closure.

No conoce la historia completa.

### Story Beat

Función narrativa:

- establish;
- anticipate;
- transform;
- validate;
- experience;
- connect;
- reflect;
- close.

### Capture Motivation

Razón humana por la cual existe la foto.

## 4. Capas de runtime

### 4.1 Input Resolver

Normaliza:

- brief;
- referencias;
- cantidad;
- género o neutralidad;
- presencia de identidad;
- producto;
- escena;
- ocasión.

Debe distinguir `required`, `recommended`, `optional` y `generated_if_missing`.

### 4.2 Reference Analyzer

Extrae contratos visuales:

- identity fingerprint;
- body fingerprint;
- item fingerprint;
- material/color locks;
- scene fingerprint;
- packaging state;
- wearable inventory.

No debe depender únicamente de texto escrito por el usuario.

### 4.3 Psychology Planner (Director)

Selecciona:

- impulso principal;
- impulsos secundarios;
- identidad deseada;
- sensación;
- experiencia;
- fantasía social;
- razón de captura por shot.

**Regla de razonamiento interno.** Validado en `10_experimental_findings_001.md`, Finding 001.

> El Director razona extensamente hacia adentro. Su razonamiento nunca se reenvía verbatim al modelo de imagen. Solo pueden exportarse decisiones visuales ya destiladas.

El razonamiento completo — intención emocional, historia, motivaciones, por qué existe la imagen — es una herramienta de decisión, no un ingrediente del prompt. Un experimento comparativo (prompt narrativo vs. dirección fotográfica pura vs. descripción visual compacta, manteniendo idénticos personaje/outfit/pose/escena) no mostró mejora medible al incluir la narrativa completa. El estilo visual resultante fue prácticamente idéntico entre variantes.

Esto cambia el límite entre el Psychology Planner y el Prompt Composer (4.8): el primero decide y razona; el segundo traduce únicamente las decisiones ya tomadas, nunca el razonamiento que las produjo.

```text
Brief
  ↓
Razonamiento del Director (interno, no exportable)
  ↓
Decisiones visuales (lo que cruza hacia el Prompt Composer)
  ↓
Prompt Composer
  ↓
Prompt final
```

### 4.4 Category Overlay

Aplica conocimiento de dominio.

Fashion controla fit y layering. Footwear controla geometría y apoyo. Beauty controla textura y aplicación. Technology controla puertos, cámaras y pantallas.

### 4.5 Recipe Planner

Construye el arco y elige primitives.

No escribe el prompt final.

### 4.6 Anchor Planner

Decide si la receta necesita:

- world-only anchor;
- identity-and-world anchor;
- product-and-world anchor;
- multi-world anchors;
- no generated anchor.

REF0 no debe ser automáticamente el primer shot visible.

### 4.7 Reference Router

Para cada shot declara:

```ts
{
  identity: ['avatarFace', 'avatarBody'],
  activeItems: ['outfitNight'],
  world: ['prepAnchor'],
  continuity: [],
  forbiddenSources: ['avatarClothing', 'priorVenueScene']
}
```

Ninguna receta debe confiar en “enviar todas las referencias”.

### 4.8 Prompt Composer

Traduce contratos y decisiones visuales a instrucciones compactas. Nunca recibe ni traduce el razonamiento interno del Director (ver 4.3) — solo sus decisiones ya destiladas.

Orden:

1. mode authority;
2. identity;
3. active item;
4. scene/world;
5. psychology and capture motivation;
6. action and camera;
7. fidelity;
8. photographic render profile;
9. negatives.

**El render fotográfico es una capa independiente, no un ingrediente mezclado en la escena.** Validado en `10_experimental_findings_001.md`, Finding 002. Ver sección 19, Photographic Rendering Layer, para el catálogo de perfiles reutilizables (`iphone_camera_roll`, `dslr`, `editorial`, etc.) y las reglas de redacción de cada uno.

```text
Brief
  ↓
Director (Psychology Planner, 4.3)
  ↓
Decisiones visuales
  ↓
Prompt Composer
  ↓
Photographic Rendering Profile (sección 19)
  ↓
Negative Prompt
  ↓
Prompt final
```

### 4.9 Model Adapter

Ajusta el lenguaje al modelo sin alterar intención ni routing.

### 4.10 Validation Engine

Valida plan antes de generar y resultado después de generar.

## 5. Categorías madre iniciales

1. Fashion / Apparel
2. Footwear
3. Beauty / Skincare / Makeup
4. Accessories / Jewelry / Bags
5. Technology
6. Food & Beverage
7. Lifestyle / Experiences
8. Home & Living, cuando exista suficiente investigación

`Unboxing`, `haul`, `favorites`, `day in life` y `essentials` pueden ser patrones transversales. Deben especializarse por categoría cuando la física o psicología cambie.

## 6. Core Stability Engine

Debe contener únicamente reglas transversales:

- identity fidelity;
- body fidelity;
- product fidelity;
- anatomy;
- mirror and camera geometry;
- continuity;
- reference authority;
- no invented text;
- no external branding;
- no accidental collage;
- reference budget;
- camera-origin consistency.

No debe contener destinos, outfits específicos ni props de recetas.

## 7. Contrato estándar de receta

```ts
interface PhotodumpRecipe {
  metadata: RecipeMetadata;
  inputContract: InputContract;
  psychologicalProfile: PsychologicalProfile;
  anchorStrategy: AnchorStrategy;
  shotTemplates: ShotTemplate[];
  compressionPolicy: CompressionPolicy;
  referencePolicy: ReferencePolicy;
  validationPolicy: ValidationPolicy;
  knownLimitations: KnownLimitation[];
}
```

## 8. Input Contract

Ejemplo:

```yaml
outfit:
  status: required
avatar_face:
  status: optional
avatar_body:
  status: optional
prep_scene:
  status: optional
venue_scene:
  status: optional
brief:
  status: recommended
```

Una referencia opcional no puede convertirse secretamente en obligatoria.

## 9. Identidad opcional

La arquitectura debe funcionar en tres modos:

### Supplied Identity

El usuario entrega rostro y/o cuerpo.

### Partial Identity

Entrega rostro sin cuerpo o cuerpo sin rostro.

### Generated Identity

No entrega avatar. REF0 genera una identidad y guarda fingerprint visual para toda la sesión.

La ropa visible en refs de identidad nunca debe convertirse en producto activo.

### REF0 es condicional, no obligatorio

Validado con `fashion/outfit_night_out`, julio 2026.

REF0 cumple dos funciones que se resolvían juntas por conveniencia, no por necesidad:

1. **Función narrativa** (mostrar una escena de preparación/anclaje antes del primer shot visible) — prescindible. Ver núcleo narrativo dual en `02_the_psychology_behind_photodump_v2.md`, sección 4bis: si la preparación no es obligatoria para la historia, tampoco lo es como paso técnico.
2. **Función técnica** (fijar identidad + geometría cuando no hay avatar entregado, para que el resto de los shots hereden consistencia) — sigue siendo necesaria, pero solo en el modo Generated Identity.

Regla resultante:

- **Supplied Identity o Partial Identity** (el usuario entrega avatar): REF0-como-cuarto-de-preparación es prescindible. La receta puede arrancar directo en el primer shot visible que corresponda (ej. venue), sin generar una imagen técnica intermedia que nunca se publica.
- **Generated Identity** (sin avatar entregado): sigue haciendo falta una generación inicial que fije identidad. Pero esa generación ya no tiene por qué ocurrir en un mundo separado ni ser invisible — puede ser directamente el primer shot visible elegido por el planner, cumpliendo ambas funciones a la vez (fija identidad Y ya es contenido publicable), en vez de gastar una generación descartable antes de la primera imagen útil.

## 10. Anchor Strategy

Tipos:

- `world_only`
- `identity_world`
- `identity_body_world`
- `product_world`
- `multi_world_chain`
- `none`

El ancla declara qué puede y qué no puede heredarse.

## 11. Shot Contract

```ts
interface ShotTemplate {
  id: string;
  beat: StoryBeat;
  role: string;
  primitive: string;
  purpose: string;
  psychologicalIntent: PsychologicalIntent;
  cameraMotivation: string;
  captureMode: CaptureMode;
  awareness: 'unaware' | 'aware_candid' | 'intentional_social';
  productRole: 'hero' | 'integrated' | 'support' | 'absent';
  required: string[];
  forbidden: string[];
  referenceRoute: ReferenceRoute;
}
```

## 12. Diversity control

La diversidad no debe ser random global. Se controla por ejes:

- camera origin;
- framing;
- awareness;
- action;
- subject presence;
- world;
- product role;
- emotional beat.

El planner debe impedir:

- dos mirror selfies consecutivas;
- tres full-body estáticos;
- misma acción;
- misma expresión;
- misma distancia;
- repetición de producto hero.

## 13. Compresión

Cada receta define prioridad de beats. El resultado debe devolver exactamente el count solicitado dentro de su rango.

No se permite declarar `maxShots: 12` si solo existen ocho shots y no hay interpolación validada.

## 13bis. Beats como pool, no como secuencia fija

Validado con `fashion/outfit_night_out`, julio 2026. Cambia cómo debe leerse `compression` en el contrato de receta (`05_recipe_contract.ts`).

El diseño original de `compression: Record<number, string[]>` asume una única secuencia canónica de shots, de la que comprimir es "sacar algunos de la lista". La validación mostró que esto es más rígido de lo que el contenido real permite: se armaron a mano varios sets (8, 6, 3 shots) usando distintas combinaciones de beats — incluyendo variaciones que no estaban en la lista original de 7 shots nombrados (ej. detalle de trago con piernas cruzadas, ángulo distinto en el auto) — y cada combinación funcionó igual de bien como dump completo, sin necesitar las demás.

Esto confirma que la sección 12 (Diversity control) ya tenía el diseño correcto — diversidad controlada por ejes, no por lista fija — pero el contrato normalizado de receta (05) no lo implementa así todavía: hoy tiene `shots: RecipeShotTemplate[]` fijos con un único `promptBlocks` por shot, y `compression` solo selecciona subconjuntos de esa lista fija.

Diseño objetivo:

- Cada **beat** (`anticipate`, `transform`, `validate`, `experience`, `connect`, `reflect`, `close`, etc.) pasa a tener un **pool de variaciones/primitives candidatas**, no un único template fijo — igual que `outfitCheck.ts` legacy ya hacía con `variationSpace` (2-4 opciones por shot) antes de ser reemplazado por el contrato normalizado de un solo bloque por shot.
- El pool de variaciones no tiene por qué vivir escrito a mano dentro de cada receta. Puede (y debería, cuando exista) alimentarse de bancos de conocimiento transversal — igual que HPI sirve a cualquier receta con pose humana, un banco de arquetipos de escena/composición por categoría de producto (ver `footwear_ugc_library_v0_2` como precedente ya construido, y el banco SeaDream en normalización) puede servir de fuente de variaciones para cualquier receta de esa categoría.
- El Recipe Planner compone la secuencia en tiempo de generación según: cuántos shots pidió el usuario, qué referencias están disponibles, qué ejes de diversidad ya están cubiertos por los shots ya elegidos, y qué aporta cada beat candidato al núcleo narrativo de la receta (ver sección 4bis del documento de psicología). No hay una posición fija tipo "shot 1 = X, shot 2 = Y".
- El núcleo narrativo (sección 4bis) es lo no negociable; la secuencia de beats que lo prueba es flexible y puede variar entre generaciones del mismo brief.

## 14. Fidelidad

Prioridad:

1. producto activo;
2. identidad;
3. anatomía y física;
4. escena;
5. estética;
6. variación.

La creatividad nunca puede alterar el objeto vendido.

## 15. Preparación para video

Cada shot debe guardar:

- world ID;
- character state;
- wardrobe state;
- product state;
- start action;
- end action;
- plausible previous shot;
- plausible next shot.

Esto permite convertir pares de imágenes en frames de video sin rediseñar la historia.

## 16. Estructura de carpetas propuesta

```text
photodump/
  core/
    recipeContract.ts
    psychology.ts
    referenceRouter.ts
    validation.ts
    promptComposer.ts
  categories/
    fashion/
      fashionMother.ts
      primitives/
      recipes/
        outfitNightOut/
  recipes_legacy/
  docs/
  validation/
```

## 17. Estados de madurez

- `DISCOVERY`
- `MANUAL_TESTING`
- `VISUALLY_VALIDATED`
- `NORMALIZED`
- `INTEGRATION_READY`
- `APP_VALIDATED`
- `PRODUCTION_STABLE`

## 18. Regla de integración

Una receta solo se integra cuando:

- funciona con al menos dos paquetes de referencias;
- devuelve exactamente el número solicitado;
- no contiene detalles de la prueba;
- tiene routing por shot;
- define límites;
- supera fidelidad, organicidad y continuidad;
- no depende de una capacidad ausente en producción.
