import * as fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Remove only test run folders under `runs-test/` after each test.
 * Keeps the root directory and touches nothing outside it.
 */
afterEach(async () => {
  const runsRoot = path.join(process.cwd(), 'runs-test');
  const testPath = (expect.getState() as any).testPath as string | undefined;
  if (!testPath) return;
  const testFolder = path.basename(testPath).replace(/\.[^.]+$/, '');
  const scopedRoot = path.join(runsRoot, testFolder);
  try {
    const entries = await fs.readdir(scopedRoot, { withFileTypes: true });
    const deletions: Array<Promise<void>> = entries.map(e => fs.rm(path.join(scopedRoot, e.name), { recursive: true, force: true }));
    await Promise.all(deletions);
  } catch {
    // scopedRoot may not exist; ignore
  }
});


