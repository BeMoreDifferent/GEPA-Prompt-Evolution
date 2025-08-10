# GEPA Prompt Evolution (GEPA-SPO)

[![npm version](https://img.shields.io/npm/v/gepa-spo.svg)](https://www.npmjs.com/package/gepa-spo)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

> **Genetic-Pareto prompt optimizer** to evolve system prompts from a few rollouts. GEPA performs natural-language reflection over full trajectories, mutates prompts with multiple strategies, and maintains a Pareto frontier rather than collapsing to a single candidate.

## 🚀 Quick Start

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Run optimization with detailed logging
npx gepa-spo \
  --input ./examples/input.prompts.json \
  --config ./examples/config.json \
  --log
```

**What you get:**
- ✅ **CLI Tool**: Optimize prompts from JSON inputs with detailed statistics
- ✅ **Modular Systems**: Support for multi-component prompts with intelligent crossover
- ✅ **Core API**: TypeScript library for custom integrations
- ✅ **Persistence**: Resume interrupted runs, export best prompts
- ✅ **Strategy Bandit**: Adaptive strategy selection via UCB1
- ✅ **Enhanced Logging**: Comprehensive performance tracking and percentage improvements

## 📖 Documentation

📚 **[Complete Documentation](docs/README.md)** - Comprehensive guides and references

### 🚀 Getting Started
- **[Quick Start Guide](docs/getting-started/quick-start.md)** - Get up and running in minutes
- **[Basic Concepts](docs/getting-started/concepts.md)** - Understanding GEPA fundamentals

### 📖 User Guides
- **[CLI Reference](docs/user-guides/cli-reference.md)** - Complete command-line interface documentation
- **[Modular Systems](docs/user-guides/modular-systems.md)** - Multi-component prompt optimization
- **[Configuration Guide](docs/user-guides/configuration.md)** - All configuration options and settings

### 🔧 Developer Guides
- **[API Reference](docs/developer-guides/api-reference.md)** - Programmatic API documentation
- **[TypeScript Types](docs/developer-guides/types.md)** - Complete type definitions

### 🔬 Technical Documentation
- **[GEPA Algorithm](docs/technical/algorithm.md)** - Detailed algorithm explanation
- **[Research Background](docs/technical/research.md)** - Academic background and methodology

## 🎯 Key Features

### 📊 Enhanced Logging & Statistics
When `--log` is enabled, GEPA provides comprehensive performance tracking:

```
📊 PERFORMANCE STATISTICS
├─ Initial Score: 0.523
├─ Final Score: 0.789
├─ Absolute Improvement: 0.266
├─ Percentage Improvement: 50.9%
├─ Iterations Completed: 15
├─ Candidates Generated: 18
├─ Candidates Accepted: 12 (66.7%)
├─ Crossover Operations: 4 (22.2%)
├─ Mutation Operations: 8
├─ Strategy Switches: 2
├─ Budget Used: 85/100 (85.0%)
├─ Data Split: Pareto=5, Feedback=10, Holdout=2
└─ Efficiency: 0.0093 score per budget unit
```

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
- **Detailed performance tracking** with percentage improvements

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

### Basic Optimization with Logging
```bash
npx gepa-spo \
  --input ./examples/input.prompts.json \
  --config ./examples/config.json \
  --log
```

### Modular System with Debug Logging
```bash
npx gepa-spo \
  --input ./examples/input.modules.json \
  --config ./examples/config.modular.json \
  --log \
  --log-level debug
```

### Resume Interrupted Run
```bash
npx gepa-spo --resume ./runs/2024-01-15T10-30-45Z-demo-abc123
```

### Save Best Prompt
```bash
npx gepa-spo \
  --input ./input.json \
  --config ./config.json \
  --out ./best-prompt.txt \
  --log
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
  "crossoverProb": 0.2,
  "rubric": "Correctness, clarity, and conciseness."
}
```

### Key Settings
- **`budget`**: Total LLM calls for optimization (50-200 recommended)
- **`minibatchSize`**: Items evaluated per iteration (2-6)
- **`paretoSize`**: Items for multi-objective tracking (2-12)
- **`crossoverProb`**: Probability of crossover vs mutation [0,1]
- **`rubric`**: Evaluation criteria for optimization

See [Configuration Guide](docs/user-guides/configuration.md) for complete options.

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
├── docs/                   # 📚 Comprehensive documentation
│   ├── getting-started/    # New user guides
│   ├── user-guides/        # User documentation
│   ├── developer-guides/   # Developer documentation
│   ├── technical/          # Technical documentation
│   └── reference/          # Reference materials
├── CLI_DOCUMENTATION.md    # Legacy CLI reference
├── MODULE_DOCUMENTATION.md # Legacy module guide
└── CONTRIBUTING.md         # Contribution guidelines
```

## 🤝 Contributing

We welcome contributions! Please see [Contributing Guide](docs/reference/contributing.md) for details.

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

For detailed technical information, see the [AI instructions](ai/instructions.md) and [Technical Documentation](docs/technical/algorithm.md).

## 🆘 Support

- **Documentation**: [Complete Documentation](docs/README.md)
- **Issues**: [GitHub Issues](https://github.com/BeMoreDifferent/GEPA-Prompt-Evolution/issues)
- **Examples**: Check the `examples/` directory for working configurations
- **FAQ**: [Frequently Asked Questions](docs/reference/faq.md)

---

**Made with ❤️ for the AI community**