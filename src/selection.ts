import type { Candidate } from './types.js';

/** Pareto-based candidate selection (Algorithm-2 style). Returns index k in P. */
export function selectCandidate(P: Candidate[], S: number[][]): number {
  if (P.length === 0) return 0;
  const nItems = S[0]?.length ?? 0;
  if (nItems === 0) return 0;

  // Instance-wise best sets P*[i]
  const Pstar: Array<Set<number>> = Array.from({ length: nItems }, (_, i) => {
    let best = -Infinity;
    for (let k = 0; k < P.length; k++) best = Math.max(best, S[k]?.[i] ?? -Infinity);
    const set = new Set<number>();
    for (let k = 0; k < P.length; k++) if ((S[k]?.[i] ?? -Infinity) === best) set.add(k);
    return set;
  });

  // Union and prune dominated
  const C = new Set<number>(); for (const s of Pstar) for (const k of s) C.add(k);
  const Carr = [...C];
  const dominated = new Set<number>();
  const dominates = (a: number, b: number): boolean => {
    let geAll = true, gtAny = false;
    for (let i = 0; i < nItems; i++) {
      const Sa = S[a]?.[i] ?? -1e9;
      const Sb = S[b]?.[i] ?? -1e9;
      if (Sa < Sb) geAll = false;
      if (Sa > Sb) gtAny = true;
    }
    return geAll && gtAny;
  };
  for (const a of Carr) for (const b of Carr) if (a !== b && dominates(b, a)) dominated.add(a);
  const Cnon = Carr.filter(k => !dominated.has(k));

  // Weighted by frequency of appearances in P*[i]
  const freq = Cnon.map(k => Pstar.reduce((acc, set) => acc + (set.has(k) ? 1 : 0), 0));
  const total = freq.reduce((a, b) => a + b, 0) || 1;
  let r = Math.random() * total;
  for (let i = 0; i < Cnon.length; i++) { r -= freq[i]; if (r <= 0) return Cnon[i]; }
  return Cnon[Cnon.length - 1];
}


