# Auditoría del repositorio Photodump
Fecha: 2026-07-14

## Alcance

La auditoría usa los archivos disponibles en la biblioteca: guía del módulo, Director, `shared.ts`, `outfitCheck.ts`, `outfitHaul.ts`, `outfitWeek.ts`, `unboxing.ts`, UI de referencias y evidencia de imports hacia `productHaul`, `weeklyFavoritesV2` y `dayInLife`.

No se afirma una auditoría línea por línea de archivos cuyo contenido completo no estaba disponible.

## Hallazgo principal

El repositorio ya inició una separación por receta, pero conserva dos arquitecturas coexistiendo:

1. recetas extraídas del Director, todavía dependientes del ensamblador central;
2. motores autónomos nuevos (`weeklyFavoritesV2`, `dayInLife`) despachados por rutas especiales.

Esto crea deuda de transición: hay nombres de receta estables, pero contratos y estrategias diferentes.

## Inventario

### `photodumpDirectorService.ts`

**Conservar:**
- orquestación de alto nivel;
- adaptadores temporales;
- compatibilidad pública.

**Problema:**
- todavía ensambla prompts y referencia ramas outfit;
- contiene routing condicional;
- importa receta legacy y reemplazo nuevo simultáneamente;
- es punto de acoplamiento.

**Destino:**
- reducir a dispatcher;
- mover prompt composition, psychology, routing y validators a core;
- prohibir lógica de shots específica.

### `recipes/shared.ts`

**Conservar:**
- tipos transversales;
- anatomía;
- geometría;
- fidelity;
- prepareRefs;
- aspect ratio.

**Problema:**
- el contrato `PhotodumpShotDirective` es demasiado limitado para nuevas recetas;
- `MomentType` mezcla función visual con beat narrativo;
- faltan intención psicológica, routing formal y cámara motivada;
- algunos tipos de outfit están cerca del core.

**Destino:**
- mantener como compatibilidad legacy;
- crear `core/recipeContract.ts`;
- migrar gradualmente.

### `outfitCheck.ts`

**Estado:** rediseñar.

**Fortalezas:**
- router de destino;
- prep environment;
- scene continuity;
- HPI especializado;
- detección de contradicciones.

**Problema estructural:**
- una sola receta intenta cubrir ópera, brunch, oficina, gala, restaurante, playa, viaje y noche;
- destino domina la lógica;
- se acerca a un router de familia Fashion más que a una receta.

**Decisión:**
- extraer router y reglas útiles hacia Fashion Mother;
- reemplazar `outfit_check` por recetas:
  - outfit_reveal_basic;
  - outfit_night_out;
  - outfit_day_out;
  - outfit_workday;
  - outfit_event;
  - outfit_travel.

### `outfitHaul.ts`

**Estado:** conservar núcleo técnico, revalidar flujo.

**Fortalezas:**
- manifest;
- cobertura;
- inventario exacto por shot;
- styling graph;
- anti-acumulación;
- world map;
- tipos de prendas;
- conflicto held/worn.

**Problemas:**
- lógica extensa dentro de una receta;
- inferencias semánticas sin visión pueden inventar componentes;
- lenguaje psicológico aún débil;
- dependencia del Director para prompt final;
- “haul” debe decidir si es ropa, accesorios o mixto.

**Decisión:**
- migrar como `fashion/clothing_haul`;
- conservar manifest y coverage;
- mover bolsos/joyería/calzado dominantes a overlays o recetas de sus categorías.

### `outfitWeek.ts`

**Estado:** legacy desconectado del runtime principal.

El Director actual despacha `outfit_week` hacia `weeklyFavoritesV2`, mientras `outfitWeek.ts` permanece importado por compatibilidad. Mantener dos motores con el mismo nombre de producto es un riesgo.

**Decisión:**
- auditar `weeklyFavoritesV2` como fuente de verdad;
- congelar `outfitWeek.ts`;
- eliminarlo tras migrar exports;
- no revalidar la versión que no se ejecuta.

### `weeklyFavoritesV2`

**Estado:** inspección técnica pendiente porque sus archivos no estaban disponibles completos.

**Evidencia positiva:**
- ruta autónoma;
- REF0 propio;
- generación propia;
- contrato de anchor.

**Riesgos:**
- nombre `outfit_week` mezcla outfits, bolsos, footwear, jewelry, skincare y technology en el legacy;
- si V2 conserva esa amplitud, “weekly favorites” debe ser patrón transversal y no Fashion puro.

### `unboxing.ts`

**Estado:** rediseñar.

**Fortalezas:**
- arco lineal;
- compresión;
- estados de packaging.

**Problemas críticos:**
- opener `PACKAGING HERO`;
- packaging puede llenar 70%;
- instrucciones de legibilidad de marca;
- product-first;
- receta genérica para objetos con físicas muy diferentes.

**Decisión:**
- crear un patrón `unboxing`;
- especializaciones:
  - technology/device_unboxing;
  - footwear/shoe_unboxing;
  - beauty/product_unboxing;
  - generic_product_unboxing.
- el opener debe ser “arrival/anticipation” orgánico, no packaging hero obligatorio.

### `productHaul`

**Estado:** inspección pendiente.

El Director importa manifest, shot plan, anatomy, HPI y bloques de interacción. El archivo fuente no apareció en los resultados disponibles.

**Decisión provisional:**
- tratar como patrón transversal;
- evaluar si repite lógica de outfit haul;
- separar coverage core de category overlay.

### `dayInLife`

**Estado:** arquitectura prometedora, revalidar.

**Fortalezas:**
- motor autónomo;
- cadena multi-REF0;
- blocks;
- world lock por bloque;
- routing específico.

**Riesgos:**
- puede degenerar en “muchos lugares bonitos”;
- necesita continuidad de gusto, hábitos y estado;
- companion logic;
- actualmente el Director todavía adapta su resultado al contrato viejo de un solo REF0.

**Decisión:**
- mover a Lifestyle;
- conservar multi-world;
- añadir psychology planner y evidencia temporal;
- validar con y sin avatar.

### Pools genéricos `launch`, `bts`, `travel`

**Estado:** no son recetas listas.

Mientras permanezcan como pool orgánico genérico sin archivo, contrato, routing y validación propia, deben clasificarse como modos legacy.

### `PDStep2Receta.tsx`

**Fortalezas:**
- referencias opcionales;
- slots dinámicos;
- tags;
- selectores de tipo;
- soporta ausencia de referencias.

**Problema:**
- selección plana de recetas;
- slots codificados según names;
- mensajes como “sin referencias funciona” no garantizan que cada receta pueda crear y fijar identidad;
- UI no expresa categoría madre ni promesa del flujo.

**Destino:**
- Category → Recipe;
- inputs generados desde recipe contract;
- `generated_if_missing`;
- preview de promesa, no lista técnica.

## Matriz de decisión

| Elemento | Conservar | Extraer | Rediseñar | Eliminar luego |
|---|---:|---:|---:|---:|
| Director | parcial | sí | sí | lógica específica |
| shared.ts | sí | sí | contrato nuevo | no |
| outfitCheck | parcial | sí | sí | receta monolítica |
| outfitHaul | sí | sí | parcial | no |
| outfitWeek legacy | no | exports | no | sí |
| weeklyFavoritesV2 | probable | por auditar | posible | no |
| unboxing | concepto | primitives | sí | versión genérica actual |
| productHaul | por auditar | probable | probable | pendiente |
| dayInLife | sí | poco | parcial | no |
| generic pools | ideas | primitives | sí | pools legacy |

## Prioridad de revalidación

1. `fashion.outfit_night_out`
2. reemplazo de `outfit_check`
3. `fashion.clothing_haul`
4. `weeklyFavoritesV2`
5. `unboxing` por categoría
6. `productHaul`
7. `lifestyle.day_in_life`
8. travel / launch / bts

## Riesgo mayor actual

No es la longitud de los prompts. Es que cada receta define “organicidad” y continuidad de manera diferente. Psychology Engine, Category Mother y Reference Router deben convertirse en contratos compartidos antes de integrar más recetas.
