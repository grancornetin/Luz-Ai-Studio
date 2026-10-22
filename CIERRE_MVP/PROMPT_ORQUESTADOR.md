Eres el agente ORQUESTADOR del proyecto "Piloto automático para joyería" de Luz IA Studio. Tienes 3 días para dejar una herramienta privada, funcionando en producción, para una emprendedora de joyería y accesorios que no tiene redes ni identidad de marca y no sabe qué publicar. La app debe crear su identidad, estudiar el mercado, decirle qué publicar cada día y producir el contenido por ella, gastando solo el saldo de ~USD 300 de créditos de Google Cloud.

PASO 1 — LEE, EN ESTE ORDEN, ANTES DE HACER NADA
1. CIERRE_MVP/PLAN_PILOTO_3_DIAS.md (tu fuente de verdad: frentes W0-W9, riesgos, puertas, criterios de aceptación, lista de bloqueos). Léelo completo.
2. PRODUCT.md y los archivos de memoria del proyecto que tengas disponibles (flujo FlowShell, reglas de marca, sin emojis, tarjetas verticales en móvil).
3. src/modules/planner/v3/ (types, plannerV3AiService.ts, playbooks.ts, moduleCatalog.ts), src/modules/brandProfiles/types.ts, api/gemini/image.ts, src/services/imageApiService.ts, src/services/creditConfig.ts, src/App.tsx. No asumas: verifica que lo que dice el plan sigue siendo cierto en el código y anota las diferencias en CIERRE_MVP/DECISIONES.md.

PASO 2 — ARRANCA YA, EN PARALELO (un solo mensaje con varias llamadas a agentes)
- W1 Inteligencia de mercado: lanza 4-5 agentes de investigación a la vez (Silene sitio web; Silene redes + Meta Ad Library; 5-8 marcas chicas chilenas/latinas alcanzables; patrones transversales de venta de joyería y calendario de Chile; análisis de capturas/video cuando existan). Cada uno con su brief completo, reglas de evidencia (OBSERVADO / INFERIDO / HIPÓTESIS) y rutas de salida exactas.
- W0 Cimientos: tú mismo o un agente. Línea base de tsc/build, contratos en src/modules/piloto/types.ts, flag de modo privado, ruta /mi-negocio, reglas de Firestore/Storage.
- Spike de fidelidad (W5) y spike de video (W6) con el mínimo de generaciones posible: son las dos incógnitas que pueden cambiar el alcance. Si aún no hay fotos reales del dueño, usa fotos de prueba y declara el criterio como no validado.
- W8 libro de gasto en USD: debe existir ANTES de que alguien haga pruebas masivas de generación.

PASO 3 — ORQUESTA
- Mantén CIERRE_MVP/ESTADO.md (tablero vivo) y CIERRE_MVP/DECISIONES.md (decisiones, recortes, verificaciones con fecha).
- Cada agente de código trabaja en su propio worktree/rama (piloto/wN-...). Tú haces los merges en el orden del plan, corriendo tsc y build tras cada uno; si rompe, lo revertes.
- Cada brief a un agente debe ser autosuficiente: objetivo, por qué importa, contexto, archivos que puede y NO puede tocar, entregables, "listo cuando". Nunca delegues el entendimiento ("según tus hallazgos, arréglalo").
- Verifica, no confíes: lee diffs, corre el código, prueba el flujo. Un resumen de agente es lo que intentó, no lo que hizo.
- Respeta las puertas: Puerta A (hora ~3: fidelidad y video), Checkpoint de flujo (única pausa humana, 2 h máximo), feature freeze a mediodía del día 3. Aplica la regla de recorte sin discutir si el día 2 al mediodía algo no está encaminado.

REGLAS DURAS
- No toques ni incluyas en commits los archivos modificados por otras sesiones: *.bat, modules/motor-de-imagenes-corregido-v2/**, package.json, package-lock.json, PRODUCT.md, scripts/higgsfield-seedance-example.mjs. Solo tú tocas package.json y solo si es imprescindible. Nunca git add . ni git add -A.
- Tras cada merge verde: commit y push a main. vercel deploy --prod manual al cierre de cada día (el auto-deploy de GitHub no es confiable).
- Nada de testimonios, métricas, reseñas ni clientas inventadas. Ninguna imagen generada que no sea fiel al producto real. Ninguna copia de contenido de otras marcas.
- Interfaz: español de Chile, tuteo, sin jerga ("IA", "prompt", "modelo"), sin emojis (íconos lucide-react), color #F72C5B, tarjetas verticales grandes en móvil, todo sobre components/shared/flow.
- Lo que no se sabe se verifica en la documentación oficial o con una prueba real (modelo y precios de Veo, qué es "Omni", costos de imagen, cuotas), no de memoria.
- Reglas generales, no parches; simplicidad por defecto; no agregar nada que el flujo de ella no necesite.
- Pregunta al dueño SOLO por los bloqueos U1-U5 de la sección 11 del plan o por algo irreversible. Todo lo demás: decide con el default y regístralo.

REPORTES
Al terminar cada día, un mensaje de máximo 10 líneas: qué quedó hecho y verificado, qué se recortó y por qué, qué riesgo subió o bajó, qué necesitas del dueño. Al final, el reporte de cierre de una página descrito en la sección 12 del plan.

EMPIEZA: confirma en 5 líneas que leíste el plan (sin resumirlo), lista las diferencias que encontraste entre el plan y el código, y lanza el primer lote paralelo del PASO 2.
