import path from 'node:path';
import * as fs from 'node:fs/promises';
import { main as cliMain } from '../src/cli.js';

/**
 * Lightweight GEPA smoke test: tiny budget and 1 prompt to exercise the full pipeline
 * and produce real artifacts under `runs-test/`.
 */
describe('GEPA minimal run', () => {
  const testName = path.basename(new URL(import.meta.url).pathname).replace(/\.[^.]+$/, '');
  const runsRoot = path.join(process.cwd(), 'runs-test', testName);
  const cfgPath = path.join(process.cwd(), 'examples', 'config.min.json');
  const inPath = path.join(process.cwd(), 'examples', 'input.min.prompts.json');

  const hasKey = !!process.env.OPENAI_API_KEY;
  (hasKey ? test : test.skip)('executes a minimal optimization and writes artifacts', async () => {
    // Prepare args by writing temp files so CLI can resolve them
    const args = [
      '--runs-root', runsRoot,
      '--input', inPath,
      '--config', cfgPath
    ];

    const origArgv = process.argv.slice(0);
    try {
      // Simulate CLI invocation
      (process as any).argv = ['node', 'cli', ...args];
      await cliMain();
    } finally {
      (process as any).argv = origArgv;
    }

    // Verify run directory created with expected files
    const entries = await fs.readdir(runsRoot, { withFileTypes: true });
    const runDirs = entries.filter(e => e.isDirectory());
    expect(runDirs.length).toBeGreaterThan(0);
    const latestRun = path.join(runsRoot, runDirs[runDirs.length - 1].name);

    const files = await fs.readdir(latestRun);
    expect(files).toEqual(expect.arrayContaining(['config.json', 'input.json', 'state.json', 'iterations']));

    const iters = await fs.readdir(path.join(latestRun, 'iterations'));
    expect(iters.length).toBeGreaterThanOrEqual(1);
  });
});


