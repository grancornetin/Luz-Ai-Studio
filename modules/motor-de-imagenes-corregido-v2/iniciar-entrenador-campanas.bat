@echo off
setlocal
cd /d "%~dp0"

set "SCRIPT_DIR=%~dp0"

if not defined GOOGLE_CLOUD_PROJECT set "GOOGLE_CLOUD_PROJECT=luz-ai-studio"
if not defined GOOGLE_CLOUD_LOCATION set "GOOGLE_CLOUD_LOCATION=us-central1"
if not defined VERTEX_GEMINI_MODEL set "VERTEX_GEMINI_MODEL=gemini-2.5-flash"
if not defined GOOGLE_APPLICATION_CREDENTIALS set "GOOGLE_APPLICATION_CREDENTIALS=%SCRIPT_DIR%Luz IA secrets\vertex-service-account.json"

if exist "%GOOGLE_APPLICATION_CREDENTIALS%" goto CREDENTIAL_OK

echo.
echo  ERROR: no se encontro vertex-service-account.json
echo  Ruta revisada: %GOOGLE_APPLICATION_CREDENTIALS%
echo.
echo  Copia tu credencial en la carpeta "Luz IA secrets" junto a este archivo.
echo.
pause
exit /b 1

:CREDENTIAL_OK

netstat -ano | findstr "127.0.0.1:3131" | findstr "LISTENING" >nul
if errorlevel 1 goto START_SERVER

echo.
echo  El motor ya esta prendido en otra ventana (puerto 3131 ocupado).
echo  Solo abro la pagina en el navegador, sin abrir un segundo motor.
echo.
start "" "http://localhost:3131/campaign-trainer.html"
echo  Podes cerrar esta ventana.
pause
exit /b 0

:START_SERVER

start "" "http://localhost:3131/campaign-trainer.html"
node server.js
if errorlevel 1 goto SERVER_ERROR
exit /b 0

:SERVER_ERROR
echo.
echo  El motor se detuvo con un error. Mira el detalle arriba.
echo.
pause
