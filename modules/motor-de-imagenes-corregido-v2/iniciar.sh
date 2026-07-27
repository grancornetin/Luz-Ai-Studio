#!/bin/bash
set -e
project_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$project_dir"

export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-luz-ai-studio}"
export GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
export VERTEX_GEMINI_MODEL="${VERTEX_GEMINI_MODEL:-gemini-2.5-flash}"
export GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-$project_dir/Luz IA secrets/vertex-service-account.json}"

if [ ! -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
  echo "ERROR: no se encontró vertex-service-account.json"
  echo "Ruta revisada: $GOOGLE_APPLICATION_CREDENTIALS"
  echo "Copia tu credencial en: $project_dir/Luz IA secrets/vertex-service-account.json"
  exit 1
fi

echo ""
echo " Iniciando SeaDream Prompt Studio..."
echo ""
node server.js
