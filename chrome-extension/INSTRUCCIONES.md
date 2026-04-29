# LUZ IA — Facebook Prompt Extractor

## Instalación (solo tú, modo developer)

1. Abre Chrome → `chrome://extensions/`
2. Activa **"Modo desarrollador"** (toggle arriba a la derecha)
3. Clic en **"Cargar descomprimida"**
4. Selecciona la carpeta `chrome-extension/`
5. Listo — aparece el ícono en la barra de Chrome

> Nota: necesitas un archivo `icon.png` (48×48px) en esta carpeta.
> Puedes usar cualquier imagen pequeña renombrada a icon.png.

---

## Cómo usar

1. Ve a Facebook → tu colección de guardados
2. Abre un post → haz clic en la primera imagen (se abre en el viewer)
3. Clic en el ícono de la extensión → **"Capturar imagen actual"**
4. Navega a la siguiente imagen con la flecha → captura otra vez
5. Repite hasta terminar todas las imágenes de todos los posts
6. Clic en **"Descargar facebook-raw.json"**

---

## Procesar los prompts

```bash
# Básico
node scripts/processFacebookPosts.js

# Con limpieza automática por Gemini (necesita GEMINI_API_KEY en .env.local)
node scripts/processFacebookPosts.js --gemini

# Con archivo de entrada/salida personalizado
node scripts/processFacebookPosts.js --input=facebook-raw.json --output=prepared-prompts.json
```

Luego envía el batch desde el panel de admin como siempre.
