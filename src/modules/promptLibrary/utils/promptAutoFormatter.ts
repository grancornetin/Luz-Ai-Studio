const BLOCK_ORDER = [
  'subject', 'type', 'style',
  'environment', 'background', 'setting',
  'lighting',
  'camera', 'composition', 'lens',
  'global_settings', 'quality', 'mood', 'atmosphere',
];

function cleanTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  return tokens
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .filter(t => {
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function fromJSON(raw: string): string | null {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj !== 'object' || obj === null) return null;

    const parts: string[] = [];

    // Walk in logical block order first, then any remaining keys
    const handled = new Set<string>();

    for (const key of BLOCK_ORDER) {
      if (key in obj) {
        const val = obj[key];
        const text = Array.isArray(val) ? val.join(', ') : String(val);
        if (text.trim()) parts.push(text.trim());
        handled.add(key);
      }
    }

    for (const key of Object.keys(obj)) {
      if (handled.has(key)) continue;
      const val = obj[key];
      if (typeof val === 'object' && val !== null) {
        // nested object — flatten values
        const nested = Object.values(val)
          .map(v => (Array.isArray(v) ? v.join(', ') : String(v)))
          .filter(Boolean);
        if (nested.length) parts.push(nested.join(', '));
      } else {
        const text = String(val).trim();
        if (text) parts.push(text);
      }
    }

    const tokens = cleanTokens(parts.flatMap(p => p.split(',')));
    return tokens.join(', ');
  } catch {
    return null;
  }
}

function fromText(raw: string): string {
  // Split by comma or newline, clean each fragment
  const tokens = raw
    .split(/[,\n]+/)
    .map(t => t.replace(/[{}[\]"']/g, '').trim())
    .filter(t => t.length > 1);

  return cleanTokens(tokens).join(', ');
}

export function formatPrompt(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith('{')) {
    const result = fromJSON(trimmed);
    if (result) return result;
  }

  return fromText(trimmed);
}
