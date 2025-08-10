import { parseArgs, main } from '../src/cli.js';
describe('cli.parseArgs', () => {
    test('parses flags and values', () => {
        const args = parseArgs(['--input', 'a.json', '--config', 'b.json', '--flag']);
        expect(args.input).toBe('a.json');
        expect(args.config).toBe('b.json');
        expect(args.flag).toBe('true');
    });
    test('handles empty argv', () => {
        expect(parseArgs([])).toEqual({});
    });
});
describe('cli.main exported', () => {
    test('main is a function', () => {
        expect(typeof main).toBe('function');
    });
});
