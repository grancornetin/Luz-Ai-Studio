// ─────────────────────────────────────────────────────────────────
// MIS MARCAS 2.0 / PLANNER V3 — Guías de captura por red social
//
// QUÉ ES ESTO: las instrucciones exactas que ve la usuaria antes de
// subir capturas de pantalla. Le dicen A QUÉ pantalla de su app ir,
// CÓMO llegar tocando qué botones, y CUÁNTAS capturas tomar (porque
// en el celular una sola captura casi nunca muestra todo — hay que
// hacer scroll y capturar por partes).
//
// SON SOLO TEXTOS: Nico puede editarlos cuando Instagram/TikTok/
// Facebook cambien sus menús, sin tocar ninguna otra parte del código.
// Los nombres de menús pueden variar levemente según la versión de la
// app de cada usuaria; por eso varias instrucciones ofrecen el nombre
// alternativo entre paréntesis.
//
// La UI los renderiza como pasos numerados + lista de capturas
// esperadas, cada una con su propio recuadro de subida.
// ─────────────────────────────────────────────────────────────────

import type { SocialNetworkKey } from '../modules/brandProfiles/types';

export interface ExpectedShot {
  /** Etiqueta corta que aparece sobre el recuadro de subida */
  label: string;
  /** Qué debe verse en esa captura */
  hint: string;
  /** Si es opcional, la UI lo marca como "(opcional)" */
  optional?: boolean;
}

export interface CaptureGuide {
  id: string;
  network: SocialNetworkKey;
  title: string;
  /** Pasos numerados para llegar a la pantalla correcta */
  steps: string[];
  /** Capturas que se esperan (1 recuadro de subida por cada una) */
  expectedShots: ExpectedShot[];
  /** Nota destacada bajo los pasos (amarillo suave) */
  note?: string;
}

// ═══════════════════════════════════════════════════════════════════
// INSTAGRAM
// ═══════════════════════════════════════════════════════════════════

export const IG_PROFILE_GUIDE: CaptureGuide = {
  id: 'instagram_profile',
  network: 'instagram',
  title: 'Tu perfil de Instagram',
  steps: [
    'Abre la app de Instagram en tu celular.',
    'Toca tu foto de perfil abajo a la derecha para ir a tu perfil.',
    'Toma una captura de pantalla donde se vea tu nombre de usuario y tu cantidad de seguidores.',
  ],
  expectedShots: [
    { label: 'Tu perfil', hint: 'Debe verse tu @usuario y tus seguidores' },
  ],
};

export const IG_ACCOUNT_INSIGHTS_GUIDE: CaptureGuide = {
  id: 'instagram_account_insights',
  network: 'instagram',
  title: 'Estadísticas de tu cuenta de Instagram',
  steps: [
    'Abre Instagram y ve a tu perfil.',
    'Toca "Panel profesional" (el botón que aparece bajo tu biografía). Si no lo ves, tu cuenta debe ser Profesional: ve a Configuración → Tipo de cuenta → "Cambiar a cuenta profesional" (es gratis).',
    'Toca "Ver todo" junto a las estadísticas (puede decir "Estadísticas" o "Insights").',
    'Arriba elige el período "Últimos 30 días".',
    'Toma la primera captura: la pantalla inicial donde se ve el Alcance del período.',
    'Toca "Total de seguidores" y baja hasta la sección "Horarios de mayor actividad" (un gráfico de barras por hora). Toma la segunda captura ahí.',
    'Vuelve atrás y entra a "Contenido que compartiste" (o "Interacciones con el contenido"). Toma la tercera captura donde se vea qué publicaciones rindieron mejor.',
  ],
  expectedShots: [
    { label: 'Alcance del período', hint: 'La pantalla inicial de Estadísticas con el número de cuentas alcanzadas' },
    { label: 'Horarios de tu audiencia', hint: 'El gráfico de "Horarios de mayor actividad" dentro de Total de seguidores' },
    { label: 'Tu mejor contenido', hint: 'La lista de publicaciones con más alcance o interacción', optional: true },
  ],
  note: 'En el celular una sola captura no alcanza a mostrar todo: haz scroll y toma una captura por sección. Sube las que tengas — con las dos primeras ya podemos trabajar.',
};

export const IG_POST_INSIGHTS_GUIDE: CaptureGuide = {
  id: 'instagram_post_insights',
  network: 'instagram',
  title: 'Estadísticas de una publicación',
  steps: [
    'Abre Instagram, ve a tu perfil y abre la publicación que quieres registrar.',
    'Toca "Ver estadísticas" (aparece bajo la imagen, a la izquierda). En reels puede estar tras los tres puntos "···" → "Ver estadísticas".',
    'Toma la primera captura de lo que aparece (alcance, me gusta, comentarios).',
    'Desliza el panel hacia arriba para ver el resto (guardados, veces compartido, visitas al perfil) y toma la segunda captura.',
  ],
  expectedShots: [
    { label: 'Parte 1', hint: 'Alcance, me gusta y comentarios' },
    { label: 'Parte 2', hint: 'Guardados, compartidos y visitas al perfil', optional: true },
  ],
  note: 'El panel de estadísticas es más largo que la pantalla: por eso son dos capturas. Si en la tuya sale todo junto, con una basta.',
};

// ═══════════════════════════════════════════════════════════════════
// TIKTOK
// ═══════════════════════════════════════════════════════════════════

export const TT_PROFILE_GUIDE: CaptureGuide = {
  id: 'tiktok_profile',
  network: 'tiktok',
  title: 'Tu perfil de TikTok',
  steps: [
    'Abre la app de TikTok.',
    'Toca "Perfil" abajo a la derecha.',
    'Toma una captura donde se vea tu @usuario y tus seguidores.',
  ],
  expectedShots: [
    { label: 'Tu perfil', hint: 'Debe verse tu @usuario y tus seguidores' },
  ],
};

export const TT_ACCOUNT_INSIGHTS_GUIDE: CaptureGuide = {
  id: 'tiktok_account_insights',
  network: 'tiktok',
  title: 'Estadísticas de tu cuenta de TikTok',
  steps: [
    'Abre TikTok y ve a tu Perfil.',
    'Toca el menú "☰" arriba a la derecha.',
    'Entra a "TikTok Studio" (en algunas versiones: "Herramientas para creadores").',
    'Toca "Estadísticas" (o "Analytics") y elige el período de 28 o 30 días.',
    'Toma la primera captura en la pestaña "Descripción general": visualizaciones de video y alcance.',
    'Pasa a la pestaña "Espectadores" (o "Seguidores") y baja hasta "Horarios más activos". Toma la segunda captura ahí.',
  ],
  expectedShots: [
    { label: 'Descripción general', hint: 'Visualizaciones y alcance del período' },
    { label: 'Horarios de tus espectadores', hint: 'El gráfico de horarios más activos de tu audiencia' },
  ],
  note: 'Si no ves "TikTok Studio", actualiza la app o busca "Herramientas para creadores" dentro de Configuración. Haz scroll en cada pestaña: lo importante suele estar más abajo.',
};

export const TT_POST_INSIGHTS_GUIDE: CaptureGuide = {
  id: 'tiktok_post_insights',
  network: 'tiktok',
  title: 'Estadísticas de un video de TikTok',
  steps: [
    'Abre tu video en TikTok.',
    'Toca los tres puntos "···" (o el botón "Más").',
    'Toca "Estadísticas" (el ícono de gráfico).',
    'Toma la primera captura de lo que aparece (reproducciones, me gusta, comentarios, compartidos).',
    'Desliza hacia arriba para ver retención y espectadores, y toma la segunda captura.',
  ],
  expectedShots: [
    { label: 'Parte 1', hint: 'Reproducciones, me gusta, comentarios, compartidos' },
    { label: 'Parte 2', hint: 'Tiempo de visualización y espectadores nuevos', optional: true },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// FACEBOOK (página de negocio)
// ═══════════════════════════════════════════════════════════════════

export const FB_PROFILE_GUIDE: CaptureGuide = {
  id: 'facebook_profile',
  network: 'facebook',
  title: 'Tu página de Facebook',
  steps: [
    'Abre la app de Facebook.',
    'Toca tu foto de perfil y cambia a tu Página de negocio (si administras una).',
    'Abre la Página y toma una captura donde se vea el nombre de la página y sus seguidores o "Me gusta".',
  ],
  expectedShots: [
    { label: 'Tu página', hint: 'Nombre de la página y seguidores / Me gusta' },
  ],
  note: 'Esto funciona con Páginas de negocio. Los perfiles personales de Facebook no muestran estadísticas.',
};

export const FB_ACCOUNT_INSIGHTS_GUIDE: CaptureGuide = {
  id: 'facebook_account_insights',
  network: 'facebook',
  title: 'Estadísticas de tu página de Facebook',
  steps: [
    'Abre tu Página de Facebook.',
    'Toca "Panel profesional" (bajo la portada de la página).',
    'Entra a "Estadísticas" (o "Insights") y elige el período de 28 o 30 días.',
    'Toma la primera captura del resumen: alcance y visitas de la página.',
    'Baja hasta el rendimiento de tus publicaciones recientes y toma la segunda captura.',
  ],
  expectedShots: [
    { label: 'Resumen de alcance', hint: 'Alcance del período y visitas a la página' },
    { label: 'Tus publicaciones', hint: 'El rendimiento de las publicaciones recientes', optional: true },
  ],
  note: 'Los menús de Facebook cambian seguido de nombre — si algo no calza exacto, busca la palabra "Estadísticas" dentro del Panel profesional.',
};

// ═══════════════════════════════════════════════════════════════════
// Índices para la UI
// ═══════════════════════════════════════════════════════════════════

/** Guías del área "Tus redes" de Mis Marcas, por red */
export const ACCOUNT_GUIDES: Record<SocialNetworkKey, { profile: CaptureGuide; insights: CaptureGuide }> = {
  instagram: { profile: IG_PROFILE_GUIDE, insights: IG_ACCOUNT_INSIGHTS_GUIDE },
  tiktok:    { profile: TT_PROFILE_GUIDE, insights: TT_ACCOUNT_INSIGHTS_GUIDE },
  facebook:  { profile: FB_PROFILE_GUIDE, insights: FB_ACCOUNT_INSIGHTS_GUIDE },
};

/** Guías por publicación (las usa el Cierre de semana del Planner V3).
 *  La clave es la plataforma de la tarea del plan. */
export const POST_GUIDES: Partial<Record<string, CaptureGuide>> = {
  'Instagram Feed': IG_POST_INSIGHTS_GUIDE,
  'Instagram Stories': IG_POST_INSIGHTS_GUIDE,
  'TikTok': TT_POST_INSIGHTS_GUIDE,
  'Facebook': FB_ACCOUNT_INSIGHTS_GUIDE,
};
