/** Minimal runtime schema for structured LLM outputs without external deps. */

export interface CompletionSchema<T> {
  parse(input: unknown): T;
}

/** Build a schema for an object whose known keys are numbers. Unknown keys are ignored. */
export function objectOfNumberKeys(keys: string[]): CompletionSchema<Record<string, number>> {
  const keySet = new Set(keys);
  return {
    parse(input: unknown): Record<string, number> {
      const out: Record<string, number> = {};
      if (typeof input !== 'object' || input === null) return out;
      for (const k of Object.keys(input as Record<string, unknown>)) {
        if (!keySet.has(k)) continue;
        const v = (input as Record<string, unknown>)[k];
        out[k] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
      }
      // Ensure all requested keys exist
      for (const k of keys) if (!(k in out)) out[k] = 0;
      return out;
    }
  };
}

/** Safe JSON.parse with schema enforcement. Returns schema defaults on failure. */
export function safeParseWithSchema<T>(raw: string, schema: CompletionSchema<T>): T {
  try {
    const j = JSON.parse(typeof raw === 'string' ? raw.trim() : String(raw));
    return schema.parse(j);
  } catch {
    // On parse failure, attempt to parse loose JSON substring if present
    const m = String(raw).match(/\{[\s\S]*\}/);
    if (m) {
      try { return schema.parse(JSON.parse(m[0])); } catch {/* fallthrough */}
    }
    // Last resort: parse against empty object
    return schema.parse({});
  }
}

/** Helper to clamp numeric field to [min,max] with default. */
export function clampNumber(x: unknown, min = 0, max = 1, def = 0): number {
  const n = typeof x === 'number' && Number.isFinite(x) ? x : def;
  return Math.max(min, Math.min(max, n));
}


