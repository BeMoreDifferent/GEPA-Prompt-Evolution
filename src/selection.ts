import type { Candidate } from './types.js';

function getInstanceWiseBests(
  numCandidates: number,
  scores: number[][]
): Array<Set<number>> {
  const nItems = scores[0]?.length ?? 0;
  return Array.from({ length: nItems }, (_, i) => {
    let best = -Infinity;
    for (let k = 0; k < numCandidates; k++) {
      best = Math.max(best, scores[k]?.[i] ?? -Infinity);
    }
    const set = new Set<number>();
    for (let k = 0; k < numCandidates; k++) {
      if ((scores[k]?.[i] ?? -Infinity) === best) {
        set.add(k);
      }
    }
    return set;
  });
}

function pruneDominated(
  candidateSet: Set<number>,
  scores: number[][]
): number[] {
  const nItems = scores[0]?.length ?? 0;
  const candidates = [...candidateSet];
  const dominated = new Set<number>();

  const dominates = (a: number, b: number): boolean => {
    let geAll = true,
      gtAny = false;
    for (let i = 0; i < nItems; i++) {
      const scoreA = scores[a]?.[i] ?? -1e9;
      const scoreB = scores[b]?.[i] ?? -1e9;
      if (scoreA < scoreB) geAll = false;
      if (scoreA > scoreB) gtAny = true;
    }
    return geAll && gtAny;
  };

  for (const a of candidates) {
    for (const b of candidates) {
      if (a !== b && dominates(b, a)) {
        dominated.add(a);
      }
    }
  }

  return candidates.filter(k => !dominated.has(k));
}

function weightedSample(
  candidates: number[],
  weights: number[]
): number {
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  let r = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/** Pareto-based candidate selection (Algorithm-2 style). Returns index k in P. */
export function selectCandidate(
  candidates: Candidate[],
  scores: number[][]
): number {
  if (candidates.length === 0) return 0;
  const nItems = scores[0]?.length ?? 0;
  if (nItems === 0) return 0;

  // Instance-wise best sets
  const instanceWiseBestSets = getInstanceWiseBests(candidates.length, scores);

  // Union and prune dominated
  const candidateUnion = new Set<number>();
  for (const set of instanceWiseBestSets) {
    for (const k of set) {
      candidateUnion.add(k);
    }
  }
  const nonDominated = pruneDominated(candidateUnion, scores);

  // Weighted by frequency of appearances in instance-wise best sets
  const frequencies = nonDominated.map(k =>
    instanceWiseBestSets.reduce((acc, set) => acc + (set.has(k) ? 1 : 0), 0)
  );

  return weightedSample(nonDominated, frequencies);
}


