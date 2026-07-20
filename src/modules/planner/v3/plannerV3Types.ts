// ─────────────────────────────────────────────────────────────────
// PLANNER V3 — Tipos centrales
// Este archivo define el "contrato de datos" de todo el módulo.
// Regla: la UI, el servicio de IA y Firestore usan SOLO estos tipos.
// ─────────────────────────────────────────────────────────────────

// ── Enfoque del mes ──────────────────────────────────────────────

export type PlanGoal = 'sell' | 'grow' | 'launch' | 'maintain';

export const GOAL_LABELS: Record<PlanGoal, string> = {
  sell: 'Vender más',
  grow: 'Ganar seguidores',
  launch: 'Lanzar algo nuevo',
  maintain: 'Mantener presencia',
};

export interface MonthlyFocus {
  goal: PlanGoal;
  /** Producto o servicio que se quiere empujar este mes (texto libre, opcional) */
  focusProduct: string;
  /** Nota libre de la usuaria (ej: "tengo liquidación el día 15") */
  notes: string;
}

// ── Plataformas y formatos ───────────────────────────────────────

export type PlanPlatform =
  | 'Instagram Feed'
  | 'Instagram Stories'
  | 'TikTok'
  | 'Facebook'
  | 'WhatsApp Estados';

export type PlanFormat = 'Reel' | 'Carrusel' | 'Foto' | 'Story' | 'Video';

// ── Embudo de ventas ─────────────────────────────────────────────
// Cada publicación cumple UN rol. Esto evita que la semana sea
// "5 posts de venta" (quema a la audiencia) o "5 posts bonitos"
// (no vende nada).

export type FunnelRole =
  | 'atraer'              // que te descubra gente nueva
  | 'generar_deseo'       // que quieran lo que vendes
  | 'construir_confianza' // que crean que eres la opción correcta
  | 'convertir';          // que compren / escriban / hagan clic

export const FUNNEL_LABELS: Record<FunnelRole, string> = {
  atraer: 'Atraer gente nueva',
  generar_deseo: 'Generar deseo',
  construir_confianza: 'Construir confianza',
  convertir: 'Convertir en ventas',
};

// ── Herramientas de Luz IA ───────────────────────────────────────

export type ToolModule =
  | 'product'    // Product Studio
  | 'ugc'        // UGC Studio
  | 'scene'      // Scene Clone
  | 'outfit'     // Outfit Extractor
  | 'prompt'     // Prompt Studio
  | 'photodump'  // Photodump
  | 'campaign'   // Campaign Generator
  | 'none';      // No requiere generar imagen (ej: story de encuesta)

// ── Métricas reales de una publicación ───────────────────────────
// Se llenan en el "Cierre de semana", ya sea leyendo una captura
// de pantalla con Gemini o escribiéndolas a mano.

export interface PostMetrics {
  reach: number | null;      // alcance / cuentas alcanzadas
  views: number | null;      // reproducciones (reels/videos)
  likes: number | null;
  comments: number | null;
  saves: number | null;      // guardados
  shares: number | null;     // compartidos
  follows: number | null;    // seguimientos ganados desde el post
  profileVisits: number | null;
  source: 'screenshot' | 'manual';
  capturedAt: number;        // Date.now()
}

export const EMPTY_METRICS: Omit<PostMetrics, 'source' | 'capturedAt'> = {
  reach: null,
  views: null,
  likes: null,
  comments: null,
  saves: null,
  shares: null,
  follows: null,
  profileVisits: null,
};

// ── La tarea del plan: el "Contrato de las 7 respuestas" ─────────
// Cada tarea DEBE responder: qué, cuándo, dónde, con qué
// herramienta, por qué, qué esperar y cómo medirlo.

export type TaskStatus = 'pending' | 'done' | 'skipped';

export interface PlanTask {
  id: string;
  date: string;            // ISO "2026-07-21"
  dayLabel: string;        // "Lunes 21 jul"
  status: TaskStatus;

  // QUÉ publicar
  title: string;           // idea en una frase: "Reel antes/después de tus aretes"
  contentType: string;     // "Antes/después", "Carrusel educativo", etc.
  format: PlanFormat;

  // DÓNDE y CUÁNDO
  platform: PlanPlatform;
  suggestedTime: string;   // "19:00"

  // ROL ESTRATÉGICO
  funnelRole: FunnelRole;

  // CON QUÉ HERRAMIENTA de Luz IA
  toolModule: ToolModule;
  toolReason: string;      // por qué esa herramienta y no otra

  // MATERIAL LISTO PARA USAR
  prompt: string;          // prompt listo para pegar en el módulo
  caption: string;         // caption completo con emojis
  hashtags: string;        // "#tag1 #tag2 ..."
  whatToUpload: string[];  // qué subir al módulo
  howToConfigure: string[];// cómo configurar el módulo, paso a paso

  // POR QUÉ este contenido (en lenguaje de emprendedora)
  whyThisContent: string;

  // QUÉ RESULTADO esperar (rango honesto, nunca promesa)
  expectedResult: string;

  // CÓMO MEDIR si funcionó
  howToMeasure: string;    // qué número mirar, dónde y cuándo

  // Consejo para generar interacción
  engagementHook: string;

  // Datos reales (se llenan al cerrar la semana)
  metrics?: PostMetrics;
}

// ── Informe semanal ──────────────────────────────────────────────
// Lo genera Gemini al cerrar la semana, con los datos reales.

export interface WeeklyReport {
  /** Resumen en 2-3 frases, lenguaje simple */
  summary: string;
  /** Qué funcionó bien (con números si los hay) */
  wins: string[];
  /** Qué aprendimos / qué no funcionó */
  learnings: string[];
  /** La mejor publicación de la semana y por qué */
  bestTask: { taskId: string; why: string } | null;
  /** Recomendaciones concretas para la próxima semana */
  recommendations: string[];
  generatedAt: number;
}

// ── Historial compacto para que el plan siguiente aprenda ────────
// Al generar una semana nueva, NO le pasamos a Gemini el plan
// completo anterior (sería carísimo en tokens). Le pasamos esto.

export interface WeekHistorySummary {
  weekNumber: number;
  contentTypes: string[];          // tipos usados (para no repetir)
  completionRate: number;          // 0-1, cuánto publicó realmente
  topPerformer: string | null;     // "Reel antes/después — 2.400 alcance"
  worstPerformer: string | null;
  reportRecommendations: string[]; // recomendaciones del informe
}

// ── El plan de contenido (documento raíz en Firestore) ───────────
// Colección: /users/{uid}/contentPlans/{planId}

export type PlanStatus = 'active' | 'closed';

export interface ContentPlan {
  id: string;
  createdAt: number;
  updatedAt: number;

  // Vínculo con Mis Marcas
  brandId: string;
  brandName: string;       // desnormalizado para mostrar sin cargar la marca

  monthlyFocus: MonthlyFocus;
  weekNumber: number;      // 1, 2, 3... dentro de este enfoque
  frequency: 3 | 5 | 7;
  platforms: PlanPlatform[];

  status: PlanStatus;

  /** Explicación del arco de la semana, en lenguaje simple.
   *  Se muestra arriba del plan: "¿Por qué este plan funciona?" */
  strategySummary: string;

  tasks: PlanTask[];

  /** Se llena al cerrar la semana */
  weeklyReport?: WeeklyReport;

  /** Resumen de esta semana para alimentar la siguiente */
  historySummary?: WeekHistorySummary;

  /** Referencia al plan anterior de la cadena (si existe) */
  previousPlanId?: string;
}

// ── Respuesta cruda de Gemini al generar un plan ─────────────────
// (antes de agregar ids, fechas de respaldo y estados)

export interface RawPlanResponse {
  strategySummary: string;
  tasks: Array<Omit<PlanTask, 'id' | 'status' | 'metrics'>>;
}
