import type { Candidate, TaskItem, ExecuteResult, SystemExecute, MetricMu, FeedbackMuF, LLM, ChatLLM, ChatMessage, GepaOptions, GEPAState, Ucb1State, Module } from '../src/types.js';

describe('types.ts - type shapes compile', () => {
  test('basic interfaces', () => {
    const c: Candidate = { system: 's' };
    const t: TaskItem = { id: '1', user: 'u' };
    const e: ExecuteResult = { output: 'o' };
    expect(c.system && t.id && e.output).toBeTruthy();
  });

  test('modular interfaces', () => {
    const m: Module = { id: 'test', prompt: 'test prompt' };
    const modularC: Candidate = { modules: [m] };
    expect(m.id && m.prompt && modularC.modules).toBeTruthy();
  });

  test('function types', async () => {
    const exec: SystemExecute = async ({ candidate, item }) => ({ output: `${candidate.system}:${item.user}` });
    const mu: MetricMu = (y, _m) => (y.length % 2 ? 1 : 0);
    const muf: FeedbackMuF = async ({ output }) => ({ score: output.length > 0 ? 1 : 0, feedbackText: 'ok' });
    const out = await exec({ candidate: { system: 's' }, item: { id: '1', user: 'u' } });
    expect(mu(out.output, null)).toBe(1);
    const jf = await muf({ item: { id: '1', user: 'u' }, output: out.output });
    expect(jf.score).toBe(1);
  });

  test('LLM shapes', async () => {
    const llm: LLM = { complete: async (p: string) => p.toUpperCase() };
    const chat: ChatLLM = { chat: async (m: ChatMessage[]) => m.map(x => x.content).join('|') };
    expect(await llm.complete('a')).toBe('A');
    expect(await chat.chat([{ role: 'user', content: 'x' }])).toContain('x');
  });

  test('state shapes', () => {
    const s: GEPAState = { version: 2, budgetLeft: 1, iter: 0, Psystems: ['s'], S: [], DparetoIdx: [], DfbIdx: [], DholdIdx: [], bestIdx: 0, seeded: false, bandit: null };
    const u: Ucb1State = { t: 0, stats: [{ id: 'a', n: 0, mean: 0 }] };
    expect(s.version).toBe(2);
    expect(u.stats[0].id).toBe('a');
  });

  test('modular state shapes', () => {
    const s: GEPAState = { 
      version: 2, 
      budgetLeft: 1, 
      iter: 0, 
      Psystems: ['s'], 
      S: [], 
      DparetoIdx: [], 
      DfbIdx: [], 
      DholdIdx: [], 
      bestIdx: 0, 
      seeded: false, 
      bandit: null,
      moduleIndex: 0,
      moduleCount: 2
    };
    expect(s.moduleIndex).toBe(0);
    expect(s.moduleCount).toBe(2);
  });
});


