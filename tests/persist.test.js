import path from 'node:path';
import * as fs from 'node:fs/promises';
import { nowId, slug, sha, writeJsonAtomic, readJson, buildRunDir, initRun, resumeRun, saveState, saveIteration, acquireLock } from '../src/persist.js';
describe('persist helpers', () => {
    test('nowId/slug/sha basic properties', () => {
        expect(nowId()).toContain('-');
        expect(slug('Hello World!!', 10)).toMatch(/^[a-z0-9\-]+$/);
        expect(sha('x')).toHaveLength(16);
    });
    test('write/read json roundtrip', async () => {
        const f = path.join(process.cwd(), 'tmp.test.json');
        await writeJsonAtomic(f, { a: 1 });
        const j = await readJson(f, {});
        expect(j.a).toBe(1);
        await fs.rm(f, { force: true });
    });
    test('buildRunDir contains slug/sha', () => {
        const p = buildRunDir('runs', { system: 'Seed System' });
        expect(p).toContain('runs/');
    });
});
describe('run lifecycle', () => {
    const testName = path.basename(new URL(import.meta.url).pathname).replace(/\.[^.]+$/, '');
    const runsRoot = path.join(process.cwd(), 'runs-test', testName);
    test('init/resume/save/lock/iteration', async () => {
        const ctx = await initRun({ runsRoot, inputObj: { system: 's' }, configObj: { a: 1 }, outFile: null });
        const unlock = await acquireLock(ctx.runDir);
        await saveIteration(ctx.iterationsDir, 1, { ok: true });
        ctx.state.iter = 1;
        await saveState(ctx.runDir, ctx.state);
        const resumed = await resumeRun(ctx.runDir);
        expect(resumed.state.iter).toBe(1);
        await unlock();
    });
});
