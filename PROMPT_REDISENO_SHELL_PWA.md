# Prompt de trabajo — rediseño del shell general para que la app se sienta nativa (mobile-first, camino a PWA)

> **Quién escribe esto**: la sesión que estuvo migrando el módulo Photodump
> (`src/modules/photodump/`) al nuevo diseño visual esta semana — la que
> encontró, en la práctica, con capturas reales del usuario en su teléfono,
> cada uno de los problemas que motivan este documento. No es una lista de
> ideas, es lo que ya se probó, se vio roto, y en algunos casos ya se
> corrigió puntualmente dentro de Photodump (sirve de referencia de qué
> funciona).
>
> **Para quién es**: el agente/chat al que el usuario le va a pedir que
> tome este trabajo completo — auditar y rediseñar el shell general de la
> app (no un módulo puntual) para que en mobile se sienta como una app
> nativa instalada, no como una página web larga. El usuario prefiere que
> este trabajo corra aparte, sin mezclarse con el trabajo puntual que sigue
> en Photodump.

## 0. El pedido del usuario, tal cual, sin resumir

> "Quiero que sepas que en móvil esto debe sentirse como una app nativa a
> pantalla completa, sin desbordarse y sin crecer verticalmente."

> "El tema del header en este momento está afectándonos mucho. En cuanto a
> tamaño para vista nativa en móviles es algo que hay que resolver, porque
> ahí podemos agregar controles o el menú lateral — en vez de que sea un
> menú lateral, que en el móvil sea una pantalla, o un botón tipo píldora
> flotante, con las opciones de volver al inicio... porque está bastante
> limitante el tema del header en el espacio, y la app no se siente tan
> nativa, tiene como muchas cosas que moverse. Me gustaría que en el móvil
> se sintiera una sola pantalla donde están todas las opciones cliqueables,
> de manera que con un solo vistazo puedas ver todos los controles que
> tenés e ir avanzando nativamente — no deslizando por avanzar, sino que se
> sienta como nativo, como una app real, y poder volver atrás con las
> funciones de swipe hacia atrás y eso."

> "Sé que es un trabajo de rediseño completo que requiere toda la app,
> entonces prefiero que quedemos quietos nosotros [la sesión de Photodump]
> y que me digas cuándo esté listo el documento para poder hacer que un
> agente diferente a mí haga el rediseño pensando en esta función de que la
> app se sienta nativa como PWA."

## 1. Los 3 problemas reales encontrados, con evidencia

Todo lo de abajo se descubrió con capturas de pantalla reales del usuario
en un iPhone, navegando `/photodump`, no con suposiciones.

### 1.1 — El botón "atrás" del navegador rompe el flujo del wizard

Cada módulo con wizard multi-paso (Photodump confirmado; probablemente
Campaign, ContentStudioPro y otros que comparten el mismo patrón — ver
sección 3) usa **una sola ruta de React Router** (ej. `/photodump` en
`src/App.tsx` línea 441) con el paso actual guardado en `useState` local
(`const [step, setStep] = useState<WizardStep>(1)`). El botón "Continuar"
del wizard hace `setStep(2)` — nunca cambia la URL.

**Consecuencia real, confirmada por el usuario**: "la única forma de volver
atrás es deslizando hasta el fondo de la página y apretar en la flecha para
volver atrás, porque si aprietan la flecha del navegador, te devuelve al
dashboard." El gesto nativo de "atrás" (swipe desde el borde en iOS, botón
físico/gesto en Android, botón atrás del navegador) no tiene noción de "un
paso atrás dentro del wizard" — salta directo fuera del módulo completo.

**Lo que se necesita**: que cada paso del wizard (o al menos los
transicionables) tenga su propio estado en la URL (query param, hash, o
sub-ruta), de forma que el botón/gesto atrás nativo del navegador SÍ
retroceda un paso del wizard antes de salir del módulo. Investigar el
patrón más liviano para esto en React Router (`useSearchParams` con un
`?step=2`, o rutas anidadas tipo `/photodump/paso/2`) — no reinventar un
sistema de historial propio si React Router ya resuelve esto.

### 1.2 — El header interno de cada módulo come pantalla en mobile

**Corrección importante sobre esto, para no repetir el error**: al
investigar el header grande que se veía en las primeras capturas del
usuario ("Historia en fotos / Crear / Biblioteca"), se descubrió que **NO
es un shell compartido de toda la app** — vive dentro de cada módulo (en
Photodump, `PhotodumpModule.tsx`, `<header>` propio ~línea 1667). Ya se
compactó ahí (ver sección 2 de este documento para el detalle del fix) sin
tocar nada compartido.

**Lo que sigue sin resolver, y sí es compartido**: si otros módulos
(Campaign, ContentStudioPro, ManualCreator, etc.) repiten el mismo patrón
de header propio pesado, cada uno necesita el mismo tratamiento — no hay un
único componente central que arreglarlo resuelva todos de una. Auditar cada
módulo con wizard/flujo multi-paso y aplicar el mismo criterio (ver sección
2, "Qué se corrigió en Photodump, para copiar el patrón").

### 1.3 — La sensación general es "página web larga", no "app"

Cita directa: "tiene como muchas cosas que moverse... me gustaría que en el
móvil se sintiera una sola pantalla donde están todas las opciones
cliqueables, de manera que con un solo vistazo puedas ver todos los
controles." El usuario propone, como posible solución de interacción (no
como requisito cerrado, es una idea a evaluar): reemplazar menús
laterales/headers por un **botón tipo píldora flotante** con las opciones
principales (volver al inicio, etc.) — patrón común en apps nativas mobile
(FAB expandible, tab bar flotante) en vez de barras fijas que ocupan alto
de layout permanentemente.

## 2. Qué se corrigió en Photodump, para copiar el patrón

Toda esta sección es trabajo YA HECHO y en producción (commits en `main`,
verificar con `git log --oneline -- src/modules/photodump/`) — sirve como
ejemplo concreto de qué funcionó, no como algo a rehacer.

- **Header compactado en mobile**: título largo + subtítulo + tutorial
  quedaron solo en desktop (`hidden md:block` / `md:flex`); en mobile un
  título corto en una sola línea. Tabs internas (Crear/Biblioteca) y badge
  de créditos, más chicos en mobile (`text-[11px]`, padding reducido) sin
  perder la función. Ver `PhotodumpModule.tsx`, bloque `<header>`.
- **`min-h` del contenedor del wizard**: tenía `min-h-[640px]` fijo en toda
  plataforma — en mobile eso a veces forzaba scroll de más, a veces dejaba
  hueco vacío según el contenido del paso. Se bajó a `min-h-0` en mobile
  (`min-h-0 md:min-h-[640px]`), dejando que el contenido real defina el
  alto.
- **Auto-avance al elegir una opción principal**: el paso 1 (elegir
  receta/tipo de contenido) ya NO tiene un botón "Continuar" separado —
  tocar la opción avanza directo al paso siguiente. Cita del usuario:
  "sería mejor tocar la receta y que automáticamente avance, es un flujo
  más intuitivo y ágil." Esto elimina un tap innecesario y hace que el
  flujo se sienta más nativo — patrón a considerar para otros
  selectores "de una sola elección" en otros módulos.
- **Selector de destino/formato removido del paso 1**: quedaba en el mismo
  paso que la receta, compitiendo por espacio y por atención tras el
  auto-avance (si seguía visible, avanzar automáticamente se lo cortaba al
  usuario a mitad de camino). Se movió lógicamente al paso siguiente
  (`destino` queda con su valor por default mientras tanto).
- **Cards/selectores como carrusel horizontal fullscreen en mobile, grid en
  desktop**: en vez de un grid de N columnas achicado para mobile (que
  apretaba cada card y forzaba scroll vertical largo para ver todas las
  opciones), se armó un carrusel horizontal con scroll-snap nativo (sin
  librería) + dots de navegación — 1 card grande, ocupando casi toda la
  altura disponible del viewport (`h-[65dvh]`, usando `dvh` no `vh` — ver
  nota técnica abajo), swipe para ver las demás. Ver
  `src/modules/photodump/components/RecipeCardCarouselMobile.tsx` y
  `RecipeCard.tsx` (prop `variant: 'grid' | 'fullscreen'`).
  **Nota técnica real, ya resuelta**: usar `dvh` (dynamic viewport height)
  en vez de `vh` para alturas en mobile — `vh` en Safari/Chrome mobile
  cuenta el espacio de la barra de direcciones del navegador incluso
  cuando está colapsada, causando que un elemento "a pantalla completa"
  en realidad se pase del viewport visible real y genere scroll fantasma.
  `dvh` se ajusta dinámicamente al viewport visible real.
- **Todas las opciones "seleccionables de un vistazo" en la misma galería,
  no en filas separadas**: había una opción especial (modo libre) que vivía
  en su propia fila aparte, con separador visual — forzaba una segunda
  "pantalla" de swipe/scroll solo para verla. Se integró en la misma
  galería/carrusel que el resto, al final de la lista (cita: "debería estar
  al final de la lista de recetas en la misma galería").

**Idea del usuario, todavía NO implementada, para considerar en el
rediseño general**: marcar opciones como favoritas con una estrellita, y
que las favoritas aparezcan primero en la lista/galería (menos scroll para
lo que se usa seguido). No se implementó en Photodump por falta de tiempo
en esta sesión, no por estar descartada — queda como mejora de UX real a
evaluar, probablemente útil en cualquier selector largo de opciones (no
solo el de receta de Photodump).

## 3. Alcance real — qué módulos probablemente comparten estos problemas

No auditado a fondo por esta sesión (el trabajo se limitó a Photodump),
pero la arquitectura de rutas (`src/App.tsx`, ver líneas 414-450) sugiere
que TODOS estos módulos usan el mismo patrón de una sola ruta + wizard con
estado local, así que probablemente comparten el problema 1.1 (botón atrás
rompe el flujo):

- `/photodump` → `PhotodumpModule.tsx` (ya corregido parcialmente, ver
  sección 2)
- `/campaign` → `CampaignModule.tsx`
- `/studio-pro` → `ContentStudioProModule.tsx`
- `/crear/clonar` → `CloningModule.tsx`
- `/crear/manual` → `ManualCreatorModule.tsx`
- `/productos` → `ProductGeneratorModule.tsx`
- `/outfit-extractor` → `OutfitExtractorModule.tsx`
- `/clonar` → `CloneImageModule.tsx`

Confirmar caso por caso si cada uno tiene wizard multi-paso con `useState`
local antes de asumir que todos necesitan el mismo fix — puede que algunos
sean de un solo paso y no les aplique 1.1, pero si tienen header propio
pesado, sí les aplica 1.2/1.3.

## 4. El bottom nav mobile ya existente — punto de partida real

`src/components/shared/MobileBottomNav.tsx` (116 líneas) ya es un patrón
nativo real: barra fija `fixed bottom-0`, 4 botones (Inicio · Crear ·
Avisos · Asistente), con `env(safe-area-inset-bottom)` ya contemplado para
el notch/home indicator de iOS — esto es lo correcto, no hay que
reinventarlo. El botón "Crear" abre un `BottomSheet` con el catálogo de
módulos. Este componente vive en `src/App.tsx` (línea 462), fuera de cada
módulo — es shell real compartido, a diferencia del header que resultó ser
interno de cada módulo.

Cuando se piense la "píldora flotante" u otra solución de navegación
interna del wizard, considerar cómo convive con esta barra ya existente —
probablemente no haya que agregar una segunda barra fija, sino integrar los
controles de "volver/avanzar dentro del wizard" de otra forma (flotante más
arriba, gestos, o aprovechando el mismo bottom nav de otra manera para
cuando hay un wizard activo).

## 5. Routing — confirmar el patrón exacto antes de tocar nada

`src/App.tsx` usa `BrowserRouter` + `Routes`/`Route` de `react-router-dom`
(no hash routing). Antes de implementar el fix de 1.1 (URL por paso),
confirmar:
- Si mover el estado del wizard a la URL rompe algo del flujo de
  generación en curso (ej. si el usuario recarga la página a mitad de un
  wizard, hoy pierde todo el estado — con URL por paso, ¿se debería
  intentar persistir/recuperar, o mantener el comportamiento actual de
  "recargar reinicia"? Es una decisión de producto, no solo técnica —
  preguntar al usuario si hace falta).
- Si otros módulos que reusan patrones similares de wizard (ver sección 3)
  tienen una forma común de manejar esto que valga la pena extraer a un
  hook compartido (`useWizardStep` o similar) en vez de resolverlo módulo
  por módulo.

## 6. PWA real — instalabilidad, fuera del rediseño de UI en sí

El usuario menciona la palabra PWA como el objetivo final ("como PWA"),
pero es importante separar dos cosas:

1. **Que la app SE SIENTA nativa en mobile** (sin scroll excesivo, sin
   desbordarse, transiciones que se sienten como pantallas y no como
   scroll de página web, navegación con gestos que funcionan como se
   espera) — esto es rediseño de UI/UX, es lo que pide este documento.
2. **Que la app SEA instalable como PWA real** (ícono en el home screen,
   funciona offline parcialmente, `manifest.json`, service worker) — esto
   es una capa técnica aparte, más grande, que puede o no ser parte de este
   mismo trabajo. Confirmar con el usuario si este documento cubre ambas
   cosas o solo la primera — la cita original mezcla ambas ("en algún punto
   tendremos que volver la app tipo PWA... es un re-empaquetado extenuante
   pero necesario", sesión previa) pero el pedido más reciente y concreto
   se centra en la sensación nativa (punto 1), no en la instalabilidad
   técnica.

## 7. Verificación sugerida

- Mismo patrón que se usó en Photodump toda esta semana: no alcanza con
  `npm run build` limpio — hay que ver el resultado real en un dispositivo
  mobile (o simulador de Chrome DevTools en modo responsive, pero
  idealmente un teléfono real, varias capturas del usuario mostraron
  problemas que el simulador no siempre replica exacto, ej. la barra de
  direcciones de Safari).
- Probar específicamente: navegar 3-4 pasos de un wizard, usar el gesto/
  botón "atrás" nativo del sistema, confirmar que retrocede un paso del
  wizard y no saca de la app entera.
- Probar en una pantalla chica real (iPhone SE o similar, no solo un
  iPhone Pro Max) — los problemas de scroll se notan más en pantallas
  chicas.

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
