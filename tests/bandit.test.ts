import { UCB1 } from '../src/bandit.js';

describe('UCB1', () => {
  test('pick returns an id', () => {
    const b = new UCB1(['a', 'b']);
    const id = b.pick();
    expect(['a', 'b']).toContain(id);
  });

  test('update adjusts means within [0,1]', () => {
    const b = new UCB1(['a']);
    b.update('a', 1.2);
    b.update('a', -5);
    const id = b.pick();
    expect(id).toBe('a');
  });

  test('serialize/deserialize roundtrip', () => {
    const b = new UCB1(['x']);
    b.update('x', 0.9);
    const s = b.serialize();
    const b2 = UCB1.from(s);
    expect(b2.pick()).toBe('x');
  });

  test('handles empty ids array', () => {
    const b = new UCB1([]);
    expect(b.pick()).toBe('');
  });

  test('does not throw on update of non-existent arm', () => {
    const b = new UCB1(['a']);
    expect(() => b.update('b', 1)).not.toThrow();
  });

  test('prefers arm with higher reward', () => {
    const b = new UCB1(['a', 'b']);
    // Initial exploration
    b.pick();
    b.pick();
    // Update 'b' with high reward
    b.update('b', 1);
    b.update('b', 1);
    // Update 'a' with low reward
    b.update('a', 0.1);
    b.update('a', 0.1);

    // Now, 'b' should be picked more often
    const picks = { a: 0, b: 0 };
    for (let i = 0; i < 10; i++) {
      const id = b.pick();
      picks[id]++;
    }
    expect(picks.b).toBeGreaterThan(picks.a);
  });
});


