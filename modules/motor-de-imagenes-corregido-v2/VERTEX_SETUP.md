# Motor creativo: Gemini 2.5 por Vertex AI

Este proyecto ya no necesita ni acepta claves de Anthropic en el navegador. El servidor obtiene por sí mismo un token temporal OAuth desde la cuenta de servicio y lo usa para Vertex AI.

## Configuración única en Google Cloud

1. En el proyecto de Google Cloud que contiene tus créditos, habilita **Vertex AI API** y verifica que la facturación/créditos estén asociados a ese proyecto.
2. Crea una cuenta de servicio dedicada, por ejemplo `luz-creative-engine`.
3. Dale el mínimo permiso para invocar Gemini: **Vertex AI User** (`roles/aiplatform.user`) en ese proyecto.
4. Crea una clave JSON para esa cuenta y guárdala fuera de este repositorio. Nunca la subas a Git, Drive público o al frontend.

## Configuración recomendada de esta herramienta

Guarda la clave con esta ruta exacta dentro de tu copia local:

```text
motor de imagenes/
└── Luz IA secrets/
    └── vertex-service-account.json
```

Después abre `iniciar.bat`. El lanzador calcula la ruta desde su propia carpeta,
así que no depende de `C:\Users\...\Downloads` ni del directorio desde donde lo
ejecutes.

La carpeta de secretos y cualquier JSON de cuenta de servicio están ignorados
por Git. No los incluyas al compartir o comprimir el proyecto.

## Configuración alternativa mediante variables de entorno

Define estas cuatro variables de entorno antes de iniciar `node server.js`:

```bash
export GOOGLE_CLOUD_PROJECT="tu-project-id"
export GOOGLE_CLOUD_LOCATION="us-central1"
export VERTEX_GEMINI_MODEL="gemini-2.5-flash"
export GOOGLE_APPLICATION_CREDENTIALS="/ruta/segura/vertex-service-account.json"
node server.js
```

En Windows PowerShell usa `$env:NOMBRE="valor"` en la misma sesión antes de
`node server.js`. Una ruta relativa en `GOOGLE_APPLICATION_CREDENTIALS` se
resuelve desde la carpeta del proyecto. Copia `.env.example` como recordatorio,
pero Node no carga archivos `.env` automáticamente.

## Verificar

Abre `http://localhost:3131/api/provider/status`. Debe responder `ready: true`, modelo y región. Luego usa el botón **Probar Vertex** en cada interfaz.

## IMPORTANTE: Firebase (login) y Vertex (créditos IA) son proyectos DISTINTOS

La app en Vercel (luz-ia-studio-1.vercel.app) usa dos proyectos de Google
completamente separados, y NO deben mezclarse al rotar cuentas:

- **Firebase** (login de usuarios + Firestore + `/api/credits`): proyecto
  `gen-lang-client-0895574081` ("Luz Ai Studio" en la consola de Firebase),
  cuenta de Google dueña: **grancornetin@gmail.com**. Su cuenta de servicio
  va en la variable de Vercel `GOOGLE_SERVICE_ACCOUNT_KEY` (usada por
  `initFirebaseAdmin()` en `src/server/api/middleware.ts`). Esta variable
  **no se toca nunca** al rotar créditos de Vertex — solo cambia si se migra
  el proyecto de Firebase (login/base de datos), algo mucho menos frecuente.
- **Vertex AI** (Gemini, motor creativo, créditos que se agotan): proyecto
  rotativo (ver lista abajo, el actual es `luz-creative-engine-2`). Su
  cuenta de servicio va en la variable de Vercel
  `GEMINI_SERVICE_ACCOUNT_KEY` (usada en `api/gemini/content.ts`).

**Bug real ya sufrido (29-sep-2026)**: al rotar los créditos de Vertex se
sobrescribió por error también `GOOGLE_SERVICE_ACCOUNT_KEY` con la cuenta de
servicio de Vertex — eso rompió el login de TODOS los usuarios (401 en
`/api/credits`, `/api/gemini/*`, etc.) porque Firebase Admin dejó de poder
verificar tokens. Antes de tocar `GOOGLE_SERVICE_ACCOUNT_KEY` en Vercel,
confirmar que la clave nueva es de Firebase, no de Vertex — compará el
`project_id` del JSON contra `gen-lang-client-0895574081`.

Al rotar el proyecto de Vertex, **solo tocar `GEMINI_SERVICE_ACCOUNT_KEY` y
`GCP_PROJECT_ID`** en Vercel. `GOOGLE_SERVICE_ACCOUNT_KEY` se deja intacta.

## Cuentas de Google Cloud ya usadas (no repetir)

Estos correos ya se usaron para crear un proyecto de Google Cloud con créditos
gratis de prueba y **ya no califican** para créditos nuevos. Al crear una
cuenta de servicio/proyecto nuevo para Vertex, usar un correo que NO esté en
esta lista:

- bastian.herrera.2a@gmail.com
- grancornetin@gmail.com
- nikolazinho.notaloka@gmail.com
- cosasbasura832@gmail.com
- herrera.importaciones1@gmail.com (cuenta actual, proyecto `luz-creative-engine-2`)

## Diseño de seguridad

- La clave JSON queda solo en el equipo/servidor que corre Node.
- El navegador no envía API keys ni puede leer la cuenta de servicio.
- El modelo por defecto es `gemini-2.5-flash`; puedes pasar a `gemini-2.5-pro` con `VERTEX_GEMINI_MODEL` para análisis más profundos y costosos.
- La app preserva la forma de respuestas que usaban los módulos antiguos, para proteger los bancos HPI y de campañas mientras se migra la arquitectura.
