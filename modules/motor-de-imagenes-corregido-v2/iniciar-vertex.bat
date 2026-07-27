@echo off
setlocal
cd /d "%~dp0"

if not defined GOOGLE_CLOUD_PROJECT set "GOOGLE_CLOUD_PROJECT=luz-ai-studio"
if not defined GOOGLE_CLOUD_LOCATION set "GOOGLE_CLOUD_LOCATION=us-central1"
if not defined VERTEX_GEMINI_MODEL set "VERTEX_GEMINI_MODEL=gemini-2.5-flash"
if not defined GOOGLE_APPLICATION_CREDENTIALS set "GOOGLE_APPLICATION_CREDENTIALS=%~dp0Luz IA secrets\vertex-service-account.json"

if not exist "%GOOGLE_APPLICATION_CREDENTIALS%" (
  echo.
  echo  ERROR: no se encontro vertex-service-account.json
  echo  Ruta revisada: %GOOGLE_APPLICATION_CREDENTIALS%
  echo.
  echo  Copia tu credencial en:
  echo  "%~dp0Luz IA secrets\vertex-service-account.json"
  echo.
  pause
  exit /b 1
)

start "" "http://localhost:3131"
node server.js
if errorlevel 1 pause
