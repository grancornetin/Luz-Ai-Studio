# Cómo funciona el agente de QA de Photodump

Este documento explica, en detalle técnico, cómo está armado
`tools/photodump-qa-agent` — especialmente **cómo se conecta a Vertex AI
para analizar imágenes con Gemini**, para poder recrear esa misma conexión
en otra herramienta.

---

## 1. La pieza central: conexión a Vertex AI (no a la API pública de Gemini)

Esto es lo más importante y lo que probablemente querés copiar tal cual.

### 1.1 Por qué Vertex AI y no una `GEMINI_API_KEY` simple

Hay **dos formas distintas** de hablarle a Gemini desde código:

| Forma | Cómo se autentica | Dónde se usa |
|---|---|---|
| **Google AI Studio** | Una sola `GEMINI_API_KEY` de texto, generada en [aistudio.google.com](https://aistudio.google.com) | Prototipos rápidos, uso personal |
| **Vertex AI** (Google Cloud) | Una **cuenta de servicio** (service account) con un archivo JSON de credenciales + un `project_id` de Google Cloud | Apps en producción, facturación empresarial, más control de acceso |

Este proyecto (Luz IA Studio) ya usa **Vertex AI** en producción para generar
imágenes (`api/gemini/image-worker.ts`), así que el agente de QA se conectó
de la misma forma — no tiene sentido mezclar dos sistemas de autenticación
distintos para el mismo Google Cloud project.

### 1.2 Qué es una "cuenta de servicio" (service account)

Es un usuario especial de Google Cloud que no es una persona — es para que
código/servidores se autentiquen. Se crea en:

```
https://console.cloud.google.com/iam-admin/serviceaccounts?project=<TU_PROJECT_ID>
```

Al crearla, se le puede generar una **clave JSON** (Keys → Add Key → Create
new key → JSON) — un archivo que se descarga una sola vez y contiene:

```json
{
  "type": "service_account",
  "project_id": "luz-ai-studio",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "photodump-qa-agent@luz-ai-studio.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "...",
  "universe_domain": "googleapis.com"
}
```

Ese JSON completo **es la credencial**. Con él, cualquier código puede
autenticarse como esa cuenta de servicio sin pedir login interactivo.

**Rol necesario**: al crear la cuenta de servicio, se le asignó el rol
`Vertex AI User` (`roles/aiplatform.user`) — es el mínimo necesario para
poder llamar a `generateContent` contra modelos Gemini en Vertex.

### 1.3 El código exacto de conexión

Todo pasa por el paquete `@google/genai` (el SDK oficial de Google, mismo
que usa `api/gemini/image-worker.ts` en la app real):

```bash
npm install @google/genai
```

```ts
import { GoogleGenAI } from "@google/genai";

function getCredentials(): Record<string, unknown> {
  const raw = process.env.GEMINI_SERVICE_ACCOUNT_KEY || "";
  // El JSON puede venir tal cual (empieza con "{") o codificado en base64
  // (útil para pegarlo como variable de entorno de una plataforma que no
  // tolera saltos de línea reales, como a veces pasa en paneles web).
  const decoded = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
  return JSON.parse(decoded);
}

const ai = new GoogleGenAI({
  vertexai: true,                          // clave: usar Vertex, no Google AI Studio
  project: process.env.GCP_PROJECT_ID!,    // el project_id de Google Cloud (ej. "luz-ai-studio")
  location: "global",                      // los modelos Gemini de imagen/texto usados acá viven en "global"
  googleAuthOptions: { credentials: getCredentials() },
});
```

Con ese `ai` ya autenticado, cualquier llamada usa el mismo cliente:

```ts
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [{
    role: "user",
    parts: [
      { text: "Describe esta imagen." },
      { inlineData: { mimeType: "image/jpeg", data: base64ImageString } },
    ],
  }],
  config: { temperature: 0 },
});

console.log(response.text); // la respuesta de texto del modelo
```

### 1.4 Cómo se guarda el JSON de credenciales en `.env`

El archivo `.env` (nunca se sube a git) tiene el JSON **completo en una sola
línea, entre comillas simples**, porque el formato `.env` no soporta bien
JSON multilínea sin escapar:

```env
GCP_PROJECT_ID=luz-ai-studio
GEMINI_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"luz-ai-studio","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvA...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"...","universe_domain":"googleapis.com"}'
```

Puntos importantes:
- Los `\n` **dentro** del `private_key` quedan como texto literal
  (backslash + n), no como saltos de línea reales — así vienen en el JSON
  descargado de Google Cloud, y `JSON.parse()` los interpreta bien solo.
- Las comillas simples que envuelven todo el valor son necesarias para que
  el parser de `.env` no se confunda con las comillas dobles internas del
  JSON.
- Node.js 20.6+ carga esto automáticamente con `node --env-file=.env` (o
  `tsx --env-file=.env` como hace este proyecto) — no hace falta la librería
  `dotenv`.

### 1.5 Cómo conseguir estos valores si no los tenés

Si la cuenta de servicio original de un proyecto está marcada como
**"Sensitive"** en un panel como Vercel, **queda irrecuperable para
siempre** (ni el dueño puede volver a verla) — hay que crear una cuenta de
servicio nueva:

1. `https://console.cloud.google.com/iam-admin/serviceaccounts?project=<PROJECT_ID>`
2. **+ CREAR CUENTA DE SERVICIO** → nombre descriptivo → Crear y continuar.
3. Rol: **Vertex AI User** → Continuar → Listo.
4. Click en la cuenta creada → pestaña **Claves** → **Agregar clave → Crear
   clave nueva → JSON** → se descarga el archivo.
5. Ese archivo `.json` completo es lo que va en `GEMINI_SERVICE_ACCOUNT_KEY`.

---

## 2. Cómo se usa Gemini para "leer" imágenes de referencia

Esta parte no es específica de Vertex — es el patrón general de
multimodalidad de Gemini, útil para cualquier análisis visual.

### 2.1 Convertir una imagen a lo que Gemini espera

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function imagePart(filePath: string) {
  const bytes = await readFile(filePath);
  return { inlineData: { mimeType: mimeFor(filePath), data: bytes.toString("base64") } };
}
```

Gemini recibe imágenes como **base64 embebido directamente en la
petición** (`inlineData`), no como una URL — esto es simple para pocas
imágenes pero significa que el tamaño de la petición crece con el tamaño
del archivo. (Para volúmenes muy grandes, Vertex AI también soporta
`fileData` apuntando a un archivo ya subido a Google Cloud Storage, pero
este proyecto no lo necesitó.)

### 2.2 El prompt de "describir referencia" (para la memoria)

```ts
const DESCRIBE_PROMPT = `Describe esta imagen de referencia en un párrafo
corto (máximo 60 palabras), en español, enfocado solo en rasgos reutilizables
para comparar contra fotos generadas por IA: rostro, color y tipo de cabello,
edad aparente, silueta/cuerpo, prendas visibles, colores y texturas, objetos
o escena si aplica. No opines sobre calidad, solo describe lo que ves.`;

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [{
    role: "user",
    parts: [
      { text: DESCRIBE_PROMPT },
      await imagePart(filePath),
    ],
  }],
  config: { temperature: 0 }, // 0 = descripción consistente, no creativa
});
const description = response.text.trim();
```

### 2.3 El prompt de "evaluar shot generado" (comparación real)

Este es más largo porque además de la imagen, manda contexto en JSON y pide
una respuesta estructurada:

```ts
const SYSTEM = `Eres un revisor forense y estricto de fotografía generada
por IA... [checklist completo de categorías a revisar]...
Devuelve SOLO JSON con: score (0-100) y findings[]...`;

const context = { shotId, prompt, objective, references: referenceDescriptions };

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [{
    role: "user",
    parts: [
      { text: `${SYSTEM}\n\nCONTEXTO:\n${JSON.stringify(context, null, 2)}` },
      await imagePart(imageFile), // la imagen generada a evaluar
    ],
  }],
  config: {
    responseMimeType: "application/json", // fuerza que la respuesta sea JSON parseable
    temperature: 0.1,
  },
});
const parsed = JSON.parse(response.text || "{}");
```

`responseMimeType: "application/json"` es clave — sin esto, Gemini a veces
envuelve el JSON en texto explicativo o bloques de markdown ` ```json `, y
hay que limpiarlo a mano. Con esta opción, `response.text` ya es JSON puro.

---

## 3. La memoria (para no re-analizar las mismas imágenes)

No es específico de Vertex, pero es la pieza que hace viable analizar
cientos de referencias sin gastar de más.

### 3.1 Hash de archivo como clave

```ts
import { createHash } from "node:crypto";

function hashFile(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
```

Cada imagen se identifica por el hash de sus bytes, no por su nombre de
archivo — así, si la misma imagen se copia a otra carpeta o se renombra,
sigue reconociéndose como "ya analizada".

### 3.2 Índice persistido en disco

```ts
// REFERENCES/index.json
{
  "e76ed179...": {
    "hash": "e76ed179...",
    "file": "C:\\...\\REFERENCES\\contenido enfocado en outfits\\009a49....jpg",
    "description": "Una mujer joven, de perfil, con cabello rubio largo...",
    "analyzedAt": "2026-07-22T13:40:00.000Z"
  }
}
```

Antes de mandar una imagen a Gemini, se calcula su hash y se busca en este
índice. Si ya existe, se reusa la descripción guardada — **cero llamadas a
Gemini** para imágenes ya vistas. El índice se guarda a disco después de
cada imagen nueva (no al final), para no perder progreso si el proceso se
corta a mitad de camino.

---

## 4. Control de velocidad (lo más importante en la práctica)

Esto fue el mayor dolor de cabeza real al usarlo, documentado acá para no
repetir el error.

### 4.1 El problema: 429 RESOURCE_EXHAUSTED

Una cuenta de servicio **recién creada** en Vertex AI parece arrancar con
una cuota muy baja y/o una tolerancia a ráfagas muy chica. En la práctica:

- Mandar varias llamadas en paralelo (aunque fueran solo 3) chocó con 429
  casi de inmediato.
- Incluso limitando a "3 por minuto" (3 en paralelo + esperar el resto del
  minuto), volvió a chocar después de la primera tanda.
- Lo que sí funcionó de forma estable: **una sola llamada a la vez, con 25
  segundos de espera fija entre cada una.**

### 4.2 El código del limitador

```ts
class RateLimiter {
  constructor(private readonly delayBetweenCallsMs = 25_000) {}

  async runAll<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += 1) {
      results.push(await fn(items[i], i));
      const isLast = i === items.length - 1;
      if (!isLast) await new Promise(resolve => setTimeout(resolve, this.delayBetweenCallsMs));
    }
    return results;
  }
}
```

Nada paralelo, nada de tandas — un `for` secuencial simple con `await` +
`setTimeout` entre cada llamada.

### 4.3 Reintento automático con backoff (por si igual pasa)

```ts
function isRateLimitError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  const message = String((error as Error)?.message ?? "");
  return status === 429 || message.includes("RESOURCE_EXHAUSTED");
}

async function withRetryOn429<T>(fn: () => Promise<T>, maxRetries = 4, baseDelayMs = 30_000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === maxRetries) throw error;
      const waitMs = baseDelayMs * (attempt + 1); // 30s, 60s, 90s, 120s...
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}
```

Se usa envolviendo cada llamada real:

```ts
const descriptor = await withRetryOn429(() => resolveReferenceDescriptor(ai, model, memory, file));
```

Si después de todo esto un 429 persiste, lo más probable es que la cuenta
de servicio necesite un **aumento de cuota explícito** en Google Cloud
Console (IAM & Admin → Cuotas, filtrando por Vertex AI / Generative AI API).

---

## 5. Resumen de lo mínimo para recrear esto en otra herramienta

1. `npm install @google/genai`
2. Crear una cuenta de servicio en Google Cloud con rol `Vertex AI User`,
   descargar su clave JSON.
3. Guardar `GCP_PROJECT_ID` y el JSON completo (`GEMINI_SERVICE_ACCOUNT_KEY`)
   como variables de entorno.
4. Instanciar el cliente:
   ```ts
   const ai = new GoogleGenAI({
     vertexai: true,
     project: process.env.GCP_PROJECT_ID!,
     location: "global",
     googleAuthOptions: { credentials: JSON.parse(process.env.GEMINI_SERVICE_ACCOUNT_KEY!) },
   });
   ```
5. Llamar con `ai.models.generateContent({ model, contents, config })`,
   mandando imágenes como `{ inlineData: { mimeType, data: base64 } }`.
6. **No mandar más de 1 solicitud a la vez** si la cuenta de servicio es
   nueva — esperar ~25s entre llamadas y usar reintento con backoff.
