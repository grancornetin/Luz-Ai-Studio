# Auditoría 02: Photodump, Mi Marca y Planner (solo lectura, 22-oct-2026)

Rutas relativas a la raíz del repo. No se tocó código. No ejecuté nada de generación ni probé el entrenador local; todo lo de abajo sale de leer archivos y del snapshot del banco, salvo lo marcado "NO verificado".

## 1) Qué es cada activo y qué tiene de valioso

**Director de Photodump** (`src/modules/photodump/director/`). Es un "cerebro de dos pasos" con Gemini. Paso 1 "Decidir": mira un banco de fotos reales aprobadas y elige, para cada foto del set, qué pose, gesto y encuadre aprovechar y qué descartar. Paso 2 "Redactar": escribe el prompt final de cada imagen. Devuelve solo TEXTO (plan + prompts); no genera imágenes.
- Entradas: brief de texto, receta, cantidad de fotos, fotos de referencia (cara, cuerpo, outfit), estilo de captura (selfie de espejo o foto de tercero), mismo lugar o varios (`director/generic/genericClient.ts:107`).
- Salidas: `GenericPlan` con razonamiento por foto (por qué existe esa foto, qué accesorio se ve y por qué, a qué momento pertenece) y `finalPrompts` (`genericTypes.ts:113-130`).
- Se ejecuta en el servidor: cola QStash + Redis + sondeo (`api/gemini/content.ts:836-880`). Pide sesión iniciada (token Firebase).

**Reglas duras** (`director/hardRules.ts:17`, y las propias de cada receta). Lo más valioso del código:
- La identidad no se cambia.
- La ropa de la foto de identidad nunca es el outfit.
- Del banco solo se reutiliza pose, gesto y encuadre, nunca el objeto.
- Continuidad de lugar y mobiliario entre fotos.
- No inventar personas.
- Cada foto debe poder explicarse como "por qué alguien la sacaría".

**Contrato de receta** (`genericTypes.ts:149`, ejemplo `recipes/outfitCheck/directorContract.ts:25`). Es el único lugar donde una receta dice de qué trata su historia. Agregar una receta nueva = escribir un contrato (texto) y registrarlo.

**Banco** (`src/data/photodump-bank/bank-snapshot.json`, 5,4 MB). Tiene 733 fotos aprobadas, compilado el 11-sep-2026. La memoria dice 911, pero eso era el total del entrenador; el que usa la app tiene 733. Verificado con un script: las 733 ya traen arquetipo y los 4 campos de re-auditoría, así que lo "falta regenerar el snapshot" de la memoria ya se hizo.
- Los 30 arquetipos están definidos en `modules/motor-de-imagenes-corregido-v2/photodump-trainer/core/system-prompt.txt:72-111`.
- Más usados: clean_girl 173, bombshell_glam 110, cool_girl 109, it_girl 75, femme_fatale 46, corporate_chic 37, quiet_luxury 31, old_money 11.
- Campos de re-auditoría: `body_visibility` (rostro, pecho, cintura, tres cuartos, cuerpo entero), `hand_occupancy` (vacía, celular, bolso o accesorio, comida o bebida, producto), `companion_prominence`, `reflection_surface_type`.
- 503 de 733 fotos traen la etiqueta "joyeria" en `product_categories_present`. Es la joya visible puesta en una persona, no la joya como protagonista (solo 4 la nombran en la descripción visual).

**Recetas** (`src/modules/photodump/recipes/`). La memoria dice que las cerradas son unboxing, outfit_check, outfit_haul, outfit_week, outfit_multi_look y outfit_reveal_basic. outfit_night_out está fuera. Solo `outfit_check` y `weekly_looks` usan hoy el director genérico (`api/gemini/content.ts:527-530`).

**Manifiesto de dirección** (`recipes/manifiesto de direccion/`, 20 documentos). Es la psicología de por qué una foto engancha: 7 impulsos, el método de extracción y el diseño del banco. Es el conocimiento más reutilizable para cualquier rubro.

**Entrenador local** (`modules/motor-de-imagenes-corregido-v2/photodump-trainer/`). Convierte fotos en análisis JSON con Vertex y alimenta el banco. Sirve para analizar fotos de joyería de referencia (Silene u otras) y crear un banco propio. NO verificado que corra hoy (el repo tiene sus `.bat` modificados por otra sesión).

**Director Lab** (`src/modules/directorLab/`). Es herramienta de desarrollador: habla con `http://localhost:3131` (`directorLabClient.ts:7`), solo tiene conectada `outfit_night_out`. No sirve para producción.

**Campaign** (`src/modules/campaign/`). Arma un kit de 7 días con piezas por canal (titular, caption, prompt de imagen) y "familias visuales" de `src/data/trainer/`. `buildCampaignPlan` está en `campaignService.ts:832`. Sirve solo para campañas puntuales (Navidad, Cyber). Es un módulo grande de 5.473 líneas y de interfaz propia, así que se usa llamado desde código, no como pantalla.

## 2) Qué sirve para joyería y por dónde entrar

Hallazgo que condiciona todo: Photodump está pensado para "persona con identidad fija, vestida con un outfit". El spike de fidelidad ya decidió que la joya real nunca se regenera y que "en el cuerpo" NO pasa hoy (`CIERRE_MVP/spikes/fidelidad-informe.md`, `DECISIONES.md` Puerta A). Por eso se reutiliza el CEREBRO (decidir qué fotos, qué poses, en qué orden, con qué texto), no el motor de imágenes de Photodump.

Sí sirve:
1. Reglas duras y lógica de coherencia: fidelidad de producto, continuidad de lugar, "por qué existe la foto", accesorios con razón.
2. Estructura de sets: carrusel de 3 a 8 fotos con hilo narrativo (`shotsByLevel` en `director/recipeContracts.ts:12`). Un "unboxing de joya" y un "3 formas de usar" calzan con eso.
3. Poses de mano y cuello como guía de composición. Filtros del banco: `product_categories_present` incluye `joyeria` + `body_visibility` chest_up o face_only + `hand_occupancy` empty o bag_or_accessory (`getOutfitCheckPoseCandidates`, `api/gemini/content.ts:1177`).
4. Arquetipos como paleta de estilos: quiet_luxury, old_money, clean_girl, boho_artista, coquette, romantic_girl, mob_wife, y2k_revival calzan con "estilo de la marca". Sirven para elegir el estilo y filtrar el banco.
5. "Foto del día": un set de 1 foto existe (`una_foto` en `recipeContracts.ts:23`, `single_hero_shot`).

Punto de entrada reutilizable sin pantalla:
- `src/modules/photodump/director/generic/genericClient.ts:107` `runGenericDirector(brief, recipe, count, referenceImages, captureStyle, placeMode)`. Devuelve `{plan, finalPrompts}`.
- Para una receta nueva (ej. `joyeria_carrusel`): escribir `src/modules/photodump/recipes/joyeria/directorContract.ts` (copiando la forma de `outfitCheck/directorContract.ts`) y registrarlo en `api/gemini/content.ts:527`. No hace falta tocar el director.
- Para la imagen final, NO usar `generatePhotodumpShot` (`photodumpDirectorService.ts:2487`, gigante y atado a avatar y outfit). Usar el prompt redactado como "dirección de escena" y componer con la estrategia C del spike (recorte del producto original sobre fondo generado).
- Continuidad de lugar con imagen real: `analyzeGenericPlace` (`genericClient.ts:180`) y `redactGenericSingleShot` (`genericClient.ts:202`).

## 3) Cambio mínimo en Mi Marca y Planner para una usuaria que parte de cero

Lo que ya resuelven (reutilizar tal cual):
- Marca: `BrandProfile` completo (`brandProfiles/types.ts:90`), wizard corto de 4 pasos con entrevista libre que la IA ordena (`BrandCoreWizard.tsx`, `brandIntelligenceService.extractBrandFromInterview`), paleta sugerida por IA (`brandProfileAiService.ts:115`), resumen de esencia con "el contenido SÍ/NO debe" (`brandProfileAiService.ts:188`). Existe `BusinessModel 'starting'` y `businessStage 'launching'`.
- Plan: una semana con las 7 respuestas por tarea (`plannerV3Types.ts:101`), embudo, historial, captura de métricas por foto de pantalla y informe (`plannerV3AiService.ts:267, 332, 408`), playbooks editables (`playbooks.ts`). Si no hay datos, el prompt pide honestidad cualitativa (`plannerV3AiService.ts:161`).

Cambios mínimos (sin reconstruir):
a) Marca desde cero: hoy el wizard exige `brandName` para continuar (`BrandCoreWizard.tsx`, botón Continuar). Falta "proponme nombres" y que el logo sea opcional. Ya lo cubre el `PilotSeed` de `piloto/types.ts`; basta convertir esas respuestas en un `BrandProfile` y llamar a `suggestColorPalette` y `generateBrandSummary`, sin pasar por el wizard.
b) `PlanGoal` agregar `'start'` (ya decidido en D1, `plannerV3Types.ts:9`) y que `buildDays` (`plannerV3AiService.ts:56`) acepte arranque de 6 semanas o al menos que `weekNumber` encadene.
c) Playbook `joyeria`: hoy "joya, arete, collar" caen en MODA (`playbooks.ts:26`) y MODA manda "priorizar try-on / puesto vs colgado", que contradice la decisión de fidelidad (en el cuerpo apagado). Hay que crear el playbook propio y ajustar `pickPlaybook` (`playbooks.ts:240`) para que gane por puntaje. Es solo texto.
d) Catálogo: `serializeBrandForAI` (`plannerV3AiService.ts:79`) no recibe productos reales. Pasarle los `CatalogItem` para que el plan nombre piezas reales.
e) Tareas ejecutables: el plan ya emite `toolModule` + `prompt`, pero "Crear ahora" solo navega y dispara un evento (`PlannerV3Week.tsx:9`). El camino mínimo es lo que el repo ya preparó: `PilotPlanTask = PlanTask & PilotTaskExtension` (`piloto/types.ts:113-122`: `recipeId`, `catalogItemIds`, `sceneBrief`, `generationStatus`, `assets`). Agregar `recipeId` y `catalogItemIds` al JSON que pide el prompt (`plannerV3AiService.ts:179`) y un despachador `receta -> función` que llame al director (para guion del set) y al motor de composición (imagen), sin navegar.

## 4) Qué NO existe y habría que construir
- Receta/contrato de joyería para el director (no existe ninguno): carrusel de pieza, "foto del día", estilos de mano y cuello.
- Banco de referencia de joyería con la joya como protagonista (el actual es moda con joya incidental). Opciones: filtrar el existente o correr el entrenador sobre fotos de joyería.
- Despachador plan -> generación, y la pantalla "Hoy". Nada lo conecta hoy.
- Generación de nombre y logo de marca; claims confirmados por ella (`confirmedClaims` solo existe como tipo).
- Plan multi-semana de arranque (hoy 1 semana).
- Composición con recorte del producto (estrategia C) y control de fidelidad: están en scripts de spike (`scripts/piloto-spikes/`), no en módulo de app.
- Vista de resultado "listo para publicar" con caption, hashtags y horario.

## 5) Riesgos de reutilizar
1. El director razona sobre una persona vestida: sin fotos de modelo/avatar puede inventar identidad. Mitigar con `protagonistVisible=false` (`genericTypes.ts:110`) y sets de producto.
2. El banco puede empujar poses sensuales (bombshell_glam 110, femme_fatale 46, tease_provocateur 17): filtrar arquetipos antes de mandar candidatos a una marca de joyería.
3. Costo y tiempo: Decidir + Redactar son 2 llamadas Gemini con espera de 15 s (`content.ts` bloque `runPhotodumpDirector`), 90 a 110 s por set de 7 fotos según la memoria. Hay que meterlo en el libro de gasto W8. Los 429 ya fueron un problema real.
4. Fidelidad: no confiar en que la imagen final salga fiel; el director solo escribe texto. La memoria admite que la fidelidad corporal es "parcial" y probable techo del modelo.
5. Contenido del banco: son fotos de terceros (influencers); como referencia de pose está bien, pero no publicarlas ni mostrarlas.
6. Archivos con cambios de otras sesiones (`modules/motor-de-imagenes-corregido-v2/**`, `.bat`): no tocar ni commitear. El `directorMode: 'open_bank'` sigue en pruebas según memoria; no apoyarse en él, usar `generic`.
7. Cambiar el contrato de `PlanTask` rompería planes guardados: usar solo campos opcionales (como ya hace `PilotTaskExtension`).
8. No verificado: que el director genérico funcione hoy con una receta nueva en producción (solo `outfit_check` y `weekly_looks` están registradas), ni el entrenador local, ni que `campaign` produzca algo útil sin avatar.
