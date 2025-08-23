import { selectCandidate } from '../src/selection.js';

describe('selectCandidate', () => {
  test('selects among non-dominated', () => {
    const P = [{ system: 'a' }, { system: 'b' }, { system: 'c' }];
    const S = [
      [0.5, 0.4, 0.6],
      [0.6, 0.3, 0.6],
      [0.4, 0.6, 0.5]
    ];
    const k = selectCandidate(P, S);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(k).toBeLessThan(P.length);
  });

  test('handles empty scores', () => {
    const P = [{ system: 'a' }];
    const S: number[][] = [[]];
    const k = selectCandidate(P, S);
    expect(k).toBe(0);
  });

  test('handles empty candidates and scores', () => {
    const P: any[] = [];
    const S: number[][] = [];
    const k = selectCandidate(P, S);
    expect(k).toBe(0);
  });

  test('selects the only candidate', () => {
    const P = [{ system: 'a' }];
    const S = [[0.1, 0.2]];
    const k = selectCandidate(P, S);
    expect(k).toBe(0);
  });

  test('handles ties in scores', () => {
    const P = [{ system: 'a' }, { system: 'b' }];
    const S = [
      [0.5, 0.5],
      [0.5, 0.5]
    ];
    const k = selectCandidate(P, S);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(k).toBeLessThan(P.length);
  });

  test('handles a fully dominated candidate', () => {
    const P = [{ system: 'a' }, { system: 'b' }];
    const S = [
      [0.6, 0.6], // Dominant
      [0.5, 0.5]  // Dominated
    ];
    for (let i = 0; i < 10; i++) {
      const k = selectCandidate(P, S);
      expect(k).toBe(0);
    }
  });
});


