### GEPA Prompt Evolution (GEPA-SPO)

[![npm version](https://img.shields.io/npm/v/gepa-spo.svg)](https://www.npmjs.com/package/gepa-spo)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Genetic-Pareto prompt optimizer to evolve system prompts from a few rollouts. GEPA performs natural-language reflection over full trajectories, mutates the system prompt with multiple strategies, and maintains a Pareto frontier rather than collapsing to a single candidate. A simple UCB1 bandit selects mutation strategies by observed uplift, with optional holdout gating to prevent regressions.

This repository provides:
- **CLI**: Optimize a system prompt from JSON inputs and configs.
- **Core Engine**: Type-safe TypeScript APIs for custom integrations.
- **Persistence**: Reproducible runs with checkpoints, best prompt export, and resume support.
- **Examples**: Minimal and task-specific configs and input sets.

---

### Installation & usage

```bash
# Run via npx (no install). Requires Node >= 18
export OPENAI_API_KEY=...  # or pass --api-key

# Using npm
npx gepa-spo --runs-root ./runs \
  --input /absolute/path/to/input.json \
  --config /absolute/path/to/config.json

# Using pnpm
pnpm dlx gepa-spo --runs-root ./runs \
  --input /absolute/path/to/input.json \
  --config /absolute/path/to/config.json

# Optional: local install for development
pnpm install && pnpm build
```

Environment:
- Set `OPENAI_API_KEY` in your shell environment, or pass `--api-key` via CLI.
- Optional: `baseURL` in config to point to a different OpenAI-compatible endpoint.

Security and privacy:
- No prompts, keys, or outputs are logged unless `--log` is set. Avoid placing secrets in input/config files.

---

### Quick start (CLI)

The CLI binary is `gepa-spo` and is available via `npx` or `pnpm dlx`:

```bash
# Minimal run (provide your own input/config JSON files)
npx gepa-spo \
  --runs-root ./runs \
  --input /absolute/path/to/input.json \
  --config /absolute/path/to/config.json \
  --log --log-level debug

# pnpm users can also run
# pnpm dlx gepa-spo --runs-root ./runs --input /abs/path/input.json --config /abs/path/config.json
```

On success, the best evolved system prompt is printed to stdout and persisted under the run directory. To write the best prompt to a specific file:

```bash
npx gepa-spo \
  --runs-root ./runs \
  --input /absolute/path/to/input.json \
  --config /absolute/path/to/config.json \
  --out ./runs/best.txt
```

Resume a previous run:

```bash
npx gepa-spo --resume /absolute/path/to/runs/<run-folder>
```

CLI flags:
- `--runs-root <dir>`: Root folder for new runs (default: `runs`).
- `--input <file>`: JSON file with `system` and `prompts`.
- `--config <file>`: JSON config (see schema below).
- `--out <file>`: Optional path to write the latest best system prompt.
- `--resume <runDir>`: Resume from an existing run directory.
- `--api-key <key>`: OpenAI API key (overrides `OPENAI_API_KEY`).
- `--log` (bool): Enable colored, high-level progress logging to stderr.
- `--log-level <level>`: One of `error|warn|info|debug` (default `info`).

Exit conditions: The optimizer runs until the budget is exhausted.

Edge cases handled by CLI:
- **Tiny datasets**: If the feedback set would be empty, the Pareto set is reused for feedback to ensure progress.
- **Budget starvation**: Seeding reserves budget to guarantee at least one full iteration; the loop stops cleanly when `budgetLeft` reaches 0.
- **Concurrent runs**: A per-run lock prevents two writers on the same run directory.

---

### Input format

`examples/input.min.prompts.json`:

```json
{
  "system": "You are a helpful assistant. Be concise.",
  "prompts": [
    { "id": "p1", "user": "Name two benefits of unit tests." }
  ]
}
```

`prompts[i].meta` is optional and forwarded to numeric metrics if you supply one.

Another example (`examples/input.prompts.json`) shows a multi-item dataset. The `examples/input.atomic_facts.json` demonstrates a structured evaluation task.

---

### Config schema

Configs live in JSON files (see `examples/config.min.json` and `examples/config.json`). Supported keys:

- `actorModel` (string): Model for the actor (prompt evolution rollouts), e.g., `gpt-5-mini`.
- `judgeModel` (string): Model for the judge (evaluation), e.g., `gpt-5-mini`.
- `budget` (number): Total evaluation budget (number of LLM calls across minibatches and gates).
- `minibatchSize` (number): Number of feedback-set items evaluated per iteration.
- `paretoSize` (number): Number of items in the Pareto set for multi-objective tracking.
- `holdoutSize` (number, optional): Size of the holdout set (subset of train) to gate regressions.
- `epsilonHoldout` (number, optional): Tolerance added to the child vs parent holdout comparison (default: 0.02).
- `actorTemperature` (number, optional): Temperature for actor calls (default: 0.4 in CLI).
- `actorMaxTokens` (number, optional): Max tokens for actor calls (default: 512 in CLI).
- `rubric` (string, optional): Judge rubric text for score and feedback.
- `strategiesPath` (string, optional): Path to strategy hints JSON (default: `strategies/strategies.json`).
- `baseURL` (string, optional): Override OpenAI API base URL.
- `scoreForPareto` ("muf" | "mu", optional): Which scorer populates the Pareto score matrix `S`. Default "muf" (judge score). Set to "mu" to use numeric metric.

Example (`examples/config.min.json`):

```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 120,
  "minibatchSize": 3,
  "paretoSize": 6,
  "holdoutSize": 3,
  "epsilonHoldout": 0.01,
  "actorTemperature": 0.2,
  "actorMaxTokens": 700,
  "rubric": "Evaluate only the JSON quality and adherence to rules...",
  "strategiesPath": "strategies/strategies.json"
}
```

---

### Strategies

Strategy hints are plain JSON objects with `id` and `hint` used to steer the reflection step, e.g. `strategies/strategies.json`:

```json
[
  { "id": "polya-4step", "hint": "Apply Pólya’s 4 steps: Understand, Plan, Execute, Reflect..." },
  { "id": "fermi-estimate", "hint": "When unknown quantities appear, use Fermi estimation..." }
]
```

The UCB1 bandit selects among these strategy IDs using observed uplift during optimization.

How strategy scheduling works:
- **Prefilter**: Before the first iteration, strategies may be filtered against the corpus preview using the LLM to remove irrelevant hints.
- **Adaptive explore/exploit**: Exploration probability increases when recent uplift slows, encouraging more diverse mutations and occasional no-hint (pure reflection) steps.
- **Re-prefilter**: If gains stagnate for several iterations, the strategy set may be re-filtered to re-focus on promising hints.

---

### What gets written to disk

Under `--runs-root`, each run creates a folder like:

```
<runs-root>/<ISO8601>-<slug>-<sha16>/
├─ input.json            # copied from your input
├─ config.json           # copied from your config
├─ state.json            # optimizer state (supports resume)
├─ best.json             # latest best system and metadata
├─ .outpath              # optional, stores the --out destination path
└─ iterations/
   ├─ iter-0001.json
   ├─ iter-0002.json
   └─ ...
```

The CLI holds an exclusive lock file during a run to avoid concurrent writers.

---

### Programmatic API (TypeScript)

```ts
// When installed as a package, import from the built output
import { runGEPA_System } from 'gepa-spo/dist/gepa.js';
import { makeOpenAIClients } from 'gepa-spo/dist/llm_openai.js';
import type { Candidate, TaskItem, GepaOptions, MetricMu, FeedbackMuF } from 'gepa-spo/dist/types.js';

const input = {
  system: 'You are a helpful assistant. Be concise.',
  prompts: [{ id: 'p1', user: 'Name two benefits of unit tests.' }]
};

const { actorLLM, chatLLM } = makeOpenAIClients({
  apiKey: process.env.OPENAI_API_KEY!,
  actorModel: 'gpt-5-mini',
  judgeModel: 'gpt-5-mini'
});

const execute: GepaOptions['execute'] = async ({ candidate, item }) => {
  // Single-turn chat using judge client for simplicity in this snippet
  const output = await chatLLM.chat([
    { role: 'system', content: candidate.system },
    { role: 'user', content: item.user }
  ]);
  return { output };
};

const mu: MetricMu = () => 0; // numeric metric optional; Pareto still maintained

const muf: FeedbackMuF = async ({ item, output }) => {
  // Provide your own judging logic or reuse judgeScore()
  return { score: 0.5, feedbackText: 'neutral' };
};

const seed: Candidate = { system: input.system };
const dtrain: TaskItem[] = input.prompts.map((p, i) => ({ id: p.id ?? String(i + 1), user: p.user }));

const best = await runGEPA_System(seed, dtrain, {
  execute,
  mu,
  muf,
  llm: actorLLM,
  budget: 50,
  minibatchSize: 3,
  paretoSize: 4,
  holdoutSize: 2,
  epsilonHoldout: 0.02,
  strategiesPath: 'strategies/strategies.json'
});

console.log(best.system);
```

Key exported building blocks (see `src/`):
- `runGEPA_System(...)` – core optimizer loop with seeding, bandit, and holdout gates.
- `makeOpenAIClients(...)` – minimal OpenAI clients for responses/chat APIs.
- `judgeScore(...)` – JSON-constrained rubric-based evaluator.
- Types: `Candidate`, `TaskItem`, `GepaOptions`, `LLM`, `ChatLLM`.

Core logic overview:
- **Seeding**: Screen a small subset of the feedback set with the top-K strategy hints to propose initial children. Evaluate children on the Pareto set and keep those that help.
- **Iteration**: For the selected parent, evaluate on a minibatch to get before scores and feedback, reflect to propose a new system, then re-evaluate after.
- **Bandit reward**: Uplift `(after - before)` is mapped from [-1, 1] to [0, 1] and used to update the UCB1 bandit when a hint was used.
- **Holdout gate**: If a holdout set exists, accept only if child ≥ parent on holdout within `epsilonHoldout` tolerance.
- **Pareto tracking**: For every accepted child, score across the Pareto set and update the running best by Pareto mean.

### Crossover (Merge) Functionality

GEPA supports optional system-aware crossover operations that combine complementary modules from different candidates:

- **Crossover Probability**: Set `crossoverProbability` in config (default: 0, mutation only).
- **Module-wise Merging**: For modular candidates, combines modules based on lineage and scores.
- **Lineage Tracking**: Maintains ancestry information to avoid merging direct relatives.
- **Novelty Detection**: Ensures merged candidates introduce module-level novelty.

Example configuration with 30% crossover probability:
```json
{
  "budget": 50,
  "minibatchSize": 3,
  "paretoSize": 5,
  "crossoverProbability": 0.3
}
```

See `examples/crossover-example.json` for a complete example.

---

### Testing

```bash
pnpm test        # jest
pnpm typecheck   # tsc --noEmit
pnpm build       # emit to dist/
```

Tests include unit and integration coverage for the bandit, selection, reflection, persistence, and CLI wrapper.

To run a minimal end-to-end smoke test locally with example configs:

```bash
pnpm build && node dist/cli.js \
  --runs-root ./runs-test/demo \
  --input ./examples/input.min.prompts.json \
  --config ./examples/config.min.json \
  --log --log-level info
```

If you see `ExperimentalWarning: VM Modules`, it is expected in our Jest setup with ESM.

---

### Contributing

Contributions are welcome! Please open an issue to discuss your idea or a draft PR if you already have a prototype.

- Fork the repo and create a feature branch.
- Ensure `pnpm build`, `pnpm typecheck`, and `pnpm test` are green.
- Follow Conventional Commits for PR titles/messages (e.g., `feat:`, `fix:`, `docs:`).
- Keep code small and well-tested; add Jest tests for new behavior.

See `CONTRIBUTING.md` for details.

---

### License

This project is licensed under the MIT License – see `LICENSE` for details.

---

### Design notes

- Maintains a Pareto frontier `S[k][i]` over a fixed Pareto subset for multi-objective robustness.
- UCB1 bandit chooses mutation strategies by uplift; serializes state for resumability.
- Optional holdout gating with epsilon tolerance reduces overfitting to the feedback minibatch.
- Deterministic run folders and atomic writes provide reproducibility and crash safety.