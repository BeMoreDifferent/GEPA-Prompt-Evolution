import * as fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { GEPAState } from './types.js';

export const nowId = (): string => new Date().toISOString().replace(/[:.]/g, '-');
export const slug  = (s: string, n = 24): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, n).replace(/-+$/, '') || 'run';
export const sha   = (s: string): string => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

async function ensureDir(p: string): Promise<void> { await fs.mkdir(p, { recursive: true }); }

async function atomicWrite(file: string, data: string): Promise<void> {
  const dir = path.dirname(file);
  await ensureDir(dir);
  const base = path.basename(file);
  const tmp = path.join(dir, `.${base}.tmp-${Math.random().toString(36).slice(2)}`);
  await fs.writeFile(tmp, data, 'utf8');
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.rename(tmp, file); // atomic replace on same filesystem (POSIX rename)
      return;
    } catch (e: any) {
      lastErr = e;
      if (e?.code === 'ENOENT') {
        // Rare transient on some filesystems; brief retry
        await new Promise((r) => setTimeout(r, 5));
        continue;
      }
      throw e;
    }
  }
  // Final attempt or throw last error
  try {
    await fs.rename(tmp, file);
  } catch {
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}

export async function writeJsonAtomic<T>(file: string, obj: T): Promise<void> {
  await atomicWrite(file, JSON.stringify(obj, null, 2));
}
export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as T; } catch { return fallback; }
}

export function buildRunDir(runsRoot: string, inputObj: { system?: string }): string {
  const id = `${nowId()}-${slug(inputObj.system ?? 'system')}-${sha(inputObj.system ?? '')}`;
  return path.join(runsRoot, id);
}

export async function acquireLock(dir: string): Promise<() => Promise<void>> {
  await ensureDir(dir);
  const lock = path.join(dir, '.lock');
  const h = await fs.open(lock, 'wx').catch(e => { throw new Error(`Lock exists at ${dir}. Another process running? (${(e as Error).message})`); });
  await h.write(String(process.pid));
  await h.close();
  return async () => { await fs.rm(lock, { force: true }); };
}

export async function initRun(args: {
  runsRoot: string;
  inputObj: Record<string, unknown>;
  configObj: Record<string, unknown>;
  outFile?: string | null;
}): Promise<{ runDir: string; iterationsDir: string; state: GEPAState; inputObj: Record<string, unknown>; configObj: Record<string, unknown> }> {
  const runDir = buildRunDir(args.runsRoot, args.inputObj as any);
  const iterationsDir = path.join(runDir, 'iterations');
  await ensureDir(iterationsDir);
  await writeJsonAtomic(path.join(runDir, 'input.json'), args.inputObj);
  await writeJsonAtomic(path.join(runDir, 'config.json'), args.configObj);
  if (args.outFile) await atomicWrite(path.join(runDir, '.outpath'), args.outFile);

  const state: GEPAState = {
    version: 2,
    budgetLeft: 0,
    iter: 0,
    Psystems: [String(args.inputObj['system'] ?? '')],
    S: [],
    DparetoIdx: [],
    DfbIdx: [],
    DholdIdx: [],
    bestIdx: 0,
    seeded: false,
    bandit: null
  };
  await writeJsonAtomic(path.join(runDir, 'state.json'), state);
  return { runDir, iterationsDir, state, inputObj: args.inputObj, configObj: args.configObj };
}

export async function resumeRun(runDir: string): Promise<{
  runDir: string;
  iterationsDir: string;
  state: GEPAState;
  inputObj: Record<string, unknown>;
  configObj: Record<string, unknown>;
  outPath: string | null;
}> {
  const iterationsDir = path.join(runDir, 'iterations');
  await ensureDir(iterationsDir);
  const state = await readJson<GEPAState>(path.join(runDir, 'state.json'), null as unknown as GEPAState);
  if (!state) throw new Error(`state.json missing in ${runDir}`);
  const inputObj = await readJson<Record<string, unknown>>(path.join(runDir, 'input.json'), {});
  const configObj = await readJson<Record<string, unknown>>(path.join(runDir, 'config.json'), {});
  let outPath: string | null = null;
  try { outPath = (await fs.readFile(path.join(runDir, '.outpath'))).toString(); } catch { /* ignore */ }
  return { runDir, iterationsDir, state, inputObj, configObj, outPath };
}

export async function saveState(runDir: string, state: GEPAState): Promise<void> {
  await writeJsonAtomic(path.join(runDir, 'state.json'), state);
}
export async function saveIteration(iterationsDir: string, iterNo: number, payload: unknown): Promise<void> {
  const file = path.join(iterationsDir, `iter-${String(iterNo).padStart(4, '0')}.json`);
  await writeJsonAtomic(file, payload);
}


