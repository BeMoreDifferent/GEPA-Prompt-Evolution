import {
  mergeCandidates,
  areDirectRelatives,
  hasBeenTriedBefore,
  findSharedAncestor,
  hasModuleNovelty
} from '../src/modules.js';
import type { Candidate } from '../src/types.js';

describe('merge.ts - merge functionality', () => {
  const singleSystemA: Candidate = { system: 'You are a helpful assistant.' };
  const singleSystemB: Candidate = { system: 'You are a friendly assistant.' };
  
  const modularA: Candidate = {
    modules: [
      { id: 'personality', prompt: 'You are friendly.' },
      { id: 'instructions', prompt: 'Always be helpful.' },
      { id: 'safety', prompt: 'Never be harmful.' }
    ]
  };
  
  const modularB: Candidate = {
    modules: [
      { id: 'personality', prompt: 'You are professional.' },
      { id: 'instructions', prompt: 'Always be accurate.' },
      { id: 'safety', prompt: 'Never be harmful.' }
    ]
  };

  describe('mergeCandidates', () => {
    test('merges single-system candidates by taking better scoring parent', () => {
      const result = mergeCandidates(singleSystemA, singleSystemB, [], [], 0.8, 0.6);
      expect(result).toEqual(singleSystemA);
      
      const result2 = mergeCandidates(singleSystemA, singleSystemB, [], [], 0.4, 0.9);
      expect(result2).toEqual(singleSystemB);
    });

    test('merges modular candidates with disjoint module changes', () => {
      // Parent A changed module 0, Parent B changed module 1
      const lineageA = [0];
      const lineageB = [1];
      
      const result = mergeCandidates(modularA, modularB, lineageA, lineageB, 0.8, 0.7);
      
      expect(result.modules).toEqual([
        modularA.modules[0],  // From A (changed in A only)
        modularB.modules[1],  // From B (changed in B only)
        modularA.modules[2]   // From A (default, neither changed)
      ]);
    });

    test('merges modular candidates with overlapping module changes', () => {
      // Both parents changed module 0
      const lineageA = [0];
      const lineageB = [0];
      
      const result = mergeCandidates(modularA, modularB, lineageA, lineageB, 0.9, 0.7);
      
      expect(result.modules).toEqual([
        modularA.modules[0],  // From A (better score)
        modularA.modules[1],  // From A (default)
        modularA.modules[2]   // From A (default)
      ]);
    });

    test('throws error for candidates with different module counts', () => {
      const modularC: Candidate = {
        modules: [
          { id: 'personality', prompt: 'You are friendly.' },
          { id: 'instructions', prompt: 'Always be helpful.' }
        ]
      };
      
      expect(() => mergeCandidates(modularA, modularC, [], [], 0.8, 0.7))
        .toThrow('Cannot merge candidates with different module counts');
    });

    test('throws error for incompatible candidate structures', () => {
      expect(() => mergeCandidates(singleSystemA, modularA, [], [], 0.8, 0.7))
        .toThrow('Cannot merge candidates with incompatible structures');
    });
  });

  describe('areDirectRelatives', () => {
    const lineage = [
      { candidateIndex: 0, parentIndex: undefined },
      { candidateIndex: 1, parentIndex: 0 },
      { candidateIndex: 2, parentIndex: 1 },
      { candidateIndex: 3, parentIndex: 0 },
      { candidateIndex: 4, parentIndex: 2 }
    ];

    test('identifies direct parent-child relationships', () => {
      expect(areDirectRelatives(0, 1, lineage)).toBe(true);
      expect(areDirectRelatives(1, 2, lineage)).toBe(true);
      expect(areDirectRelatives(0, 3, lineage)).toBe(true);
    });

    test('identifies ancestor-descendant relationships', () => {
      expect(areDirectRelatives(0, 2, lineage)).toBe(true);
      expect(areDirectRelatives(0, 4, lineage)).toBe(true);
      expect(areDirectRelatives(1, 4, lineage)).toBe(true);
    });

    test('returns false for unrelated candidates', () => {
      expect(areDirectRelatives(1, 3, lineage)).toBe(false);
      expect(areDirectRelatives(3, 4, lineage)).toBe(false);
    });

    test('returns false for same candidate', () => {
      expect(areDirectRelatives(1, 1, lineage)).toBe(false);
    });
  });

  describe('hasBeenTriedBefore', () => {
    const triedTriplets: Array<[number, number, number]> = [
      [1, 2, 0],
      [3, 4, 1],
      [5, 6, 2]
    ];

    test('identifies previously tried triplets', () => {
      expect(hasBeenTriedBefore(1, 2, 0, triedTriplets)).toBe(true);
      expect(hasBeenTriedBefore(3, 4, 1, triedTriplets)).toBe(true);
    });

    test('handles symmetric ordering', () => {
      expect(hasBeenTriedBefore(2, 1, 0, triedTriplets)).toBe(true);
      expect(hasBeenTriedBefore(4, 3, 1, triedTriplets)).toBe(true);
    });

    test('returns false for new triplets', () => {
      expect(hasBeenTriedBefore(1, 3, 0, triedTriplets)).toBe(false);
      expect(hasBeenTriedBefore(2, 4, 1, triedTriplets)).toBe(false);
    });
  });

  describe('findSharedAncestor', () => {
    const lineage = [
      { candidateIndex: 0, parentIndex: undefined },
      { candidateIndex: 1, parentIndex: 0 },
      { candidateIndex: 2, parentIndex: 1 },
      { candidateIndex: 3, parentIndex: 0 },
      { candidateIndex: 4, parentIndex: 2 }
    ];

    test('finds shared ancestor', () => {
      expect(findSharedAncestor(2, 3, lineage)).toBe(0);
      expect(findSharedAncestor(4, 3, lineage)).toBe(0);
    });

    test('returns null when no shared ancestor exists', () => {
      // Create a different lineage where 1 and 3 have no shared ancestor
      const differentLineage = [
        { candidateIndex: 0, parentIndex: undefined },
        { candidateIndex: 1, parentIndex: 0 },
        { candidateIndex: 2, parentIndex: undefined },
        { candidateIndex: 3, parentIndex: 2 },
        { candidateIndex: 4, parentIndex: 1 }
      ];
      expect(findSharedAncestor(1, 3, differentLineage)).toBe(null);
    });

    test('returns null for candidates with no lineage', () => {
      expect(findSharedAncestor(5, 6, lineage)).toBe(null);
    });
  });

  describe('hasModuleNovelty', () => {
    test('detects novelty when merged module differs from both parents', () => {
      const mergedCandidate: Candidate = {
        modules: [
          { id: 'personality', prompt: 'You are neutral.' },  // Different from both
          { id: 'instructions', prompt: 'Always be helpful.' }, // Same as A
          { id: 'safety', prompt: 'Never be harmful.' }        // Same as both
        ]
      };
      
      const lineageA = [0, 1];
      const lineageB = [0];
      
      expect(hasModuleNovelty(mergedCandidate, modularA, modularB, lineageA, lineageB)).toBe(true);
    });

    test('detects novelty when merged module differs from one parent', () => {
      const mergedCandidate: Candidate = {
        modules: [
          { id: 'personality', prompt: 'You are friendly.' },  // Same as A
          { id: 'instructions', prompt: 'Always be accurate.' }, // Different from A, same as B
          { id: 'safety', prompt: 'Never be harmful.' }         // Same as both
        ]
      };
      
      const lineageA = [0];
      const lineageB = [1];
      
      expect(hasModuleNovelty(mergedCandidate, modularA, modularB, lineageA, lineageB)).toBe(true);
    });

    test('returns false when merged candidate is identical to one parent', () => {
      const lineageA = [0];
      const lineageB = [1];
      
      expect(hasModuleNovelty(modularA, modularA, modularB, lineageA, lineageB)).toBe(false);
    });

    test('returns false when no modules were changed', () => {
      const mergedCandidate: Candidate = {
        modules: [
          { id: 'personality', prompt: 'You are friendly.' },
          { id: 'instructions', prompt: 'Always be helpful.' },
          { id: 'safety', prompt: 'Never be harmful.' }
        ]
      };
      
      const lineageA: number[] = [];
      const lineageB: number[] = [];
      
      expect(hasModuleNovelty(mergedCandidate, modularA, modularB, lineageA, lineageB)).toBe(false);
    });
  });
});
