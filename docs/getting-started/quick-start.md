# Quick Start Guide

Get up and running with GEPA in under 5 minutes! This guide will walk you through your first prompt optimization.

## 🚀 Prerequisites

- **Node.js** >= 18
- **OpenAI API Key** (or compatible endpoint)
- **Basic familiarity with JSON**

## 📋 Step 1: Set Up Your API Key

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Or on Windows
set OPENAI_API_KEY=your-api-key-here
```

## 📝 Step 2: Create Your Input File

Create a file called `input.json` with your system prompt and test cases:

```json
{
  "system": "You are a helpful assistant. Be concise and accurate.",
  "prompts": [
    {
      "id": "math-1",
      "user": "What is 2 + 2?"
    },
    {
      "id": "math-2", 
      "user": "What is 15 * 7?"
    },
    {
      "id": "fact-1",
      "user": "What is the capital of France?"
    },
    {
      "id": "fact-2",
      "user": "Who wrote Romeo and Juliet?"
    }
  ]
}
```

## ⚙️ Step 3: Create Your Configuration

Create a file called `config.json` with optimization settings:

```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 50,
  "minibatchSize": 2,
  "paretoSize": 2,
  "holdoutSize": 0,
  "rubric": "Correctness, clarity, and conciseness.",
  "crossoverProb": 0.1
}
```

## 🎯 Step 4: Run Optimization

```bash
# Run optimization with detailed logging
npx gepa-spo \
  --input input.json \
  --config config.json \
  --log
```

## 📊 Step 5: Review Results

GEPA will output detailed statistics and save the optimized prompt. You'll see output like:

```
🔍 Evaluating initial system performance...
📊 Initial Performance: 0.523 (average over 2 Pareto items)

📈 Iteration 1: Score=0.567 (+8.4%) | Accepted=true | Operation=mutation | Budget=45/50
📈 Iteration 2: Score=0.589 (+12.6%) | Accepted=true | Operation=crossover | Budget=40/50
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
├─ Budget Used: 45/50 (90.0%)
├─ Data Split: Pareto=2, Feedback=2, Holdout=0
└─ Efficiency: 0.0175 score per budget unit

You are an improved helpful assistant that provides accurate, concise answers...
```

## 🎉 What Just Happened?

1. **Initial Evaluation**: GEPA evaluated your original prompt on the Pareto set
2. **Optimization Loop**: GEPA ran 15 iterations, trying different prompt variations
3. **Strategy Selection**: Used various optimization strategies (mutation, crossover)
4. **Performance Tracking**: Monitored improvement across iterations
5. **Final Output**: Returned the best-performing prompt

## 🔧 Key Configuration Options

| Option | Description | Default | Recommended |
|--------|-------------|---------|-------------|
| `budget` | Total LLM calls allowed | 50+ | 50-200 for meaningful optimization |
| `minibatchSize` | Items evaluated per iteration | 4 | 2-4 for small datasets |
| `paretoSize` | Items for multi-objective tracking | 2+ | 2-8 depending on dataset size |
| `crossoverProb` | Probability of crossover vs mutation | 0 | 0.1-0.3 for modular systems |

## 📁 Output Files

GEPA creates a run directory with:
- `best.json` - Best performing prompt
- `statistics.json` - Detailed performance statistics
- `iterations/` - Per-iteration data
- `state.json` - Optimization state (for resuming)

## 🚀 Next Steps

- **Try Modular Systems**: See [Modular Systems Guide](../user-guides/modular-systems.md)
- **Advanced Configuration**: Read [Configuration Guide](../user-guides/configuration.md)
- **Programmatic API**: Check [API Reference](../developer-guides/api-reference.md)
- **Examples**: Explore the [Examples Directory](../examples/README.md)

## 🆘 Troubleshooting

**Common Issues:**
- **API Key Error**: Make sure `OPENAI_API_KEY` is set correctly
- **Budget Too Small**: Increase `budget` to at least 50 for meaningful optimization
- **No Improvement**: Try different `rubric` or increase `budget`

For more help, see [Troubleshooting Guide](../reference/troubleshooting.md).

---

**Ready to optimize your prompts? Let's go! 🚀**
