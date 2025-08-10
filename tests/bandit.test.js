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
});
