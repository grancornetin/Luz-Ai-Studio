/**
 * PDStep2Receta.tsx — Paso 2 modo recetas
 * Brief · Referencias dinámicas según la receta elegida
 */
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, User, Package, Shirt, Layers, AlertCircle, AtSign, Star } from 'lucide-react';
import { ImageSlot } from '../../components/shared/ImageSlot';
import {
  PhotodumpRecipe, PhotodumpRefs, PhotodumpOutfitMode, HaulRefKind, MultiLookIntent,
  RECIPE_META, isRefRequired,
} from './types';
import { SLOT_CATALOG, buildTag } from './slotCatalog';
import HaulReferenceTypeSelector from './HaulReferenceTypeSelector';

// Colores por slot
const SLOT_STYLE = {
  avatar:         { label: 'text-indigo-600',  border: 'border-indigo-200',  bg: 'bg-indigo-50/40',  dot: 'bg-indigo-500'  },
  outfit:         { label: 'text-purple-600',  border: 'border-purple-200',  bg: 'bg-purple-50/30',  dot: 'bg-purple-500'  },
  accesorios:     { label: 'text-pink-600',    border: 'border-pink-200',    bg: 'bg-pink-50/30',    dot: 'bg-pink-500'    },
  producto:       { label: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50/30', dot: 'bg-emerald-500' },
  empaque:        { label: 'text-amber-600',   border: 'border-amber-200',   bg: 'bg-amber-50/30',   dot: 'bg-amber-500'   },
  escena:         { label: 'text-blue-600',    border: 'border-blue-200',    bg: 'bg-blue-50/30',    dot: 'bg-blue-500'    },
  escena_prueba:  { label: 'text-cyan-600',    border: 'border-cyan-200',    bg: 'bg-cyan-50/30',    dot: 'bg-cyan-500'    },
  escena_destino: { label: 'text-violet-600',  border: 'border-violet-200',  bg: 'bg-violet-50/30',  dot: 'bg-violet-500'  },
} as const;

const SLOT_ICON = {
  avatar:         <User    size={13} strokeWidth={2} />,
  outfit:         <Shirt   size={13} strokeWidth={2} />,
  accesorios:     <Star    size={13} strokeWidth={2} />,
  producto:       <Package size={13} strokeWidth={2} />,
  empaque:        <Package size={13} strokeWidth={2} />,
  escena:         <Layers  size={13} strokeWidth={2} />,
  escena_prueba:  <Layers  size={13} strokeWidth={2} />,
  escena_destino: <Layers  size={13} strokeWidth={2} />,
} as const;

const SLOT_LABEL: Record<string, string> = {
  avatar:         'Persona',
  outfit:         'Prendas / Look',
  accesorios:     'Accesorios',
  producto:       'Producto',
  empaque:        'Empaque',
  escena:         'Escena',
  escena_prueba:  'Escena de prueba',
  escena_destino: 'Escena destino',
};

interface PDStep2RecetaProps {
  recipe:      PhotodumpRecipe;
  count:       number;
  basePrompt:  string;
  refs:        PhotodumpRefs;
  outfitMode:  PhotodumpOutfitMode;
  onCount:     (n: number) => void;
  onPrompt:    (v: string) => void;
  onRefs:      (r: PhotodumpRefs) => void;
  onOutfitMode:(m: PhotodumpOutfitMode) => void;
}

const MIN_COUNT = 3;
const MAX_COUNT = 20;
const OUTFIT_CHECK_MAX_COUNT = 8;

const PDStep2Receta: React.FC<PDStep2RecetaProps> = ({
  recipe, count, basePrompt, refs, outfitMode, onCount, onPrompt, onRefs, onOutfitMode,
}) => {
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toggle = (key: string) => setOpenSlot(p => p === key ? null : key);

  const isOutfitRecipe = recipe === 'outfit_check' || recipe === 'outfit_haul' || recipe === 'outfit_week';
  const maxCount = recipe === 'outfit_check' ? OUTFIT_CHECK_MAX_COUNT : MAX_COUNT;

  // outfit_multi_look: el TOPE de fotos lo define la cantidad de looks
  // subidos (ver recipes/outfitMultiLook/allocator.ts, que nunca genera más
  // shots que looks disponibles) — weekly/then_vs_now/trip_recap: 1 shot por
  // look. curated_ideas: 2 shots por look (frontal + variación de ángulo,
  // ver contracts.ts). Dentro de ese tope, el usuario SÍ puede elegir pedir
  // menos fotos (ej. generar solo 3 de 5 looks cargados) — no se fuerza un
  // valor fijo, solo se corrige automáticamente si count queda fuera de
  // rango (0, o por encima del máximo posible).
  const multiLookLookCount = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean).length;
  const multiLookShotsPerLook = refs.multiLookIntent === 'curated_ideas' ? 2 : 1;
  const multiLookMaxCount = multiLookLookCount * multiLookShotsPerLook;
  useEffect(() => {
    if (recipe !== 'outfit_multi_look' || multiLookMaxCount === 0) return;
    if (count > multiLookMaxCount || count === 0) {
      onCount(multiLookMaxCount);
    }
  }, [recipe, multiLookMaxCount, count, onCount]);

  // outfit_reveal_basic: siempre son los mismos 3 shots fijos (mirror check,
  // POV, close-up), sin importar cuántas prendas se suban — no hay selector
  // de cantidad para esta receta.
  const REVEAL_BASIC_SHOT_COUNT = 3;
  useEffect(() => {
    if (recipe === 'outfit_reveal_basic' && count !== REVEAL_BASIC_SHOT_COUNT) {
      onCount(REVEAL_BASIC_SHOT_COUNT);
    }
  }, [recipe, count, onCount]);

  // outfit_night_out: cantidad fija por nivel elegido (Corto=3, Completo=5,
  // Extendido=7) — no hay selector +/- libre, ver recipes/outfitNightOut/levelResolver.ts.
  const NIGHT_OUT_COUNT_BY_LEVEL: Record<'corto' | 'completo' | 'extendido', number> = {
    corto: 3, completo: 5, extendido: 7,
  };
  const nightOutLevel = refs.nightOutLevel ?? 'corto';
  useEffect(() => {
    if (recipe !== 'outfit_night_out') return;
    const target = NIGHT_OUT_COUNT_BY_LEVEL[nightOutLevel];
    if (count !== target) onCount(target);
  }, [recipe, nightOutLevel, count, onCount]);

  // Insertar @tag en la posición del cursor del textarea
  const insertTag = (tag: string) => {
    const el = textareaRef.current;
    if (!el) { onPrompt(basePrompt + tag + ' '); return; }
    const start = el.selectionStart ?? basePrompt.length;
    const end   = el.selectionEnd   ?? basePrompt.length;
    const before = basePrompt.slice(0, start);
    const after  = basePrompt.slice(end);
    const needsSpace = before.length > 0 && !before.endsWith(' ');
    const newVal = (needsSpace ? before + ' ' : before) + tag + ' ' + after;
    onPrompt(newVal);
    setTimeout(() => {
      el.focus();
      const pos = (needsSpace ? start + 1 : start) + tag.length + 1;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const meta    = RECIPE_META[recipe];
  const refKeys = (Object.keys(meta.refs) as (keyof typeof meta.refs)[])
    .filter(k => meta.refs[k] !== 'none');

  // ── Sistema de tags: qué tags existen y cuáles están activos en el brief ──

  // Todos los tags posibles, cada uno con su slot-key e índice para iluminar el slot
  interface TagDef {
    tag:     string;
    label:   string;
    color:   string;
    slotKey: string;
    slotIdx: number;
    preview: string | null;
  }

  const allTagDefs: TagDef[] = [];

  // Helper para construir el color de chip desde el catálogo
  const chipColor = (cat: typeof SLOT_CATALOG[keyof typeof SLOT_CATALOG]) =>
    `${cat.color.text} ${cat.color.bg} ${cat.color.border}`;

  // @persona / @cuerpo
  if (refs.avatarRef) allTagDefs.push({
    tag: buildTag('persona', 1), label: 'persona', slotKey: 'avatar', slotIdx: 0,
    preview: refs.avatarRef, color: chipColor(SLOT_CATALOG.persona),
  });
  if (refs.bodyRef) allTagDefs.push({
    tag: '@cuerpo', label: 'cuerpo', slotKey: 'avatar', slotIdx: 1,
    preview: refs.bodyRef, color: chipColor(SLOT_CATALOG.persona),
  });

  // @outfit1, @outfit2… (siempre numerados — el catálogo dicta la convención)
  const outfitAll = [refs.outfitRef, ...(refs.outfitRefs ?? [])];
  outfitAll.forEach((r, i) => {
    if (!r) return;
    allTagDefs.push({
      tag: buildTag('outfit', i + 1), label: `outfit ${i + 1}`,
      slotKey: 'outfit', slotIdx: i, preview: r,
      color: chipColor(SLOT_CATALOG.outfit),
    });
  });

  // @accesorio1, @accesorio2…
  (refs.accesorioRefs ?? []).forEach((r, i) => {
    if (!r) return;
    allTagDefs.push({
      tag: buildTag('accesorio', i + 1), label: `accesorio ${i + 1}`,
      slotKey: 'accesorios', slotIdx: i, preview: r,
      color: chipColor(SLOT_CATALOG.accesorio),
    });
  });

  // @producto1, @producto2…
  const productoAll = [refs.productRef, ...(refs.productRefs ?? [])];
  productoAll.forEach((r, i) => {
    if (!r) return;
    allTagDefs.push({
      tag: buildTag('producto', i + 1), label: `producto ${i + 1}`,
      slotKey: 'producto', slotIdx: i, preview: r,
      color: chipColor(SLOT_CATALOG.producto),
    });
  });

  // @packaging1
  const packagingAll = [refs.packagingRef, ...(refs.packagingRefs ?? [])];
  packagingAll.forEach((r, i) => {
    if (!r) return;
    allTagDefs.push({
      tag: buildTag('packaging', i + 1), label: `packaging ${i + 1}`,
      slotKey: 'empaque', slotIdx: i, preview: r,
      color: chipColor(SLOT_CATALOG.packaging),
    });
  });

  // @escena1 / @escena_prueba / @escena_destino
  const escenaAll = [refs.sceneRef, ...(refs.sceneRefs ?? [])];
  escenaAll.forEach((r, i) => {
    if (!r) return;
    allTagDefs.push({
      tag: buildTag('escena', i + 1), label: `escena ${i + 1}`,
      slotKey: 'escena', slotIdx: i, preview: r,
      color: chipColor(SLOT_CATALOG.escena),
    });
  });
  if (refs.scenePruebaRef) allTagDefs.push({
    tag: '@escena_prueba', label: 'escena prueba', slotKey: 'escena_prueba', slotIdx: 0,
    preview: refs.scenePruebaRef, color: chipColor(SLOT_CATALOG.escena),
  });
  if (refs.sceneDestinoRef) allTagDefs.push({
    tag: '@escena_destino', label: 'escena destino', slotKey: 'escena_destino', slotIdx: 0,
    preview: refs.sceneDestinoRef, color: chipColor(SLOT_CATALOG.escena),
  });

  // Tags activos (mencionados en el brief)
  const tagsInBrief = new Set(
    (basePrompt.match(/@[a-záéíóúüñA-ZÁÉÍÓÚÜÑ_]+\d*/g) ?? []).map(t => t.toLowerCase())
  );
  const isTagActive = (tag: string) => tagsInBrief.has(tag.toLowerCase());

  // Para cada slot, qué tags están activos (para iluminar el borde del acordeón)
  const isSlotTagged = (slotKey: string): boolean =>
    allTagDefs.some(td => td.slotKey === slotKey && isTagActive(td.tag));

  // Tags para insertar (chips bajo el brief) — solo los que existen (tienen imagen)
  const availableTags = allTagDefs;

  // ── Helpers para leer/escribir refs por slot key ─────────────
  const getSlotImages = (key: string): (string | null)[] => {
    if (key === 'avatar')         return [refs.avatarRef, refs.bodyRef ?? null].filter((_, i) => i === 0 || refs.bodyRef !== undefined) as (string | null)[];
    if (key === 'outfit')         return [refs.outfitRef, ...(refs.outfitRefs ?? [])];
    if (key === 'accesorios') {
      const slots = recipe === 'outfit_haul' ? 5 : recipe === 'outfit_week' ? 4 : 3;
      return [...(refs.accesorioRefs ?? Array(slots).fill(null))];
    }
    if (key === 'producto')       return [refs.productRef, ...(refs.productRefs ?? [])];
    if (key === 'empaque')        return [refs.packagingRef ?? null, ...(refs.packagingRefs ?? [])];
    if (key === 'escena')         return [refs.sceneRef, ...(refs.sceneRefs ?? [])];
    if (key === 'escena_prueba')  return [refs.scenePruebaRef ?? null];
    if (key === 'escena_destino') return [refs.sceneDestinoRef ?? null];
    return [];
  };

  const getSlotMax = (key: string): number => {
    if (key === 'avatar')         return 2;
    if (key === 'outfit') {
      if (recipe === 'outfit_haul') return 10; // hasta 10 prendas (MAX_REFS - avatar slots)
      if (recipe === 'outfit_week' || recipe === 'outfit_multi_look') return 7;  // hasta 7 outfits/looks
      return 4;                                // outfit_check: hasta 4 prendas del mismo look
    }
    if (key === 'accesorios')     return recipe === 'outfit_haul' ? 5 : recipe === 'outfit_week' ? 4 : 3;
    if (key === 'producto')       return recipe === 'product_haul' ? 10 : 3;
    if (key === 'empaque')        return 3;
    if (key === 'escena') {
      // trip_recap: 1 escena por look (mismo tope que el slot de outfit),
      // no el tope genérico de 3 — cada look necesita su propia foto de lugar.
      if (recipe === 'outfit_multi_look' && refs.multiLookIntent === 'trip_recap') return getSlotMax('outfit');
      return 3;
    }
    if (key === 'escena_prueba')  return 1;
    if (key === 'escena_destino') return 1;
    return 1;
  };

  const handleSlotChange = (key: string, index: number, value: string | null) => {
    if (key === 'avatar') {
      if (index === 0) onRefs({ ...refs, avatarRef: value });
      else             onRefs({ ...refs, bodyRef: value });
      return;
    }
    if (key === 'outfit') {
      if (index === 0) {
        onRefs({ ...refs, outfitRef: value, outfitMode: value ? 'upload' : 'generate' });
      } else {
        const maxExtra = getSlotMax('outfit') - 1;
        const arr = [...(refs.outfitRefs ?? Array(maxExtra).fill(null))];
        arr[index - 1] = value;
        onRefs({ ...refs, outfitRefs: arr });
      }
      return;
    }
    if (key === 'accesorios') {
      const slots = recipe === 'outfit_haul' ? 5 : recipe === 'outfit_week' ? 4 : 3;
      const arr = [...(refs.accesorioRefs ?? Array(slots).fill(null))];
      arr[index] = value;
      // Si se borra la imagen, también limpiar el checkbox de closeup
      const closeups = [...(refs.accesorioCloseup ?? Array(slots).fill(false))];
      if (!value) closeups[index] = false;
      onRefs({ ...refs, accesorioRefs: arr, accesorioCloseup: closeups });
      return;
    }
    if (key === 'producto') {
      if (index === 0) {
        onRefs({ ...refs, productRef: value });
      } else {
        const arr = [...(refs.productRefs ?? [null, null])];
        arr[index - 1] = value;
        onRefs({ ...refs, productRefs: arr });
      }
      return;
    }
    if (key === 'empaque') {
      if (index === 0) {
        onRefs({ ...refs, packagingRef: value });
      } else {
        const arr = [...(refs.packagingRefs ?? [null, null])];
        arr[index - 1] = value;
        onRefs({ ...refs, packagingRefs: arr });
      }
      return;
    }
    if (key === 'escena') {
      if (index === 0) {
        onRefs({ ...refs, sceneRef: value });
      } else {
        const arr = [...(refs.sceneRefs ?? [null, null])];
        arr[index - 1] = value;
        onRefs({ ...refs, sceneRefs: arr });
      }
      return;
    }
    if (key === 'escena_prueba') {
      onRefs({ ...refs, scenePruebaRef: value });
      return;
    }
    if (key === 'escena_destino') {
      onRefs({ ...refs, sceneDestinoRef: value });
    }
  };

  // ── Handlers de outfit_multi_look ─────────────────────────────
  const MULTI_LOOK_INTENT_OPTIONS: { value: MultiLookIntent; label: string; hint: string }[] = [
    { value: 'weekly',        label: 'Mi semana en looks',      hint: 'Muestra varios looks, uno por día, sin elegir uno como el mejor.' },
    { value: 'then_vs_now',   label: 'Antes vs. ahora',         hint: 'Marcá qué look es "antes" y cuál es "ahora" — el segundo se ve con más onda.' },
    { value: 'trip_recap',    label: 'Los looks de mi viaje',   hint: 'Cada foto en un lugar distinto — subí una foto real de cada lugar.' },
    { value: 'curated_ideas', label: 'Ideas para una ocasión',  hint: 'Varias opciones del mismo estilo — ej. "3 vestidos para invitada a boda".' },
  ];

  const handleMultiLookIntentChange = (intent: MultiLookIntent) => {
    onRefs({ ...refs, multiLookIntent: intent });
  };

  const handleMultiLookEraChange = (slotIndex: number, era: 'before' | 'after' | null) => {
    const max = getSlotMax('outfit');
    const arr = [...(refs.multiLookEras ?? Array(max).fill(null))];
    arr[slotIndex] = era;
    onRefs({ ...refs, multiLookEras: arr });
  };

  // ── Handlers de outfit_night_out ────────────────────────────────
  const NIGHT_OUT_LEVEL_OPTIONS: { value: 'una_foto' | 'corto' | 'completo' | 'extendido'; label: string; hint: string }[] = [
    { value: 'una_foto',  label: 'Una foto (1 foto)',   hint: 'Una sola imagen que cuenta toda la historia — sin mirror check, sin secuencia.' },
    { value: 'corto',     label: 'Corto (3 fotos)',     hint: 'Mirror check y 2 momentos de la noche.' },
    { value: 'completo',  label: 'Completo (5 fotos)',  hint: '+ un detalle de cómo armaste el look, y 3 momentos de la noche.' },
    { value: 'extendido', label: 'Extendido (7 fotos)', hint: 'Mirror check y 6 momentos de la noche — la experiencia completa, sin volver a la preparación.' },
  ];

  const handleNightOutLevelChange = (level: 'una_foto' | 'corto' | 'completo' | 'extendido') => {
    onRefs({ ...refs, nightOutLevel: level });
  };

  // trip_recap: el lugar de cada look ya no es texto — se sube como foto
  // real en el slot "Escena" (misma posición que el outfit correspondiente,
  // ver manifest.ts). No hace falta un handler propio acá, se usa el
  // handleSlotChange('escena', ...) genérico que ya existe más abajo.

  const handleCloseupToggle = (accIndex: number) => {
    const slots = recipe === 'outfit_haul' ? 5 : recipe === 'outfit_week' ? 4 : 3;
    const closeups = [...(refs.accesorioCloseup ?? Array(slots).fill(false))];
    closeups[accIndex] = !closeups[accIndex];
    onRefs({ ...refs, accesorioCloseup: closeups });
  };

  // ── curated_ideas: pool de calzado/accesorios con enlace many-to-many ──
  const MAX_CURATED_ACCESSORIES = 5;
  const curatedAccessoryRefs  = refs.curatedIdeasAccessoryRefs  ?? [];
  const curatedAccessoryLinks = refs.curatedIdeasAccessoryLinks ?? [];
  const curatedLookIds = [refs.outfitRef, ...(refs.outfitRefs ?? [])]
    .map((url, i) => (url ? { id: `look_${i}`, label: `Look ${i + 1}` } : null))
    .filter((l): l is { id: string; label: string } => l !== null)
    // Los ids deben re-indexarse igual que buildMultiLookManifest (solo cuenta looks con imagen)
    .map((l, i) => ({ id: `look_${i}`, label: l.label }));

  const handleCuratedAccessoryChange = (accIndex: number, value: string | null) => {
    const arr = [...curatedAccessoryRefs];
    while (arr.length <= accIndex) arr.push(null);
    arr[accIndex] = value;
    const links = [...curatedAccessoryLinks];
    while (links.length <= accIndex) links.push(null);
    if (!value) links[accIndex] = null;
    onRefs({ ...refs, curatedIdeasAccessoryRefs: arr, curatedIdeasAccessoryLinks: links });
  };

  const handleCuratedAccessoryLinkToggle = (accIndex: number, lookId: string) => {
    const links = [...curatedAccessoryLinks];
    while (links.length <= accIndex) links.push(null);
    const current = links[accIndex] ?? [];
    links[accIndex] = current.includes(lookId)
      ? current.filter(id => id !== lookId)
      : [...current, lookId];
    onRefs({ ...refs, curatedIdeasAccessoryLinks: links });
  };

  const curatedAccessoriesFilledCount = curatedAccessoryRefs.filter(Boolean).length;
  const [curatedAccessoriesEnabled, setCuratedAccessoriesEnabled] = useState(curatedAccessoriesFilledCount > 0);

  // ── Handlers de tipo de referencia Haul ───────────────────────
  const handleOutfitKindChange = (slotIndex: number, kind: HaulRefKind) => {
    const max = getSlotMax('outfit');
    const arr = [...(refs.haulOutfitKinds ?? Array(max).fill('auto' as HaulRefKind))];
    arr[slotIndex] = kind;
    onRefs({ ...refs, haulOutfitKinds: arr });
  };

  const handleAccKindChange = (accIndex: number, kind: HaulRefKind) => {
    const max = recipe === 'outfit_haul' ? 5 : 3;
    const arr = [...(refs.haulAccKinds ?? Array(max).fill('auto' as HaulRefKind))];
    arr[accIndex] = kind;
    onRefs({ ...refs, haulAccKinds: arr });
  };

  const getOutfitKind = (i: number): HaulRefKind =>
    (refs.haulOutfitKinds ?? [])[i] ?? 'auto';

  const getAccKind = (i: number): HaulRefKind =>
    (refs.haulAccKinds ?? [])[i] ?? 'auto';

  const handleProductKindChange = (slotIndex: number, kind: HaulRefKind) => {
    const max = getSlotMax('producto');
    const arr = [...(refs.haulProductKinds ?? Array(max).fill('auto' as HaulRefKind))];
    arr[slotIndex] = kind;
    onRefs({ ...refs, haulProductKinds: arr });
  };

  const getProductKind = (i: number): HaulRefKind =>
    (refs.haulProductKinds ?? [])[i] ?? 'auto';

  const getSlotFilled = (key: string): number =>
    getSlotImages(key).filter(Boolean).length;

  // Slots de crecimiento progresivo: outfit/accesorios/producto arrancan mostrando 1
  // casillero y agregan uno más automáticamente cada vez que se llena el último — en vez
  // de precargar todos los casilleros vacíos de entrada (7 outfits, 4 accesorios, etc.
  // en Weekly Favorites eran abrumadores). avatar/empaque/escena NO usan esta lógica —
  // siguen con su cantidad fija de siempre.
  const PROGRESSIVE_SLOT_KEYS = new Set(['outfit', 'accesorios', 'producto']);
  const getSlotVisibleCount = (key: string): number => {
    const max = getSlotMax(key);
    if (!PROGRESSIVE_SLOT_KEYS.has(key)) return max;
    const images = getSlotImages(key);
    // Último índice ocupado + 1 casillero vacío para seguir cargando, con tope en max
    // (límite técnico real de refs que soporta la API — no se muestra como límite en la UI,
    // simplemente deja de agregar casilleros nuevos al llegar ahí).
    let lastFilled = -1;
    for (let i = 0; i < images.length; i++) if (images[i]) lastFilled = i;
    return Math.min(max, Math.max(1, lastFilled + 2));
  };

  const slotSubLabels: Record<string, string[]> = {
    avatar:         ['Cara / identidad', 'Cuerpo (opcional)'],
    outfit:         recipe === 'outfit_haul'
      ? ['Prenda 1', 'Prenda 2', 'Prenda 3', 'Prenda 4', 'Prenda 5', 'Prenda 6', 'Prenda 7', 'Prenda 8', 'Prenda 9', 'Prenda 10']
      : recipe === 'outfit_week'
        ? ['Outfit 1', 'Outfit 2', 'Outfit 3', 'Outfit 4', 'Outfit 5', 'Outfit 6', 'Outfit 7']
        : ['Prenda 1', 'Prenda 2', 'Prenda 3', 'Prenda 4'],
    accesorios:     recipe === 'outfit_haul'
      ? ['Accesorio 1', 'Accesorio 2', 'Accesorio 3', 'Accesorio 4', 'Accesorio 5']
      : recipe === 'outfit_week'
        ? ['Accesorio 1', 'Accesorio 2', 'Accesorio 3', 'Accesorio 4']
        : ['Accesorio 1', 'Accesorio 2', 'Accesorio 3'],
    producto:       recipe === 'product_haul'
      ? ['Producto 1', 'Producto 2', 'Producto 3', 'Producto 4', 'Producto 5', 'Producto 6', 'Producto 7', 'Producto 8', 'Producto 9', 'Producto 10']
      : ['Producto (dentro)', 'Ángulo 2', 'Ángulo 3'],
    empaque:        ['Empaque principal', 'Ángulo 2', 'Ángulo 3'],
    escena:         ['Principal', 'Lugar 2', 'Lugar 3'],
    escena_prueba:  ['Dormitorio / espejo / probador'],
    escena_destino: ['Lugar final (restaurante, evento, calle...)'],
  };

  // Hint de ayuda por slot y receta
  const getSlotHint = (key: string): string => {
    if (key === 'avatar') {
      if (recipe === 'bts') return 'Opcional: tu foto mantiene tono de piel y manos consistentes aunque no se vea tu cara.';
      if (recipe === 'unboxing') return 'Opcional: si subís tu foto aparecerás guiando el unboxing — abriendo la caja, sosteniendo el producto.';
      return 'La foto del rostro ancla la identidad facial en todas las imágenes.';
    }
    if (key === 'outfit') {
      if (recipe === 'outfit_check') return 'Sube las prendas del look por separado: una foto clara de cada pieza. Puedes usar Separar prendas o Fotos de producto para obtener mejores resultados. Evita fotos con personas para no mezclar identidades.';
      if (recipe === 'outfit_haul') return 'Sube una imagen por prenda o accesorio. Indica qué tipo de artículo aparece en cada imagen para crear una historia más precisa. Evita fotos con personas para no mezclar identidades.';
      if (recipe === 'outfit_week') return 'Sube una imagen por artículo: looks, prendas, bolsos, calzado, joyería o productos de belleza. Aparecerán en este mismo orden.';
      if (recipe === 'outfit_multi_look') return 'Sube una foto por look. Aparecerán en el mismo orden. Evita fotos con personas para no mezclar identidades.';
      return 'Sube hasta 4 prendas. Puedes usar Separar prendas o Fotos de producto para obtener mejores resultados.';
    }
    if (key === 'accesorios') {
      if (recipe === 'outfit_haul') return 'Añade bolsos, joyería, cinturones o gorras. Marca ⭐ si quieres una foto de detalle de una pieza.';
      if (recipe === 'outfit_week') return 'Añade tus accesorios, bolsos, joyería o calzado favoritos. Marca ⭐ si quieres una foto de detalle.';
      return 'Sube los accesorios que quieras destacar. Marca ⭐ si quieres una foto de detalle adicional.';
    }
    if (key === 'producto') {
      if (recipe === 'unboxing') return 'El producto dentro del empaque: lo que el cliente recibe. Subí hasta 3 ángulos.';
      if (recipe === 'product_haul') return 'Subí cada producto del set — una imagen por slot. Usá el selector debajo de cada imagen para indicar qué tipo de producto es (skincare, maquillaje, gadget, comida/bebida, bienestar o genérico): eso define cómo interactúa con el producto en cada foto.';
      if (recipe === 'day_in_life') return 'Producto del día (opcional) o foto de tu acompañante — usá el selector debajo de cada imagen y elegí "Acompañante" para que el sistema genere momentos grupales en el set. Los distintos momentos del día (mañana, tarde, noche) se describen en el brief de texto, no acá.';
      if (recipe === 'outfit_night_out') return 'Opcional: foto de tu acompañante — usá el selector debajo de la imagen y elegí "Acompañante" para que el sistema incluya un momento con esa persona en la noche. Si no subís nada, todos los momentos son en solitario.';
      return 'Subí hasta 3 ángulos del mismo producto para mayor fidelidad visual.';
    }
    if (key === 'empaque') return recipe === 'product_haul'
      ? 'Opcional: la caja o packaging en la que llegaron los productos. Si lo subís, se genera un momento de unboxing intercalado en el set.'
      : 'El empaque, caja o packaging del producto. Si no subís fotos, la IA generará un empaque — la consistencia puede variar.';
    if (key === 'escena') {
      if (recipe === 'outfit_multi_look' && refs.multiLookIntent === 'trip_recap') {
        return 'Subí una foto del lugar por cada look — Escena 1 va con Look 1, Escena 2 con Look 2, y así. El sistema nunca inventa el lugar, siempre usa la foto real que subas acá.';
      }
      if (recipe === 'outfit_night_out') {
        return 'Foto del lugar (opcional) — si no subís nada, armamos el venue según lo que cuentes en el brief (ej. "cena en un rooftop", "previa y boliche").';
      }
      return 'La escena principal define la ambientación del set completo.';
    }
    if (key === 'escena_prueba') return 'Escena de prueba: lugar donde te preparás o revisás el look. Opcional. Si no subís foto, se genera un espacio coherente con el contexto del brief.';
    if (key === 'escena_destino') return 'Escena destino: lugar al que vas con el outfit puesto. Opcional. Si no subís foto, Luz IA intenta inferir el destino desde el brief.';
    return '';
  };

  return (
    <div className="fade-in p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 md:gap-8 items-start">

        {/* ── Columna principal ─────────────────────────────── */}
        <div className="flex flex-col gap-6">

          <div>
            <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 2 · Brief</div>
            <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
              Contanos la<br /><span className="text-brand-600 italic normal-case">historia del set</span>
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
              Describí el sujeto, el contexto o el momento. Las referencias refuerzan la identidad visual.
            </p>
          </div>

          {/* Cantidad de imágenes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
              Cantidad de imágenes
            </label>
            {recipe === 'outfit_reveal_basic' ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center min-w-[48px]">
                    <span className="text-2xl font-black text-slate-900 leading-none">3</span>
                    <span className="text-[9px] text-slate-400 font-medium">fotos</span>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 mt-1.5">
                  Siempre 3 ángulos: mirror check completo, tu propia vista, y un close-up — no hace falta elegir cantidad.
                </p>
              </>
            ) : recipe === 'outfit_night_out' ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center min-w-[48px]">
                    <span className="text-2xl font-black text-slate-900 leading-none">{count}</span>
                    <span className="text-[9px] text-slate-400 font-medium">fotos</span>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 mt-1.5">
                  La cantidad la define el nivel elegido más abajo — no hace falta elegir cantidad acá.
                </p>
              </>
            ) : recipe === 'outfit_multi_look' ? (
              <>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onCount(Math.max(1, count - 1))}
                    disabled={count <= 1 || multiLookMaxCount === 0}
                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-lg flex items-center justify-center hover:border-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    −
                  </button>
                  <div className="flex flex-col items-center min-w-[48px]">
                    <span className="text-2xl font-black text-slate-900 leading-none">{count}</span>
                    <span className="text-[9px] text-slate-400 font-medium">fotos</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCount(Math.min(multiLookMaxCount, count + 1))}
                    disabled={count >= multiLookMaxCount}
                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-lg flex items-center justify-center hover:border-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    +
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 mt-1.5">
                  {multiLookMaxCount === 0
                    ? 'Sube al menos un look para elegir la cantidad.'
                    : refs.multiLookIntent === 'curated_ideas'
                    ? `Hasta ${multiLookMaxCount} fotos (2 por look subido: frontal + otro ángulo).`
                    : `Hasta ${multiLookMaxCount} fotos (1 por look subido).`}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onCount(Math.max(MIN_COUNT, count - 1))}
                    disabled={count <= MIN_COUNT}
                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-lg flex items-center justify-center hover:border-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    −
                  </button>
                  <div className="flex flex-col items-center min-w-[48px]">
                    <span className="text-2xl font-black text-slate-900 leading-none">{count}</span>
                    <span className="text-[9px] text-slate-400 font-medium">fotos</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCount(Math.min(maxCount, count + 1))}
                    disabled={count >= maxCount}
                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-lg flex items-center justify-center hover:border-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    +
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 mt-1.5">
                  {recipe === 'outfit_check'
                    ? 'Outfit check permite hasta 8 imágenes para mantener coherencia de look y escena.'
                    : 'Mínimo 3 · El género del avatar se detecta automáticamente'}
                </p>
              </>
            )}
          </div>

          {/* Brief */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
              Contexto base <span className="text-brand-600">*</span>
            </label>
            <textarea
              ref={textareaRef}
              value={basePrompt}
              onChange={e => onPrompt(e.target.value)}
              placeholder={
                recipe === 'outfit_check' ? 'Ej: @persona hace su outfit check para una cena romántica — look elegante casual en @escena_prueba...' :
                recipe === 'outfit_haul'  ? 'Ej: @persona se prueba 5 blusas distintas para ver cuál se queda — haul de primavera en su dormitorio...' :
                recipe === 'outfit_week'  ? 'Ej: Estos fueron los outfits de @persona de la semana: del gym al restaurante, todo en uno...' :
                recipe === 'outfit_multi_look' ? 'Ej: Los outfits que usé en mi semana de trabajo, todos con el mismo espejo de mi cuarto...' :
                recipe === 'outfit_reveal_basic' ? 'Ej: Así me quedó el vestido que compré para el cumpleaños de mi amiga...' :
                recipe === 'outfit_night_out' ? 'Ej: Cena con amigas en un rooftop antes de ir al boliche...' :
                recipe === 'outfit'       ? 'Ej: @persona hace un haul de otoño luciendo @outfit en Palermo...' :
                recipe === 'unboxing'     ? 'Ej: Caja de mi nueva crema de vitamina C, @persona hace el unboxing de @producto...' :
                recipe === 'day_in_life'  ? 'Ej: @persona en una mañana de domingo tranquila en casa con @producto...' :
                recipe === 'product_haul' ? 'Ej: Miren lo que me llegó — mi nuevo set de skincare coreano, @persona probando cada producto...' :
                recipe === 'bts'          ? 'Ej: Preparando los pedidos de la semana con @producto, papel de seda rosado...' :
                recipe === 'travel'       ? 'Ej: @persona en Montevideo, el puerto, los cafés y la rambla al atardecer...' :
                'Describí el contexto central del set...'
              }
              rows={4}
              autoComplete="off"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-[15px] text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all resize-none leading-relaxed"
            />
            {availableTags.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider flex-shrink-0">
                    <AtSign size={9} /> Insertar
                  </span>
                  {availableTags.map(t => {
                    const active = isTagActive(t.tag);
                    return (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => insertTag(t.tag)}
                        title={active ? `${t.tag} está en el brief ✓` : `Insertar ${t.tag} en el brief`}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all hover:scale-105 ${t.color} ${
                          active ? 'ring-2 ring-offset-1 ring-current opacity-100 shadow-sm' : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {t.preview && (
                          <img src={t.preview} className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0" />
                        )}
                        {t.tag}
                        {active && <span className="text-[8px]">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {tagsInBrief.size > 0 && (
                  <p className="text-[10px] text-brand-600 font-semibold flex items-center gap-1">
                    <AtSign size={9} />
                    {[...tagsInBrief].filter(t => allTagDefs.some(td => td.tag.toLowerCase() === t)).length} tag{[...tagsInBrief].filter(t => allTagDefs.some(td => td.tag.toLowerCase() === t)).length !== 1 ? 's' : ''} conectado{[...tagsInBrief].filter(t => allTagDefs.some(td => td.tag.toLowerCase() === t)).length !== 1 ? 's' : ''} al brief
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1.5">
                Cuantos más detalles compartas, más preciso será el resultado. Puedes añadir imágenes de referencia.
              </p>
            )}
          </div>

          {/* outfit_multi_look: selector de intención */}
          {recipe === 'outfit_multi_look' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
                ¿Qué querés contar? <span className="text-brand-600">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2">
                {MULTI_LOOK_INTENT_OPTIONS.map(opt => {
                  const sel = (refs.multiLookIntent ?? 'weekly') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleMultiLookIntentChange(opt.value)}
                      className={`text-left px-4 py-2.5 rounded-xl border transition-all ${
                        sel ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="text-sm font-bold text-slate-900">{opt.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{opt.hint}</div>
                    </button>
                  );
                })}
              </div>
              {refs.multiLookIntent === 'trip_recap' && (
                <p className="text-[10px] text-slate-400 mt-2 leading-snug">
                  El lugar de cada look se sube como foto en el slot <b>Escena</b> más abajo — Escena 1 va con Look 1, Escena 2 con Look 2, y así. Subí una foto real del lugar (tuya o encontrada), no hace falta escribir el nombre.
                </p>
              )}
            </div>
          )}

          {/* outfit_night_out: selector de nivel (cantidad fija por nivel) */}
          {recipe === 'outfit_night_out' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
                ¿Cuánta historia querés contar?
              </label>
              <div className="grid grid-cols-1 gap-2">
                {NIGHT_OUT_LEVEL_OPTIONS.map(opt => {
                  const sel = (refs.nightOutLevel ?? 'corto') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleNightOutLevelChange(opt.value)}
                      className={`text-left px-4 py-2.5 rounded-xl border transition-all ${
                        sel ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="text-sm font-bold text-slate-900">{opt.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{opt.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Referencias dinámicas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
              Referencias de identidad
            </label>

            <div className="space-y-2">
              {refKeys.map(key => {
                const required  = isRefRequired(recipe, key);
                const style     = SLOT_STYLE[key as keyof typeof SLOT_STYLE] ?? SLOT_STYLE.escena;
                const isOpen    = openSlot === key;
                const filled    = getSlotFilled(key);
                const max       = getSlotMax(key);
                const visibleCount = getSlotVisibleCount(key);
                const subLabels = slotSubLabels[key] ?? [];
                const slotType  = key === 'avatar' ? 'person'
                  : (key === 'outfit' || key === 'accesorios') ? 'outfit'
                  : (key === 'producto' || key === 'empaque') ? 'product'
                  : 'scene';

                const isAccesorios  = key === 'accesorios';
                const images        = getSlotImages(key);
                const closeups      = refs.accesorioCloseup ?? Array(recipe === 'outfit_haul' ? 5 : recipe === 'outfit_week' ? 4 : 3).fill(false);
                const slotTagged    = isSlotTagged(key);
                const slotTagDefs   = allTagDefs.filter(td => td.slotKey === key);
                const slotTagsForHeader = slotTagDefs.map(td => td.tag).slice(0, 3);

                return (
                  <div
                    key={key}
                    className={`border rounded-2xl overflow-hidden transition-all ${
                      isOpen
                        ? `${style.border} ${style.bg}`
                        : slotTagged
                          ? `${style.border} ${style.bg} ring-2 ring-offset-1`
                          : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Header acordeón */}
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
                    >
                      <span className={`${style.label} flex-shrink-0`}>
                        {SLOT_ICON[key as keyof typeof SLOT_ICON]}
                      </span>
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.12em] flex-1">
                        {SLOT_LABEL[key]}
                      </span>

                      {/* Tags del slot */}
                      {filled > 0 && !isOpen && slotTagsForHeader.length > 0 && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {slotTagsForHeader.map(t => {
                            const active = isTagActive(t);
                            return (
                              <span
                                key={t}
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border transition-all ${
                                  active
                                    ? `${style.label} ${style.bg} ${style.border} shadow-sm`
                                    : 'text-slate-300 bg-slate-50 border-slate-100'
                                }`}
                              >
                                {t}{active && ' ✓'}
                              </span>
                            );
                          })}
                          {allTagDefs.filter(td => td.slotKey === key).length > 3 && (
                            <span className="text-[9px] text-slate-400">+{allTagDefs.filter(td => td.slotKey === key).length - 3}</span>
                          )}
                        </div>
                      )}

                      {filled > 0 && !isOpen && (
                        <span className={`text-[9px] font-bold ${style.label} flex-shrink-0`}>
                          {filled} foto{filled > 1 ? 's' : ''}
                          {isAccesorios && (refs.accesorioCloseup ?? []).filter(Boolean).length > 0 &&
                            ` · ${(refs.accesorioCloseup ?? []).filter(Boolean).length} close-up`}
                        </span>
                      )}
                      {filled === 0 && !isOpen && (
                        <span className="text-[9px] text-slate-400 flex items-center gap-1">
                          {required && <AlertCircle size={9} className="text-brand-400" />}
                          {required ? 'Necesario' : 'Opcional'}
                        </span>
                      )}

                      <ChevronDown
                        size={14}
                        className={`text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Contenido expandido */}
                    {isOpen && (
                      <div className="px-3.5 pb-3.5 space-y-3">
                        <div className={`grid gap-2 ${visibleCount <= 2 ? 'grid-cols-2' : visibleCount <= 3 ? 'grid-cols-3' : 'grid-cols-3 md:grid-cols-4'}`}>
                          {Array.from({ length: visibleCount }).map((_, i) => {
                            const isFirst    = i === 0;
                            const isDisabled = i > 0 && !images[0];
                            const hasImage   = !!images[i];
                            const isCloseup  = isAccesorios && closeups[i];
                            // Tag propio de este sub-slot (e.g. @outfit2 para index 1)
                            const subTagDef  = slotTagDefs[i];
                            const subTagActive = subTagDef ? isTagActive(subTagDef.tag) : false;

                            return (
                              <div key={i} className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex flex-col gap-0.5">
                                    <p className={`text-[9px] font-bold uppercase tracking-wider ${
                                      isFirst ? style.label : 'text-slate-400'
                                    }`}>
                                      {subLabels[i] ?? `Foto ${i + 1}`}
                                    </p>
                                    {subTagDef && hasImage && (
                                      <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded border w-fit transition-all ${
                                        subTagActive
                                          ? `${style.label} ${style.bg} ${style.border}`
                                          : 'text-slate-300 bg-slate-50 border-slate-100'
                                      }`}>
                                        {subTagDef.tag}{subTagActive && ' ✓'}
                                      </span>
                                    )}
                                  </div>
                                  {/* Checkbox de close-up para accesorios */}
                                  {isAccesorios && hasImage && (
                                    <button
                                      type="button"
                                      onClick={() => handleCloseupToggle(i)}
                                      title={isCloseup ? 'Quitar close-up dedicado' : 'Agregar close-up dedicado (+1 imagen)'}
                                      className={`flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full border transition-all ${
                                        isCloseup
                                          ? 'bg-pink-500 border-pink-500 text-white'
                                          : 'bg-white border-slate-300 text-slate-400 hover:border-pink-400 hover:text-pink-500'
                                      }`}
                                    >
                                      <Star size={7} strokeWidth={2.5} />
                                      CU
                                    </button>
                                  )}
                                </div>
                                <ImageSlot
                                  value={images[i] ?? null}
                                  onChange={v => handleSlotChange(key, i, v)}
                                  slotType={slotType as any}
                                  aspectRatio="square"
                                  disabled={isDisabled}
                                  iconless
                                />
                                {/* Selector de tipo — haul y weekly favorites, cuando hay imagen.
                                    category filtra las opciones mostradas: outfit nunca ve
                                    tipos que no aplican, accesorios ya no muestra ropa. */}
                                {(recipe === 'outfit_haul' || recipe === 'outfit_week') && hasImage && key === 'outfit' && (
                                  <HaulReferenceTypeSelector
                                    value={getOutfitKind(i)}
                                    onChange={kind => handleOutfitKindChange(i, kind)}
                                    category="outfit"
                                  />
                                )}
                                {(recipe === 'outfit_haul' || recipe === 'outfit_week') && hasImage && isAccesorios && (
                                  <HaulReferenceTypeSelector
                                    value={getAccKind(i)}
                                    onChange={kind => handleAccKindChange(i, kind)}
                                    category="accesorio"
                                  />
                                )}
                                {(recipe === 'outfit_week' || recipe === 'product_haul' || recipe === 'day_in_life' || recipe === 'outfit_night_out') && hasImage && key === 'producto' && (
                                  <HaulReferenceTypeSelector
                                    value={getProductKind(i)}
                                    onChange={kind => handleProductKindChange(i, kind)}
                                    category="producto"
                                  />
                                )}
                                {recipe === 'outfit_multi_look' && hasImage && key === 'outfit' && refs.multiLookIntent === 'then_vs_now' && (
                                  <div className="flex gap-1">
                                    {(['before', 'after'] as const).map(era => {
                                      const current = (refs.multiLookEras ?? [])[i] ?? null;
                                      const sel = current === era;
                                      return (
                                        <button
                                          key={era}
                                          type="button"
                                          onClick={() => handleMultiLookEraChange(i, sel ? null : era)}
                                          className={`flex-1 text-[9px] font-bold px-1 py-0.5 rounded-full border transition-all ${
                                            sel ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white border-slate-300 text-slate-400 hover:border-brand-400'
                                          }`}
                                        >
                                          {era === 'before' ? 'Antes' : 'Ahora'}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {isAccesorios && isCloseup && hasImage && (
                                  <p className="text-[8px] text-pink-500 font-bold text-center">
                                    ★ Close-up incluido
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Nota de ayuda por slot */}
                        <p className="text-[10px] text-slate-400 leading-snug">
                          {getSlotHint(key)}
                        </p>

                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          className="w-full text-[10px] text-slate-400 hover:text-slate-600 py-1 transition-colors"
                        >
                          Minimizar ↑
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* curated_ideas: calzado/accesorios opcionales, con enlace a looks */}
          {recipe === 'outfit_multi_look' && refs.multiLookIntent === 'curated_ideas' && (
            <div>
              {!curatedAccessoriesEnabled ? (
                <button
                  type="button"
                  onClick={() => setCuratedAccessoriesEnabled(true)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/40 transition-all"
                >
                  <p className="text-[13px] font-bold text-slate-700">¿Querés agregar calzado o accesorios para complementar tus looks?</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Subí zapatos, carteras o joyas y decinos con qué looks combinan.</p>
                </button>
              ) : (
                <div className="border border-pink-200 bg-pink-50/30 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-pink-600 uppercase tracking-[0.12em]">
                      Calzado / Accesorios
                    </label>
                    <button
                      type="button"
                      onClick={() => setCuratedAccessoriesEnabled(false)}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      Ocultar
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Opcional. Si no subís nada para un look, el resultado igual incluye calzado/accesorios coherentes con el outfit.
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: Math.min(curatedAccessoryRefs.filter(Boolean).length + 1, MAX_CURATED_ACCESSORIES) }).map((_, i) => (
                      <ImageSlot
                        key={i}
                        value={curatedAccessoryRefs[i] ?? null}
                        onChange={(v) => handleCuratedAccessoryChange(i, v)}
                        slotType="outfit"
                        aspectRatio="square"
                        className="!aspect-square"
                      />
                    ))}
                  </div>

                  {curatedLookIds.length > 0 && curatedAccessoryRefs.some(Boolean) && (
                    <div className="space-y-2 pt-1">
                      {curatedAccessoryRefs.map((url, i) => {
                        if (!url) return null;
                        const links = curatedAccessoryLinks[i] ?? [];
                        return (
                          <div key={i} className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-500">Combina con:</span>
                            {curatedLookIds.map(look => {
                              const active = links.includes(look.id);
                              return (
                                <button
                                  key={look.id}
                                  type="button"
                                  onClick={() => handleCuratedAccessoryLinkToggle(i, look.id)}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${
                                    active
                                      ? 'border-pink-500 bg-pink-500 text-white'
                                      : 'border-slate-200 bg-white text-slate-500 hover:border-pink-300'
                                  }`}
                                >
                                  {look.label}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Panel lateral ─────────────────────────────────── */}
        <div className="md:sticky md:top-4 space-y-3">

          {/* Receta activa */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Tipo de historia
            </p>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                <Package size={15} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-800">{meta.label}</p>
                <p className="text-[11px] text-slate-500">{meta.description}</p>
              </div>
            </div>
          </div>

          {/* Checklist de refs */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Referencias del set
            </p>
            {refKeys.map(key => {
              const required = isRefRequired(recipe, key);
              const filled   = getSlotFilled(key);
              const ok       = filled > 0;
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border ${
                    ok
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : required
                        ? 'border-brand-400 bg-white'
                        : 'border-slate-300 bg-white'
                  }`}>
                    {ok && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-600 flex-1">{SLOT_LABEL[key]}</span>
                  <span className={`text-[10px] font-bold ${
                    ok ? 'text-emerald-500' : required ? 'text-brand-400' : 'text-slate-400'
                  }`}>
                    {ok ? `${filled} foto${filled > 1 ? 's' : ''}` : required ? 'Necesario' : 'Opcional'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Resumen de close-ups si hay accesorios marcados */}
          {isOutfitRecipe && (refs.accesorioCloseup ?? []).filter(Boolean).length > 0 && (
            <div className="bg-pink-50 border border-pink-100 rounded-xl px-3 py-2.5 text-[11px] text-pink-800 leading-[1.55]">
              <strong>+{(refs.accesorioCloseup ?? []).filter(Boolean).length} imagen{(refs.accesorioCloseup ?? []).filter(Boolean).length > 1 ? 's' : ''} extra</strong> — close-up de accesorio{(refs.accesorioCloseup ?? []).filter(Boolean).length > 1 ? 's' : ''} marcado{(refs.accesorioCloseup ?? []).filter(Boolean).length > 1 ? 's' : ''} con ⭐
            </div>
          )}

          <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5 text-[11px] text-violet-800 leading-[1.55]">
            <strong>Sin referencias</strong> también funciona — el resultado será más genérico pero igualmente válido.
          </div>
        </div>

      </div>
    </div>
  );
};

export default PDStep2Receta;
