# LUZ IA Studio — Brief de Estrategia de Precios
**Documento técnico para análisis externo · Abril 2026**

---

## CONTEXTO GENERAL

LUZ IA Studio es una plataforma SaaS de generación de contenido publicitario con IA, orientada a creadores, agencias y marcas en Latinoamérica. Permite generar imágenes de modelos digitales, clonar escenas, crear contenido tipo UGC, extraer outfits y producir fotografía de productos, todo desde el navegador.

El modelo de negocio es **créditos por suscripción mensual** con posibilidad de recarga. Los créditos se consumen por cada generación de imagen.

El fundador es un desarrollador independiente con operación desde Chile, aún sin inicio de actividades formal ni RUT tributario. Esto tiene implicancias directas en la elección de la pasarela de pagos (ver Sección 5).

---

## SECCIÓN 1 — ARQUITECTURA TÉCNICA RELEVANTE

### Stack de infraestructura

| Componente | Servicio | Notas |
|---|---|---|
| Frontend | Vercel (static/Vite) | Deploy automático desde GitHub |
| Funciones serverless | Vercel Serverless Functions | Timeout configurado por función |
| Cola de tareas async | Upstash QStash | Maneja generaciones largas (hasta 5 min) |
| Estado de jobs | Upstash Redis | TTL de 1 hora por job |
| Historial de generaciones | Upstash Redis | TTL 90 días, máx 100 registros por usuario |
| Autenticación | Firebase Auth | Gratis hasta 50K usuarios |
| Base de datos | Firestore (mínimo) + Redis | Firestore casi no se usa en producción |
| Almacenamiento imágenes | Cliente (IndexedDB/localStorage) | No hay upload automático a storage en la nube |

### Modelos de IA usados

| Modelo | Uso | Ubicación |
|---|---|---|
| `gemini-3.1-flash-image-preview` | Generación de imágenes (default) | global |
| `gemini-3-pro-image-preview` | Fallback en generaciones con fidelidad facial crítica | global |
| `gemini-2.5-flash` | Análisis de texto, outfits, productos, asistente | us-central1 |

**Nota importante:** `gemini-2.5-flash-image` fue eliminado del stack por problemas de drift de identidad con referencias. Todos los módulos usan Gemini 3 para imagen.

### Flujo de generación de imagen (toda generación pasa por esto)

```
Cliente → POST /api/gemini/image → Redis (guarda job) → QStash (encola)
Cliente → polling cada 2s (máx 90 intentos = 3 min)
QStash → image-worker → Gemini API → Redis (guarda resultado)
Cliente → recibe imagen
```

**Timeouts por función:**
- Funciones generales: 60 segundos
- Clone worker (Model DNA): 300 segundos (5 minutos)

---

## SECCIÓN 2 — COSTO REAL DE INFRAESTRUCTURA (MENSUAL FIJO)

| Servicio | Plan actual | Costo mensual |
|---|---|---|
| Vercel | Hobby | **$0/mes** |
| Upstash Redis | Free tier / pay-as-you-go | **$0–$10/mes** |
| Upstash QStash | Pay-as-you-go | **~$0.35 por 100K mensajes** |
| Firebase Auth | Free | **$0** |
| Firestore | Free (uso mínimo) | **$0** |
| Almacenamiento de imágenes | No aplica (no hay cloud storage activo) | **$0** |

**Costo fijo mínimo operativo: prácticamente $0/mes en las etapas iniciales.**

El costo escala con el volumen de generaciones (QStash) y usuarios (Redis). Es un modelo muy favorable para validación temprana.

**Advertencia Vercel Hobby:** el plan Hobby tiene límites de ancho de banda y funciones. Si el tráfico escala, migrar a Pro ($20/mes) puede ser necesario. Incluir este costo en proyecciones de breakeven.

---

## SECCIÓN 3 — COSTO REAL POR MÓDULO (GOOGLE VERTEX AI)

### Metodología de costeo

**Decisión de diseño:** se costea todo como si usara **Gemini 3 Pro** (el modelo más caro), aunque en la práctica la mayoría de generaciones usa Gemini 3.1 Flash. Esto cubre el peor caso (reintentos con fallback a Pro) y convierte cualquier generación exitosa con Flash en margen adicional.

**Precios de referencia Gemini en Vertex AI (verificar vigencia en console.cloud.google.com):**
- Gemini 3 Pro image: ~$0.134 por imagen generada
- Gemini 3.1 Flash image: ~$0.067 por imagen generada
- Gemini 2.5 Flash text: incluido en cuota gratuita o costo mínimo (< $0.001 por llamada)

**Riesgo de reintentos:** el sistema tiene hasta 3 reintentos silenciosos por generación fallida, y el worker puede intentar Flash → Pro en cascada. En el peor caso, una generación que debería costar $0.067 puede consumir hasta $0.80 en API calls reales. Al costear con Pro cubrimos este escenario.

---

### Costo real por módulo (base Pro = $0.134/imagen)

#### Model DNA — From Photos (`/crear/clonar`)
- Flujo: 1 llamada texto (análisis biométrico) + 4 generaciones de imagen
- Imágenes generadas: frontal, trasera, lateral, close-up de rostro
- **Costo API real: 4 × $0.134 = $0.536**
- Créditos actuales asignados: **8 créditos**
- A $0.05/crédito → precio cobrado: $0.40
- **Margen actual: negativo si usa Pro (-$0.136). Positivo si usa Flash (+$0.132)**

#### Model DNA — From Scratch (`/crear/manual`)
- Flujo: 4 generaciones de imagen (sin análisis previo)
- **Costo API real: 4 × $0.134 = $0.536**
- Créditos actuales: **8 créditos** → $0.40 cobrado
- **Misma situación que From Photos**

#### AI Generator — Standard sin persona (`/prompt-studio`)
- Flujo: 1 generación de imagen
- **Costo API real: $0.067 (Flash) / $0.134 (Pro)**
- Créditos actuales: **2 créditos** → $0.10 cobrado
- A precio Pro: margen negativo. A Flash: margen positivo.

#### AI Generator — Standard con persona
- Mismo flujo, pero la referencia de persona puede activar Pro
- **Costo API real: $0.067–$0.134**
- Créditos actuales: **4 créditos** → $0.20 cobrado
- A precio Pro: margen positivo ($0.066)

#### Campaign Generator (6 shots)
- Flujo: 6 generaciones en paralelo
- **Costo API real: 6 × $0.134 = $0.804**
- Créditos actuales: 6 × 2 = **12 créditos** → $0.60 cobrado
- **Margen negativo a precio Pro (-$0.204)**

#### Photodump Mode (8 shots)
- Flujo: 8 generaciones en paralelo
- **Costo API real: 8 × $0.134 = $1.072**
- Créditos actuales: 8 × 2 = **16 créditos** → $0.80 cobrado
- **Margen negativo a precio Pro (-$0.272)**

#### UGC Studio — sesión completa (7 shots: REF0 + 6 derivadas)
- Flujo: 7 generaciones + análisis de escena (texto gratis)
- **Costo API real: 7 × $0.134 = $0.938**
- Créditos actuales: 7 × 4 = **28 créditos** → $1.40 cobrado
- **Margen positivo a precio Pro (+$0.462)**

#### Scene Clone — CloneMaster (`/clonar`)
- Flujo: 1 generación con múltiples referencias
- **Costo API real: $0.067–$0.134**
- Créditos actuales: **4 créditos** → $0.20 cobrado
- **Margen positivo incluso a precio Pro (+$0.066)**

#### Outfit Kit — flujo completo (análisis + 5 prendas + composición)
- Flujo: 1 análisis texto (gratis) + 7 generaciones de imagen
- **Costo API real: 7 × $0.134 = $0.938**
- Créditos actuales: 7 × 2 = **14 créditos** → $0.70 cobrado
- **Margen negativo a precio Pro (-$0.238)**

#### Catálogo / Product shots
- Flujo: 1–8 generaciones de imagen (sin referencias de persona)
- **Costo API real por foto: $0.067–$0.134**
- Créditos actuales: **2 créditos/foto** → $0.10 cobrado
- A Flash: margen positivo. A Pro: break-even o ligeramente negativo.

---

### Tabla resumen — Margen por módulo (base Pro)

| Módulo | Créditos cobrados | $ cobrado | Costo API (Pro) | Margen bruto |
|---|---|---|---|---|
| Model DNA Fotos | 8 | $0.40 | $0.536 | **-$0.136** |
| Model DNA Manual | 8 | $0.40 | $0.536 | **-$0.136** |
| AI Gen sin persona | 2 | $0.10 | $0.134 | **-$0.034** |
| AI Gen con persona | 4 | $0.20 | $0.134 | **+$0.066** |
| Campaign 6 shots | 12 | $0.60 | $0.804 | **-$0.204** |
| Photodump 8 shots | 16 | $0.80 | $1.072 | **-$0.272** |
| UGC Studio 7 shots | 28 | $1.40 | $0.938 | **+$0.462** |
| Scene Clone | 4 | $0.20 | $0.134 | **+$0.066** |
| Outfit Kit (7 imgs) | 14 | $0.70 | $0.938 | **-$0.238** |
| Catálogo (1 foto) | 2 | $0.10 | $0.134 | **-$0.034** |

**Conclusión:** Al costear con Pro, varios módulos tienen margen negativo por generación. Sin embargo, en la práctica la mayoría usa Flash ($0.067), lo que invierte el resultado. El UGC Studio es el módulo con mejor margen en cualquier escenario.

**Pregunta clave para la IA de precios:** ¿cuánto hay que subir el precio del crédito, o cuántos créditos asignar por módulo, para que el margen sea positivo incluso en el peor caso (Pro + 3 reintentos)?

---

## SECCIÓN 4 — PLANES Y CRÉDITOS ACTUALES (ESTADO ACTUAL DEL CÓDIGO)

Definidos en `src/services/creditConfig.ts`:

| Plan | Créditos/mes | Precio | Precio por crédito | ~Imágenes/mes |
|---|---|---|---|---|
| Free | 20 (único) | $0 | — | ~10 |
| Starter | 240 | $9.99 | $0.0416 | ~80 |
| Pro | 600 | $19.99 | $0.0333 | ~200 |
| Studio | 1500 | $39.99 | $0.0266 | ~500 |

**Observaciones sobre los planes actuales:**
- El precio por crédito baja según el plan (descuento por volumen), lo que es estándar.
- A $0.033–$0.042 por crédito, la mayoría de generaciones con Flash tienen margen positivo.
- Con Pro como worst-case, el margen se vuelve negativo en módulos de batch (Campaign, Photodump, Outfit Kit).
- El plan Free de 20 créditos (única vez) alcanza para ~5 generaciones de AI Generator con persona o 2-3 sesiones de UGC.

**Preguntas abiertas para la estrategia:**
1. ¿Cuántos créditos asignar a cada módulo para cubrir el escenario Pro + reintentos?
2. ¿Tiene sentido mantener Campaign y Photodump a 2 créditos/imagen o subirlos a 3?
3. ¿El acceso a la Prompt Gallery debe estar restringido al plan Starter en adelante?
4. ¿Qué módulos justifican un plan Enterprise por encima de Studio?

---

## SECCIÓN 5 — PASARELA DE PAGOS

### Situación actual del fundador

- Operación desde Chile
- Sin inicio de actividades formal ni RUT tributario activo al momento del análisis
- Necesidad de recibir pagos internacionales en una cuenta y retirarlos mensualmente
- Necesidad de documentación válida para declaración de impuestos en Chile (facturas de servicios en el extranjero que justifiquen gastos y no parezca todo ganancia neta)

### Variables de entorno pre-configuradas en el codebase

El código ya tiene los nombres de variables para **Lemon Squeezy**:
```
LEMONSQUEEZY_API_KEY
LEMONSQUEEZY_WEBHOOK_SECRET
LEMONSQUEEZY_STORE_ID
LEMONSQUEEZY_VARIANT_STARTER
LEMONSQUEEZY_VARIANT_PRO
LEMONSQUEEZY_VARIANT_STUDIO
```

Esto indica que la integración técnica está pensada para Lemon Squeezy.

### Comparativa de pasarelas relevantes para este caso

| Característica | Lemon Squeezy | Stripe | Paddle |
|---|---|---|---|
| Modelo | Merchant of Record (MoR) | Procesador directo | Merchant of Record (MoR) |
| Impuestos/IVA | Lo maneja LS automáticamente | Responsabilidad del vendedor | Lo maneja Paddle automáticamente |
| Inicio de actividades requerido | No necesariamente al inicio | Sí (para cuenta en regla) | No necesariamente al inicio |
| Disponibilidad en Chile | Sí (cuenta personal/empresa extranjera) | Sí, con limitaciones para personas sin empresa formal | Sí |
| Retiros a cuenta bancaria | Payoneer, tarjeta local, transferencia | Cuenta bancaria directa | Payoneer, transferencia |
| Facturación a usuarios | LS emite facturas automáticas | El vendedor debe configurarlo | Paddle emite facturas automáticas |
| Documentación para impuestos | LS emite factura mensual al vendedor | Stripe emite reportes, no facturas al vendedor | Paddle emite factura mensual al vendedor |
| Comisión | 5% + $0.50 por transacción | 2.9% + $0.30 por transacción | 5% + $0.50 por transacción |
| Integración con suscripciones | Nativa, simple | Requiere configuración de Billing | Nativa |
| Soporte para LATAM | Bueno | Bueno pero requiere empresa formal | Bueno |

### Recomendación provisional

**Lemon Squeezy o Paddle son los más adecuados para la situación actual** porque:

1. Son **Merchant of Record**: ellos son el vendedor legal ante el usuario, no tú. Ellos cobran el IVA/impuestos locales de cada país y te pagan el neto.
2. **Emiten factura mensual al vendedor** (al fundador) por sus servicios como procesador. Esa factura es un gasto válido deducible en Chile y justifica por qué no toda la ganancia bruta es ingreso neto.
3. No requieren empresa formal para comenzar a operar (solo cuenta personal o un freelance registrado en otro país).
4. **Payoneer** como cuenta receptora intermedia es una opción viable para recibir los pagos de LS/Paddle y luego transferir a cuenta bancaria chilena.

### Estructura recomendada provisional (sin inicio de actividades)

```
Usuario paga → Lemon Squeezy (Merchant of Record)
               └─ Descuenta comisión + IVA de cada país
               └─ Emite factura mensual al fundador por servicios
               └─ Transfiere el neto a Payoneer del fundador
                          └─ Retiro mensual a cuenta bancaria chilena
```

**Para declaración de impuestos en Chile:**
- La factura mensual de Lemon Squeezy al fundador es el documento que justifica el gasto de procesamiento.
- Los ingresos netos recibidos en Payoneer son los ingresos reales a declarar.
- Un contador en el extranjero (ej. servicio remoto en Argentina, Colombia o España) puede emitir una factura adicional por servicios de asesoría contable, que también es gasto deducible.
- **Acción prioritaria:** consultar con un contador chileno especializado en rentas del exterior antes de escalar el volumen de ventas, para elegir el régimen tributario correcto (Régimen Pro-Pyme, 14D, o renta global complementaria).

### Preguntas para la IA de precios sobre pasarelas

1. ¿Cuál es el costo total efectivo (comisión + fees) de Lemon Squeezy vs Paddle para tickets promedio de $9.99–$39.99/mes con usuarios LATAM?
2. ¿Paddle tiene mejor cobertura de métodos de pago locales (PSE, Mercado Pago, etc.) que Lemon Squeezy para LATAM?
3. ¿Existe alguna restricción para operar con Lemon Squeezy sin empresa formal en Chile en 2026?
4. ¿Cómo se compara la comisión efectiva de LemonSqueezy (5% + $0.50) vs Stripe con Billing en volúmenes de $1K, $5K y $20K MRR?

---

## SECCIÓN 6 — BENCHMARKS DE COMPETIDORES

Usar como referencia para posicionamiento de precio. Investigar precios vigentes al momento del análisis:

| Plataforma | Plan base | Plan mid | Plan top | Modelo |
|---|---|---|---|---|
| Midjourney | $10/mes | $30/mes | $60/mes | Fast GPU hours / créditos |
| Leonardo AI | $10/mes | $24/mes | $48/mes | Tokens por generación |
| Runway | $12/mes | $28/mes | $76/mes | Créditos por segundo de video/imagen |
| Adobe Firefly | $4.99/mes (en Creative Cloud) | — | $54.99/mes (CC completo) | Créditos generativos |
| Canva AI | $15/mes | — | $30/mes | Incluido en Canva Pro |

**Diferencial de LUZ IA Studio vs competidores:**
- Enfoque específico en contenido publicitario (no arte general)
- UGC Studio para influencers digitales (nicho no cubierto por Midjourney/Leonardo)
- Model DNA: clonar identidades reales para uso comercial
- Scene Clone: recrear composiciones existentes con identidades propias
- Orientado a agencias y marcas LATAM (español como idioma nativo)

**Pregunta para la IA:** ¿Qué posicionamiento de precio (premium, mid-market, accesible) maximiza conversión en LATAM dado que el ticket promedio de SaaS en la región es 30-40% menor que en USA?

---

## SECCIÓN 7 — INFRAESTRUCTURA EN ESCALA (PARA PROYECCIONES)

### Cuándo escalar Vercel

| MRR | Usuarios activos est. | Recomendación |
|---|---|---|
| $0–$500 | <50 | Hobby ($0) es suficiente |
| $500–$2K | 50–200 | Evaluar Vercel Pro ($20/mes) |
| $2K–$10K | 200–1000 | Vercel Pro necesario |
| >$10K | >1000 | Vercel Enterprise o migración a Railway/Fly.io |

### Cuándo escalar Upstash

| Generaciones/mes | Redis ops est. | QStash msgs est. | Costo est. |
|---|---|---|---|
| <1K | <50K ops | <1K msgs | $0 (free tier) |
| 1K–10K | 50K–500K ops | 1K–10K msgs | $5–$15/mes |
| 10K–100K | 500K–5M ops | 10K–100K msgs | $15–$50/mes |
| >100K | >5M ops | >100K msgs | $50–$200/mes |

### Costo de Gemini en escala

El costo de Gemini es el único que escala directamente con el volumen de generaciones.

| Generaciones/mes | Costo API (Flash) | Costo API (Pro worst-case) |
|---|---|---|
| 1K | $67 | $134 |
| 5K | $335 | $670 |
| 10K | $670 | $1,340 |
| 50K | $3,350 | $6,700 |

A estos volúmenes, **negociar créditos comprometidos con Google Cloud** puede bajar el costo de Vertex AI entre 20-40%. Investigar "Committed Use Discounts" en Vertex AI.

---

## SECCIÓN 8 — PREGUNTAS CLAVE PARA LA IA DE ESTRATEGIA DE PRECIOS

Con todo el contexto anterior, estas son las preguntas específicas que necesitan respuesta:

### Sobre costos y márgenes
1. ¿A qué precio por crédito se logra margen positivo en TODOS los módulos incluso en worst-case (Pro + 3 reintentos)?
2. ¿Tiene más sentido subir el precio del crédito ($0.05 → $0.08) o subir los créditos por módulo (Campaign de 2 → 3 créditos/imagen)?
3. ¿Qué margen bruto mínimo por plan es saludable para un SaaS con este modelo de costos variables?

### Sobre planes
4. ¿Los planes actuales (Free/Starter/Pro/Studio) tienen saltos de precio y créditos apropiados?
5. ¿Tiene sentido un plan "Agency" entre Pro y Studio para equipos de 2-5 personas?
6. ¿Cómo estructurar un sistema de recarga de créditos (top-up) sin canibalizar las suscripciones?
7. ¿Debe el plan Free dar acceso completo a todos los módulos, o restringir algunos (ej. UGC Studio) para forzar conversión?

### Sobre pasarela
8. ¿Cuál es la comisión total efectiva de Lemon Squeezy para un MRR de $1K, $5K y $20K?
9. ¿Paddle tiene ventaja competitiva en LATAM sobre Lemon Squeezy para los métodos de pago locales?
10. ¿Cómo estructurar los webhooks de Lemon Squeezy para manejar upgrade/downgrade/cancelación y reflejar los créditos correctos en Firestore?

### Sobre competidores y posicionamiento
11. ¿Qué precio psicológico funciona mejor en LATAM para SaaS creativo: $9.99, $12, $15 o $19.99 para el plan base?
12. ¿Conviene tener un plan anual con descuento del 20-30% desde el inicio o esperar a tener tracción?
13. ¿Cómo comunicar el valor de créditos vs "imágenes" para que el usuario entienda el precio sin confusión?

---

## DATOS TÉCNICOS ADICIONALES PARA VERIFICACIÓN EXTERNA

Verificar vigencia de precios en estas fuentes antes de hacer proyecciones finales:

- **Gemini Vertex AI pricing:** cloud.google.com/vertex-ai/generative-ai/pricing
- **Lemon Squeezy fees:** lemonsqueezy.com/pricing
- **Paddle fees:** paddle.com/pricing
- **Upstash pricing:** upstash.com/pricing (Redis y QStash)
- **Vercel pricing:** vercel.com/pricing

---

*Documento generado el 2026-04-23. Los precios de API de Google Gemini cambian frecuentemente — verificar antes de usar en proyecciones financieras.*
