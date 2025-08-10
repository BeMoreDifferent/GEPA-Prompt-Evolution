import path from 'node:path';
import * as fs from 'node:fs/promises';
import { main as cliMain } from '../src/cli.js';

describe('CLI snapshot: best system and run artifacts', () => {
  const testName = path.basename(new URL(import.meta.url).pathname).replace(/\.[^.]+$/, '');
  const runsRoot = path.join(process.cwd(), 'runs-test', testName);
  const cfgPath = path.join(process.cwd(), 'examples', 'config.min.json');
  const inPath = path.join(process.cwd(), 'examples', 'input.min.prompts.json');

  const hasKey = !!process.env.OPENAI_API_KEY;
  (hasKey ? test : test.skip)('produces string best system; files stable', async () => {
    const args = ['--runs-root', runsRoot, '--input', inPath, '--config', cfgPath];
    const origArgv = process.argv.slice(0);
    try {
      (process as any).argv = ['node', 'cli', ...args];
      await cliMain();
    } finally {
      (process as any).argv = origArgv;
    }

    const entries = await fs.readdir(runsRoot, { withFileTypes: true });
    const runDirs = entries.filter(e => e.isDirectory());
    expect(runDirs.length).toBeGreaterThan(0);
    const latestRun = path.join(runsRoot, runDirs[runDirs.length - 1].name);

    const files = await fs.readdir(latestRun);
    expect(files).toEqual(expect.arrayContaining(['config.json', 'input.json', 'state.json', 'iterations']));

    const bestJson = JSON.parse(await fs.readFile(path.join(latestRun, 'best.json'), 'utf8'));
    expect(typeof bestJson.system).toBe('string');
  });
});


