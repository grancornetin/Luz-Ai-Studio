# PUNTO DE RETOMA W57 (Hoy + fábrica + hibernación) — EN CURSO

Worktree: luz-piloto-w57-hoy, rama piloto/w57-hoy. Sin push.

## Hecho (escrito, tsc verde salvo 4 errores base de archivos ignorados)
- src/modules/piloto/contentFactory.ts (fábrica headless, IO inyectable)
- src/modules/piloto/pilotData.ts (lectura catálogo users/{uid}/catalog, marca, plan)
- src/modules/piloto/hibernate.tsx + cambios mínimos en src/App.tsx y src/components/shared/MobileBottomNav.tsx
- src/modules/piloto/screens/HoyScreen.tsx y rutas en PilotoModule.tsx

## Falta
- Prueba simulada de contentFactory (sin gasto), prueba real <= 12 imágenes, build, revisión móvil 375/390.
- Nota: node_modules del worktree apunta a w23 (el principal estaba vacío).
