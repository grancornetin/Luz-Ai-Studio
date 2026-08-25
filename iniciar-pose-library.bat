@echo off
setlocal
cd /d "%~dp0"

set "BACKEND_DIR=%~dp0modules\motor-de-imagenes-corregido-v2\pose-library"

if not exist "%~dp0modules\motor-de-imagenes-corregido-v2\Luz IA secrets\vertex-service-account.json" (
  echo.
  echo  ERROR: no se encontro vertex-service-account.json
  echo  Ruta revisada: "%~dp0modules\motor-de-imagenes-corregido-v2\Luz IA secrets\vertex-service-account.json"
  echo.
  pause
  exit /b 1
)

set "GOOGLE_CLOUD_PROJECT=luz-ai-studio"
set "GOOGLE_CLOUD_LOCATION=us-central1"
set "VERTEX_GEMINI_MODEL=gemini-2.5-flash"
set "POSE_LIBRARY_IMAGE_MODEL=gemini-3.1-flash-image"
set "POSE_LIBRARY_IMAGE_MODEL_FALLBACK=gemini-3-pro-image"
set "PORT=3133"
set "POSE_LIBRARY_DATA_DIR=C:\Users\Nico Trabajo\Downloads\contenido de prueba\pose-library"
set "PHOTODUMP_TRAINER_DATA_DIR=C:\Users\Nico Trabajo\Downloads\contenido de prueba\photodump"

echo.
echo  Iniciando Pose Library (puerto 3133)...
start "Pose Library (3133)" cmd /k "cd /d "%BACKEND_DIR%" && set GOOGLE_CLOUD_PROJECT=luz-ai-studio&& set GOOGLE_CLOUD_LOCATION=us-central1&& set VERTEX_GEMINI_MODEL=gemini-2.5-flash&& set POSE_LIBRARY_IMAGE_MODEL=gemini-3.1-flash-image&& set POSE_LIBRARY_IMAGE_MODEL_FALLBACK=gemini-3-pro-image&& set PORT=3133&& set POSE_LIBRARY_DATA_DIR=C:\Users\Nico Trabajo\Downloads\contenido de prueba\pose-library&& set PHOTODUMP_TRAINER_DATA_DIR=C:\Users\Nico Trabajo\Downloads\contenido de prueba\photodump&& node server.js"

echo  Esperando a que levante...
timeout /t 4 /nobreak >nul

start "" "http://localhost:3133/pose-library.html"

echo.
echo  Pose Library deberia abrirse en tu navegador.
echo  Si ves un error de conexion, espera unos segundos y recarga la pagina.
echo  Puerto 3133 -- independiente de Director Lab (3131) y Entrenador Photodump (3132),
echo  podes tener los tres abiertos al mismo tiempo sin problema.
echo  Para cerrar, cerra la ventana de terminal que se abrio.
echo.
