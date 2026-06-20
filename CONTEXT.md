# Contexto del proyecto: Luz IA — Sistema de diseño y módulos

> **¿Eres una IA leyendo este archivo en una conversación nueva?**
> Saltá a la sección **"📋 Instrucciones para retomar"** al final.

---

## Quién soy y qué construyo

Soy una persona desarrollando **Luz IA**, una plataforma de generación de imágenes con IA (especialmente fotos de producto, contenido para redes, mockups). Mi público son **principiantes** — gente que no sabe qué es un "prompt" pero quiere fotos profesionales.

Mi codebase es:
- **React + TypeScript**
- **Tailwind CSS** (con clases custom como `t-meta`, `t-display`, `text-brand-*`)
- **react-router-dom** (no es Next.js — Vite o CRA)
- Servicios propios: `geminiService`, `imageApiService`, `generationHistoryService`
- Hooks propios: `useCreditGuard`, `useAuth`, `useScrollFAB`
- Componentes shared en `src/components/shared/`
- Lo desarrollo con **Claude Code**

## El sistema de diseño que ya validamos (v3)

Después de explorar varias direcciones (v1 más conservadora, v2 más loca), nos quedamos con **v3** como estándar. Tiene esta personalidad:

- **Atrevido pero accesible** — no es minimalismo aburrido ni maximalismo abrumador
- **Editorial** — usa tipografía display italic con personalidad
- **Optimista** — gradientes violet→pink con propósito, no decorativos
- **Friendly para principiantes** — labels claros, microcopy explicativo, validaciones con feedback visual

### Paleta v3 (estándar para todos los módulos)

```typescript
// Neutrales (ink → faint)
ink:     '#0f172a'  // textos principales
body:    '#475569'  // textos secundarios
muted:   '#64748b'  // labels, metadata
faint:   '#94a3b8'  // hints, deshabilitado
border:  '#e2e8f0'  // bordes de cards y dividers
surface: '#f8fafc'  // fondos de zonas secundarias
bg:      '#fafbfc'  // fondo general

// Acentos
violet:  '#7c3aed'  // primario — CTAs, selecciones, énfasis
pink:    '#ec4899'  // acento — palabras italic en titulares, "hot"
amber:   '#f59e0b'  // warning, "atención"
emerald: '#10b981'  // success, "óptimo"
indigo:  '#4f46e5'  // info, links secundarios

// Gradient brand
GRADIENT_BRAND: linear-gradient(135deg, #7c3aed, #ec4899)
```

### Tipografía v3

- **Display (titulares):** `Syne` italic 800 — Google Fonts, SIL OFL (uso comercial libre)
  - Patrón: la palabra-verbo del titular va en `color: pink` italic. Ej: *"Cuéntanos qué **vamos a fotografiar**."*
- **Sans (UI/body):** `Inter` 400/500/600/700 — Google Fonts, SIL OFL
- **Tailwind:** `font-sans: ['Inter']`, `font-display: ['Syne']`

### Patrones visuales del sistema v3

- **Kicker:** texto chico en uppercase con letter-spacing 0.12em+, color violet o muted, marca cada paso/sección. Ej: `PASO 1 · PRODUCTO`
- **SectionTitle:** título display Syne italic 28-36px (mobile/desktop), con palabra acento en pink
- **Lead:** párrafo body 14-16px color body, después del título, explica el qué/por qué
- **Pills:** estado/badge redondeado, color sólido + fondo translúcido (color + '14' = 8% alpha)
- **Cards:** bordes `1px solid border`, radio 14-18px, sombra `0 8px 20px rgba(15,23,42,0.08)` solo cuando tienen contenido o están seleccionadas
- **CTAs primarios:** fondo `ink` (`#0f172a`), texto blanco, radio 10-12px, padding `14px 24px`
- **CTAs con brand:** fondo violet o gradient, blanco
- **Borders dashed:** dropzones y slots vacíos usan `2px dashed violet55` (alpha 33%)

### Layout patterns

- **Desktop wizard:** sidebar izquierda (chrome del producto Luz IA) + contenido principal con stepper arriba + footer sticky abajo
- **Mobile:** sidebar oculta, MobileTopbar con back+título, stepper minimal "Paso N de 6 + barra", footer sticky con CTA full-width 48px+
- **Breakpoint:** `< 900px` = mobile, `>= 900px` = desktop
- **Container desktop:** 1380px max-width centrado, `border-radius: 14px` con shadow grande sobre fondo dark

### Animaciones del sistema

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.fade-in { animation: fadeIn 0.35s ease-out both; } /* el `both` es CRÍTICO */
```

- Transiciones de pasos en wizard: fade-in
- Hover cards: `transition: all 0.15s`
- Sticky bars: slide-up 250ms

## Voz y tono

- **Tuteo en español** ("vos" o "tú" según la audiencia, mantener consistencia)
- **Microcopy explicativo, no técnico:** "Sumá una vista más" en vez de "Add another angle"
- **Validaciones con feedback narrativo:** "Excelente. Con 2 ángulos vamos a mantener forma, color y detalles" en vez de "Valid"
- **Verbo activo en titulares:** "Cuéntanos qué vamos a fotografiar" no "Información del producto"
- **Sin jerga IA:** evitar "prompt", "generación", "modelo" — preferir "lo que vamos a fotografiar", "creando", "estilo"

## Módulos en producción (Junio 2026)

### ✅ Product Studio — `/productos`
Wizard 6 pasos. Genera fotos de catálogo, lifestyle, detalle y mockup.
Archivos: `src/modules/productGenerator/`

### ✅ UGC Studio (Content Studio Pro) — `/studio-pro`
Genera series de 6 shots tipo "iPhone real" con identidad consistente (AVATAR/OUTFIT/PRODUCT/SCENE).
Archivos: `src/modules/contentStudioPro/`

### ✅ Model DNA — `/crear/clonar`
Crea avatar digital desde 1-3 fotos reales (Body Master + vistas técnicas + Face Master).
Archivos: `src/modules/modelDNA/`

### ✅ Manual Creator — `/crear/manual`
Crea avatar desde cero con parámetros visuales (género, edad, build, etnia, pelo, etc).
Archivos: `src/modules/manualCreator/`

### ✅ Scene Clone — `/clonar`
Replica la composición y ambiente de una foto de referencia con el modelo propio. Solo un sujeto.
Archivos: `src/modules/sceneClone/`

### ✅ Outfit Extractor — `/outfit-extractor`
Detecta prendas en una foto y genera renders individuales de catálogo.
Archivos: `src/modules/outfitExtractor/`

### ✅ Prompt Studio + Galería — `/prompt-studio`, `/prompt-gallery`
Generador libre con referencias visuales + galería pública de prompts curados.
Archivos: `src/modules/promptLibrary/`

### ✅ Campaign Generator — `/campaign`
Kit de campaña completo: plan estratégico + imágenes consistentes + copy + calendario 7 días + PDF/HTML.
Archivos: `src/modules/campaign/`

### ✅ Photodump — `/photodump`
Series narrativas de 3-8 imágenes. Recetas: unboxing, outfit_check, outfit_haul (v1.8), outfit_week.
Archivos: `src/modules/photodump/`

### ✅ Planner — `/planner`
Asistente semanal de contenido. Onboarding 4 preguntas → plan completo con captions/prompts listos.
Burbuja flotante que acompaña la ejecución. Reemplazó Projects y Publicar Studio.
Archivos: `src/modules/planner/`

### ✅ Mis Marcas — `/mis-marcas`
CRUD de perfiles de marca con paleta editable, assets de Storage, status y reporte descargable.
Archivos: `src/modules/brandProfiles/`

## Pendientes / mejoras futuras conocidas

- Pre-llenar parámetros en Product Studio y UGC via URL params (hoy solo Prompt Studio)
- Integración Perfil de Marca → Planner y Campaign (hoy la usuaria describe su negocio manualmente)
- Photodump recetas pendientes: day_in_life, launch, bts, travel

## Decisiones de diseño tomadas (no revisitar sin razón)

- ✅ **Wizard guiado** > formulario único — para principiantes el wizard reduce fricción
- ✅ **Modo "subir referencia Pinterest"** > solo presets — la inspiración visual es más potente que descripciones
- ✅ **Sin checkpoint hero** > generación atómica — el usuario espera todo y curate al final
- ✅ **Selección múltiple en resultados** para crear grids manuales — feature distintiva del producto
- ✅ **Costo visible en vivo** — transparencia con créditos siempre
- ✅ **Mobile-first hit targets** 48px+ en CTAs principales
- ✅ **Tipografía Syne italic** para personalidad editorial — diferencia vs competidores con fuentes "tech" genéricas
- ✅ **Paleta v3** (violet+pink) por sobre v1 (más sobria) o variaciones — la identidad ya está fijada

## Stack del prototipo (NO confundir con stack de producción)

Los prototipos están hechos con:
- HTML + React 18 vía Babel inline (`<script type="text/babel">`)
- Inline styles (no Tailwind)
- Sin TypeScript

**Esto es solo para validar UX rápido.** El handoff a producción convierte:
- Babel → Vite/Next compile
- Inline styles → Tailwind utility classes
- `Object.assign(window, ...)` → `import/export`
- Mock data (uploads fake, créditos hardcoded) → servicios reales

---

## 📋 Instrucciones para retomar (leer si sos una IA en chat nuevo)

**Hola IA. Soy un proyecto de diseño en curso. Para que podamos seguir donde dejamos:**

### Paso 1 — Pedime que te comparta los archivos de contexto

Pedime que importe (vía drag-and-drop o el botón de Import en la esquina) los siguientes archivos/carpetas del proyecto anterior:

**Esenciales (siempre):**
1. Este `CONTEXT.md` que estás leyendo (ya lo tenés)
2. `modulo-producto/` completo — sistema de diseño aplicado al wizard
3. `design_handoff_modulo_producto/` — handoff package con tokens y patterns documentados
4. `uploads/ProductGeneratorModule.tsx` — código actual del módulo (para entender el stack real)

**Si voy a iterar sobre módulos existentes:**
5. `v3/` o `prototype/` o `prototype-desktop/` — según qué módulo quiera tocar

**Si voy a diseñar un nuevo módulo:**
6. Pedime el brief del módulo (en texto o en un archivo) — qué hace, para qué tipo de usuario, casos de uso, integraciones técnicas si aplica
7. Pedime referencias visuales de productos similares si tengo

### Paso 2 — Antes de diseñar nada, confirmá conmigo

- ¿Qué módulo vamos a diseñar / qué iteración hacemos?
- ¿Querés desktop, mobile, o ambos?
- ¿Cuántas variaciones querés explorar?
- ¿Hay constraints técnicas nuevas? (componentes shared nuevos, servicios nuevos, cambios en stack)

### Paso 3 — Reglas para el trabajo

- **Usá siempre el sistema v3** (paleta + tipografías + patrones de arriba) salvo que te pida explícitamente explorar algo nuevo
- **Reutilizá los componentes shared del codebase** (la tabla está en el handoff de producto) — no inventes componentes que ya existen
- **Mantené la voz y tono** descritos arriba
- **Output:** prototipos HTML + React vía Babel (mismo formato que `modulo-producto/`), separando shell.jsx + pasos/secciones + app.jsx para que sean editables
- **Para mobile, usá `ios-frame.jsx`** (starter component) con el mismo patrón que `Modulo Producto Mobile.html`
- **Cuando termines un módulo, generá un handoff package** (carpeta `design_handoff_<nombre>/`) con README detallado siguiendo el formato de `design_handoff_modulo_producto/README.md`
- **NO inventes datos del codebase** — si necesitás saber si existe algún componente o servicio, preguntame y te traigo el archivo

### Paso 4 — Lo que NO hay que hacer

- ❌ No empezar a diseñar antes de tener el sistema v3 cargado
- ❌ No usar otras tipografías "porque quedan bien" (Inter + Syne, fin)
- ❌ No agregar emojis en la UI a menos que sean parte del contenido (ej: 📌 en dropzone Pinterest del paso 3 está OK porque es metáfora visual)
- ❌ No proponer paletas alternativas — la decisión de v3 ya está tomada
- ❌ No sugerir Material UI / Chakra / shadcn — el codebase usa Tailwind utility-first
- ❌ No olvidar el `animation-fill-mode: both` en `.fade-in` (bug real que tuvimos)

---

## Archivo CLAUDE.md sugerido

Si querés que esto se aplique automáticamente en cada chat sin tener que mencionarlo, copiá este archivo (o un extracto) a `CLAUDE.md` en la raíz del proyecto. La IA lo lee automáticamente al iniciar.

```bash
cp CONTEXT.md CLAUDE.md
```

---

*Actualizado: cierre del módulo Foto de Producto + handoff package entregado.*
*Próximo módulo a definir.*
