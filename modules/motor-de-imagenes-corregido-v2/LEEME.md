# SeaDream Prompt Studio → motor creativo de Luz IA

Esta herramienta analiza referencias visuales, expresiones, poses y campañas para transformar patrones aprobados en prompts y reglas reutilizables. Su valor está en los bancos HPI, la curación y los esquemas de dirección: no es solo un chat con imágenes.

El proveedor actual es **Gemini 2.5 en Vertex AI**. Las credenciales de la cuenta de servicio permanecen en el servidor local; el navegador nunca guarda una API key.

## Antes de abrirla

1. Crea dentro del proyecto la carpeta `Luz IA secrets`.
2. Copia allí tu credencial con el nombre exacto `vertex-service-account.json`.
3. Sigue [VERTEX_SETUP.md](VERTEX_SETUP.md) si todavía no configuraste Google Cloud.

La ruta se calcula desde la ubicación real del proyecto, por lo que puedes
mover o renombrar la carpeta sin editar el `.bat`. Cuando
`http://localhost:3131/api/provider/status` informe `ready: true`, la aplicación
está preparada.

## Abrir

- Windows: `iniciar.bat`
- macOS/Linux: `sh iniciar.sh`
- HPI: inicia por separado `facial-expression-intelligence/iniciar.bat` o `iniciar.sh` y abre `http://localhost:3133`.

El estudio principal vive en `http://localhost:3131`; Campaign Trainer en `/campaign-trainer.html`.

## Módulos que conviene conservar

- **Prompt Studio:** analiza y convierte referencias en prompts; gestiona lote, biblioteca y banco.
- **Campaign Trainer:** extrae patrones comerciales UGC/editorial y genera familias/reglas de dirección.
- **HPI:** construye familias de expresión, pose, mirada, gesto y performance humana.
- **Combinador:** ensambla el conocimiento curado en variaciones nuevas.

La migración usa un adaptador de compatibilidad, por lo que los formatos que ya alimentan estos módulos no se rompen al cambiar de Claude a Gemini.

## Campaign Trainer v3.7.2 — banco físico, escenas curables y acciones masivas

V3.7 agrega selección por filtros, aprobación/descartado masivo, filtros por
capacidades y un editor completo de identidad, espejo, espacio, luz, estética
y limitaciones. También normaliza nombres existentes y solicita nombres
semánticos cortos en español para análisis nuevos.

V3.7.2 añade el reinicio seguro del banco de escenas generado sin eliminar
análisis, estados de curación, notas ni las familias visuales principales.

Para actualizar una instalación existente, reemplaza:

- `campaign-trainer.html`
- `server.js`
- `vertex-client.js`

Conserva tu `.env`, la cuenta de servicio y los demás archivos del proyecto.
Nunca incluyas credenciales en un ZIP de diagnóstico.

El modo nocturno:

- procesa una imagen a la vez;
- usa 35 segundos como intervalo mínimo recomendado;
- guarda imagen, miniatura, análisis y estado después de cada unidad tanto en IndexedDB como físicamente en disco;
- recupera como pendientes las unidades interrumpidas por una recarga o por cerrar y volver a iniciar el servidor;
- separa la biblioteca permanente de la cola activa;
- conserva en la galería las imágenes retiradas mediante **Limpiar cola**;
- restaura después de F5 solo los elementos que seguían marcados en la cola;
- reintenta errores 429 con backoff hasta 20 veces;
- solicita hasta 24.000 tokens JSON y admite 32.768 en el adaptador;
- aísla solo el subdominio HPI contaminado en vez de perder el análisis entero.

La carpeta se crea automáticamente junto a `server.js`:

```text
campaign-trainer-data/
├── analyses/       # un JSON independiente por imagen
├── images/         # imágenes comprimidas usadas por Gemini
├── thumbnails/     # miniaturas para reconstruir la galería
├── queue/          # estructura reservada para checkpoints de cola
├── logs/           # estructura reservada para respaldos diagnósticos
├── scene-bank.json # banco de escenas y todas sus correcciones manuales
└── manifest.json   # inventario y conteo global
```

No borres ni reemplaces `campaign-trainer-data` al actualizar la herramienta.
Cerrar el `.bat`, el terminal o Chrome no elimina esos archivos. Al volver a abrir
`http://localhost:3131/campaign-trainer.html`, el servidor reconstruye la galería
desde esa carpeta. Una imagen que estaba procesándose vuelve como pendiente.

### Carga recomendada

1. Abre siempre `http://localhost:3131/campaign-trainer.html`.
2. Pulsa **Probar conexión Vertex**.
3. Carga el lote; espera a que termine el mensaje de carga física.
4. Confirma que el contador muestre todas las imágenes antes de iniciar.
5. Para la primera prueba grande, procesa las 300 con una imagen simultánea y 35 segundos.

El botón **Limpiar cola** no borra imágenes, análisis, familias ni reglas. Solo
retira el lote de la pantalla de carga y evita que sus pendientes se ejecuten.
La galería siempre se reconstruye desde la biblioteca física.

Con 35 segundos entre inicios, 300 imágenes requieren como mínimo unas 2 h 55 min
y 1.000 imágenes unas 9 h 43 min, más la duración adicional de respuestas,
reintentos y pausas por 429.

### Seguridad de actualización

- Conserva `.env`, la cuenta de servicio y `campaign-trainer-data`.
- La credencial debe apuntar a la ruta actual de `motor de imagenes`.
- Nunca incluyas `Luz IA secrets` ni el JSON de la cuenta de servicio en un ZIP.

## Banco de escenas

La pestaña **Escenas** consolida localmente los `sceneContribution` de las
imágenes aprobadas. No vuelve a llamar a Gemini.

1. Cura imágenes en Galería y usa `Aprobada` o `Referencia fuerte`.
2. Pulsa **Generar / actualizar desde aprobadas**.
3. Revisa las escenas candidatas, corrige nombre, tipo, prompt y usos.
4. Aprueba o marca como fuerte solo las escenas listas para el Director.
5. Exporta `scene_bank_ugc.json` o genera nuevamente las reglas.

Las referencias fuertes pesan 3× al escoger el prompt y el ancla visual. Las
fusiones, separaciones y correcciones quedan en `campaign-trainer-data/scene-bank.json`
y se conservan al actualizar el banco con nuevas imágenes.
