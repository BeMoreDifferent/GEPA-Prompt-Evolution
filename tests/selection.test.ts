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
    expect([0, undefined]).toContain(k);
  });
});


