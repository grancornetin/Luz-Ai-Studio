@echo off
setlocal
cd /d "%~dp0"

set "BACKEND_DIR=%~dp0modules\motor-de-imagenes-corregido-v2"

if not exist "%BACKEND_DIR%\Luz IA secrets\vertex-service-account.json" (
  echo.
  echo  ERROR: no se encontro vertex-service-account.json
  echo  Ruta revisada: "%BACKEND_DIR%\Luz IA secrets\vertex-service-account.json"
  echo.
  pause
  exit /b 1
)

set "GOOGLE_CLOUD_PROJECT=luz-ai-studio"
set "GOOGLE_CLOUD_LOCATION=us-central1"
set "VERTEX_GEMINI_MODEL=gemini-2.5-flash"
set "PORT=3132"
set "PHOTODUMP_TRAINER_DATA_DIR=C:\Users\Nico Trabajo\Downloads\contenido de prueba\photodump"

echo.
echo  Iniciando Entrenador Photodump (puerto 3132)...
start "Entrenador Photodump (3132)" cmd /k "cd /d "%BACKEND_DIR%" && set GOOGLE_CLOUD_PROJECT=luz-ai-studio&& set GOOGLE_CLOUD_LOCATION=us-central1&& set VERTEX_GEMINI_MODEL=gemini-2.5-flash&& set PORT=3132&& set PHOTODUMP_TRAINER_DATA_DIR=C:\Users\Nico Trabajo\Downloads\contenido de prueba\photodump&& node server.js"

echo  Esperando a que levante...
timeout /t 4 /nobreak >nul

start "" "http://localhost:3132/photodump-trainer.html"

echo.
echo  El Entrenador Photodump deberia abrirse en tu navegador.
echo  Si ves un error de conexion, espera unos segundos y recarga la pagina.
echo  Ahora tiene su propio puerto (3132) -- podes tener Director Lab (3131) abierto al mismo tiempo sin problema.
echo  Para cerrar, cerra la ventana de terminal que se abrio.
echo.
