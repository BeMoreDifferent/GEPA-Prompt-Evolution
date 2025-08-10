# GEPA CLI Documentation

## Overview

The GEPA (Genetic-Pareto) CLI is a command-line interface for optimizing system prompts using evolutionary algorithms. It supports both single-system prompts and modular multi-component systems, with features for persistence, resumption, and comprehensive logging.

## Installation

### Quick Start (No Installation Required)

```bash
# Using npx (Node.js 18+ required)
npx gepa-spo --runs-root ./runs \
  --input /path/to/input.json \
  --config /path/to/config.json

# Using pnpm
pnpm dlx gepa-spo --runs-root ./runs \
  --input /path/to/input.json \
  --config /path/to/config.json
```

### Local Installation

```bash
# Install globally
pnpm add -g gepa-spo

# Or install locally for development
pnpm install && pnpm build
```

## Environment Setup

### Required Environment Variables

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"
```

### Optional Environment Variables

```bash
# Custom base URL for OpenAI-compatible endpoints
export OPENAI_BASE_URL="https://your-custom-endpoint.com/v1"
```

## Command Line Options

### Core Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `--input` | string | Yes* | Path to input JSON file with prompts and system/modules |
| `--config` | string | Yes* | Path to configuration JSON file |
| `--runs-root` | string | No | Root directory for run outputs (default: `runs`) |
| `--resume` | string | No | Resume from existing run directory |

*Required unless using `--resume`

### Output Options

| Option | Type | Description |
|--------|------|-------------|
| `--out` | string | Write best prompt to specific file |
| `--log` | boolean | Enable progress logging (default: false) |
| `--log-level` | string | Log level: `error`, `warn`, `info`, `debug` (default: `info`) |

### API Configuration

| Option | Type | Description |
|--------|------|-------------|
| `--api-key` | string | OpenAI API key (overrides `OPENAI_API_KEY` env var) |

## Input File Formats

### Single System Prompt Format

```json
{
  "system": "You are a helpful assistant. Be concise and accurate.",
  "prompts": [
    {
      "id": "p1",
      "user": "What are the benefits of unit testing?",
      "meta": { "category": "software", "difficulty": "beginner" }
    },
    {
      "id": "p2", 
      "user": "Explain the concept of recursion with an example"
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
      "prompt": "You are a friendly and helpful assistant."
    },
    {
      "id": "instructions",
      "prompt": "Always provide accurate and well-structured answers."
    },
    {
      "id": "safety",
      "prompt": "Never provide harmful or dangerous information."
    }
  ],
  "prompts": [
    {
      "id": "p1",
      "user": "What are the benefits of unit testing?",
      "meta": { "category": "software" }
    }
  ]
}
```

### Input File Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `system` | string | No* | Single system prompt |
| `modules` | array | No* | Array of module objects |
| `prompts` | array | Yes | Array of task items |

*Either `system` or `modules` must be provided

#### Module Object Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique module identifier |
| `prompt` | string | Yes | Module system prompt |

#### Task Item Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique task identifier |
| `user` | string | Yes | User prompt text |
| `meta` | object | No | Optional metadata for metrics |

## Configuration File

### Basic Configuration

```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 100,
  "minibatchSize": 4,
  "paretoSize": 8,
  "holdoutSize": 6,
  "epsilonHoldout": 0.02,
  "actorTemperature": 0.4,
  "actorMaxTokens": 512,
  "rubric": "Correctness, coverage, safety, brevity.",
  "strategiesPath": "strategies/strategies.json",
  "scoreForPareto": "muf",
  "mufCosts": true,
  "crossoverProb": 0.1
}
```

### Configuration Schema

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `actorModel` | string | LLM model for prompt evolution (e.g., `gpt-5-mini`) |
| `judgeModel` | string | LLM model for evaluation (e.g., `gpt-5-mini`) |
| `budget` | number | Total evaluation budget (LLM calls) |
| `minibatchSize` | number | Items evaluated per iteration |
| `paretoSize` | number | Items in Pareto set for multi-objective tracking |

#### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `holdoutSize` | number | 0 | Size of holdout set for regression gating |
| `epsilonHoldout` | number | 0.02 | Tolerance for holdout comparison |
| `actorTemperature` | number | 0.4 | Temperature for actor LLM calls |
| `actorMaxTokens` | number | 512 | Max tokens for actor calls |
| `rubric` | string | "Correctness, coverage, safety, brevity." | Judge evaluation rubric |
| `strategiesPath` | string | "strategies/strategies.json" | Path to strategy hints file |
| `baseURL` | string | OpenAI default | Custom API base URL |
| `requestTimeoutMs` | number | 30000 | Request timeout in milliseconds |
| `scoreForPareto` | string | "muf" | Scorer for Pareto matrix: "muf" or "mu" |
| `mufCosts` | boolean | true | Whether judge calls consume budget |
| `crossoverProb` | number | 0 | Probability of crossover vs mutation [0,1] |

## Usage Examples

### Basic Optimization

```bash
# Simple optimization run
npx gepa-spo \
  --runs-root ./my-runs \
  --input ./examples/input.prompts.json \
  --config ./examples/config.json \
  --log
```

### With Custom Output

```bash
# Save best prompt to specific file
npx gepa-spo \
  --runs-root ./my-runs \
  --input ./examples/input.prompts.json \
  --config ./examples/config.json \
  --out ./best-prompt.txt \
  --log --log-level debug
```

### Resume Interrupted Run

```bash
# Resume from existing run directory
npx gepa-spo \
  --resume ./my-runs/2024-01-15T10-30-45Z-demo-abc123 \
  --log
```

### Modular System Optimization

```bash
# Optimize modular system
npx gepa-spo \
  --runs-root ./modular-runs \
  --input ./examples/input.modules.json \
  --config ./examples/config.modular.json \
  --log --log-level info
```

### Custom API Configuration

```bash
# Use custom API key and endpoint
npx gepa-spo \
  --runs-root ./runs \
  --input ./input.json \
  --config ./config.json \
  --api-key "your-custom-key" \
  --log
```

## Output and Persistence

### Run Directory Structure

Each run creates a directory under `--runs-root` with the following structure:

```
<runs-root>/<ISO8601>-<slug>-<sha16>/
├── input.json            # Copied input file
├── config.json           # Copied config file
├── state.json            # Optimizer state (for resume)
├── best.json             # Latest best prompt and metadata
├── .outpath              # Optional output path
└── iterations/           # Iteration history
    ├── iter-0001.json
    ├── iter-0002.json
    └── ...
```

### Output Files

#### `best.json`
```json
{
  "system": "Optimized system prompt...",
  "bestIdx": 3,
  "iter": 15
}
```

#### `state.json`
Contains the complete optimizer state for resumption:
- Candidate pool
- Score matrix
- Budget tracking
- Bandit state
- Module indices (for modular systems)

#### `iterations/iter-XXXX.json`
Detailed information for each iteration:
- Parent selection
- Mutation/crossover details
- Scores and feedback
- Strategy usage

### Console Output

- **Progress**: High-level progress updates (when `--log` is enabled)
- **Final Result**: Best optimized prompt printed to stdout
- **Errors**: Detailed error messages for debugging

## Error Handling

### Common Error Scenarios

1. **Missing API Key**
   ```
   Error: Missing OpenAI API key. Set OPENAI_API_KEY environment variable or use --api-key
   ```

2. **Invalid Input Format**
   ```
   Error: Input must contain either "system" or "modules"
   ```

3. **Budget Exhaustion**
   ```
   Info: Budget exhausted. Optimization complete.
   ```

4. **Concurrent Run Prevention**
   ```
   Error: Run directory is locked by another process
   ```

### Recovery Strategies

- **Resume**: Use `--resume` to continue interrupted runs
- **Lock Recovery**: Delete `.lock` file if process was killed
- **Budget Adjustment**: Increase `budget` in config for longer runs

## Performance Considerations

### Budget Planning

- **Minibatch Evaluation**: Each iteration uses `minibatchSize` LLM calls
- **Pareto Evaluation**: Accepted candidates are evaluated on `paretoSize` items
- **Judge Calls**: Each evaluation includes judge scoring (if `mufCosts: true`)
- **Total Budget**: `budget` should account for all LLM calls

### Recommended Settings

| Dataset Size | Budget | Minibatch | Pareto | Holdout |
|--------------|--------|-----------|--------|---------|
| Small (<10) | 50-100 | 2-3 | 4-6 | 2-3 |
| Medium (10-50) | 100-200 | 3-4 | 6-8 | 3-4 |
| Large (>50) | 200+ | 4-6 | 8-12 | 4-6 |

### Optimization Tips

1. **Start Small**: Use small budgets for initial testing
2. **Monitor Progress**: Enable logging to track optimization
3. **Resume Capability**: Use resume for long-running optimizations
4. **Modular Systems**: Consider module count when setting budget

## Security and Privacy

### Data Handling

- **No Logging**: Prompts and outputs are not logged unless `--log` is enabled
- **Local Storage**: All data is stored locally in run directories
- **API Keys**: Never logged or stored in files

### Best Practices

- Avoid placing secrets in input/config files
- Use environment variables for API keys
- Review run directories before sharing
- Delete sensitive run data when no longer needed

## Troubleshooting

### Common Issues

1. **Node.js Version**: Ensure Node.js 18+ is installed
2. **API Limits**: Check OpenAI rate limits and quotas
3. **Memory Usage**: Large datasets may require more memory
4. **Network Issues**: Check internet connectivity for API calls

### Debug Mode

```bash
# Enable detailed logging
npx gepa-spo \
  --input ./input.json \
  --config ./config.json \
  --log --log-level debug
```

### Validation

```bash
# Validate input format
node -e "console.log(JSON.parse(require('fs').readFileSync('./input.json')))"

# Validate config format  
node -e "console.log(JSON.parse(require('fs').readFileSync('./config.json')))"
```

## Integration Examples

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Optimize Prompts
  run: |
    npx gepa-spo \
      --runs-root ./runs \
      --input ./prompts/input.json \
      --config ./prompts/config.json \
      --out ./optimized-prompt.txt
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Script Integration

```bash
#!/bin/bash
# Optimize and use result
npx gepa-spo \
  --runs-root ./runs \
  --input ./input.json \
  --config ./config.json \
  --out ./best-prompt.txt

# Use optimized prompt
OPTIMIZED_PROMPT=$(cat ./best-prompt.txt)
echo "Using optimized prompt: $OPTIMIZED_PROMPT"
```

## Advanced Features

### Strategy Hints

Custom strategy hints can be provided via `strategiesPath`:

```json
[
  {
    "id": "polya-4step",
    "hint": "Apply Pólya's 4 steps: Understand, Plan, Execute, Reflect"
  },
  {
    "id": "fermi-estimate", 
    "hint": "Use Fermi estimation for unknown quantities"
  }
]
```

### Crossover Optimization

Enable genetic crossover for modular systems:

```json
{
  "crossoverProb": 0.3,
  "budget": 100,
  "minibatchSize": 4
}
```

### Holdout Gating

Prevent overfitting with holdout validation:

```json
{
  "holdoutSize": 6,
  "epsilonHoldout": 0.02
}
```

This documentation covers all CLI features and provides comprehensive guidance for using the GEPA prompt optimizer effectively.
