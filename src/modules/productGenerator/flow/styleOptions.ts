// Estilos de foto de producto, con su ejemplo real.
import imgMinimal   from '../../../data/media/estilos de foto producto/minimal.png';
import imgPremium   from '../../../data/media/estilos de foto producto/premium.png';
import imgLifestyle from '../../../data/media/estilos de foto producto/lifestyle.png';
import imgDark      from '../../../data/media/estilos de foto producto/dark.png';
import imgNatural   from '../../../data/media/estilos de foto producto/natural.png';
import type { ProductStyle, ProductObjective } from '../productDirectorService';

export interface StyleOption {
  id: ProductStyle;
  title: string;
  desc: string;
  img: string;
}

export const STYLE_OPTIONS: StyleOption[] = [
  { id: 'natural',   title: 'Natural',     desc: 'Luz suave y materiales reales',       img: imgNatural },
  { id: 'lifestyle', title: 'En uso',      desc: 'Tu producto en un lugar de verdad',   img: imgLifestyle },
  { id: 'premium',   title: 'Premium',     desc: 'Elegante, de alta gama',              img: imgPremium },
  { id: 'minimal',   title: 'Minimalista', desc: 'Fondo limpio, como en tienda',        img: imgMinimal },
  { id: 'dark',      title: 'Oscuro',      desc: 'Dramático y con contraste',           img: imgDark },
];

export const EXAMPLE_IMAGES = [imgNatural, imgPremium, imgDark, imgMinimal];

export const styleTitle = (id: ProductStyle | null | undefined) =>
  STYLE_OPTIONS.find((s) => s.id === id)?.title ?? 'Sin estilo';

// "¿Dónde las vas a usar?" — decide el formato de la foto.
export const USE_OPTIONS: { id: ProductObjective; title: string; hint: string }[] = [
  { id: 'social',    title: 'Instagram',     hint: 'vertical' },
  { id: 'ecommerce', title: 'Tienda online', hint: 'cuadrada' },
  { id: 'ads',       title: 'Anuncios',      hint: 'cuadrada' },
];
