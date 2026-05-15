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
  // Inteligencia visual (opcional — asignado por Gemini si hay familias editoriales)
  visualFamilyId?:   string;    // ID de familia visual de campaign_director_rules.json
  psychologicalGoal?: string;   // objetivo psicológico/comercial de esta pieza
  // Copy adaptado al canal
  titular:     string;           // frase corta, impacto inmediato
  caption:     string;           // texto completo del post
  cta:         string;           // llamado a la acción específico
  hashtags:    string[];         // hashtags estratificados
  // Instrucción de publicación para Sofi
  instruccion: string;           // "Publicá el lunes a las 19hs. No reveles el precio todavía."
  horaRecomendada: string;       // "19:00"
}

// ── Modo visual de campaña ────────────────────────────────────
// "ugc"      → iPhone orgánico, personas reales, luz natural, sin polish
// "editorial"→ fotografía profesional, revista, lookbook, controlado
export type ModoVisual = 'ugc' | 'editorial';

// ── Estilo de texto en imágenes ───────────────────────────────
// "none"     → fotografía pura, sin tipografía
// "minimal"  → una frase corta máx, integrada al diseño con elegancia
// "editorial"→ texto como elemento gráfico fuerte, estilo revista/campaña
export type TextoEnImagenes = 'none' | 'minimal' | 'editorial';

// ── Visual Spine — columna vertebral visual de toda la campaña ─
// Define el mundo visual compartido. Todas las piezas heredan estos valores.
// Se genera en buildCampaignPlan y se fija cuando la usuaria elige la ancla B.
export interface CampaignVisualSpine {
  campaignVisualFamilyId:    string;   // ID de la familia visual maestra
  campaignVisualConcept:     string;   // concepto visual en 1 frase
  campaignLightingRule:      string;   // regla de iluminación para toda la campaña
  campaignEnvironmentRule:   string;   // tipo de entorno / sistema de entornos
  campaignCompositionRule:   string;   // dirección de composición
  campaignColorPaletteRule:  string;   // paleta de color unificada
  campaignDoNotBreakRule:    string;   // lo que NO se puede romper en ninguna pieza
}

// ── Styling Lock — bloqueo de vestuario/estilismo de campaña ──
// Capturado del ancla cuando incluye modelo con outfit visible.
// Se propaga a todas las piezas derivadas para mantener coherencia editorial.
export interface CampaignStylingLock {
  hasVisibleModel:     boolean;  // el ancla incluye modelo con outfit visible
  outfitColorFamily:   string;   // familia de colores del outfit ("neutrales cálidos", "tonos tierra", etc.)
  garmentCategory:     string;   // categoría de la prenda ("falda larga", "pantalón sastre", etc.)
  stylingFormality:    string;   // formalidad ("formal", "smart casual", "casual", "streetwear", etc.)
  silhouetteLogic:     string;   // silueta ("oversized", "fitted", "flowing", "structured", etc.)
  fashionMood:         string;   // mood general ("editorial minimalista", "boho romántico", etc.)
  doNotSwitch:         string;   // lo que NO puede cambiar ("no pants if anchor shows long skirt", etc.)
}

// ── Plan estratégico completo ─────────────────────────────────
export interface CampaignPlan {
  concepto:    string;
  promesa:     string;
  tagline:     string;
  duracionDias: number;
  piezas:      CampaignPiece[];
  hashtagsComunidad: string[];
  hashtagsNicho:     string[];
  hashtagsColarga:   string[];
  resumen:     string;
  // Modo visual — definido cuando la usuaria elige el ancla (A=ugc, B=editorial)
  modoVisual:  ModoVisual;
  // Decisión tipográfica
  textoEnImagenes: TextoEnImagenes;
  estiloTexto?: string;
  // Director creativo — análisis de situación generado en buildCampaignPlan
  clienteIdeal?:    string;  // a quién le hablamos exactamente
  dolorCentral?:    string;  // qué problema resuelve el producto
  moodboardTexto?:  string;  // descripción del mundo visual acordado
  // Visual Spine — columna vertebral visual (asignada por Gemini, confirmada al elegir ancla B)
  visualSpine?: CampaignVisualSpine;
  // Styling Lock — vestuario/estilismo del ancla (asignado por Gemini si hay modelo con outfit)
  stylingLock?: CampaignStylingLock;
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

// ── Campaign Anchor Analysis ──────────────────────────────────
// Extraída de la imagen ancla real elegida por el usuario,
// equivalente al REF0Analysis de ContentStudioPro.
// Se usa para construir el contrato visual con datos reales,
// no con predicciones del planning.
export interface CampaignAnchorAnalysis {
  lighting: {
    primarySource:    string;   // "natural window from left", "golden hour outdoor"
    direction:        string;   // "left to right", "overhead", "frontal"
    colorTemperature: string;   // "warm golden", "cool daylight", "neutral white"
    shadowType:       string;   // "soft diffused", "hard dramatic", "minimal"
    intensity:        string;   // "bright", "moody low-key", "balanced"
    productionLevel:  string;   // "studio controlled", "natural ambient", "UGC casual"
  };
  environment: {
    locationType:     string;   // "studio grey", "outdoor urban", "home interior", "flat lay surface"
    indoorOutdoor:    string;   // "indoor", "outdoor", "mixed"
    backgroundDesc:   string;   // "clean grey gradient", "blurred city street", "white seamless"
    surfaceLanguage:  string;   // "none visible", "marble", "wood", "concrete", "fabric"
    productionTier:   string;   // "high-end editorial", "mid-tier commercial", "UGC authentic"
    propsLevel:       string;   // "minimal", "moderate", "rich"
  };
  styling: {
    hasVisiblePerson: boolean;
    garmentCategory:  string;   // "long skirt", "tailored coat", "casual jeans", "" if no person
    outfitColorFamily:string;   // "black and white", "warm neutrals", "monochrome"
    formalityTier:    string;   // "formal editorial", "smart casual", "casual", "streetwear"
    silhouette:       string;   // "structured refined", "flowing ethereal", "oversized relaxed"
    doNotSwitch:      string;   // "do not switch to activewear or mini dress"
  };
  product: {
    category:         string;   // "boots", "skincare bottle", "handbag", "candle"
    colorFamily:      string;   // "black", "warm beige", "vibrant red"
    materialDesc:     string;   // "leather with metal buckle", "glass bottle", "fabric"
    dominanceLevel:   string;   // "hero — centered and large", "supporting — held by model", "accent"
  };
  composition: {
    shotType:         string;   // "full body", "waist up", "product hero", "detail close-up"
    cameraDistance:   string;   // "wide", "medium", "close-up"
    negativeSpace:    string;   // "generous", "moderate", "minimal"
    visualHierarchy:  string;   // "product first", "model first", "balanced"
    framingStyle:     string;   // "editorial minimal", "editorial rich", "UGC candid"
  };
  mood: {
    emotionalRegister: string;  // "quiet luxury", "aspirational", "authentic relatable", "bold commercial"
    energyLevel:       string;  // "calm and refined", "dynamic energetic", "soft intimate"
    colorPalette:      string;  // "muted earth tones", "high contrast black/white", "warm golden"
    overallMood:       string;  // "premium editorial", "UGC organic", "luxury fashion"
  };
}

// ── Constante de créditos para el ancla ──────────────────────
export const ANCHOR_IMAGE_COUNT  = 2;   // siempre 2 opciones
export const CREDITS_PER_IMAGE   = 2;   // igual que el resto de módulos
