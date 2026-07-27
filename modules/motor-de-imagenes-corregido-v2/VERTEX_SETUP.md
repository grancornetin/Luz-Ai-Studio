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

## Diseño de seguridad

- La clave JSON queda solo en el equipo/servidor que corre Node.
- El navegador no envía API keys ni puede leer la cuenta de servicio.
- El modelo por defecto es `gemini-2.5-flash`; puedes pasar a `gemini-2.5-pro` con `VERTEX_GEMINI_MODEL` para análisis más profundos y costosos.
- La app preserva la forma de respuestas que usaban los módulos antiguos, para proteger los bancos HPI y de campañas mientras se migra la arquitectura.
