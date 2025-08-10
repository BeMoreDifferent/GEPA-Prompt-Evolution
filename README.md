# GEPA Prompt Evolution (GEPA-SPO)

[![npm version](https://img.shields.io/npm/v/gepa-spo.svg)](https://www.npmjs.com/package/gepa-spo)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

> **Genetic-Pareto prompt optimizer** to evolve system prompts from a few rollouts. GEPA performs natural-language reflection over full trajectories, mutates prompts with multiple strategies, and maintains a Pareto frontier rather than collapsing to a single candidate.

## 🚀 Quick Start

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Run optimization (no installation required)
npx gepa-spo \
  --runs-root ./runs \
  --input ./examples/input.prompts.json \
  --config ./examples/config.json \
  --log
```

**What you get:**
- ✅ **CLI Tool**: Optimize prompts from JSON inputs
- ✅ **Modular Systems**: Support for multi-component prompts
- ✅ **Core API**: TypeScript library for custom integrations
- ✅ **Persistence**: Resume interrupted runs, export best prompts
- ✅ **Strategy Bandit**: Adaptive strategy selection via UCB1

## 📖 Documentation

- **[CLI Documentation](CLI_DOCUMENTATION.md)** - Complete CLI reference and usage guide
- **[Module System Documentation](MODULE_DOCUMENTATION.md)** - Modular prompt optimization features
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to the project

## 🎯 Key Features

### Single-System Optimization
```json
{
  "system": "You are a helpful assistant. Be concise.",
  "prompts": [
    { "id": "p1", "user": "What are the benefits of unit testing?" }
  ]
}
```

### Modular System Optimization
```json
{
  "modules": [
    { "id": "personality", "prompt": "You are friendly and helpful." },
    { "id": "safety", "prompt": "Never provide harmful content." }
  ],
  "prompts": [
    { "id": "p1", "user": "What are the benefits of unit testing?" }
  ]
}
```

### Advanced Features
- **Round-robin mutation** for modular systems
- **Intelligent crossover** combining complementary modules
- **Trace-aware reflection** with execution context
- **Holdout gating** to prevent overfitting
- **Strategy bandit** for adaptive optimization

## 🔧 Installation

### Quick Start (Recommended)
```bash
# No installation needed - runs via npx
npx gepa-spo --help
```

### Local Development
```bash
# Clone and install
git clone https://github.com/BeMoreDifferent/GEPA-Prompt-Evolution.git
cd GEPA-Prompt-Evolution
pnpm install
pnpm build

# Run locally
node dist/cli.js --help
```

## 📋 Requirements

- **Node.js** >= 18
- **OpenAI API Key** (or compatible endpoint)
- **pnpm** (recommended) or npm

## 🛠️ Usage Examples

### Basic Optimization
```bash
npx gepa-spo \
  --runs-root ./my-runs \
  --input ./examples/input.prompts.json \
  --config ./examples/config.json \
  --log
```

### Modular System
```bash
npx gepa-spo \
  --runs-root ./modular-runs \
  --input ./examples/input.modules.json \
  --config ./examples/config.modular.json \
  --log
```

### Resume Interrupted Run
```bash
npx gepa-spo --resume ./my-runs/2024-01-15T10-30-45Z-demo-abc123
```

### Save Best Prompt
```bash
npx gepa-spo \
  --input ./input.json \
  --config ./config.json \
  --out ./best-prompt.txt
```

## ⚙️ Configuration

### Basic Config
```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 100,
  "minibatchSize": 4,
  "paretoSize": 8,
  "crossoverProb": 0.2
}
```

### Key Settings
- **`budget`**: Total LLM calls for optimization
- **`minibatchSize`**: Items evaluated per iteration
- **`paretoSize`**: Items for multi-objective tracking
- **`crossoverProb`**: Probability of crossover vs mutation [0,1]

See [CLI Documentation](CLI_DOCUMENTATION.md) for complete configuration options.

## 🔌 Programmatic API

```typescript
import { runGEPA_System } from 'gepa-spo/dist/gepa.js';
import { makeOpenAIClients } from 'gepa-spo/dist/llm_openai.js';

const { actorLLM } = makeOpenAIClients({
  apiKey: process.env.OPENAI_API_KEY!,
  actorModel: 'gpt-5-mini'
});

const best = await runGEPA_System(seed, taskItems, {
  execute: async ({ candidate, item }) => ({
    output: await actorLLM.complete(`${candidate.system}\n\nUser: ${item.user}`)
  }),
  mu: () => 0,
  muf: async ({ item, output }) => ({ score: 0.5, feedbackText: 'neutral' }),
  llm: actorLLM,
  budget: 50,
  minibatchSize: 3,
  paretoSize: 4
});

console.log(best.system);
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Type checking
pnpm typecheck

# Build
pnpm build

# End-to-end smoke test
pnpm build && node dist/cli.js \
  --runs-root ./runs-test/demo \
  --input ./examples/input.min.prompts.json \
  --config ./examples/config.min.json \
  --log
```

## 📁 Project Structure

```
GEPA-Prompt-Evolution/
├── src/                    # Core TypeScript source
├── tests/                  # Test suite
├── examples/               # Example configs and inputs
├── strategies/             # Strategy hints for optimization
├── CLI_DOCUMENTATION.md    # Complete CLI reference
├── MODULE_DOCUMENTATION.md # Modular system guide
└── CONTRIBUTING.md         # Contribution guidelines
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

**Quick start for contributors:**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm test` and `pnpm typecheck`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## 🔬 Research

GEPA (Genetic-Pareto) is a prompt optimization method that:
- Uses natural-language reflection on full system trajectories
- Maintains a Pareto frontier of high-performing candidates
- Achieves sample-efficient adaptation with up to 35× fewer rollouts
- Outperforms GRPO by ~10% on average and MIPROv2 by >10%

For detailed technical information, see the [AI instructions](ai/instructions.md).

## 🆘 Support

- **Documentation**: [CLI Guide](CLI_DOCUMENTATION.md) | [Module Guide](MODULE_DOCUMENTATION.md)
- **Issues**: [GitHub Issues](https://github.com/BeMoreDifferent/GEPA-Prompt-Evolution/issues)
- **Examples**: Check the `examples/` directory for working configurations

---

**Made with ❤️ for the AI community**