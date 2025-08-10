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

  test('parses --api-key value', () => {
    const args = parseArgs(['--api-key', 'abc123']);
    expect(args['api-key']).toBe('abc123');
  });

  test('parses --log and --log-level', () => {
    const args = parseArgs(['--log', '--log-level', 'debug']);
    expect(args.log).toBe('true');
    expect(args['log-level']).toBe('debug');
  });
});

describe('cli.main exported', () => {
  test('main is a function', () => {
    expect(typeof main).toBe('function');
  });
});


