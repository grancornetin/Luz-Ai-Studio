# PUNTO DE RETOMA W57 (Hoy + fábrica + hibernación) — EN CURSO (pausado por límite de uso)

Worktree: luz-piloto-w57-hoy, rama piloto/w57-hoy. Sin push. Commit c3194a5 (+ este).
Imágenes de prueba gastadas: 0 (de 12 permitidas). Ninguna generación real lanzada.

## Hecho (commit c3194a5; `npx tsc --noEmit` solo da los 4 errores base de archivos ignorados; NO verificado: npm run build, ni la lógica)
- src/modules/piloto/contentFactory.ts: fábrica headless. runProductDirector + buildShotPlans + buildPromptPayloadsFromDirectorResult (minimal), refs múltiples (máx 4, lado 1600 px por el tope de 4,5 MB de Vercel), generación con imageApiService, control de visión (/api/gemini/content, acción pilotFidelityCheck, umbral 70, reintento reforzado, si falla 2 veces -> fallback_original), reintento ante bloqueo, BUDGET_LIMIT/402, límite de 2 simultáneas, idempotente y reanudable (checkpoint por opción), pre-generación hoy+2 (3 opciones hoy, 2 los otros días). IO inyectable (FactoryIO).
- pilotData.ts: lee users/{uid}/catalog (SUPUESTO: ruta que W23 debe respetar), marca (brandProfileService) y plan activo.
- hibernate.tsx (HIBERNATE=true; admin ve todo) + cambios mínimos en src/App.tsx (Sidebar + HibernationGuard) y src/components/shared/MobileBottomNav.tsx.
- screens/HoyScreen.tsx y PilotoModule.tsx (rutas /mi-negocio, /marca, /catalogo con import.meta.glob y "Próximamente" si faltan MiMarcaScreen/MiCatalogoScreen).

## A medias / falta
- Prueba simulada de la fábrica (intentada; el script no se llegó a crear): IO falso + prompts reales del director, sin gasto. Casos: camino feliz, idempotencia, fidelidad baja x2, bloqueo, 402, reanudar, recetas no ejecutables, pre-generación y límite de 2.
- Prueba real (<=12 imágenes) con fotos de CIERRE_MVP/insumos/fotos-reales (no subir a git); requiere sesión Firebase; si no, simular y decirlo.
- `npm run build`, revisión en 375/390 px, verificar que Storage permita fetch de las imágenes (CORS) para descargar/compartir.
- Verificar que la acción pilotFidelityCheck de api/gemini/content.ts acepta varias imágenes + generationConfig JSON (se leyó el código, no se probó).
- "Dame otra idea" = nuevas fotos de la misma idea (máx 3), no cambia el texto del plan.

## Cómo retomar
node_modules del worktree es una unión a luz-piloto-w23-marca-catalogo\node_modules (el del repo principal estaba vacío). Correr tsc y build, luego las pruebas de arriba.
