import type { Ucb1State } from './types.js';

/** UCB1 bandit to select strategy IDs by historical uplift */
export class UCB1 {
    private t = 0;
    private stats: Array<{ id: string; n: number; mean: number }>;

    constructor(ids: string[]) {
        this.stats = ids.map(id => ({ id, n: 0, mean: 0 }));
    }

    pick(): string {
        this.t++;
        const c = Math.sqrt(2);
        let bestId = this.stats[0]?.id ?? '';
        let bestU = -Infinity;
        for (const s of this.stats) {
            const bonus = s.n ? c * Math.sqrt(Math.log(this.t) / s.n) : Number.POSITIVE_INFINITY;
            const u = (s.n ? s.mean : 0) + bonus;
            if (u > bestU) { bestU = u; bestId = s.id; }
        }
        return bestId;
    }

    update(id: string, reward: number): void {
        const s = this.stats.find(x => x.id === id); if (!s) return;
        const r = Math.max(0, Math.min(1, reward));
        s.n += 1;
        s.mean += (r - s.mean) / s.n;
    }

    serialize(): Ucb1State { return { t: this.t, stats: this.stats.map(s => ({ ...s })) }; }
    static from(obj: Ucb1State): UCB1 { const b = new UCB1([]); (b as any).t = obj.t; (b as any).stats = obj.stats.map(s => ({ ...s })); return b; }
}


