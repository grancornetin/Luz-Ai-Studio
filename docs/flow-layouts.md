# Flujos de tarea — distribución por dispositivo

Especificación del marco `FlowShell` (`src/components/shared/flow/`) para celular,
tableta y computador. Aplica a todos los módulos que se migren al marco; el
primero es **Fotos de producto** (`src/modules/productGenerator/flow/`).

Principio: **adaptar no es estirar.** Cada modo tiene su propia distribución,
pensada para cómo se usa ese aparato:

- Celular: una mano, pulgar abajo, una cosa a la vez.
- Tableta: lienzo más ancho, se usa con el dedo o con teclado; dos columnas
  cuando ayudan, hojas centradas.
- Computador: mouse y teclado, mirada amplia. Dos paneles: el **lienzo** (lo
  visual) a la izquierda y el **paso** (preguntas y botón) a la derecha, como
  un configurador de la tienda de Apple. El botón principal siempre a la vista.

---

## 1. Modos y cortes

| Modo | Ancho | Equipos típicos | Nombre en código |
|---|---|---|---|
| Celular | < 768 px | iPhone, Android | `compact` |
| Tableta vertical | 768 – 1023 px | iPad vertical, ventanas angostas | `regular` |
| Dos paneles | ≥ 1024 px | iPad horizontal, notebooks (1280×720), escritorio (1440×900 y más) | `wide` |

Decisión: el modo de dos paneles parte en **1024 px**, no en 1280. A 1024 px
ya caben un lienzo de ~560 px y un panel de 420 px sin apretar, y así el iPad
horizontal (1194 px) usa la vista dividida que es típica de iPadOS en vez de
un celular estirado. Lo propio del computador (no del ancho) se decide por el
**tipo de puntero**, no por el tamaño:

- `(hover: hover) and (pointer: fine)` → estados al pasar el mouse, botón
  "Descargar" en vez de "Guardar en…", arrastrar y soltar fotos.
- En pantallas táctiles grandes (iPad) nada depende del hover.

El hook `useFlowLayout()` entrega el modo; `usePrecisePointer()` el puntero.
Ambos escuchan cambios (girar el iPad, achicar la ventana).

## 2. El marco en cada modo

### Celular (sin cambios — aprobado)
Modo inmersivo a pantalla completa, barra superior translúcida (atrás/cerrar,
título compacto al desplazar, progreso de 2 px), un solo título grande, barra
de acción fija abajo con área segura y teclado. Ver `project_flow_shell.md`.

### Tableta y computador: la "ventana"
- El flujo es un **panel blanco** que llena la pantalla con 12 px de margen
  (radio 20 px, borde de 0,5 px y sombra suave), sobre el gris de la app. A la
  izquierda queda una franja de 76 px donde vive el botón de menú de la app.
  Se activa con `body.flow-immersive` en ≥ 768 px: `[data-app-main]` pasa a
  `padding: 12px 12px 12px 76px` y se esconde lo flotante de la app
  (`[data-app-chrome]`: asistente, burbuja del planificador, avisos), igual que
  en celular, porque tapaba el botón principal.
- Alto fijo `100dvh − 24px`; **la página no se desplaza**, se desplaza el panel
  de contenido. Así la barra superior y el botón nunca se pierden.
- Ancho máximo 1680 px, centrado (pantallas 4K no se estiran).
- **Barra superior** de 56 px: a la izquierda "‹ Atrás" (con texto) o una X;
  al centro, en los pasos de configuración, un **indicador de pasos
  horizontal** (Tu producto · Estilo · Revisa y crea) en vez de la línea de
  progreso; en las demás pantallas el título compacto aparece al desplazar. A
  la derecha, acciones de la pantalla con ícono **y texto**.
- **Botón principal en línea**: va justo después del contenido del paso; si el
  contenido es más alto que la pantalla, se queda pegado abajo del panel con
  material translúcido. Nunca queda bajo el pliegue.
- En galerías (Mi catálogo) el botón principal sube a la barra superior, como
  en Fotos de macOS.

### Distribución de dos paneles (≥ 1024 px)
```
┌──────────────────────────────────────────────────────────────┐
│ ‹ Atrás          ① Tu producto  ② Estilo  ③ Revisa     ...  │  56 px
├───────────────────────────────────────┬──────────────────────┤
│                                       │ Título grande        │
│          LIENZO (gris claro)          │ preguntas            │
│   foto del producto / ejemplos /      │                      │
│   fotos creándose / resultados        │ [ Botón principal ]  │
│   — se ajusta al alto, sin scroll —   │ leyenda de créditos  │
│                                       │                      │
└───────────────────────────────────────┴──────────────────────┘
          flexible (≥ 560 px)              420 px (460 en ≥1280)
```
- El lienzo usa `FitGallery`: calcula columnas y tamaño para que **todas las
  fotos quepan completas en el alto disponible**, sin recortar y sin scroll.
  Reglas: 1 → una; 2 → dos; 3 → tres en fila; 4 → 2×2; 6 → 3×2; el collage va
  al final y completa la última fila (se muestra entero, sin recortar). Nunca
  filas a medias.
- Teclado: **Enter** continúa (o crea) cuando el botón está activo y el foco no
  está en otro botón; **Esc** vuelve o cierra (si hay una hoja abierta, Esc
  solo cierra la hoja). Foco visible en todo lo que se puede tocar.
- Hover (solo mouse): filas, tarjetas y botones se oscurecen levemente; en las
  fotos de resultado el botón de descarga aparece al pasar el mouse.
- Arrastrar y soltar: en la Entrada y en Tu producto se puede soltar una foto
  sobre la ventana (aparece un aviso "Suelta tu foto aquí").

### Hojas
- Celular: hoja inferior con agarradera y gesto para cerrar (sin cambios).
- Tableta y computador: **hoja centrada** (form sheet) de 480 px, o 720 px para
  elegir del catálogo; aparece con escala 0,96 → 1 y opacidad, sin agarradera,
  con botón X arriba a la derecha. Esc o clic fuera la cierran.

### Transiciones entre pasos
- Celular: empuje lateral completo (sin cambios).
- Tableta y computador: desplazamiento corto de 24 px con fundido (260 ms); el
  lienzo cruza con fundido. Un empuje de pantalla completa en una ventana
  grande se siente lento y marea.

## 3. Pantalla por pantalla — Fotos de producto

Medidas de referencia: a 1440×900 el lienzo mide ~890×820 y el panel 460 px;
a 1280×720, ~730×640 y 460 px; iPad horizontal ~690×750 y 420 px.

### Entrada
| Modo | Distribución |
|---|---|
| Celular | Igual que hoy. |
| Tableta | Título Syne 36 px, subtítulo, "¿Cómo funciona?"; los 4 ejemplos en 2×2 ajustados al alto que queda; botón "Subir foto de mi producto" y "Usar uno de mi catálogo" debajo, centrados (420 px). |
| Computador | Lienzo: los 4 ejemplos en 2×2 a todo el alto (la promesa). Panel: título Syne 44 px, subtítulo, "¿Cómo funciona?", "Con 1 foto tuya · listas en unos 2 minutos", y el botón, todo **centrado en vertical** (pantalla de bienvenida). "o arrastra una foto aquí" si hay mouse. Enter abre el selector. Arriba a la derecha: "Mi catálogo" con ícono y texto. |

### Tu producto
| Modo | Distribución |
|---|---|
| Celular | Igual que hoy. |
| Tableta | Dos columnas: foto grande con "Cambiar" a la izquierda; a la derecha nombre, "Más detalles" (abierto) y ángulos extra. Continuar debajo. |
| Computador | Lienzo: la foto del producto completa, ajustada al alto, con "Cambiar"; debajo la revisión de luz y la fila "Otros ángulos · opcional" (3 espacios). Panel: título, "¿Cómo se llama?", "¿Algo que no se vea en la foto?" (visible, marcado opcional) y Continuar. Enter continúa. Soltar una foto la reemplaza. |

### Estilo
| Modo | Distribución |
|---|---|
| Celular | Igual que hoy (2 columnas, 6 tarjetas). |
| Tableta | 3 columnas × 2 filas (las 6 caben sin desplazar). |
| Computador | Lienzo: las 6 tarjetas en 3×2 ajustadas al alto. Panel: título, subtítulo "Toca un estilo. Puedes cambiarlo después.", tu producto (miniatura + nombre) y la descripción del estilo que tienes encima con el mouse o el elegido. Un clic elige y avanza, igual que en celular. |

### Revisa y crea
| Modo | Distribución |
|---|---|
| Celular | Igual que hoy. |
| Tableta | Dos columnas: a la izquierda tu producto y el estilo como dos fotos grandes con "Cambiar"; a la derecha cantidad, dónde se usarán, "Más opciones". Botón y créditos debajo. |
| Computador | Lienzo: producto y estilo lado a lado, grandes, con "Cambiar" sobre cada uno. Panel: título, aviso de error si lo hay, cantidad (control segmentado), dónde las usarás, "Más opciones" (hoja centrada), nota de devolución y el botón "Crear mis 4 fotos" con los créditos. Enter crea. |

### Creando
| Modo | Distribución |
|---|---|
| Celular | Igual que hoy. |
| Tableta | Título, estado y barra de progreso; las fotos ajustadas en un recuadro del 52 % del alto; aviso "Puedes salir". |
| Computador | Lienzo: los espacios de foto ajustados al alto, se van llenando. Panel: título, estado en vivo, barra de progreso y "Puedes salir de la app. Te avisamos cuando estén listas." "Salir" arriba a la derecha. |

### Listas
| Modo | Distribución |
|---|---|
| Celular | Igual que hoy (carrusel con la siguiente asomando). |
| Tableta | Título y resumen; galería ajustada (52 % del alto) sin recortar; guardado; "Siguiente paso"; botón "Guardar en mis fotos" (hoja de compartir del iPad). |
| Computador | Lienzo: galería completa ajustada al alto (clic abre en grande; descargar una al pasar el mouse). Panel lateral: título, resumen, "Guardadas en Mi catálogo", avisos, **Siguiente paso** (4 filas) y el botón "Descargar todas" (ZIP; con mouse no se abre la hoja de compartir). "Listo" arriba a la derecha. |

### Mi catálogo
| Modo | Distribución |
|---|---|
| Celular | Igual que hoy (2 columnas + barra de acción). |
| Tableta | Galería de 3 columnas a todo el ancho; "Crear fotos de un producto" arriba a la derecha. |
| Computador | Galería de columnas automáticas (mín. 208 px) a todo el ancho del panel, tarjetas 4:5 con hover; botón principal en la barra superior. Vacío: mensaje centrado con el botón debajo. En una biblioteca la última fila puede quedar incompleta (es una colección, no un set de resultados). |

## 4. API del marco para los próximos módulos

```tsx
<FlowShell
  title="Tu producto"
  leading={{ kind: 'back', onPress }}
  trailing={<NavButton icon={<Package />} label="Mi catálogo" onPress={…} />}
  progress={1 / 3}                       // celular: línea de 2 px
  steps={{ labels: ['Tu producto', 'Estilo', 'Revisa y crea'], current: 0 }} // tableta/computador
  actions={<PrimaryButton …/>}           // celular: barra fija · resto: en línea
  aside={wide ? <Lienzo/> : undefined}   // computador: panel izquierdo
  layout="form" | "hero" | "gallery"     // pista de distribución
  onEnter={canContinue ? next : undefined}
  onDropFile={(file) => …}               // computador/tableta con mouse
>
  <LargeTitle>…</LargeTitle>…
</FlowShell>
```

- `useFlowLayout()` → `'compact' | 'regular' | 'wide'`; cada paso decide su
  contenido con eso (un solo árbol, sin duplicar campos ni ids).
- `FitGallery` para cualquier lienzo de fotos; `PhotoLayout` sigue siendo la
  regla del celular.
- `BottomSheet` ya se convierte solo en hoja centrada en ≥ 768 px (`size="large"`
  para listas de fotos).
- `NavButton`: ícono solo en celular, ícono + texto en tableta/computador.

## 5. Criterios de aceptación

- 1440×900, 1280×720, iPad Pro 11 vertical y horizontal: el botón principal se
  ve sin desplazar en todas las pantallas; sin desplazamiento horizontal; un
  solo título grande; galerías sin filas a medias y sin fotos recortadas.
- Celular (iPhone 14): idéntico a la versión aprobada.
- `npm run lint` y `npm run build` pasan.
