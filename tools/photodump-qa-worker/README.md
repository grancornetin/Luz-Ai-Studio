# Luz Photodump QA Worker

Primer núcleo autónomo para revisar resultados Photodump sin modificar la aplicación principal.

## Qué hace esta versión

- Vigila permanentemente una carpeta `jobs/`.
- Valida cada `job.json`.
- Analiza cada shot con Gemini y sus referencias visuales.
- Evalúa identidad, cuerpo, cabello, outfit, anatomía, escena, objetos inventados, pose, realismo iPhone, continuidad e historia.
- Genera `reports/report.json` y `reports/report.html`.
- Cambia el marcador `READY` por `DONE` o `REVIEW`.
- Puede quedar ejecutándose con Docker y reiniciarse automáticamente con el PC.

Esta versión **no regenera imágenes ni cambia recetas**. Primero debe calibrarse contra revisiones humanas reales.

## Estructura de un trabajo

```text
jobs/mi-prueba/
├── job.json
├── READY
├── outputs/
│   ├── shot_01.jpg
│   └── shot_02.jpg
└── references/
    ├── face.jpg
    ├── body.jpg
    ├── outfit_final.jpg
    └── home.jpg
```

El archivo `READY` debe estar vacío. Se crea al final, cuando todas las imágenes y el JSON ya fueron copiados.

## Inicio con Docker

1. Instalar Docker Desktop.
2. Copiar `.env.example` como `.env`.
3. Pegar la clave de Gemini en `.env`.
4. Desde esta carpeta ejecutar:

```bash
docker compose up -d --build
```

Para ver actividad:

```bash
docker compose logs -f
```

Para detenerlo:

```bash
docker compose down
```

## Inicio sin Docker

```bash
npm install
GEMINI_API_KEY=tu_clave npm run dev
```

En Windows PowerShell:

```powershell
$env:GEMINI_API_KEY="tu_clave"
npm run dev
```

## Seguridad y límites

- Solo lee imágenes dentro del trabajo.
- Solo escribe dentro de `reports/` y renombra el marcador de estado.
- No toca `main`, producción, Firebase ni Vercel.
- No borra imágenes.
- Procesa los shots en secuencia para controlar consumo y simplificar diagnóstico.

## Próximas piezas

1. Evaluación de continuidad de toda la secuencia en una sola llamada multimodal.
2. Biblioteca de aprobados/rechazados para calibración.
3. Panel dentro de Luz IA Studio.
4. Adaptador de regeneración con presupuesto y máximo de intentos.
5. Propuestas de parches de receta en una rama o PR, nunca directo a producción.
