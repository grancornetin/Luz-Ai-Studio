// ── Campaign Module Types ─────────────────────────────────────

// ── Canales de publicación ────────────────────────────────────
export type CampaignChannel =
  | 'instagram_feed'
  | 'instagram_stories'
  | 'tiktok'
  | 'whatsapp'
  | 'facebook_ads';

export const CAMPAIGN_CHANNEL_META: Record<CampaignChannel, { label: string; icon: string; copyHint: string }> = {
  instagram_feed:    { label: 'Instagram Feed',     icon: '📸', copyHint: 'Caption largo con hashtags' },
  instagram_stories: { label: 'Instagram Stories',  icon: '⭕', copyHint: 'Texto corto + CTA directo' },
  tiktok:            { label: 'TikTok',             icon: '🎵', copyHint: 'Hook + descripción breve' },
  whatsapp:          { label: 'WhatsApp / Catálogo', icon: '💬', copyHint: 'Mensaje directo y natural' },
  facebook_ads:      { label: 'Anuncios Facebook',  icon: '📣', copyHint: 'Titular + texto persuasivo' },
};

// ── Slots de imágenes de referencia ──────────────────────────
export type ImageSlotRole = 'product' | 'inspiration' | 'brand' | 'model';

export const IMAGE_SLOT_META: Record<ImageSlotRole, { label: string; description: string; icon: string }> = {
  product:     { label: 'Tu producto',     description: 'Foto de lo que querés promocionar', icon: '📦' },
  inspiration: { label: 'Inspiración',     description: 'Estética o estilo que te gustó',    icon: '🖼️' },
  brand:       { label: 'Tu marca',        description: 'Logo, packaging o colores de marca', icon: '🎨' },
  model:       { label: 'Modelo / Avatar', description: 'Quién protagoniza la campaña',       icon: '👤' },
};

export interface CampaignImageSlot {
  role:  ImageSlotRole;
  base64: string;
}

// ── Pieza individual de campaña ───────────────────────────────
export interface CampaignPiece {
  id:          string;
  dia:         number;
  semana:      number;
  canal:       CampaignChannel;
  rol:         string;           // "Teaser", "Lanzamiento", "Beneficio", "Conversión", etc.
  imagePrompt: string;           // prompt para generar la imagen
  imageUrl:    string;           // resultado generado
  usaTexto?:   boolean;          // true si esta pieza específica debe llevar texto en imagen
  // Copy adaptado al canal
  titular:     string;           // frase corta, impacto inmediato
  caption:     string;           // texto completo del post
  cta:         string;           // llamado a la acción específico
  hashtags:    string[];         // hashtags estratificados
  // Instrucción de publicación para Sofi
  instruccion: string;           // "Publicá el lunes a las 19hs. No reveles el precio todavía."
  horaRecomendada: string;       // "19:00"
}

// ── Estilo de texto en imágenes ───────────────────────────────
// "none"     → fotografía pura, sin tipografía (default cuando la inspiración es UGC/lifestyle)
// "minimal"  → una frase corta máx, integrada al diseño con elegancia
// "editorial"→ texto como elemento gráfico fuerte, estilo revista/campaña
export type TextoEnImagenes = 'none' | 'minimal' | 'editorial';

// ── Plan estratégico completo ─────────────────────────────────
export interface CampaignPlan {
  concepto:    string;   // El hilo conductor creativo
  promesa:     string;   // Qué le promete la campaña al cliente de Sofi
  tagline:     string;   // Frase memorable de la campaña
  duracionDias: number;  // 7
  piezas:      CampaignPiece[];
  // Estrategia de hashtags por capa
  hashtagsComunidad: string[];   // alta competencia, largo plazo
  hashtagsNicho:     string[];   // competencia media
  hashtagsColarga:   string[];   // baja competencia, alta intención
  // Resumen ejecutivo para Sofi
  resumen:     string;           // 2-3 oraciones de qué hacer con esta campaña
  // Decisión tipográfica — tomada por Gemini al analizar la inspiración
  textoEnImagenes: TextoEnImagenes;
  estiloTexto?: string;  // descripción del estilo si textoEnImagenes !== 'none'
                         // ej: "serif blanco bold, centrado, uppercase, fondo oscuro semitransparente"
}

// ── Set guardado en biblioteca ────────────────────────────────
export interface CampaignSet {
  id:        string;
  createdAt: number;
  // Brief
  idea:      string;
  canales:   CampaignChannel[];
  imageCount: number;
  // Slots de referencia (base64)
  slots:     CampaignImageSlot[];
  // Ancla visual — elegida por Sofi en el paso de aprobación
  anchorImage:   string;        // base64 o URL de la imagen ancla elegida
  anchorOptions: string[];      // las 2 opciones generadas (para referencia)
  // Usuario
  userName?: string;            // nombre del usuario para el PDF
  // Plan generado
  plan:      CampaignPlan;
}

// ── Constante de créditos para el ancla ──────────────────────
export const ANCHOR_IMAGE_COUNT  = 2;   // siempre 2 opciones
export const CREDITS_PER_IMAGE   = 2;   // igual que el resto de módulos
