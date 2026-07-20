import type { GrowthCtaTarget, GrowthFunnelRole } from '../../growthPlannerTypes';

const HOOKS: Record<GrowthCtaTarget, string[]> = {
  'Instagram DM': [
    'Escríbenos PLAN por DM y te recomendamos una opción según tu ritmo de publicación.',
    'Envíanos STARTER por DM y revisamos si 200 créditos te alcanzan.',
    'Mándanos PRO por DM si necesitas contenido para campañas activas.',
  ],
  Comentario: [
    'Comenta PLAN y te recomendamos una opción.',
    'Comenta FOTO si quieres revisar la presentación de tu producto.',
  ],
  'Facebook comentario': [
    'Comenta PLAN y te recomendamos una opción.',
    'Comenta CRÉDITOS y te explicamos qué plan calza con tu ritmo.',
    'Comenta PRO si quieres ver ejemplos para campañas activas.',
  ],
  'DM Facebook': [
    'Envíanos PLAN por mensaje y te recomendamos una opción.',
    'Escríbenos CRÉDITOS por mensaje y revisamos qué plan te conviene.',
  ],
  WhatsApp: [
    'Responde PLAN por WhatsApp y te recomendamos una opción.',
    'Envíanos CRÉDITOS por WhatsApp y revisamos cuántos necesitas.',
  ],
  'Responder story': [
    'Responde esta story con PLAN y te orientamos.',
    'Responde esta story con CRÉDITOS y te explicamos cuántos necesitas.',
    'Responde esta story con FOTO si quieres revisar tu caso.',
  ],
  Guardar: [
    'Guarda este carrusel para comparar las opciones después.',
    'Guarda esta guía antes de elegir tu plan.',
    'Guarda este post si quieres revisar tus opciones con calma.',
  ],
  Link: [
    'Abre el enlace para comparar precios, créditos y usos de cada plan.',
    'Revisa los planes en el enlace y elige según tu ritmo de publicación.',
  ],
  'Link en bio': [
    'Abre el enlace de la bio para comparar precios, créditos y usos de cada plan.',
    'Revisa los planes en el enlace de la bio y elige según tu ritmo de publicación.',
  ],
};

function hash(value: string): number {
  return Array.from(value).reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 7);
}

export function buildHookForCtaTarget(task: {
  id?: string;
  ctaTarget: GrowthCtaTarget;
  funnelRole?: GrowthFunnelRole;
  contentType?: string;
}): string {
  const options = HOOKS[task.ctaTarget];
  return options[hash(`${task.id || ''}-${task.contentType || ''}-${task.funnelRole || ''}`) % options.length];
}
