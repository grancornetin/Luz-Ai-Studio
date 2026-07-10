/**
 * recipes/briefTags.ts
 * Resolución de tags @outfit1, @accesorio2, etc. en el brief del usuario — patch v4.
 * Usa contexto semántico circundante para extraer mood, destino y pairings explícitos.
 * No es específico de ninguna receta — usable por cualquiera que reciba un brief con tags.
 *
 * Extraído de photodumpDirectorService.ts (patch post-refactor, Fase 1) para romper
 * la dependencia circular recipes → Director: este archivo es neutral, no importa
 * ni de ./shared ni de ../photodumpDirectorService.
 *
 * Código movido tal cual — sin reescribir lógica.
 */

export const PAIRING_CONNECTORS = [
  'van con', 'va con', 'combina con', 'combino con', 'lo usé con', 'la usé con',
  'los usé con', 'las usé con', 'use con', 'usé con', 'lo uso con', 'la uso con',
  'lo llevé con', 'la llevé con', 'lo puse con', 'la puse con',
  'junto con', 'juntos con', 'acompañé con', 'acompañan', 'acompaña',
  'pair with', 'goes with', 'combined with', 'wore with',
];
// ── Global Reference Tag Resolver (patch v4) ─────────────────
// Resuelve tags @outfit1, @outfit2, @accessory1, etc. desde el brief del usuario.
// Usa contexto semántico circundante para extraer mood, destino y pairings explícitos.
// No específico de outfit_week — usable en cualquier receta.

// Map de alias de tag → slotType
const TAG_SLOT_ALIASES: Record<string, import('../types').RefTagSlotType> = {
  outfit: 'outfit', look: 'outfit', looks: 'outfit',
  accessory: 'accessory', accesorio: 'accessory', accesorios: 'accessory',
  aro: 'accessory', aros: 'accessory',
  bag: 'bag', bolso: 'bag',
  shoe: 'shoe', shoes: 'shoe', zapato: 'shoe', zapatos: 'shoe',
  makeup: 'makeup', maquillaje: 'makeup',
  product: 'product', producto: 'product',
  scene: 'scene', escena: 'scene',
  avatar: 'avatar',
  body: 'body',
};

// Palabras descriptoras de mood/rol de outfit extraíbles del contexto
const MOOD_KEYWORDS = [
  'casual', 'arreglado', 'cómodo', 'comodo', 'vibrante', 'elegante', 'formal',
  'informal', 'básico', 'basico', 'lindo', 'chic', 'sport', 'relajado',
  'colorido', 'simple', 'llamativo', 'divertido', 'sobrio', 'trendy',
];

// Palabras de destino extraíbles del contexto
const DESTINATION_KEYWORDS = [
  'cena', 'tarde', 'mañana', 'día', 'dia', 'noche', 'oficina', 'trabajo',
  'playa', 'salir', 'reunión', 'reunion', 'brunch', 'almuerzo', 'evento',
  'escuela', 'universidad', 'gym', 'viaje', 'aeropuerto', 'fiesta',
  'cita', 'shopping', 'mercado', 'café', 'cafe',
];

// Palabras que indican asociación explícita entre ítem y outfit
const PAIRING_VERBS = [
  'usé con', 'use con', 'combina con', 'van con', 'va con', 'queda con',
  'lo usé con', 'los usé con', 'las usé con', 'para el look de', 'con el look',
  'para este look', 'con este look', 'para ese look', 'con ese look',
];

function extractSemanticContext(brief: string, tagStart: number): { role?: string; dest?: string; contextSnippet: string } {
  // Tomar hasta 60 chars antes del tag y 40 después
  const before = brief.slice(Math.max(0, tagStart - 60), tagStart);
  const after  = brief.slice(tagStart, Math.min(brief.length, tagStart + 40));
  const ctx    = (before + after).toLowerCase();

  let role: string | undefined;
  let dest: string | undefined;

  for (const kw of MOOD_KEYWORDS) {
    if (ctx.includes(kw)) { role = kw; break; }
  }
  for (const kw of DESTINATION_KEYWORDS) {
    if (ctx.includes(kw)) { dest = kw; break; }
  }

  return { role, dest, contextSnippet: (before.slice(-40) + after).trim().replace(/\n/g, ' ') };
}

function detectExplicitPairing(
  brief:        string,
  taggedItems:  import('../types').ResolvedReferenceTag[],
  allItems:     import('../types').WeeklyItem[],
): import('../types').ExplicitItemPairing[] {
  const pairings: import('../types').ExplicitItemPairing[] = [];
  const seenPairs = new Set<string>();
  const lowerBrief = brief.toLowerCase();

  // ── Estrategia 1: tags directos en la misma oración ──────────
  // Detecta pairings cuando dos tags distintos (@accesorio1 + @outfit3) aparecen
  // en la misma cláusula (separados por ≤120 chars sin punto ni punto y coma duro).
  const tagPattern = /@([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+\d*)/gi;
  const allTagMatches: { rawTag: string; pos: number; itemId?: string; type: string }[] = [];

  let m: RegExpExecArray | null;
  while ((m = tagPattern.exec(brief)) !== null) {
    const resolved = taggedItems.find(t => t.rawTag.toLowerCase() === m![0].toLowerCase());
    if (!resolved?.resolvedItemId) continue;
    const baseKey = m[1].toLowerCase().replace(/\d+$/, '');
    const tagType = TAG_SLOT_ALIASES[baseKey] ?? 'unknown';
    allTagMatches.push({ rawTag: m[0], pos: m.index, itemId: resolved.resolvedItemId, type: tagType });
  }

  for (let i = 0; i < allTagMatches.length; i++) {
    for (let j = i + 1; j < allTagMatches.length; j++) {
      const a = allTagMatches[i];
      const b = allTagMatches[j];
      if (!a.itemId || !b.itemId || a.itemId === b.itemId) continue;
      if (a.type === b.type) continue;  // mismo tipo → no es un pairing útil

      const gap     = Math.abs(b.pos - a.pos);
      if (gap > 150) continue;  // demasiado separados

      // ¿Hay separador duro entre ellos?
      const between = lowerBrief.slice(Math.min(a.pos, b.pos), Math.max(a.pos, b.pos));
      const hasSeparator = /[.;]\s/.test(between.replace(/@\w+\d*/g, ''));
      if (hasSeparator && gap > 60) continue;

      // ¿Hay conector explícito o están en la misma cláusula?
      const hasConnector = PAIRING_CONNECTORS.some(c => between.includes(c)) ||
                           PAIRING_VERBS.some(v => between.includes(v));
      const sameClause   = !hasSeparator && gap < 100;

      if (!hasConnector && !sameClause) continue;

      // Identificar cuál es accesorio/item y cuál es outfit/destino del pairing
      const isAAccessory = a.type === 'accessory' || a.type === 'bag' || a.type === 'shoe';
      const isBOutfit    = b.type === 'outfit';
      const isAOutfit    = a.type === 'outfit';
      const isBAccessory = b.type === 'accessory' || b.type === 'bag' || b.type === 'shoe';

      let sourceId: string | undefined;
      let targetId: string | undefined;

      if (isAAccessory && isBOutfit) {
        sourceId = a.itemId; targetId = b.itemId;
      } else if (isBAccessory && isAOutfit) {
        sourceId = b.itemId; targetId = a.itemId;
      } else {
        // Pairing no estándar (outfit + producto, etc.) — igualmente útil
        sourceId = a.itemId; targetId = b.itemId;
      }

      const pairKey = [sourceId, targetId].sort().join('::');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const ctxStart = Math.max(0, Math.min(a.pos, b.pos) - 30);
      const ctxEnd   = Math.min(brief.length, Math.max(a.pos, b.pos) + 50);
      const rawText  = brief.slice(ctxStart, ctxEnd).trim();

      pairings.push({
        sourceItemId: sourceId!,
        targetItemId: targetId!,
        reason:       `Direct tag pairing detected: ${a.rawTag} + ${b.rawTag} in same clause`,
        rawText,
      });
    }
  }

  // ── Estrategia 2: verbos de pairing con tags (compatible con legado) ─────────
  for (const verb of PAIRING_VERBS) {
    const verbIdx = lowerBrief.indexOf(verb);
    if (verbIdx === -1) continue;

    // Buscar cualquier tag DESPUÉS del verbo (no solo outfit)
    const afterVerb = brief.slice(verbIdx, verbIdx + 120);
    const targetTagMatch = afterVerb.match(/@([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+\d*)/i);
    if (!targetTagMatch) continue;

    const targetResolved = taggedItems.find(t =>
      t.rawTag.toLowerCase() === targetTagMatch[0].toLowerCase()
    );
    if (!targetResolved?.resolvedItemId) continue;

    // Buscar cualquier tag ANTES del verbo
    const beforeVerb = brief.slice(Math.max(0, verbIdx - 100), verbIdx);
    const sourceTagMatch = beforeVerb.match(/@([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+\d*)/i);
    if (!sourceTagMatch) continue;

    const sourceResolved = taggedItems.find(t =>
      t.rawTag.toLowerCase() === sourceTagMatch[0].toLowerCase()
    );
    if (!sourceResolved?.resolvedItemId) continue;
    if (sourceResolved.resolvedItemId === targetResolved.resolvedItemId) continue;

    const pairKey = [sourceResolved.resolvedItemId, targetResolved.resolvedItemId].sort().join('::');
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    pairings.push({
      sourceItemId: sourceResolved.resolvedItemId,
      targetItemId: targetResolved.resolvedItemId,
      reason:       `Pairing verb "${verb}" between ${sourceResolved.rawTag} and ${targetResolved.rawTag}`,
      rawText:      brief.slice(Math.max(0, verbIdx - 40), verbIdx + 80).trim(),
    });
  }

  return pairings;
}

export function resolveReferenceTagsFromBrief(
  brief:         string,
  outfitItems:   import('../types').WeeklyItem[],
  accessoryItems: import('../types').WeeklyItem[],
  allItems?:     import('../types').WeeklyItem[],
): import('../types').ReferenceTagResolutionResult {
  const items = allItems ?? [...outfitItems, ...accessoryItems];
  const tags: import('../types').ResolvedReferenceTag[] = [];
  const seenRawTags: Record<string, { count: number; contexts: string[] }> = {};

  // Regex que captura @word seguido de dígito opcional, soporta tildes y puntuación pegada
  const tagPattern = /@([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+\d*)(?=[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ\d]|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(brief)) !== null) {
    const rawTag    = match[0].replace(/[.,!?;:]$/, '');
    const rawName   = match[1].replace(/[.,!?;:]$/, '');
    const lowerName = rawName.toLowerCase();

    // Resolver slotType
    const baseKey     = lowerName.replace(/\d+$/, '');
    const slotType: import('../types').RefTagSlotType = TAG_SLOT_ALIASES[baseKey] ?? 'unknown';

    // Resolver índice humano (1-based): @outfit → 1, @outfit2 → 2, @outfit3 → 3
    const numStr      = lowerName.match(/\d+$/)?.[0];
    const humanIndex  = numStr ? parseInt(numStr, 10) : 1;
    const slotIndex   = humanIndex - 1;  // 0-based

    // Resolver el WeeklyItem real
    let resolvedItemId: string | undefined;
    let resolvedRefUrl: string | undefined;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let warning: string | undefined;

    if (slotType === 'outfit') {
      const candidate = outfitItems[slotIndex];
      if (candidate) {
        resolvedItemId = candidate.id;
        resolvedRefUrl = candidate.refUrl;
        confidence = 'high';
      } else {
        warning = `Tag @${rawName} refers to outfit slot ${humanIndex}, but only ${outfitItems.length} outfit(s) were uploaded`;
        confidence = 'low';
      }
    } else if (slotType === 'accessory' || slotType === 'bag' || slotType === 'shoe') {
      const candidate = accessoryItems[slotIndex];
      if (candidate) {
        resolvedItemId = candidate.id;
        resolvedRefUrl = candidate.refUrl;
        confidence = 'high';
      } else {
        warning = `Tag @${rawName} refers to accessory slot ${humanIndex}, but only ${accessoryItems.length} accessory/ies were uploaded`;
        confidence = 'low';
      }
    } else if (slotType === 'unknown') {
      warning = `Tag @${rawName} could not be mapped to a known slot type`;
      confidence = 'low';
    }

    // Extraer contexto semántico
    const tagPos = match.index;
    const { role: semanticRole, dest: semanticDest, contextSnippet } = extractSemanticContext(brief, tagPos);

    const resolved: import('../types').ResolvedReferenceTag = {
      rawTag:            rawTag.trim(),
      normalizedTag:     rawName,
      slotType,
      slotIndex,
      humanIndex,
      resolvedItemId,
      resolvedRefUrl,
      confidence,
      usedInTextContext: contextSnippet,
      semanticRole,
      semanticDest,
      warning,
    };

    tags.push(resolved);

    // Tracking de duplicados
    const key = rawTag.trim().toLowerCase();
    if (!seenRawTags[key]) seenRawTags[key] = { count: 0, contexts: [] };
    seenRawTags[key].count++;
    seenRawTags[key].contexts.push(contextSnippet);
  }

  // Construir lista de duplicados
  const duplicateTagUses: import('../types').ReferenceTagDuplicateUse[] = Object.entries(seenRawTags)
    .filter(([, v]) => v.count > 1)
    .map(([k, v]) => ({
      rawTag:   k,
      count:    v.count,
      contexts: v.contexts,
      warning:  `Same tagged item (${k}) assigned to ${v.count} different contexts`,
    }));

  // Ítems sin resolver
  const unresolvedTags = tags.filter(t => !t.resolvedItemId);

  // Asignaciones semánticas por ítem
  const itemSemanticAssignments: import('../types').ItemSemanticAssignment[] = [];
  const assignedItems = new Map<string, import('../types').ItemSemanticAssignment>();

  for (const tag of tags) {
    if (!tag.resolvedItemId) continue;
    const existing = assignedItems.get(tag.resolvedItemId);
    if (!existing) {
      const entry: import('../types').ItemSemanticAssignment = {
        itemId:              tag.resolvedItemId,
        sourceTag:           tag.rawTag,
        roleFromBrief:       tag.semanticRole,
        destinationFromBrief: tag.semanticDest,
      };
      assignedItems.set(tag.resolvedItemId, entry);
      itemSemanticAssignments.push(entry);
    } else {
      // Ítem duplicado — enriquecer si hay más info
      if (!existing.roleFromBrief && tag.semanticRole) existing.roleFromBrief = tag.semanticRole;
      if (!existing.destinationFromBrief && tag.semanticDest) existing.destinationFromBrief = tag.semanticDest;
    }
  }

  // Pairings explícitos (accesorio + outfit)
  const explicitPairings = detectExplicitPairing(brief, tags, items);

  // Brief sin tags (para uso interno)
  const briefWithoutTags = brief.replace(/@([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+\d*)/gi, '').replace(/\s{2,}/g, ' ').trim();

  // Warnings de cobertura
  const warnings: string[] = [];
  for (const tag of unresolvedTags) {
    if (tag.warning) warnings.push(tag.warning);
  }
  for (const dup of duplicateTagUses) warnings.push(dup.warning);

  // Detectar declaración de count vs tags únicos
  const declaredCountMatch = brief.match(/\b(\d+)\s+(looks?|outfits?)/i);
  const uniqueTaggedOutfitIds = new Set(
    tags.filter(t => t.slotType === 'outfit' && t.resolvedItemId).map(t => t.resolvedItemId)
  );
  const declaredCountDoesNotMatchUniqueTaggedItems = declaredCountMatch
    ? parseInt(declaredCountMatch[1], 10) !== uniqueTaggedOutfitIds.size && uniqueTaggedOutfitIds.size > 0
    : false;

  if (declaredCountDoesNotMatchUniqueTaggedItems) {
    warnings.push(
      `Brief mentions ${declaredCountMatch![1]} looks but only ${uniqueTaggedOutfitIds.size} unique outfit tag(s) were found`
    );
  }

  return {
    tags,
    unresolvedTags,
    duplicateTagUses,
    itemSemanticAssignments,
    explicitPairings,
    briefWithoutTags,
    referenceTaggingUsed: tags.length > 0,
    declaredCountDoesNotMatchUniqueTaggedItems,
    warnings,
  };
}
