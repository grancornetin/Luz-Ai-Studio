# LUZ IA STUDIO — Plan de Cierre para MVP & Portafolio
**Fecha: 13 oct 2026 · Objetivo: Sellar la app, desactivar 4 módulos, cierre de 1-2 semanas máximo**

---

## Estado actual

Módulos en código (todos funcionales pero algunos con huecos):
- ✅ Product Studio (`/productos`)
- ✅ UGC Studio (`/studio-pro`)
- ✅ Model DNA: Clonar (`/crear/clonar`) + Manual (`/crear/manual`)
- ✅ Outfit Extractor (`/outfit-extractor`)
- ✅ Scene Clone (`/clonar`)
- ✅ Prompt Studio + Gallery (`/prompt-studio`, `/prompt-gallery`)

Módulos a DESACTIVAR (NO borrar):
- ❌ Planner (`/planner`, `/planner/nuevo`, `/planner/:id`, `/planner/:id/cierre`)
- ❌ Campaign (`/campaign`)
- ❌ Photodump (`/photodump`)
- ❌ Mis Marcas (`/mis-marcas`)

---

## Fase 1: Desactivación de rutas (1 día)

### T1 · Ocultar 4 módulos del menú y navegación — `AGENTE`

**Qué hacer:**
1. En `src/App.tsx` línea ~69-100 (MENU_GROUPS):
   - Quitar las líneas de Campaign y Photodump de la sección "Contenido para vender"
   - Quitar la sección "Planes de contenido" que contiene Planner
   - Quitar Mis Marcas (donde sea que esté en el menú)
2. Las rutas en `<Route>` del App.tsx líneas ~430-457 pueden quedarse (no se navega a ellas, pero no tiran error si alguien las tipea en la URL).
3. Verificar que `<MobileBottomNav>` (línea ~48) no liste los módulos ocultos.

**Resultado:** El usuario ve 6 módulos en el menú, no 10.

**Listo cuando:** El menú en web y mobile muestran solo: Crear modelo (3 items) + Crear contenido (4 items) = 7 items totales. Sin Campaign/Photodump/Planner/Mis Marcas.

---

## Fase 2: Sellado de huecos críticos (5-7 días)

### T2 · Onboarding mínimo — `AGENTE` (requiere OK previo del dueño)

**Por qué:** Sin dirección, un usuario nuevo ve 6 módulos sin saber cuál usar.

**Qué hacer:**
1. Crear una pantalla POST-LOGIN (antes del Dashboard):
   - Pregunta: "¿Qué vendes?" (multiselect: Ropa, Skincare, Velas, Accesorios, Otro)
   - Pregunta: "¿Cuándo necesitas fotos?" (radio: Hoy, Esta semana, En 2-3 días)
   - Botón: "Empezar"
2. Guardar en Firestore: `user.onboardingProfile = { category, urgency, timestamp }`
3. Redirigir a Dashboard (modificado en T5).
4. **Nunca volver a mostrar** si `user.onboardingProfile` existe.

**Costo de código:** 1 pantalla React + 1 campo en Firestore + lógica de redirección = 2-3 horas.

**Listo cuando:** Un usuario nuevo ve "¿Qué vendes?" al registrarse, responde, y aterriza en Dashboard.

---

### T3 · Dashboard rediseñado (recomendaciones basadas en onboarding) — `AGENTE` (requiere código de T2)

**Por qué:** El Dashboard actual muestra 6 módulos genéricos. Con la respuesta de T2, puede recomendar.

**Qué hacer:**
1. Leer `user.onboardingProfile.category` y `urgency`.
2. Si `category = 'Ropa'` → mostrar primero "Modelo desde fotos" (para modelos) y "Fotos para redes" (UGC).
3. Si `urgency = 'Hoy'` → mostrar primero "Fotos de producto" (Product Studio).
4. Mantener los otros módulos visibles, pero en orden sugerido según el perfil.
5. Mostrar un "primer paso recomendado" card destacada en la parte superior.

**Costo de código:** Reordenar componentes del Dashboard + lógica condicional = 3-4 horas.

**Listo cuando:** Un usuario que dijo "Ropa" y "Hoy" ve "Fotos de producto" como primer card recomendado.

---

### T4 · Validación de flujo en mobile (rediseño finalizado) — `AGENTE`

**Por qué:** Tu memoria documenta que mobile está "en progreso" pero no cerrado.

**Qué hacer:**
1. Revisar cada módulo en ancho 375px (iPhone SE) y 768px (iPad):
   - Botones: clickeables, no apiñados
   - Texto: legible, no overflow
   - Formularios: una columna, inputs grandes
   - Imágenes: máx ancho 100%, aspect-ratio respetado
2. Cada módulo debe tener su FlowShell (según `project_flow_shell.md`): título claro, barra de acción, botones grandes.
3. Listar qué está OK y qué falta en cada módulo (máximo 1-2 issues por módulo).

**Entregable:** `CIERRE_MVP/T4_mobile_checklist.md` con lista de cada módulo: ✅ OK / 🟨 Pendiente (qué arreglar).

**Listo cuando:** Cada módulo tiene al menos 2 pantallas testeadas en mobile sin problemas visuales críticos.

---

### T5 · Limpieza de emojis (regla de marca global) — `AGENTE`

**Por qué:** Tu feedback dice "Nada de emojis en la UI" — reemplazar por lucide-react icons.

**Qué hacer:**
1. Buscar en todo `src/` archivos que tengan emojis en texto de botones, labels, tarjetas (no comentarios).
2. Por cada emoji encontrado: reemplazar por un `<Icon>` de lucide-react relevante.
3. Ejemplo: "📸 Sube tu foto" → `<Camera /> Sube tu foto`
4. Prioridad: Dashboard, Pricing, Buy Credits, vistas de estado vacío, tarjetas de módulos.

**Costo de código:** Búsqueda global + reemplazos = 3-4 horas si hay muchos.

**Listo cuando:** `grep -r "📸\|🎯\|⚡" src/` devuelve cero coincidencias en archivos .tsx/.jsx/.ts (comentarios OK).

---

### T6 · Landing page simple (cierre narrativo) — `AGENTE`

**Por qué:** Necesitas algo "sellado y bonito" para portfolio. La Landing actual existe (`src/views/Landing.tsx`).

**Qué hacer:**
1. Revisar si Landing describe los 6 módulos que quedan (no los 10).
2. Si no: actualizar copy a describir solo: "Crea modelos digitales" + "Genera contenido" = 2 secciones.
3. Agregar sección "Módulos disponibles" con 6 cards (uno por módulo), cada uno con descripción de 1 línea y un ícono.
4. Asegurar que el CTA principal es "Prueba gratis" (con los 20 créditos sin tarjeta).
5. Revisar mobile: debe verse limpio sin scroll horizontal.

**Costo de código:** Actualizar copy + CSS si hace falta = 2-3 horas.

**Listo cuando:** Landing muestra 6 módulos, no 10. CTA es visible. Mobile OK.

---

## Fase 3: Documento de cierre para portafolio (1 día)

### T7 · README.md actualizado — `AGENTE`

Crear/actualizar `README.md` en raíz con:

```markdown
# Luz IA Studio — MVP de producción

Una plataforma de generación de contenido visual para emprendedoras que venden online.

## Módulos

- **Product Studio**: Transforma fotos de celular en fotos de catálogo profesional.
- **UGC Studio**: Genera contenido estilo "creador real" (sesiones naturales).
- **Model DNA**: Crea avatares digitales desde fotos reales o desde cero.
- **Outfit Extractor**: Extrae prendas individuales de una foto grupal.
- **Scene Clone**: Recrea el estilo y composición de una foto de referencia.
- **Prompt Studio + Gallery**: Generación libre de imágenes con inspiración de la comunidad.

## Tech Stack

- Frontend: React, TypeScript, Tailwind CSS
- Backend: Node.js, Firebase, Vertex AI (Gemini 3.1 Flash)
- Hosting: Vercel (frontend), Google Cloud (backend)
- Payment: Dodo Payments (subscripciones y top-ups)

## Instalar & Correr

```bash
npm install
npm run dev
```

Abre http://localhost:5173.

## Estado MVP

- ✅ 6 módulos funcionales
- ✅ Auth (email + Google)
- ✅ Sistema de créditos + planes
- ✅ Historial de generaciones
- ✅ Mobile responsive
- 🚧 Planner, Campaign, Photodump, Mis Marcas: postponed para v2

## Roadmap futuro

- Planner: planificar contenido semanal
- Campaign: generar campañas publicitarias
- Photodump: series de fotos coherentes
- Mis Marcas: gestionar identidades de marca
```

---

### T8 · CIERRE.md (explicación de decisiones) — `AGENTE`

Crear `CIERRE_MVP/CIERRE.md`:

```markdown
# Cierre del MVP — Decisiones y Rationale

## ¿Por qué estos 6 módulos y no 10?

La investigación inicial (Fase 1 de validación, /abogado-del-diablo) identificó que:
- **Sin un flujo de dirección (Planner), la retención es baja.** Sofi entra, ve 6 módulos, no sabe cuál usar, se aburre día 2.
- **Los 10 módulos originales eran demasiados para un MVP.** Mejor: cerrar bien 6 que lanzar 10 a medias.

Para este cierre, decidí:
1. Mantener los 6 módulos que el usuario final usa directamente para generar.
2. Postponer Planner, Campaign, Photodump, Mis Marcas para v2 (cuando haya tracción real).
3. Agregar un onboarding mínimo (T2) para dirigir al usuario sin necesidad de Planner todavía.

## Estado técnico

- Todos los 6 módulos tienen código funcional y están testeados en web y mobile.
- Las rutas de Campaign, Photodump, Planner, Mis Marcas siguen en el código pero están desactivadas del menú.
- El MVP es navegable, sellado, y listo para portfolioentregable en producción vía Vercel.

## Próximos pasos (post-MVP)

Dependiendo de tracción real (si llega):
1. **Validación con usuarios reales** (Fase 1-3 del roadmap original).
2. **Agregar Planner** si las métricas muestran que users se aburren día 2.
3. **Agregar Campaign** si aparecen usuarios que piden "ayuda para armar una campaña".
4. **Agregar Photodump** si hay demanda por "series coherentes".
```

---

## Tabla de ejecución

| ID | Tarea | Duración | Bloqueador | Estado |
|---|---|---|---|---|
| T1 | Desactivar 4 módulos del menú | 1h | — | ⬜ |
| T2 | Onboarding mínimo (categoría + urgencia) | 3h | — | ⬜ |
| T3 | Dashboard con recomendaciones | 4h | T2 | ⬜ |
| T4 | Validación mobile + checklist | 4h | — | ⬜ |
| T5 | Limpiar emojis | 3h | — | ⬜ |
| T6 | Landing actualizada | 3h | — | ⬜ |
| T7 | README.md | 1h | — | ⬜ |
| T8 | CIERRE.md | 1h | — | ⬜ |
| **TOTAL** | | **20h** | | |

---

## Commits & Deploy

Al terminar cada tarea:
```bash
git add .
git commit -m "tarea: [T1/T2/etc] descripción breve"
git push origin main
vercel deploy --prod  # solo al final
```

Solo FINAL deploy a producción con `vercel deploy --prod` cuando TODO está mergido a main.

---

## Para el agente que toma esto

1. Lee este archivo completo.
2. Toma **una tarea a la vez** en orden (T1 → T2 → ... → T8).
3. Para cada tarea: lee la descripción, implementa, abre un PR (o commiteacomenta el resultado.
4. Actualiza esta tabla con ⬜ → 🟨 → ✅ según avanzes.
5. No mezcles tareas: termina una antes de empezar la siguiente.
6. Si una tarea es bloqueada (ej: T3 necesita T2), espera.

---

**Objetivo final:** App lista para portfolio y GitHub en 1-2 semanas, sin agregar features nuevas. Solo sellar huecos.
