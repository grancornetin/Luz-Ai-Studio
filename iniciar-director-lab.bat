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
set "PORT=3134"

echo.
echo  Iniciando Director Lab (puerto 3134)...
start "Director Lab (3134)" cmd /k "cd /d "%BACKEND_DIR%" && set GOOGLE_CLOUD_PROJECT=luz-ai-studio&& set GOOGLE_CLOUD_LOCATION=us-central1&& set VERTEX_GEMINI_MODEL=gemini-2.5-flash&& set PORT=3134&& node server.js"

echo  Esperando a que levante...
timeout /t 4 /nobreak >nul

start "" "http://localhost:3134/director-lab.html"

echo.
echo  Director Lab deberia abrirse en tu navegador.
echo  Si ves un error de conexion, espera unos segundos y recarga la pagina.
echo  Para cerrar Director Lab, cerra la ventana de terminal que se abrio.
echo.
