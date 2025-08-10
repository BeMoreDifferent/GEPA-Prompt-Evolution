# CLI Reference

Complete reference for the GEPA command-line interface.

## 📋 Command Overview

```bash
gepa-spo [options]
```

## 🚀 Basic Usage

```bash
# Basic optimization
gepa-spo --input input.json --config config.json

# With logging enabled
gepa-spo --input input.json --config config.json --log

# Resume interrupted run
gepa-spo --resume ./runs/2024-01-15T10-30-45Z-demo-abc123

# Save output to file
gepa-spo --input input.json --config config.json --out best-prompt.txt
```

## 📝 Command Options

### Required Options

| Option | Description | Example |
|--------|-------------|---------|
| `--input <file>` | Input JSON file with prompts and system/modules | `--input ./data/input.json` |
| `--config <file>` | Configuration JSON file | `--config ./config/optimization.json` |

### Optional Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `--runs-root <dir>` | Directory for run outputs | `runs` | `--runs-root ./my-runs` |
| `--resume <dir>` | Resume from a previous run directory | - | `--resume ./runs/previous-run` |
| `--out <file>` | Output file for best system prompt | - | `--out ./best-prompt.txt` |
| `--api-key <key>` | OpenAI API key (or set OPENAI_API_KEY env var) | - | `--api-key sk-...` |
| `--log` | Enable logging | `false` | `--log` |
| `--log-level <level>` | Log level: debug, info, warn, error | `info` | `--log-level debug` |
| `--help` | Show help information | - | `--help` |

## 📊 Logging Levels

### Silent (Default)
```bash
gepa-spo --input input.json --config config.json
# No output except final prompt
```

### Info Level
```bash
gepa-spo --input input.json --config config.json --log
# Shows progress steps and final statistics
```

### Debug Level
```bash
gepa-spo --input input.json --config config.json --log --log-level debug
# Shows detailed debugging information
```

## 📁 Input File Format

### Single System Format

```json
{
  "system": "You are a helpful assistant. Be concise and accurate.",
  "prompts": [
    {
      "id": "math-1",
      "user": "What is 2 + 2?",
      "meta": { "category": "math", "difficulty": "easy" }
    },
    {
      "id": "fact-1", 
      "user": "What is the capital of France?",
      "meta": { "category": "geography", "difficulty": "easy" }
    }
  ]
}
```

### Modular System Format

```json
{
  "modules": [
    {
      "id": "personality",
      "prompt": "You are friendly and helpful."
    },
    {
      "id": "safety",
      "prompt": "Never provide harmful content."
    },
    {
      "id": "instructions",
      "prompt": "Always provide accurate information."
    }
  ],
  "prompts": [
    {
      "id": "math-1",
      "user": "What is 2 + 2?",
      "meta": { "category": "math" }
    }
  ]
}
```

## ⚙️ Configuration Options

### Basic Configuration

```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 100,
  "minibatchSize": 4,
  "paretoSize": 8,
  "holdoutSize": 2,
  "epsilonHoldout": 0.02,
  "crossoverProb": 0.2,
  "rubric": "Correctness, clarity, and conciseness."
}
```

### Advanced Configuration

```json
{
  "actorModel": "gpt-4",
  "judgeModel": "gpt-4",
  "actorTemperature": 0.4,
  "actorMaxTokens": 512,
  "budget": 200,
  "minibatchSize": 6,
  "paretoSize": 10,
  "holdoutSize": 4,
  "epsilonHoldout": 0.01,
  "crossoverProb": 0.3,
  "rubric": "Correctness, clarity, conciseness, and safety.",
  "strategiesPath": "strategies/custom-strategies.json",
  "scoreForPareto": "muf",
  "mufCosts": true,
  "baseURL": "https://api.openai.com/v1",
  "requestTimeoutMs": 30000
}
```

### Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `actorModel` | string | `gpt-5-mini` | OpenAI model for execution |
| `judgeModel` | string | `gpt-5-mini` | OpenAI model for evaluation |
| `actorTemperature` | number | `0.4` | Temperature for execution model |
| `actorMaxTokens` | number | `512` | Max tokens for execution |
| `budget` | number | `50+` | Total LLM calls allowed |
| `minibatchSize` | number | `4` | Feedback batch size |
| `paretoSize` | number | `2+` | Pareto evaluation size |
| `holdoutSize` | number | `0` | Holdout evaluation size |
| `epsilonHoldout` | number | `0.02` | Holdout improvement threshold |
| `crossoverProb` | number | `0` | Probability of crossover vs mutation |
| `rubric` | string | `"Correctness, coverage, safety, brevity."` | Evaluation criteria |
| `strategiesPath` | string | `strategies/strategies.json` | Path to strategies file |
| `scoreForPareto` | string | `"muf"` | Scoring method: "mu" or "muf" |
| `mufCosts` | boolean | `true` | Whether judge calls count toward budget |
| `baseURL` | string | - | Custom API base URL |
| `requestTimeoutMs` | number | - | Request timeout in milliseconds |

## 📊 Output and Logging

### Console Output

When `--log` is enabled, you'll see:

```
🔍 Evaluating initial system performance...
📊 Initial Performance: 0.523 (average over 5 Pareto items)

📈 Iteration 1: Score=0.567 (+8.4%) | Accepted=true | Operation=mutation | Budget=85/100
📈 Iteration 2: Score=0.589 (+12.6%) | Accepted=true | Operation=crossover | Budget=70/100
...

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

[Optimized system prompt output]
```

### File Output

GEPA creates a run directory with:

```
runs/2024-01-15T10-30-45Z-demo-abc123/
├── best.json              # Best performing prompt
├── statistics.json        # Detailed performance statistics
├── config.json           # Configuration used
├── input.json            # Input data
├── state.json            # Optimization state (for resuming)
├── iterations/           # Per-iteration data
│   ├── 1.json
│   ├── 2.json
│   └── ...
└── .lock                 # Lock file (prevents concurrent runs)
```

## 🔄 Resuming Runs

### Resume from Directory

```bash
gepa-spo --resume ./runs/2024-01-15T10-30-45Z-demo-abc123
```

### Resume with New Configuration

```bash
gepa-spo --resume ./runs/previous-run --config new-config.json
```

### Resume with Additional Budget

```bash
# Edit config.json to increase budget, then resume
gepa-spo --resume ./runs/previous-run
```

## 🚀 Usage Examples

### Basic Optimization

```bash
# Set API key
export OPENAI_API_KEY="your-api-key"

# Run optimization
gepa-spo \
  --input ./examples/input.prompts.json \
  --config ./examples/config.json \
  --log
```

### Modular System

```bash
gepa-spo \
  --input ./examples/input.modules.json \
  --config ./examples/config.modular.json \
  --log \
  --log-level debug
```

### Custom Run Directory

```bash
gepa-spo \
  --runs-root ./my-optimization-runs \
  --input ./data/input.json \
  --config ./config/optimization.json \
  --log
```

### Save Best Prompt

```bash
gepa-spo \
  --input ./input.json \
  --config ./config.json \
  --out ./best-prompt.txt \
  --log
```

### Resume Interrupted Run

```bash
gepa-spo --resume ./runs/2024-01-15T10-30-45Z-demo-abc123
```

### Debug Mode

```bash
gepa-spo \
  --input ./input.json \
  --config ./config.json \
  --log \
  --log-level debug
```

## 🆘 Troubleshooting

### Common Issues

**API Key Error**
```bash
Error: OpenAI API key required. Set --api-key or OPENAI_API_KEY environment variable.
```
**Solution**: Set your API key:
```bash
export OPENAI_API_KEY="your-api-key"
```

**Budget Too Small**
```bash
Error: Budget must be at least 10 (got: 5). Recommended: 50-200 for meaningful optimization.
```
**Solution**: Increase budget in config.json:
```json
{
  "budget": 100
}
```

**Data Split Impossible**
```bash
Error: Data split impossible: paretoSize=8 + holdoutSize=4 >= total prompts=10
```
**Solution**: Reduce paretoSize or holdoutSize, or add more prompts.

**Lock File Exists**
```bash
Error: Lock exists at ./runs/run-dir. Another process running?
```
**Solution**: Wait for other process to finish, or manually remove `.lock` file if safe.

### Getting Help

```bash
# Show help
gepa-spo --help

# Show version
gepa-spo --version
```

For more help, see [Troubleshooting Guide](../reference/troubleshooting.md).

---

**Ready to optimize? Check out the [Quick Start Guide](../getting-started/quick-start.md) to get started!**
